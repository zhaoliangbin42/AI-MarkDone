import type { ConversationDocumentRefV1, ConversationTurnV1 } from '../../../contracts/conversationContent';
import type { SiteAdapter } from '../adapters/base';
import type {
    ConversationContentRepository,
    ConversationHostTurnObservationV1,
} from '../../../services/content/ConversationContentRepository';
import {
    DEFAULT_RENDERED_CONTENT_POLICY_V2,
    RenderedContentCompilerV2,
    createIdentityV2,
    createRenderedParserCapabilityV2,
} from '../../../services/content/RenderedContentCompilerV2';
import {
    resolveChatGPTDomRoundIdentity,
    type ChatGPTDomRoundRef,
} from './domConversationDiscovery';
import type { ChatGPTHostObservationBatch, ChatGPTPageIndex } from './ChatGPTPageIndex';
import type { RenderedContentCompilerV2 as RenderedContentCompilerPortV2 } from '../../../contracts/conversationDiscoveryV2';

export type ChatGPTConversationHostMonitorOptions = Readonly<{
    adapter: SiteAdapter;
    index: ChatGPTPageIndex;
    repository: ConversationContentRepository;
    resolveDocument: () => ConversationDocumentRefV1 | null;
    settleDelayMs?: number;
    compiler?: RenderedContentCompilerPortV2;
}>;

const DEFAULT_SETTLE_DELAY_MS = 400;

/**
 * ChatGPT host port backed by the shared PageIndex observer.
 *
 * Mutation batches only dirty identities. Markdown compilation happens once
 * after the whole page has been quiet and only for typed, completed turns.
 */
export class ChatGPTConversationHostMonitor {
    private readonly compiler: RenderedContentCompilerPortV2 | null;
    private readonly parserCapability;
    private readonly elementTokens = new WeakMap<HTMLElement, string>();
    private readonly dirtyAssistantIds = new Set<string>();
    private unsubscribe: (() => void) | null = null;
    private settleTimer: ReturnType<typeof setTimeout> | null = null;
    private captureInFlight = false;
    private captureRequested = false;
    private elementSequence = 0;
    private captureSequence = 0;
    private globalDirty = false;
    private emptyProven = false;
    private birthFactsObserved = false;
    private birthRouteObserved = false;
    private initialized = false;
    private disposed = false;
    private lastDocumentKey: string | null = null;

    constructor(private readonly options: ChatGPTConversationHostMonitorOptions) {
        const parserAdapter = options.adapter.getMarkdownParserAdapter();
        this.compiler = options.compiler ?? (parserAdapter
            ? new RenderedContentCompilerV2({
                markdownParserAdapter: parserAdapter,
                normalizeDOM: (root) => options.adapter.normalizeDOM(root),
                isNoiseNode: (node, context) => options.adapter.isNoiseNode(node, context),
                getArtifactPlaceholder: (node) => options.adapter.getArtifactPlaceholder(node),
                cleanMarkdown: (markdown) => options.adapter.cleanMarkdown(markdown),
            })
            : null);
        this.parserCapability = parserAdapter ? createRenderedParserCapabilityV2(parserAdapter) : null;
    }

    init(): void {
        if (this.initialized || this.disposed || this.options.adapter.getPlatformId() !== 'chatgpt') return;
        this.initialized = true;
        const rounds = this.options.index.getSnapshot();
        const document = this.options.resolveDocument();
        this.lastDocumentKey = document?.key ?? null;
        this.birthRouteObserved = document === null && isTemporaryBirthRoute(window.location.href);
        this.emptyProven = document === null && rounds.length === 0 && countTypedMessages() === 0;
        this.unsubscribe = this.options.index.subscribeObservations((batch) => this.observe(batch));
    }

    notifyRouteChanged(): void {
        if (this.disposed) return;
        const nextDocumentKey = this.options.resolveDocument()?.key ?? null;
        const birthFactsAlreadyVisible = this.lastDocumentKey === null
            && this.emptyProven
            && this.birthRouteObserved
            && (this.birthFactsObserved || countTypedMessages() > 0);
        if (
            nextDocumentKey !== null
            && nextDocumentKey !== this.lastDocumentKey
        ) {
            this.dirtyAssistantIds.clear();
            this.globalDirty = true;
            // A canonical route reached directly from an empty home page is
            // an existing conversation unless real host facts were observed
            // before route binding. The latter is the blank-page birth path.
            if (!birthFactsAlreadyVisible) this.emptyProven = false;
            this.birthFactsObserved = false;
            this.birthRouteObserved = false;
        }
        if (nextDocumentKey === null) {
            const temporaryBirthRoute = isTemporaryBirthRoute(window.location.href);
            if (temporaryBirthRoute) {
                this.birthRouteObserved = true;
            } else if (
                this.options.index.getSnapshot().length === 0
                && countTypedMessages() === 0
            ) {
                this.birthRouteObserved = false;
            }
        }
        this.lastDocumentKey = nextDocumentKey;
        if (
            nextDocumentKey === null
            && this.options.index.getSnapshot().length === 0
            && countTypedMessages() === 0
        ) {
            this.emptyProven = true;
            this.birthFactsObserved = false;
        }
        this.options.repository.bindCurrentDocument();
        if (this.dirtyAssistantIds.size > 0 || this.globalDirty) this.scheduleStableCapture();
    }

    notifyPageShow(): void {
        if (this.disposed) return;
        this.options.index.invalidate();
        this.globalDirty = true;
        this.scheduleStableCapture();
    }

    dispose(): void {
        this.disposed = true;
        this.initialized = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        this.settleTimer = null;
        this.captureRequested = false;
        this.dirtyAssistantIds.clear();
        this.lastDocumentKey = null;
        this.birthFactsObserved = false;
        this.birthRouteObserved = false;
    }

    private observe(batch: ChatGPTHostObservationBatch): void {
        if (this.disposed) return;
        // A typed host mutation may be the first signal after `/c/WEB:*`
        // becomes canonical. Bind identity now so Materialization can publish
        // the pending toolbar before stable content compilation completes.
        this.options.repository.bindCurrentDocument();
        if (
            batch.kinds.includes('structure')
            && this.options.resolveDocument() === null
            && this.options.index.getSnapshot().length === 0
            && countTypedMessages() === 0
        ) {
            this.emptyProven = true;
        }
        if (
            this.options.resolveDocument() === null
            && this.emptyProven
            && this.options.index.getSnapshot().length > 0
        ) {
            this.birthFactsObserved = true;
        }
        if (batch.assistantMessageIds.length === 0) this.globalDirty = true;
        for (const id of batch.assistantMessageIds) {
            const normalized = id.trim();
            if (normalized) this.dirtyAssistantIds.add(normalized);
        }
        this.scheduleStableCapture();
    }

    private scheduleStableCapture(): void {
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        const delay = Math.max(0, this.options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS);
        this.settleTimer = setTimeout(() => {
            this.settleTimer = null;
            void this.captureStableTail();
        }, delay);
    }

    private async captureStableTail(): Promise<void> {
        if (this.disposed || !this.compiler || !this.parserCapability) return;
        if (this.captureInFlight) {
            this.captureRequested = true;
            return;
        }
        this.captureInFlight = true;
        try {
            const captureRevision = this.options.index.getObservationRevision();
            const rounds = this.options.index.getSnapshot();
            const dirtyIds = new Set(this.dirtyAssistantIds);
            const captureAll = this.globalDirty;
            this.dirtyAssistantIds.clear();
            this.globalDirty = false;

            for (let index = 0; index < rounds.length; index += 1) {
                const round = rounds[index]!;
                const assistantMessageId = round.identity.assistantMessageId?.trim() ?? '';
                if (!assistantMessageId) continue;
                const knownTurn = this.options.repository.read().snapshot?.turns.some((turn) => (
                    turn.identity.assistantMessageId === assistantMessageId
                ));
                if (knownTurn) {
                    // Baseline-cache bodies are already authoritative. A
                    // mounted copy only changes materialization, never content.
                    this.dirtyAssistantIds.delete(assistantMessageId);
                    continue;
                }
                if (!captureAll && !dirtyIds.has(assistantMessageId)) continue;
                const observation = await this.compileRound(round, rounds[index - 1] ?? null, captureRevision);
                if (!observation) {
                    // A transient host shell, streaming turn, or compiler
                    // rejection is local to this message. Keep it dirty so a
                    // later structure/completion signal can retry it.
                    this.dirtyAssistantIds.add(assistantMessageId);
                    continue;
                }
                if (this.options.index.getObservationRevision() !== captureRevision) {
                    this.dirtyAssistantIds.add(assistantMessageId);
                    this.scheduleStableCapture();
                    continue;
                }
                this.options.repository.ingestHostTurn(observation);
                if (this.options.repository.read().snapshot?.turns.some((turn) => (
                    turn.identity.assistantMessageId === assistantMessageId
                ))) {
                    this.dirtyAssistantIds.delete(assistantMessageId);
                } else {
                    // Keep a deferred observation alive. A later virtualization
                    // or structure signal can make its predecessor available.
                    this.dirtyAssistantIds.add(assistantMessageId);
                }
            }
        } finally {
            this.captureInFlight = false;
            if (this.captureRequested && !this.disposed) {
                this.captureRequested = false;
                this.scheduleStableCapture();
            }
        }
    }

    private async compileRound(
        round: ChatGPTDomRoundRef,
        predecessor: ChatGPTDomRoundRef | null,
        captureRevision: number,
    ): Promise<ConversationHostTurnObservationV1 | null> {
        if (round.isStreaming) return null;
        const identityParts = resolveChatGPTDomRoundIdentity(round);
        if (!identityParts) return null;
        const { turnId, userMessageId, assistantMessageId } = identityParts;
        if (!round.userMessageEl.isConnected || !round.assistantMessageEl.isConnected) return null;
        if (!round.assistantContentRootEl?.isConnected) return null;
        if (!this.options.adapter.getToolbarAnchorElement(round.assistantMessageEl)?.isConnected) return null;

        const userContentRoot = resolveUserContentRoot(round);
        const identity = createIdentityV2(turnId, userMessageId, assistantMessageId);
        if (!identity) return null;
        const userSurfaceToken = this.surfaceToken(userContentRoot, 'user', captureRevision);
        const assistantSurfaceToken = this.surfaceToken(round.assistantContentRootEl, 'assistant', captureRevision);
        const result = await this.compiler!.compile({
            identity,
            userRootClone: userContentRoot.cloneNode(true) as HTMLElement,
            assistantRootClone: round.assistantContentRootEl.cloneNode(true) as HTMLElement,
            userSurfaceToken,
            assistantSurfaceToken,
            parser: this.parserCapability!,
            policy: DEFAULT_RENDERED_CONTENT_POLICY_V2,
        });
        if (result.kind !== 'ready') return null;

        const maintainedSnapshot = this.options.repository.read().snapshot;
        const maintainedTail = maintainedSnapshot?.turns[maintainedSnapshot.turns.length - 1];
        const predecessorAssistantMessageId = predecessor?.identity.assistantMessageId?.trim()
            || maintainedTail?.identity.assistantMessageId
            || null;
        const turn: ConversationTurnV1 = Object.freeze({
            key: `${turnId}:${assistantMessageId}`,
            ordinal: round.assistantIndex + 1,
            identity: Object.freeze({ turnId, userMessageId, assistantMessageId }),
            userText: result.user.text,
            assistantMarkdown: result.assistant.markdown,
            assistantProvenance: Object.freeze({
                authority: 'host-rendered' as const,
                fidelity: 'normalized' as const,
                producer: 'rendered-content-v2',
            }),
        });
        return Object.freeze({
            turn,
            semanticDigest: result.semanticDigest,
            captureId: `chatgpt-host:${assistantMessageId}:${++this.captureSequence}`,
            revision: captureRevision,
            predecessorAssistantMessageId,
            emptyProven: this.emptyProven,
        });
    }

    private surfaceToken(root: HTMLElement, role: 'user' | 'assistant', revision: number): string {
        let token = this.elementTokens.get(root);
        if (!token) {
            token = `chatgpt-surface:${role}:${++this.elementSequence}`;
            this.elementTokens.set(root, token);
        }
        return `${token}:revision:${revision}`;
    }
}

function resolveUserContentRoot(round: ChatGPTDomRoundRef): HTMLElement {
    const prompt = round.userMessageEl.querySelector('.whitespace-pre-wrap');
    return prompt instanceof HTMLElement ? prompt : round.userMessageEl;
}

function countTypedMessages(): number {
    return document.querySelectorAll([
        '[data-message-author-role="user"]',
        '[data-message-author-role="assistant"]',
    ].join(',')).length;
}

function isTemporaryBirthRoute(url: string): boolean {
    try {
        return /(?:^|\/)(?:c|conversation)\/WEB:[^/]+/i.test(new URL(url, window.location.href).pathname);
    } catch {
        return /(?:^|\/)(?:c|conversation)\/WEB:[^/]+/i.test(url);
    }
}
