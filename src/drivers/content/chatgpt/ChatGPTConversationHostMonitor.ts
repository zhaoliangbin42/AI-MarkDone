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
const COMPATIBILITY_SETTLE_DELAY_MS = 1_600;

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
    private readonly generationAssistantIds = new Set<string>();
    private readonly tailReplacementAssistantIds = new Set<string>();
    private readonly completedGenerationAssistantIds = new Set<string>();
    private readonly weakCompletionReadyAt = new Map<string, number>();
    private unsubscribe: (() => void) | null = null;
    private settleTimer: ReturnType<typeof setTimeout> | null = null;
    private capturePromise: Promise<void> | null = null;
    private activeCaptureRunId: number | null = null;
    private captureRequested = false;
    private captureRunSequence = 0;
    private documentFence = 0;
    private elementSequence = 0;
    private captureSequence = 0;
    private globalDirty = false;
    private initialized = false;
    private disposed = false;
    private lastDocument: ConversationDocumentRefV1 | null = null;
    private pageSurfaceCleared = false;

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
        this.lastDocument = document;
        if (rounds.length > 0) {
            this.globalDirty = true;
        }
        this.unsubscribe = this.options.index.subscribeObservations((batch) => this.observe(batch));
    }

    notifyRouteChanged(captureCurrentSurface = false): void {
        if (this.disposed) return;
        const nextDocument = this.options.resolveDocument();
        const changed = nextDocument?.key !== this.lastDocument?.key;
        const promotesPageIdentity = this.lastDocument?.identityKind === 'page'
            && nextDocument?.identityKind !== 'page'
            && nextDocument?.conversationId !== null;
        const bindsStagedPage = this.lastDocument === null && nextDocument !== null;
        if (changed && !bindsStagedPage && !promotesPageIdentity) {
            this.documentFence += 1;
            this.activeCaptureRunId = null;
            this.captureRequested = false;
            this.dirtyAssistantIds.clear();
            this.generationAssistantIds.clear();
            this.tailReplacementAssistantIds.clear();
            this.completedGenerationAssistantIds.clear();
            this.weakCompletionReadyAt.clear();
            this.globalDirty = false;
            this.pageSurfaceCleared = false;
            if (this.settleTimer !== null) clearTimeout(this.settleTimer);
            this.settleTimer = null;
        }
        if (captureCurrentSurface) this.globalDirty = true;
        this.lastDocument = nextDocument;
        if (nextDocument?.identityKind !== 'page') this.pageSurfaceCleared = false;
        this.options.repository.bindCurrentDocument();
        if (this.dirtyAssistantIds.size > 0 || this.globalDirty) this.scheduleStableCapture();
    }

    notifyPageShow(): void {
        if (this.disposed) return;
        this.options.index.invalidate();
        this.globalDirty = true;
        this.scheduleStableCapture();
    }

    /**
     * Flush only host work that PageIndex has already observed. This never
     * scans for a new baseline or retries a website response. One failed turn
     * remains dirty for the next related host signal instead of making refresh
     * spin until it succeeds.
     */
    async flushObserved(): Promise<void> {
        if (this.disposed) return;
        // Give a queued MutationObserver delivery a chance to publish its
        // typed batch before checking the local dirty set.
        await Promise.resolve();
        const activeCapture = this.capturePromise;
        if (activeCapture) await activeCapture;
        // A refresh is a local drain, not a completion signal. In particular,
        // it must not shorten the quiet window or compile a streaming DOM.
    }

    dispose(): void {
        this.disposed = true;
        this.initialized = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        this.settleTimer = null;
        this.documentFence += 1;
        this.activeCaptureRunId = null;
        this.captureRequested = false;
        this.dirtyAssistantIds.clear();
        this.generationAssistantIds.clear();
        this.tailReplacementAssistantIds.clear();
        this.completedGenerationAssistantIds.clear();
        this.weakCompletionReadyAt.clear();
        this.lastDocument = null;
        this.pageSurfaceCleared = false;
    }

    private observe(batch: ChatGPTHostObservationBatch): void {
        if (this.disposed) return;
        if (batch.kinds.every((kind) => kind === 'surface')) return;
        if (batch.surfaceRebased) {
            this.documentFence += 1;
            this.generationAssistantIds.clear();
            this.tailReplacementAssistantIds.clear();
            this.completedGenerationAssistantIds.clear();
            this.weakCompletionReadyAt.clear();
            this.pageSurfaceCleared = false;
            this.globalDirty = true;
        }
        // A typed host mutation may be the first signal after a canonical
        // conversation identity appears. Bind it before stable compilation so
        // Materialization and Content remain in the same page epoch.
        this.options.repository.bindCurrentDocument();
        const document = this.options.resolveDocument();
        const maintained = this.options.repository.read().snapshot?.turns ?? [];
        const topologyChanged = batch.kinds.some((kind) => kind !== 'content' && kind !== 'surface');
        if (topologyChanged) {
            const mountedIds = new Set(
                this.options.index.getSnapshot()
                    .map((round) => round.identity.assistantMessageId?.trim() ?? '')
                    .filter(Boolean),
            );
            if (
                !batch.surfaceRebased
                && document?.identityKind === 'page'
                && maintained.length > 0
                && mountedIds.size === 0
            ) {
                this.pageSurfaceCleared = true;
            }
        }
        if (batch.assistantMessageIds.length === 0) this.globalDirty = true;
        for (const id of batch.assistantMessageIds) {
            const normalized = id.trim();
            if (normalized) {
                this.dirtyAssistantIds.add(normalized);
                this.weakCompletionReadyAt.delete(normalized);
            }
        }
        for (const id of batch.generationStartedAssistantMessageIds ?? []) {
            const normalized = id.trim();
            if (normalized) this.generationAssistantIds.add(normalized);
        }
        for (const id of batch.generationCompletedAssistantMessageIds ?? []) {
            const normalized = id.trim();
            if (normalized) this.completedGenerationAssistantIds.add(normalized);
        }
        const maintainedTailId = maintained[maintained.length - 1]?.identity.assistantMessageId ?? null;
        for (const replacement of batch.assistantIdentityReplacements ?? []) {
            if (replacement.previousAssistantMessageId === maintainedTailId) {
                this.tailReplacementAssistantIds.add(replacement.nextAssistantMessageId);
            }
        }
        for (const id of batch.removedAssistantMessageIds ?? []) {
            const normalized = id.trim();
            if (normalized) this.weakCompletionReadyAt.delete(normalized);
        }
        this.scheduleStableCapture();
    }

    private scheduleStableCapture(delayOverrideMs?: number): void {
        if (this.settleTimer !== null) clearTimeout(this.settleTimer);
        const delay = Math.max(
            0,
            delayOverrideMs ?? this.options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS,
        );
        this.settleTimer = setTimeout(() => {
            this.settleTimer = null;
            void this.startStableCapture();
        }, delay);
    }

    private startStableCapture(): Promise<void> {
        if (this.capturePromise) {
            this.captureRequested = true;
            return this.capturePromise;
        }
        const promise = this.captureStableTail().finally(() => {
            if (this.capturePromise === promise) this.capturePromise = null;
        });
        this.capturePromise = promise;
        return promise;
    }

    private async captureStableTail(): Promise<void> {
        if (this.disposed || !this.compiler || !this.parserCapability) return;
        if (this.activeCaptureRunId !== null) {
            this.captureRequested = true;
            return;
        }
        const runId = ++this.captureRunSequence;
        const captureFence = this.documentFence;
        this.activeCaptureRunId = runId;
        try {
            const captureRevision = this.options.index.getObservationRevision();
            const rounds = this.options.index.getSnapshot();
            const captureContentToken = this.options.repository.read().snapshot?.contentToken ?? null;
            const documentAtCapture = this.options.resolveDocument();
            const dirtyIds = new Set(this.dirtyAssistantIds);
            const captureAll = this.globalDirty;
            const maintainedTurnsAtCapture = this.options.repository.read().snapshot?.turns ?? [];
            const maintainedTailId = maintainedTurnsAtCapture[maintainedTurnsAtCapture.length - 1]
                ?.identity.assistantMessageId ?? null;
            const maintainedTailIndexes = maintainedTailId
                ? rounds.flatMap((round, index) => (
                    round.identity.assistantMessageId?.trim() === maintainedTailId ? [index] : []
                ))
                : [];
            const mountedMaintainedTailIndex = maintainedTailIndexes.length === 1
                ? maintainedTailIndexes[0]!
                : -1;
            const observations: ConversationHostTurnObservationV1[] = [];
            let plannedPredecessorAssistantMessageId: string | null = maintainedTailId;
            let replaceCurrentPageConversation = false;
            let captureInvalidated = false;
            let compatibilityRetryDelay: number | null = null;
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
                    this.generationAssistantIds.delete(assistantMessageId);
                    this.tailReplacementAssistantIds.delete(assistantMessageId);
                    this.completedGenerationAssistantIds.delete(assistantMessageId);
                    this.weakCompletionReadyAt.delete(assistantMessageId);
                    continue;
                }
                if (
                    mountedMaintainedTailIndex >= 0
                    && index > mountedMaintainedTailIndex
                    && resolveChatGPTDomRoundIdentity(round) === null
                ) {
                    for (let pendingIndex = index; pendingIndex < rounds.length; pendingIndex += 1) {
                        const pendingId = rounds[pendingIndex]?.identity.assistantMessageId?.trim();
                        if (pendingId) this.dirtyAssistantIds.add(pendingId);
                    }
                    break;
                }
                if (!captureAll && !dirtyIds.has(assistantMessageId)) continue;
                const maintainedTurns = this.options.repository.read().snapshot?.turns ?? [];
                const hasTailAdmissionEvidence = this.generationAssistantIds.has(assistantMessageId)
                    || this.tailReplacementAssistantIds.has(assistantMessageId);
                if (
                    maintainedTurns.length > 0
                    && mountedMaintainedTailIndex >= 0
                    && index < mountedMaintainedTailIndex
                    && hasTailAdmissionEvidence
                ) {
                    // A uniquely mounted pool tail is the strongest local
                    // ordering fact. Generation evidence proves that this is
                    // live content, but cannot prove that a candidate rendered
                    // before the tail belongs after it. Preserve the dirty
                    // fact and wait for the host order to settle.
                    this.dirtyAssistantIds.add(assistantMessageId);
                    break;
                }
                const beginsNewPageProjection = Boolean(
                    this.pageSurfaceCleared
                    && documentAtCapture?.identityKind === 'page'
                    && this.generationAssistantIds.has(assistantMessageId),
                );
                if (beginsNewPageProjection && observations.length === 0) {
                    plannedPredecessorAssistantMessageId = null;
                    replaceCurrentPageConversation = true;
                }
                const followsMountedMaintainedTail = mountedMaintainedTailIndex >= 0
                    && index > mountedMaintainedTailIndex;
                if (
                    maintainedTurns.length > 0
                    && !hasTailAdmissionEvidence
                    && !followsMountedMaintainedTail
                ) {
                    // Unknown content hydrated into an existing virtual slot
                    // is not evidence of a new tail message.
                    this.dirtyAssistantIds.delete(assistantMessageId);
                    continue;
                }
                const hasOfficialCompletionAnchor = Boolean(
                    this.options.adapter.getToolbarAnchorElement(round.assistantMessageEl)?.isConnected,
                );
                const hasLaterTypedRound = rounds.slice(index + 1).some((candidate) => (
                    resolveChatGPTDomRoundIdentity(candidate) !== null
                ));
                const hasStrongCompletion = hasOfficialCompletionAnchor
                    || this.completedGenerationAssistantIds.has(assistantMessageId)
                    || hasLaterTypedRound;
                if (!hasStrongCompletion) {
                    const now = Date.now();
                    const readyAt = this.weakCompletionReadyAt.get(assistantMessageId);
                    if (readyAt === undefined) {
                        this.weakCompletionReadyAt.set(
                            assistantMessageId,
                            now + COMPATIBILITY_SETTLE_DELAY_MS,
                        );
                        compatibilityRetryDelay = COMPATIBILITY_SETTLE_DELAY_MS;
                    } else if (readyAt > now) {
                        compatibilityRetryDelay = Math.min(
                            compatibilityRetryDelay ?? Number.POSITIVE_INFINITY,
                            readyAt - now,
                        );
                    }
                    if (readyAt === undefined || readyAt > now) {
                        for (let pendingIndex = index; pendingIndex < rounds.length; pendingIndex += 1) {
                            const pendingId = rounds[pendingIndex]?.identity.assistantMessageId?.trim();
                            if (pendingId) this.dirtyAssistantIds.add(pendingId);
                        }
                        break;
                    }
                }
                this.weakCompletionReadyAt.delete(assistantMessageId);
                const observation = await this.compileRound(
                    round,
                    plannedPredecessorAssistantMessageId,
                    captureRevision,
                );
                if (this.documentFence !== captureFence || this.disposed) {
                    captureInvalidated = true;
                    break;
                }
                if ((this.options.repository.read().snapshot?.contentToken ?? null) !== captureContentToken) {
                    for (let pendingIndex = index; pendingIndex < rounds.length; pendingIndex += 1) {
                        const pendingId = rounds[pendingIndex]?.identity.assistantMessageId?.trim();
                        if (pendingId) this.dirtyAssistantIds.add(pendingId);
                    }
                    captureInvalidated = true;
                    this.scheduleStableCapture();
                    break;
                }
                if (!observation) {
                    // A transient host shell, streaming turn, or compiler
                    // rejection is local to this message. Keep it dirty so a
                    // later structure/completion signal can retry it. Do not
                    // cross the unresolved gap and compile a later round.
                    for (let pendingIndex = index; pendingIndex < rounds.length; pendingIndex += 1) {
                        const pendingId = rounds[pendingIndex]?.identity.assistantMessageId?.trim();
                        if (pendingId) this.dirtyAssistantIds.add(pendingId);
                    }
                    break;
                }
                if (this.options.index.getObservationRevision() !== captureRevision) {
                    this.dirtyAssistantIds.add(assistantMessageId);
                    captureInvalidated = true;
                    this.scheduleStableCapture();
                    break;
                }
                observations.push(observation);
                plannedPredecessorAssistantMessageId = assistantMessageId;
            }

            if (!captureInvalidated && this.documentFence === captureFence && observations.length > 0) {
                if (replaceCurrentPageConversation) {
                    this.options.repository.replaceCurrentPageConversationHostBatch(observations);
                } else {
                    this.options.repository.ingestHostBatch(observations);
                }
                for (const observation of observations) {
                    const assistantMessageId = observation.turn.identity.assistantMessageId;
                    if (this.options.repository.read().snapshot?.turns.some((turn) => (
                        turn.identity.assistantMessageId === assistantMessageId
                    ))) {
                        this.dirtyAssistantIds.delete(assistantMessageId);
                        this.generationAssistantIds.delete(assistantMessageId);
                        this.tailReplacementAssistantIds.delete(assistantMessageId);
                        this.completedGenerationAssistantIds.delete(assistantMessageId);
                        this.weakCompletionReadyAt.delete(assistantMessageId);
                        if (replaceCurrentPageConversation) this.pageSurfaceCleared = false;
                    } else {
                        // Keep a deferred observation alive. A later virtualization
                        // or structure signal can make its predecessor available.
                        this.dirtyAssistantIds.add(assistantMessageId);
                    }
                }
            }
            if (compatibilityRetryDelay !== null && !this.disposed) {
                this.scheduleStableCapture(compatibilityRetryDelay);
            }
        } finally {
            if (this.activeCaptureRunId !== runId) return;
            this.activeCaptureRunId = null;
            if (this.captureRequested && !this.disposed) {
                this.captureRequested = false;
                this.scheduleStableCapture();
            }
        }
    }

    private async compileRound(
        round: ChatGPTDomRoundRef,
        predecessorAssistantMessageId: string | null,
        captureRevision: number,
    ): Promise<ConversationHostTurnObservationV1 | null> {
        if (round.isStreaming) return null;
        const identityParts = resolveChatGPTDomRoundIdentity(round);
        if (!identityParts) return null;
        const { turnId, userMessageId, assistantMessageId } = identityParts;
        if (!round.userMessageEl.isConnected || !round.assistantMessageEl.isConnected) return null;
        if (!round.assistantContentRootEl?.isConnected) return null;

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
