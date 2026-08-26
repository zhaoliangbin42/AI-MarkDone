import { browserInfo } from '../../shared/browser';
import {
    ConversationContentAcquisitionError,
    createConversationDocumentKeyV1,
    type ConversationContentCandidateV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '../../../contracts/conversationContent';
import { getChatGPTConversationId } from './chatgptRoute';
import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const PEEK_TIMEOUT_MS = 800;

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: {
        conversationId: string;
        rounds: ConversationTurnV1[];
        branchKey: string;
        capturedAt: number;
        captureSequence?: number;
    };
    error?: { code?: unknown; retryable?: unknown };
};

function decodeDetail<T>(value: unknown): T | null {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value && typeof value === 'object' ? value as T : null;
}

function encodeRequest<T>(value: T): T | string {
    return browserInfo.isFirefox ? JSON.stringify(value) : value;
}

export class ChatGPTConversationDiscoveryAdapter {
    private readonly signalListeners = new Set<() => void>();
    private disposed = false;

    private readonly handleCapture = (event: Event): void => {
        const detail = decodeDetail<{ kind?: unknown; conversationId?: unknown }>(
            (event as CustomEvent<unknown>).detail,
        );
        const currentId = getChatGPTConversationId(window.location.href)?.trim() ?? null;
        if (detail?.kind !== 'graph' || detail.conversationId !== currentId) return;
        for (const listener of Array.from(this.signalListeners)) listener();
    };

    resolveDocument(pageUrl = window.location.href): ConversationDocumentRefV1 | null {
        const conversationId = getChatGPTConversationId(pageUrl)?.trim() ?? null;
        if (!conversationId) return null;
        return Object.freeze({
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            identityKind: 'canonical' as const,
            conversationId,
            canonicalUrl: pageUrl,
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

    readBaseline(signal: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const document = this.resolveDocument();
        if (!document?.conversationId) return Promise.resolve(null);
        return this.request(document.conversationId, signal);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        window.removeEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
        this.signalListeners.clear();
    }

    private request(conversationId: string, signal: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const requestId = `chatgpt-get-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                finish(null, new ConversationContentAcquisitionError('source-timeout'));
            }, PEEK_TIMEOUT_MS);
            const cleanup = () => {
                window.clearTimeout(timeoutId);
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                signal.removeEventListener('abort', onAbort);
            };
            const finish = (value: ConversationContentCandidateV1 | null, error?: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                if (error) reject(error);
                else resolve(value);
            };
            const onAbort = () => finish(null, new ConversationContentAcquisitionError('source-unavailable'));
            const onResponse = (event: Event) => {
                const detail = decodeDetail<BridgeResponse>((event as CustomEvent<unknown>).detail);
                if (!detail || detail.requestId !== requestId) return;
                if (!detail.ok || !detail.snapshot) {
                    finish(null, new ConversationContentAcquisitionError('source-unavailable'));
                    return;
                }
                try {
                    finish(toCandidate(detail.snapshot, conversationId));
                } catch (error) {
                    finish(null, error instanceof Error ? error : new Error('Invalid ChatGPT source payload'));
                }
            };
            window.addEventListener(RESPONSE_EVENT, onResponse as EventListener);
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) return onAbort();
            window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
                detail: encodeRequest({ requestId, type: 'peek', conversationId }),
            }));
        });
    }
}

function toCandidate(
    snapshot: NonNullable<BridgeResponse['snapshot']>,
    conversationId: string,
): ConversationContentCandidateV1 {
    if (
        snapshot.conversationId !== conversationId
        || !Array.isArray(snapshot.rounds)
        || snapshot.rounds.length === 0
    ) {
        throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
    }
    const turns = snapshot.rounds.map((round, index) => {
        const identity = round?.identity;
        const turnId = typeof identity?.turnId === 'string' ? identity.turnId.trim() : '';
        const assistantMessageId = typeof identity?.assistantMessageId === 'string'
            ? identity.assistantMessageId.trim()
            : '';
        const assistantMarkdown = typeof round?.assistantMarkdown === 'string'
            ? normalizeChatGPTReaderMarkdown(round.assistantMarkdown)
            : '';
        if (!turnId || !assistantMessageId || !assistantMarkdown) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        const userMessageId = typeof identity?.userMessageId === 'string'
            ? identity.userMessageId.trim() || null
            : null;
        return {
            key: typeof round?.key === 'string' && round.key.trim()
                ? round.key.trim()
                : `${turnId}:${assistantMessageId}`,
            ordinal: index + 1,
            identity: {
                turnId,
                userMessageId,
                assistantMessageId,
            },
            userText: typeof round?.userText === 'string' ? round.userText.trim() : '',
            assistantMarkdown,
            ...(round?.assistantProvenance ? { assistantProvenance: round.assistantProvenance } : {}),
        };
    });
    if (
        new Set(turns.map((turn) => turn.identity.turnId)).size !== turns.length
        || new Set(turns.map((turn) => turn.identity.assistantMessageId)).size !== turns.length
    ) {
        throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
    }
    return {
        document: {
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            identityKind: 'canonical',
            conversationId,
            canonicalUrl: window.location.href,
        },
        coverage: 'complete',
        turns,
        branchKey: snapshot.branchKey,
        captureId: `chatgpt-bridge:${snapshot.branchKey}:${snapshot.captureSequence ?? snapshot.capturedAt}`,
        sourceRevision: snapshot.captureSequence ?? snapshot.capturedAt,
        origin: 'source',
    };
}
