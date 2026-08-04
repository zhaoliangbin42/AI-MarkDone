import { browserInfo } from '../../shared/browser';
import {
    ConversationContentAcquisitionError,
    type ConversationContentCandidateV1,
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '../../../contracts/conversationContent';
import { decodeBridgeDetail, encodeBridgeRequest, type BridgeWireDetail } from './bridgeTransport';
import { getChatGPTConversationId, isChatGPTConversationPage } from './chatgptRoute';
import type { ChatGPTConversationRound, ChatGPTDomTurnObservation } from './types';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const PEEK_TIMEOUT_MS = 800;
const ACQUIRE_TIMEOUT_MS = 3000;
const RETRY_DELAY_MS = 500;

type BridgeRequestType = 'peek' | 'acquire';

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: {
        conversationId: string;
        rounds: ChatGPTConversationRound[];
        capturedAt: number;
        branchKey: string;
    };
    error?: {
        code?: unknown;
        retryable?: unknown;
    };
};

export type ChatGPTConversationDiscoveryAdapterOptions = Readonly<{
    /** Active reads remain opt-in until the real-browser Phase 0 gate passes. */
    allowActiveAcquisition?: boolean;
    /** Verified, typed DOM successor evidence; never a positional content fallback. */
    readTypedDomCandidate?: () => ConversationContentCandidateV1 | null;
    hasTypedDomEvidence?: () => boolean;
}>;

export class ChatGPTConversationDiscoveryAdapter {
    private readonly signalListeners = new Set<() => void>();
    private readonly handleCapture = (event: Event) => {
        const detail = decodeBridgeDetail<{ conversationId?: unknown }>(
            (event as CustomEvent<unknown>).detail,
        );
        if (typeof detail?.conversationId !== 'string') return;
        const currentId = getChatGPTConversationId(window.location.href)?.trim().toLowerCase() ?? null;
        if (detail.conversationId.trim().toLowerCase() !== currentId) return;
        for (const listener of Array.from(this.signalListeners)) listener();
    };

    constructor(private readonly options: ChatGPTConversationDiscoveryAdapterOptions = {}) {}

    resolveDocument(): ConversationDocumentRefV1 | null {
        const conversationId = getChatGPTConversationId(window.location.href)?.trim().toLowerCase() ?? null;
        if (!conversationId || !isChatGPTConversationPage(window.location.href)) return null;
        return Object.freeze({
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            conversationId,
            canonicalUrl: window.location.href,
        });
    }

    subscribeSignals(listener: () => void): () => void {
        if (this.signalListeners.size === 0) {
            window.addEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
        }
        this.signalListeners.add(listener);
        return () => {
            this.signalListeners.delete(listener);
            if (this.signalListeners.size === 0) {
                window.removeEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
            }
        };
    }

    peek(signal?: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const document = this.resolveDocument();
        if (!document) return Promise.resolve(null);
        return this.request('peek', document, PEEK_TIMEOUT_MS, signal);
    }

    async acquire(signal: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const document = this.resolveDocument();
        if (!document) {
            throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
        }

        try {
            const passive = await this.peek(signal);
            const typedDomCandidate = this.options.readTypedDomCandidate?.() ?? null;
            if (passive) {
                // The passive graph is usually the strongest source, but it is
                // intentionally a snapshot of the last host GET. ChatGPT can
                // add a new reply through a POST/SSE path without refreshing
                // that graph. Merge only an identity-overlapping DOM suffix;
                // this keeps the graph's history and branch proof while making
                // the newest completed turn visible immediately.
                return typedDomCandidate
                    ? mergePassiveCandidateWithTypedDom(passive, typedDomCandidate)
                    : passive;
            }
        } catch (error) {
            if (!isRetryableSourceError(error)) throw error;
        }

        const typedDomCandidate = this.options.readTypedDomCandidate?.() ?? null;
        if (typedDomCandidate) return typedDomCandidate;

        if (this.options.allowActiveAcquisition !== true) {
            throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
        }

        try {
            return await this.request('acquire', document, ACQUIRE_TIMEOUT_MS, signal);
        } catch (error) {
            const hasTypedDomEvidence = this.options.hasTypedDomEvidence?.()
                ?? Boolean(this.options.readTypedDomCandidate?.());
            if (!isRetryableSourceError(error) || !hasTypedDomEvidence) throw error;
            await wait(RETRY_DELAY_MS, signal);
            return this.request('acquire', document, ACQUIRE_TIMEOUT_MS, signal);
        }
    }

    dispose(): void {
        window.removeEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
        this.signalListeners.clear();
    }

    private request(
        type: BridgeRequestType,
        document: ConversationDocumentRefV1,
        timeoutMs: number,
        signal?: AbortSignal,
    ): Promise<ConversationContentCandidateV1 | null> {
        const requestId = `aimd-chatgpt-content-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                window.clearTimeout(timeoutId);
                signal?.removeEventListener('abort', onAbort);
            };
            const finish = (result: ConversationContentCandidateV1 | null) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const fail = (error: unknown) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const onAbort = () => fail(new ConversationContentAcquisitionError('source-unavailable', { retryable: true }));
            const onResponse = (event: Event) => {
                const detail = decodeBridgeDetail<BridgeResponse>(
                    (event as CustomEvent<unknown>).detail,
                );
                if (!detail || detail.requestId !== requestId) return;
                if (!detail.ok || !detail.snapshot) {
                    const error = mapBridgeError(detail.error);
                    fail(error);
                    return;
                }
                try {
                    finish(toCandidate(detail.snapshot, document));
                } catch (error) {
                    fail(error);
                }
            };
            const timeoutId = window.setTimeout(() => fail(
                new ConversationContentAcquisitionError('source-timeout'),
            ), timeoutMs);
            window.addEventListener(RESPONSE_EVENT, onResponse as EventListener);
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted) {
                onAbort();
                return;
            }
            window.dispatchEvent(new CustomEvent<BridgeWireDetail<{
                requestId: string;
                type: BridgeRequestType;
                conversationId: string;
            }>>(REQUEST_EVENT, {
                detail: encodeBridgeRequest({
                    requestId,
                    type,
                    conversationId: document.conversationId,
                }, browserInfo.isFirefox),
            }));
        });
    }
}

function mergePassiveCandidateWithTypedDom(
    passive: ConversationContentCandidateV1,
    typedDom: ConversationContentCandidateV1,
): ConversationContentCandidateV1 {
    if (passive.document.key !== typedDom.document.key || typedDom.turns.length === 0) {
        return passive;
    }

    const graphTurns = passive.turns.map((turn) => ({
        ...turn,
        identity: { ...turn.identity },
    }));
    const domTurns = typedDom.turns;
    const graphIndexByAssistantId = new Map<string, number>();
    graphTurns.forEach((turn, index) => {
        graphIndexByAssistantId.set(turn.identity.assistantMessageId, index);
    });

    let best: { domStart: number; graphStart: number; length: number } | null = null;
    for (let domStart = 0; domStart < domTurns.length; domStart += 1) {
        const graphStart = graphIndexByAssistantId.get(
            domTurns[domStart]!.identity.assistantMessageId,
        );
        if (graphStart === undefined) continue;

        let length = 0;
        while (
            domStart + length < domTurns.length
            && graphStart + length < graphTurns.length
        ) {
            const graphTurn = graphTurns[graphStart + length]!;
            const domTurn = domTurns[domStart + length]!;
            if (graphTurn.identity.assistantMessageId !== domTurn.identity.assistantMessageId) break;
            if (!compatibleUserMessageId(graphTurn, domTurn)) break;
            length += 1;
        }
        if (!best || length > best.length) {
            best = { domStart, graphStart, length };
        }
    }

    // Without a shared typed assistant id there is no safe way to tell a new
    // branch from a different DOM window. Keep the verified graph unchanged.
    if (!best || best.length === 0) return passive;

    const merged = graphTurns.slice();
    for (let index = 0; index < best.length; index += 1) {
        const graphIndex = best.graphStart + index;
        const domTurn = domTurns[best.domStart + index]!;
        merged[graphIndex] = mergeTurnText(merged[graphIndex]!, domTurn);
    }

    const domSuccessors = domTurns.slice(best.domStart + best.length);
    if (domSuccessors.length > 0) {
        const graphSuccessorIndex = best.graphStart + best.length;
        if (graphSuccessorIndex < merged.length) {
            // A changed assistant id for the same user turn is a regenerate /
            // branch replacement. Any later old graph suffix is no longer the
            // verified current branch and must not be mixed into the result.
            if (!sameKnownUserMessage(merged[graphSuccessorIndex]!, domSuccessors[0]!)) {
                return passive;
            }
            merged.splice(graphSuccessorIndex);
        }
        merged.push(...domSuccessors.map((turn) => ({
            ...turn,
            identity: { ...turn.identity },
        })));
    }

    const turns = normalizeMergedTurns(merged);
    const changed = turns.length !== passive.turns.length
        || turns.some((turn, index) => (
            turn.identity.assistantMessageId !== passive.turns[index]?.identity.assistantMessageId
            || turn.userText !== passive.turns[index]?.userText
            || turn.assistantMarkdown !== passive.turns[index]?.assistantMarkdown
        ));
    return changed
        ? { document: passive.document, coverage: passive.coverage, turns }
        : passive;
}

function compatibleUserMessageId(left: ConversationTurnV1, right: ConversationTurnV1): boolean {
    return !left.identity.userMessageId
        || !right.identity.userMessageId
        || left.identity.userMessageId === right.identity.userMessageId;
}

function sameKnownUserMessage(left: ConversationTurnV1, right: ConversationTurnV1): boolean {
    return Boolean(
        left.identity.userMessageId
        && right.identity.userMessageId
        && left.identity.userMessageId === right.identity.userMessageId,
    );
}

function mergeTurnText(left: ConversationTurnV1, right: ConversationTurnV1): ConversationTurnV1 {
    return {
        ...left,
        userText: right.userText.trim() ? right.userText : left.userText,
        assistantMarkdown: right.assistantMarkdown.trim() ? right.assistantMarkdown : left.assistantMarkdown,
    };
}

function normalizeMergedTurns(turns: ConversationTurnV1[]): ConversationTurnV1[] {
    return turns.map((turn, index) => ({
        ...turn,
        key: `${turn.identity.turnId}:${turn.identity.assistantMessageId}`,
        ordinal: index + 1,
        identity: { ...turn.identity },
    }));
}

export function createChatGPTPartialCandidateFromDomObservation(
    document: ConversationDocumentRefV1,
    observation: ChatGPTDomTurnObservation,
): ConversationContentCandidateV1 | null {
    const turns: ConversationContentCandidateV1['turns'][number][] = [];
    const turnIds = new Set<string>();
    const assistantIds = new Set<string>();
    let previousObservedPosition = 0;
    for (const fact of observation.rounds) {
        if (!Number.isInteger(fact.position) || fact.position <= previousObservedPosition) break;
        previousObservedPosition = fact.position;
        // A streaming or malformed turn must not erase the completed typed
        // window that surrounds it. The DOM order remains the only safe local
        // ordering signal, so completed successors are retained as a partial
        // candidate and the repository still marks the snapshot partial.
        if (fact.status !== 'complete') continue;
        const turnId = fact.roundId?.trim()
            || fact.assistantTurnId?.trim()
            || fact.assistantMessageId?.trim()
            || '';
        const assistantMessageId = fact.assistantMessageId?.trim() || '';
        if (
            !turnId
            || !assistantMessageId
            || !fact.userPrompt.trim()
            || !fact.assistantContent.trim()
            || turnIds.has(turnId)
            || assistantIds.has(assistantMessageId)
        ) continue;
        turnIds.add(turnId);
        assistantIds.add(assistantMessageId);
        turns.push({
            key: `${turnId}:${assistantMessageId}`,
            ordinal: turns.length + 1,
            identity: {
                turnId,
                userMessageId: fact.userMessageId?.trim() || null,
                assistantMessageId,
            },
            userText: fact.userPrompt,
            assistantMarkdown: fact.assistantContent,
        });
    }
    return turns.length > 0 ? { document, coverage: 'partial', turns } : null;
}

function toCandidate(
    snapshot: NonNullable<BridgeResponse['snapshot']>,
    document: ConversationDocumentRefV1,
): ConversationContentCandidateV1 {
    if (snapshot.conversationId !== document.conversationId) {
        throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
    }
    const turns = snapshot.rounds.map((round) => {
        const assistantMessageId = round.assistantMessageId ?? round.messageId;
        if (!assistantMessageId || !round.id) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        return {
            key: `${round.id}:${assistantMessageId}`,
            ordinal: round.position,
            identity: {
                turnId: round.id,
                userMessageId: round.userMessageId,
                assistantMessageId,
            },
            userText: round.userPrompt,
            assistantMarkdown: round.assistantContent,
        };
    });
    return {
        document,
        coverage: 'complete',
        turns,
    };
}

function mapBridgeError(error: BridgeResponse['error']): ConversationContentAcquisitionError {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code === 'SOURCE_TIMEOUT') return new ConversationContentAcquisitionError('source-timeout');
    if (code === 'INVALID_PAYLOAD' || code === 'INVALID_CONTENT_TYPE') {
        return new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
    }
    if (code === 'IDENTITY_CONFLICT') {
        return new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
    }
    const status = Number(code.replace(/^HTTP_/, ''));
    const retryable = error?.retryable === true
        || status === 408
        || status === 425
        || status >= 500 && status <= 599;
    return new ConversationContentAcquisitionError(
        retryable ? 'source-timeout' : 'source-unavailable',
        { retryable },
    );
}

function isRetryableSourceError(error: unknown): boolean {
    return error instanceof ConversationContentAcquisitionError && error.retryable;
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(resolve, delayMs);
        const onAbort = () => {
            window.clearTimeout(timer);
            reject(new ConversationContentAcquisitionError('source-unavailable', { retryable: true }));
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
