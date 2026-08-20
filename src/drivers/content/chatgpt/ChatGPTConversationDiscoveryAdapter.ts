import { browserInfo } from '../../shared/browser';
import {
    ConversationContentAcquisitionError,
    type ConversationContentCandidateV1,
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
} from '../../../contracts/conversationContent';
import type { DiscoveryBridgeDiagnosticsV1 } from '../../../contracts/conversationDiscoveryDiagnostics';
import { decodeBridgeDetail, encodeBridgeRequest, type BridgeWireDetail } from './bridgeTransport';
import { getChatGPTConversationId } from './chatgptRoute';
import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';
import type { ChatGPTConversationRound } from './types';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const BOOTSTRAP_ERROR_EVENT = 'aimd:chatgpt-conversation-bridge:bootstrap-error';
const PEEK_TIMEOUT_MS = 800;
const DIAGNOSTICS_TIMEOUT_MS = 1500;

type BridgeRequestType = 'peek' | 'diagnostics';

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: {
        conversationId: string;
        rounds: ChatGPTConversationRound[];
        coverage?: 'complete';
        capturedAt: number;
        captureSequence?: number;
        branchKey: string;
    };
    diagnostics?: DiscoveryBridgeDiagnosticsV1;
    error?: {
        code?: unknown;
        retryable?: unknown;
    };
};

export class ChatGPTConversationDiscoveryAdapter {
    private readonly signalListeners = new Set<() => void>();
    private captureSignalCount = 0;
    private cachedBridgeDiagnostics: DiscoveryBridgeDiagnosticsV1 | null = null;
    private bridgeUnavailable = false;
    private disposed = false;
    private readonly handleBootstrapError = () => {
        this.bridgeUnavailable = true;
    };
    private readonly handleCapture = (event: Event) => {
        const detail = decodeBridgeDetail<{
            kind?: unknown;
            conversationId?: unknown;
        }>(
            (event as CustomEvent<unknown>).detail,
        );
        if (detail?.kind !== 'graph' || typeof detail.conversationId !== 'string') return;
        const currentId = getChatGPTConversationId(window.location.href)?.trim() ?? null;
        const conversationId = detail.conversationId.trim();
        if (conversationId !== currentId) return;
        this.captureSignalCount += 1;
        for (const listener of Array.from(this.signalListeners)) listener();
    };

    constructor() {
        window.addEventListener(BOOTSTRAP_ERROR_EVENT, this.handleBootstrapError);
    }

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

    peek(signal?: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        const document = this.resolveDocument();
        if (!document || document.identityKind === 'page' || !document.conversationId) {
            return Promise.resolve(null);
        }
        return this.request(
            'peek',
            document.conversationId,
            PEEK_TIMEOUT_MS,
            (detail) => {
                if (!detail.snapshot) {
                    throw mapBridgeError(detail.error);
                }
                return toCandidate(detail.snapshot, document);
            },
            signal,
        );
    }

    async readBaseline(signal: AbortSignal): Promise<ConversationContentCandidateV1 | null> {
        return this.peek(signal);
    }

    getCaptureSignalCount(): number {
        return this.captureSignalCount;
    }

    isBridgeUnavailable(): boolean {
        return this.bridgeUnavailable;
    }

    getCachedBridgeDiagnostics(): DiscoveryBridgeDiagnosticsV1 | null {
        return this.cachedBridgeDiagnostics;
    }

    async readBridgeDiagnostics(signal?: AbortSignal): Promise<DiscoveryBridgeDiagnosticsV1 | null> {
        if (this.disposed) return this.cachedBridgeDiagnostics;
        try {
            const diagnostics = await this.request(
                'diagnostics',
                this.resolveDocument()?.conversationId ?? '',
                DIAGNOSTICS_TIMEOUT_MS,
                (detail) => {
                    if (!detail.ok || !detail.diagnostics) {
                        throw mapBridgeError(detail.error);
                    }
                    return detail.diagnostics;
                },
                signal,
            );
            this.cachedBridgeDiagnostics = diagnostics;
            return diagnostics;
        } catch {
            return this.cachedBridgeDiagnostics;
        }
    }

    dispose(): void {
        window.removeEventListener(CAPTURE_EVENT, this.handleCapture as EventListener);
        window.removeEventListener(BOOTSTRAP_ERROR_EVENT, this.handleBootstrapError);
        this.disposed = true;
        this.signalListeners.clear();
    }

    private request<T>(
        type: BridgeRequestType,
        conversationId: string,
        timeoutMs: number,
        parse: (detail: BridgeResponse) => T,
        signal?: AbortSignal,
    ): Promise<T> {
        const requestId = `aimd-chatgpt-content-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                window.clearTimeout(timeoutId);
                signal?.removeEventListener('abort', onAbort);
            };
            const finish = (result: T) => {
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
                if (!detail.ok) {
                    if (detail.error?.code === 'BRIDGE_UNAVAILABLE') this.bridgeUnavailable = true;
                    fail(mapBridgeError(detail.error));
                    return;
                }
                this.bridgeUnavailable = false;
                try {
                    finish(parse(detail));
                } catch (error) {
                    fail(error);
                }
            };
            const timeoutId = window.setTimeout(() => {
                // A same-window event round-trip that times out means the page
                // bridge is absent (or the page is frozen), not slow transport.
                this.bridgeUnavailable = true;
                fail(new ConversationContentAcquisitionError('source-timeout'));
            }, timeoutMs);
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
                    conversationId,
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
            // Provider positions are not semantic identity; the cache uses a
            // dense local ordinal for the messages admitted by this baseline.
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
        coverage: 'complete',
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
