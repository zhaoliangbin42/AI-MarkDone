import type { ConversationDocumentRefV1, ConversationTurnV1 } from '../../../contracts/conversationContent';
import type { DiscoveryHostMonitorFactsV1 } from '../../../contracts/conversationDiscoveryDiagnostics';
import type { RenderedContentCompilerV2 as RenderedContentCompilerPortV2 } from '../../../contracts/conversationDiscoveryV2';
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
    collectChatGPTDomHostSlots,
    resolveChatGPTDomRoundProjectionIdentity,
    resolveChatGPTDomRoundHostSlotId,
    type ChatGPTDomRoundRef,
} from './domConversationDiscovery';
import type { ChatGPTHostObservationBatch, ChatGPTPageIndex } from './ChatGPTPageIndex';

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
 * Lightweight DOM capture coordinator backed by the shared ChatGPTPageIndex.
 *
 * The official action row is the readiness signal. Mutations only dirty IDs;
 * one page-level debounce scans the mounted rounds and compiles each eligible
 * body once. Missing readiness remains pending until another real host signal
 * or an explicit page-lifecycle scan arrives.
 */
export class ChatGPTConversationHostMonitor {
    private readonly compiler: RenderedContentCompilerPortV2 | null;
    private readonly parserCapability;
    private readonly elementTokens = new WeakMap<HTMLElement, string>();
    private readonly dirtyAssistantIds = new Set<string>();
    private readonly capturedAssistantIdsByDocumentKey = new Map<string, Set<string>>();
    private readonly compileRejectionCounts = new Map<string, number>();
    private unsubscribe: (() => void) | null = null;
    private settleTimer: ReturnType<typeof setTimeout> | null = null;
    private capturePromise: Promise<void> | null = null;
    private captureRequested = false;
    private documentFence = 0;
    private elementSequence = 0;
    private stableCaptureCount = 0;
    private globalDirty = false;
    private readonly flushWaiters = new Set<() => void>();
    private initialized = false;
    private disposed = false;
    private lastDocument: ConversationDocumentRefV1 | null = null;

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
        this.lastDocument = this.options.resolveDocument();
        this.unsubscribe = this.options.index.subscribeObservations((batch) => this.observe(batch));
        if (this.options.index.getSnapshot().length > 0) {
            this.globalDirty = true;
            this.scheduleCapture();
        }
    }

    notifyRouteChanged(captureCurrentSurface = false): void {
        if (this.disposed) return;
        const nextDocument = this.options.resolveDocument();
        if (nextDocument?.key !== this.lastDocument?.key) {
            this.documentFence += 1;
            this.dirtyAssistantIds.clear();
            this.globalDirty = captureCurrentSurface;
            if (this.settleTimer !== null) clearTimeout(this.settleTimer);
            this.settleTimer = null;
        } else if (captureCurrentSurface) {
            this.globalDirty = true;
        }
        this.lastDocument = nextDocument;
        this.options.repository.bindCurrentDocument();
        if (this.globalDirty || this.dirtyAssistantIds.size > 0) this.scheduleCapture();
    }

    notifyPageShow(): void {
        if (this.disposed) return;
        this.options.index.invalidate();
        this.options.repository.bindCurrentDocument();
        this.globalDirty = true;
        this.scheduleCapture();
    }

    async flushObserved(): Promise<void> {
        if (this.disposed) return;
        await Promise.resolve();
        while (!this.disposed && (this.settleTimer !== null || this.capturePromise !== null)) {
            await new Promise<void>((resolve) => this.flushWaiters.add(resolve));
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.initialized = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        this.settleTimer = null;
        this.documentFence += 1;
        this.captureRequested = false;
        this.dirtyAssistantIds.clear();
        this.capturedAssistantIdsByDocumentKey.clear();
        this.globalDirty = false;
        this.lastDocument = null;
        for (const resolve of this.flushWaiters) resolve();
        this.flushWaiters.clear();
    }

    private observe(batch: ChatGPTHostObservationBatch): void {
        if (this.disposed || batch.kinds.every((kind) => kind === 'surface')) return;
        this.options.repository.bindCurrentDocument();
        if (batch.surfaceRebased || batch.assistantMessageIds.length === 0) this.globalDirty = true;
        const forceKnownCapture = batch.kinds.includes('content')
            || batch.kinds.includes('identity')
            || (batch.kinds.includes('lifecycle') && !batch.kinds.includes('structure'));
        const completedIds = new Set(batch.generationCompletedAssistantMessageIds);
        for (const assistantMessageId of batch.assistantMessageIds) {
            const normalized = assistantMessageId.trim();
            if (
                normalized
                && (
                    forceKnownCapture
                    || completedIds.has(normalized)
                    || !this.wasCapturedForCurrentDocument(normalized)
                )
            ) {
                this.dirtyAssistantIds.add(normalized);
            }
        }
        this.scheduleCapture();
    }

    private scheduleCapture(): void {
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        const delay = Math.max(0, this.options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS);
        this.settleTimer = setTimeout(() => {
            this.settleTimer = null;
            void this.startCapture().finally(() => this.resolveFlushWaiters());
        }, delay);
    }

    private resolveFlushWaiters(): void {
        if (this.settleTimer !== null || this.capturePromise !== null) return;
        for (const resolve of this.flushWaiters) resolve();
        this.flushWaiters.clear();
    }

    private startCapture(): Promise<void> {
        if (this.capturePromise) {
            this.captureRequested = true;
            return this.capturePromise;
        }
        const promise = this.captureMountedRounds().finally(() => {
            if (this.capturePromise === promise) this.capturePromise = null;
            if (this.captureRequested && !this.disposed) {
                this.captureRequested = false;
                this.scheduleCapture();
            }
        });
        this.capturePromise = promise;
        return promise;
    }

    private async captureMountedRounds(): Promise<void> {
        if (this.disposed || !this.compiler || !this.parserCapability) return;
        this.stableCaptureCount += 1;
        const fence = this.documentFence;
        const revision = this.options.index.getObservationRevision();
        const documentKey = this.options.resolveDocument()?.key ?? null;
        const captureAll = this.globalDirty;
        const dirtyIds = new Set(this.dirtyAssistantIds);
        const hostSlots = collectChatGPTDomHostSlots(this.options.adapter);
        const observedHostSlotOrder = hostSlots.map((slot) => slot.id);
        const rounds = this.options.index.getSnapshot();
        const observations: ConversationHostTurnObservationV1[] = [];
        const successfulIds = new Set<string>();
        this.globalDirty = false;

        for (const round of rounds) {
            const identity = resolveChatGPTDomRoundProjectionIdentity(round);
            if (!identity) continue;
            const assistantMessageId = identity.assistantMessageId;
            const hostSlotId = resolveChatGPTDomRoundHostSlotId(round, hostSlots);
            if (!hostSlotId) continue;
            const shouldCapture = captureAll || dirtyIds.has(assistantMessageId);
            if (!shouldCapture) continue;

            const officialActionRow = this.options.adapter.getToolbarAnchorElement(round.assistantMessageEl);
            if (
                round.isStreaming
                || !officialActionRow?.isConnected
                || !round.assistantContentRootEl?.isConnected
                || !round.assistantContentRootEl.textContent?.trim()
            ) {
                this.dirtyAssistantIds.add(assistantMessageId);
                continue;
            }

            const observation = await this.compileRound(
                round,
                hostSlotId,
                revision,
            );
            if (
                this.disposed
                || fence !== this.documentFence
                || documentKey !== (this.options.resolveDocument()?.key ?? null)
                || revision !== this.options.index.getObservationRevision()
            ) {
                this.globalDirty = true;
                this.scheduleCapture();
                return;
            }
            if (!observation) {
                this.dirtyAssistantIds.add(assistantMessageId);
                continue;
            }
            observations.push(observation);
            successfulIds.add(assistantMessageId);
            // An assistant-only capture can later regain its virtualized user
            // prompt, so only complete turn pairs are safe to skip on remount.
            if (observation.turn.identity.userMessageId) {
                this.rememberCaptured(documentKey, assistantMessageId);
            }
        }

        if (observedHostSlotOrder.length > 0) {
            this.options.repository.ingestHostBatch(observations, observedHostSlotOrder);
        }
        for (const assistantMessageId of successfulIds) this.dirtyAssistantIds.delete(assistantMessageId);
    }

    private wasCapturedForCurrentDocument(assistantMessageId: string): boolean {
        const documentKey = this.options.resolveDocument()?.key;
        return Boolean(documentKey && this.capturedAssistantIdsByDocumentKey.get(documentKey)?.has(assistantMessageId));
    }

    private rememberCaptured(documentKey: string | null, assistantMessageId: string): void {
        if (!documentKey) return;
        let capturedIds = this.capturedAssistantIdsByDocumentKey.get(documentKey);
        if (!capturedIds) {
            capturedIds = new Set<string>();
            this.capturedAssistantIdsByDocumentKey.set(documentKey, capturedIds);
        }
        capturedIds.add(assistantMessageId);
    }

    private async compileRound(
        round: ChatGPTDomRoundRef,
        hostSlotId: string,
        captureRevision: number,
    ): Promise<ConversationHostTurnObservationV1 | null> {
        const identityParts = resolveChatGPTDomRoundProjectionIdentity(round);
        const assistantRoot = round.assistantContentRootEl;
        if (!identityParts || !assistantRoot?.isConnected) return null;
        const { turnId, userMessageId, assistantMessageId } = identityParts;

        const userContentRoot = resolveUserContentRoot(round);
        const compilerUserId = userMessageId ?? `chatgpt-user:${assistantMessageId}`;
        const identity = createIdentityV2(turnId, compilerUserId, assistantMessageId);
        if (!identity) return null;
        const result = await this.compiler!.compile({
            identity,
            userRootClone: userContentRoot.cloneNode(true) as HTMLElement,
            assistantRootClone: assistantRoot.cloneNode(true) as HTMLElement,
            userSurfaceToken: this.surfaceToken(userContentRoot, 'user', captureRevision),
            assistantSurfaceToken: this.surfaceToken(assistantRoot, 'assistant', captureRevision),
            parser: this.parserCapability!,
            policy: DEFAULT_RENDERED_CONTENT_POLICY_V2,
        });
        if (result.kind !== 'ready') {
            this.compileRejectionCounts.set(
                result.reason,
                (this.compileRejectionCounts.get(result.reason) ?? 0) + 1,
            );
            return null;
        }

        const turn: ConversationTurnV1 = Object.freeze({
            key: `${turnId}:${assistantMessageId}`,
            ordinal: round.assistantIndex + 1,
            identity: Object.freeze({ turnId, userMessageId, assistantMessageId }),
            userText: result.user.text,
            assistantMarkdown: result.assistant.markdown,
            assistantProvenance: Object.freeze({
                authority: 'host-rendered' as const,
                fidelity: 'normalized' as const,
                producer: 'chatgpt-dom-fallback',
            }),
        });
        return Object.freeze({
            turn,
            hostSlotId,
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

    readDiagnosticsFacts(): DiscoveryHostMonitorFactsV1 {
        return {
            stableCaptureCount: this.stableCaptureCount,
            dirtyAssistantCount: this.dirtyAssistantIds.size,
            compileRejections: Object.freeze(Object.fromEntries(this.compileRejectionCounts)),
        };
    }
}

function resolveUserContentRoot(round: ChatGPTDomRoundRef): HTMLElement {
    if (round.source === 'assistant-only' || !round.userMessageEl.isConnected) {
        return document.createElement('div');
    }
    const prompt = round.userMessageEl.querySelector('.whitespace-pre-wrap');
    return prompt instanceof HTMLElement ? prompt : round.userMessageEl;
}
