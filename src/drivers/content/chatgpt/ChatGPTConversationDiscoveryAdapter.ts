import { browserInfo } from '../../shared/browser';
import {
    ConversationContentAcquisitionError,
    type ConversationContentCandidateV1,
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
} from '../../../contracts/conversationContent';
import { decodeBridgeDetail, encodeBridgeRequest, type BridgeWireDetail } from './bridgeTransport';
import { getChatGPTConversationId, isChatGPTConversationPage } from './chatgptRoute';
import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';
import type { ChatGPTConversationRound } from './types';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const PEEK_TIMEOUT_MS = 800;

type BridgeRequestType = 'peek';

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: {
        conversationId: string;
        rounds: ChatGPTConversationRound[];
        coverage?: 'complete' | 'partial';
        capturedAt: number;
        captureSequence?: number;
        branchKey: string;
    };
    error?: {
        code?: unknown;
        retryable?: unknown;
    };
};

export class ChatGPTConversationDiscoveryAdapter {
    private readonly signalListeners = new Set<() => void>();
    private completedGeneration: { conversationId: string; assistantMessageId: string } | null = null;
    private readonly handleCapture = (event: Event) => {
        const detail = decodeBridgeDetail<{
            kind?: unknown;
            conversationId?: unknown;
            assistantMessageId?: unknown;
        }>(
            (event as CustomEvent<unknown>).detail,
        );
        if (typeof detail?.conversationId !== 'string') return;
        const currentId = getChatGPTConversationId(window.location.href)?.trim().toLowerCase() ?? null;
        const conversationId = detail.conversationId.trim().toLowerCase();
        if (conversationId !== currentId) return;
        if (detail.kind === 'generation-start') {
            this.completedGeneration = null;
        } else if (
            detail.kind === 'generation-complete'
            && typeof detail.assistantMessageId === 'string'
            && detail.assistantMessageId.trim()
        ) {
            this.completedGeneration = {
                conversationId,
                assistantMessageId: detail.assistantMessageId.trim(),
            };
        }
        for (const listener of Array.from(this.signalListeners)) listener();
    };

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

    getCompletedAssistantMessageId(conversationId: string): string | null {
        const normalizedId = conversationId.trim().toLowerCase();
        return this.completedGeneration?.conversationId === normalizedId
            ? this.completedGeneration.assistantMessageId
            : null;
    }

    notifyLifecycleSignal(): void {
        // Retained for the shared coordinator contract. A lifecycle signal
        // may trigger another peek, but never an extension-issued request.
    }

    peek(signal?: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const document = this.resolveDocument();
        if (!document) return Promise.resolve(null);
        return this.request('peek', document, PEEK_TIMEOUT_MS, signal);
    }

    async readBaseline(signal: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        return this.peek(signal);
    }

    dispose(): void {
        window.removeEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
        this.completedGeneration = null;
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

function toCandidate(
    snapshot: NonNullable<BridgeResponse['snapshot']>,
    document: ConversationDocumentRefV1,
): ConversationContentCandidateV1 {
    if (snapshot.conversationId !== document.conversationId) {
        throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
    }
    const turns = snapshot.rounds.map((round, index) => {
        const assistantMessageId = round.assistantMessageId ?? round.messageId;
        if (!assistantMessageId || !round.id) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        return {
            key: `${round.id}:${assistantMessageId}`,
            // Provider positions can have gaps after the bridge omits an
            // unfinished head; ordinals are local V1 display order only.
            ordinal: index + 1,
            identity: {
                turnId: round.id,
                userMessageId: round.userMessageId,
                assistantMessageId,
            },
            userText: round.userPrompt,
            // Provider dialect adaptation happens once at the source edge so
            // every upper consumer receives the same canonical Markdown.
            assistantMarkdown: normalizeChatGPTReaderMarkdown(round.assistantContent),
            assistantProvenance: SOURCE_BACKED_PROVENANCE,
        };
    });
    return {
        document,
        coverage: snapshot.coverage === 'partial' ? 'partial' : 'complete',
        turns,
        branchKey: snapshot.branchKey,
        captureId: `chatgpt-bridge:${snapshot.branchKey}:${
            Number.isInteger(snapshot.captureSequence) && snapshot.captureSequence! > 0
                ? snapshot.captureSequence
                : snapshot.capturedAt
        }`,
        sourceRevision: Number.isInteger(snapshot.captureSequence) && snapshot.captureSequence! > 0
            ? snapshot.captureSequence
            : snapshot.capturedAt,
        origin: 'source',
        tail: snapshot.coverage === 'partial' ? 'streaming' : 'stable',
    };
}

const SOURCE_BACKED_PROVENANCE = Object.freeze({
    authority: 'verified-derived' as const,
    fidelity: 'normalized' as const,
    producer: 'chatgpt-markdown-source-adapter',
});


function mapBridgeError(error: BridgeResponse['error']): ConversationContentAcquisitionError {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code === 'SOURCE_TIMEOUT') return new ConversationContentAcquisitionError('source-timeout');
    if (code === 'BRIDGE_UNAVAILABLE') {
        return new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
    }
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
