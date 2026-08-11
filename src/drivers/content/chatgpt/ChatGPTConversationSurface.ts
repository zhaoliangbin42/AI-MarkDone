import type {
    ConversationContentSourceV1,
    ConversationContentStateV1,
    ConversationTurnV1,
} from '../../../contracts/conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationMaterializationResultV1,
    ConversationTargetV1,
    MaterializationSnapshotV1,
} from '../../../contracts/conversationMaterialization';
import type {
    ConversationObtainedSurfaceTurnV1,
    ConversationPendingSurfaceV1,
    ConversationSurfaceFrameV1,
    ConversationSurfaceMaterializationV1,
    ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import type { SiteAdapter } from '../adapters/base';
import { logger } from '../../../core/logger';
import {
    materializeChatGPTConversationTarget,
    type ChatGPTMaterializationResult,
} from './ChatGPTConversationNavigation';
import type { ChatGPTPageIndex } from './ChatGPTPageIndex';
import type { ChatGPTHostObservationBatch } from './ChatGPTPageIndex';
import {
    getChatGPTPageIndex,
    resolveChatGPTDomRoundIdentity,
    resolveChatGPTDomRoundProjectionIdentity,
    type ChatGPTDomRoundRef,
} from './domConversationDiscovery';

export type ChatGPTConversationSurfaceOptions = Readonly<{
    adapter: SiteAdapter;
    content: ConversationContentSourceV1;
    pageIndex?: ChatGPTPageIndex;
}>;

const EMPTY_FRAME: ConversationSurfaceFrameV1 = Object.freeze({
    frameToken: 'chatgpt-surface-frame:empty',
    surfaceToken: 'chatgpt-surface:empty',
    contentKind: 'idle',
    document: null,
    snapshot: null,
    projectionId: null,
    contentToken: null,
    obtainedTurns: Object.freeze([]),
    pendingSurfaces: Object.freeze([]),
});

const EMPTY_MATERIALIZATION: MaterializationSnapshotV1 = Object.freeze({
    materializationToken: EMPTY_FRAME.surfaceToken,
    contentToken: null,
    entries: Object.freeze([]),
});

/**
 * The single join between the semantic content pool and ChatGPT's mounted DOM.
 * It owns no message body and creates no observer; PageIndex is its only host
 * input. The compatibility materialization port is projected from the same frame.
 */
export class ChatGPTConversationSurface implements ConversationSurfacePortV1, ConversationMaterializationPortV1 {
    private readonly pageIndex: ChatGPTPageIndex;
    private readonly frameListeners = new Set<(frame: ConversationSurfaceFrameV1) => void>();
    private readonly materializationListeners = new Set<(snapshot: MaterializationSnapshotV1) => void>();
    private readonly anchorTokens = new WeakMap<HTMLElement, string>();
    private anchorSequence = 0;
    private hostSurfaceRevision = 0;
    private frame: ConversationSurfaceFrameV1 = EMPTY_FRAME;
    private materializationSnapshot: MaterializationSnapshotV1 = EMPTY_MATERIALIZATION;
    private navigation: ConversationNavigationPortV1 | null = null;
    private readonly unsubscribeContent: () => void;
    private readonly unsubscribePage: () => void;

    readonly materialization: ConversationMaterializationPortV1 = this;

    constructor(private readonly options: ChatGPTConversationSurfaceOptions) {
        this.pageIndex = options.pageIndex ?? getChatGPTPageIndex(options.adapter);
        let subscribing = true;
        this.unsubscribeContent = options.content.subscribe(() => {
            if (!subscribing) this.rebuild();
        });
        subscribing = false;
        this.unsubscribePage = this.pageIndex.subscribeObservations((batch) => this.handleHostObservation(batch));
        this.rebuild();
    }

    readFrame(): ConversationSurfaceFrameV1 {
        return this.frame;
    }

    subscribeFrame(listener: (frame: ConversationSurfaceFrameV1) => void): () => void {
        this.frameListeners.add(listener);
        listener(this.frame);
        return () => this.frameListeners.delete(listener);
    }

    read(): MaterializationSnapshotV1 {
        return this.materializationSnapshot;
    }

    subscribe(listener: (snapshot: MaterializationSnapshotV1) => void): () => void {
        this.materializationListeners.add(listener);
        listener(this.materializationSnapshot);
        return () => this.materializationListeners.delete(listener);
    }

    setNavigationPort(navigation: ConversationNavigationPortV1 | null): void {
        this.navigation = navigation;
    }

    resolveElement(element: HTMLElement): ConversationTargetV1 | null {
        for (const entry of this.frame.obtainedTurns) {
            if (entry.materialization && containsElement(entry.materialization, element)) return entry.target;
        }
        for (const entry of this.frame.pendingSurfaces) {
            if (containsElement(entry.materialization, element)) return entry.target;
        }
        return null;
    }

    async locate(
        target: ConversationTargetV1,
        signal?: AbortSignal,
    ): Promise<ConversationMaterializationResultV1> {
        if (signal?.aborted) return 'cancelled';
        const state = this.options.content.read();
        const semantic = findTurn(state, target);
        if (!semantic) return 'unavailable';
        const mounted = this.frame.obtainedTurns.find((entry) => (
            entry.turn.identity.assistantMessageId === semantic.identity.assistantMessageId
        ))?.materialization;
        if (mounted?.anchorElement.isConnected) return 'located';

        if (this.navigation) {
            const result = await this.navigation.navigate({
                documentKey: state.document?.key,
                position: semantic.ordinal,
                roundId: semantic.identity.turnId,
                userMessageId: semantic.identity.userMessageId,
                assistantMessageId: semantic.identity.assistantMessageId,
                source: 'reader',
            }, { signal, timeoutMs: 15_000, align: 'start' });
            if (result.ok) {
                this.rebuild();
                return 'located';
            }
            return result.reason === 'cancelled' ? 'cancelled' : 'unavailable';
        }

        const result: ChatGPTMaterializationResult = await materializeChatGPTConversationTarget(
            this.options.adapter,
            {
                position: semantic.ordinal,
                roundId: semantic.identity.turnId,
                userMessageId: semantic.identity.userMessageId,
                assistantMessageId: semantic.identity.assistantMessageId,
            },
            { signal, timeoutMs: 1500, surface: this },
        );
        if (result.ok) {
            this.pageIndex.invalidate();
            this.rebuild();
            return 'located';
        }
        return signal?.aborted || result.message === 'Navigation cancelled' ? 'cancelled' : 'unavailable';
    }

    /** Re-read PageIndex after BFCache/root replacement without creating work. */
    refreshSurface(): void {
        this.pageIndex.invalidate();
        this.rebuild();
    }

    dispose(): void {
        this.unsubscribeContent();
        this.unsubscribePage();
        this.frameListeners.clear();
        this.materializationListeners.clear();
    }

    private rebuild(): void {
        const state = this.options.content.read();
        const document = state.document;
        const snapshot = state.snapshot;
        const hostRounds = this.pageIndex.getSnapshot();
        const mountedByAssistantId = indexUniqueHostRounds(hostRounds);
        const obtainedAssistantIds = new Set<string>();
        const obtainedTurns: ConversationObtainedSurfaceTurnV1[] = [];

        if (document && snapshot) {
            for (const turn of snapshot.turns) {
                obtainedAssistantIds.add(turn.identity.assistantMessageId);
                const hostRound = mountedByAssistantId.get(turn.identity.assistantMessageId) ?? null;
                const materialization = hostRound && hostRound !== 'ambiguous' && hostMatchesTurn(hostRound, turn)
                    ? this.materializeHostRound(hostRound)
                    : null;
                obtainedTurns.push(Object.freeze({
                    status: 'obtained' as const,
                    turn,
                    target: Object.freeze(toTarget(document.key, turn)),
                    materialization,
                }));
            }
        }

        const pendingSurfaces: ConversationPendingSurfaceV1[] = [];
        if (document) {
            for (const round of hostRounds) {
                const identity = resolveChatGPTDomRoundIdentity(round)
                    ?? resolveChatGPTDomRoundProjectionIdentity(round);
                if (!identity || obtainedAssistantIds.has(identity.assistantMessageId)) continue;
                const materialization = this.materializeHostRound(round);
                if (!materialization) continue;
                pendingSurfaces.push(Object.freeze({
                    status: 'pending-surface' as const,
                    target: Object.freeze({
                        documentKey: document.key,
                        turnId: identity.turnId,
                        userMessageId: identity.userMessageId,
                        assistantMessageId: identity.assistantMessageId,
                    }),
                    materialization,
                }));
            }
        }

        const surfaceKeys = [
            ...obtainedTurns.map((entry) => (
                `${entry.target.turnId}:${entry.target.assistantMessageId}:${this.anchorToken(entry.materialization)}`
            )),
            ...pendingSurfaces.map((entry) => (
                `pending:${entry.target.turnId}:${entry.target.assistantMessageId}:${this.anchorToken(entry.materialization)}`
            )),
        ];
        const contentToken = snapshot?.contentToken ?? null;
        const surfaceToken = `chatgpt-surface:${contentToken ?? 'none'}:host-${this.hostSurfaceRevision}:${surfaceKeys.join('|')}`;
        const frameToken = [
            'chatgpt-surface-frame',
            state.kind,
            document?.key ?? 'none',
            snapshot?.projectionId ?? 'none',
            contentToken ?? 'none',
            surfaceToken,
        ].join(':');
        if (frameToken === this.frame.frameToken) return;

        this.frame = Object.freeze({
            frameToken,
            surfaceToken,
            contentKind: state.kind,
            document,
            snapshot,
            projectionId: snapshot?.projectionId ?? null,
            contentToken,
            obtainedTurns: Object.freeze(obtainedTurns),
            pendingSurfaces: Object.freeze(pendingSurfaces),
        });
        this.materializationSnapshot = Object.freeze({
            materializationToken: surfaceToken,
            contentToken,
            entries: Object.freeze([
                ...obtainedTurns.flatMap((entry) => entry.materialization
                    ? [Object.freeze({
                        target: entry.target,
                        anchorElement: entry.materialization.anchorElement,
                        messageElement: entry.materialization.messageElement,
                    })]
                    : []),
                ...pendingSurfaces.map((entry) => Object.freeze({
                    target: entry.target,
                    anchorElement: entry.materialization.anchorElement,
                    messageElement: entry.materialization.messageElement,
                })),
            ]),
        });
        this.notify();
    }

    private handleHostObservation(batch: ChatGPTHostObservationBatch): void {
        // Streaming text changes only dirty HostMonitor identities. They do
        // not change mounted geometry and must not rescan or republish Surface.
        if (batch.kinds.every((kind) => kind === 'content')) return;
        this.hostSurfaceRevision = batch.revision;
        this.rebuild();
    }

    private materializeHostRound(round: ChatGPTDomRoundRef): ConversationSurfaceMaterializationV1 | null {
        const messageElement = round.assistantMessageEl;
        if (!messageElement.isConnected) return null;
        const anchorElement = this.options.adapter.getToolbarAnchorElement(messageElement) ?? messageElement;
        if (!anchorElement.isConnected) return null;
        const groupElements = round.groupEls.filter((element) => element.isConnected);
        return Object.freeze({
            anchorElement,
            messageElement,
            jumpAnchorElement: round.jumpAnchorEl.isConnected ? round.jumpAnchorEl : anchorElement,
            userElement: round.userRootEl.isConnected ? round.userRootEl : null,
            assistantElement: round.assistantRootEl.isConnected ? round.assistantRootEl : messageElement,
            groupElements: Object.freeze(groupElements.length > 0 ? groupElements : [messageElement]),
        });
    }

    private getAnchorToken(element: HTMLElement): string {
        const existing = this.anchorTokens.get(element);
        if (existing) return existing;
        const token = `anchor-${++this.anchorSequence}`;
        this.anchorTokens.set(element, token);
        return token;
    }

    private notify(): void {
        for (const listener of Array.from(this.frameListeners)) {
            try {
                listener(this.frame);
            } catch (error) {
                logger.warn('[AI-MarkDone][ChatGPTConversationSurface] Frame subscriber failed', error);
            }
        }
        for (const listener of Array.from(this.materializationListeners)) {
            try {
                listener(this.materializationSnapshot);
            } catch (error) {
                logger.warn('[AI-MarkDone][ChatGPTConversationSurface] Materialization subscriber failed', error);
            }
        }
    }

    private anchorToken(materialization: ConversationSurfaceMaterializationV1 | null): string {
        return materialization ? this.getAnchorToken(materialization.anchorElement) : 'unmounted';
    }
}

type IndexedHostRound = ChatGPTDomRoundRef | 'ambiguous';

function indexUniqueHostRounds(rounds: readonly ChatGPTDomRoundRef[]): Map<string, IndexedHostRound> {
    const index = new Map<string, IndexedHostRound>();
    for (const round of rounds) {
        const assistantMessageId = resolveChatGPTDomRoundProjectionIdentity(round)?.assistantMessageId;
        if (!assistantMessageId) continue;
        const existing = index.get(assistantMessageId);
        index.set(assistantMessageId, existing && existing !== round ? 'ambiguous' : round);
    }
    return index;
}

function hostMatchesTurn(round: ChatGPTDomRoundRef, turn: ConversationTurnV1): boolean {
    const identity = resolveChatGPTDomRoundProjectionIdentity(round);
    if (!identity || identity.assistantMessageId !== turn.identity.assistantMessageId) return false;
    if (identity.userMessageId && identity.userMessageId !== turn.identity.userMessageId) return false;
    const observedTurnId = round.identity.roundId?.trim() || round.identity.assistantTurnId?.trim() || null;
    return !observedTurnId
        || observedTurnId === turn.identity.turnId
        || round.source === 'assistant-only';
}

function toTarget(documentKey: string, turn: ConversationTurnV1): ConversationTargetV1 {
    return {
        documentKey,
        turnId: turn.identity.turnId,
        userMessageId: turn.identity.userMessageId,
        assistantMessageId: turn.identity.assistantMessageId,
    };
}

function findTurn(state: ConversationContentStateV1, target: ConversationTargetV1): ConversationTurnV1 | null {
    if (!state.document || !state.snapshot || state.document.key !== target.documentKey) return null;
    return state.snapshot.turns.find((turn) => (
        turn.identity.turnId === target.turnId
        && turn.identity.assistantMessageId === target.assistantMessageId
        && (target.userMessageId === undefined || turn.identity.userMessageId === target.userMessageId)
    )) ?? null;
}

function containsElement(materialization: ConversationSurfaceMaterializationV1, element: HTMLElement): boolean {
    const candidates = [
        materialization.anchorElement,
        materialization.messageElement,
        materialization.jumpAnchorElement,
        materialization.userElement,
        materialization.assistantElement,
        ...materialization.groupElements,
    ].filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);
    return candidates.some((candidate) => (
        candidate === element || candidate.contains(element) || element.contains(candidate)
    ));
}
