import type { SiteAdapter } from '../adapters/base';
import { browserInfo } from '../../shared/browser';
import { decodeBridgeDetail, encodeBridgeRequest, type BridgeWireDetail } from './bridgeTransport';
import {
    createChatGPTConversationModel,
    reduceChatGPTConversation,
    type ChatGPTConversationModel,
} from './ChatGPTConversationReducer';
import { RouteWatcher } from '../injection/routeWatcher';
import {
    getChatGPTConversationId,
    isChatGPTConversationPage,
} from './chatgptRoute';
import type {
    ChatGPTConversationSnapshot,
    ChatGPTConversationSnapshotCandidate,
    ChatGPTConversationSource,
    ChatGPTConversationState,
    ChatGPTDomTurnFactSource,
    ChatGPTDomTurnObservation,
} from './types';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const RESPONSE_TIMEOUT_MS = 2500;

type BridgeRequest = {
    requestId: string;
    type: 'snapshot';
    conversationId: string;
};

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: ChatGPTConversationSnapshotCandidate;
};

export type ChatGPTConversationEngineOptions = {
    domFacts?: ChatGPTDomTurnFactSource | null;
};

export class ChatGPTConversationEngine implements ChatGPTConversationSource {
    private initialized = false;
    private routeWatcher: RouteWatcher | null = null;
    private lastUrl = '';
    private model: ChatGPTConversationModel = createChatGPTConversationModel();
    private readonly subscribers = new Set<(state: ChatGPTConversationState) => void>();
    private lastCaptureSequence = 0;
    private flush: {
        routeEpoch: number;
        promise: Promise<ChatGPTConversationSnapshot | null>;
    } | null = null;
    private readonly domFacts: ChatGPTDomTurnFactSource | null;
    private domFactsEpoch: number | null = null;

    private readonly handleBridgeCapture = (event: Event) => {
        const detail = decodeBridgeDetail<{
            conversationId?: unknown;
            captureSequence?: unknown;
        }>((event as CustomEvent<unknown>).detail);
        const conversationId = typeof detail?.conversationId === 'string'
            ? detail.conversationId
            : null;
        const captureSequence = typeof detail?.captureSequence === 'number'
            && Number.isSafeInteger(detail.captureSequence)
            && detail.captureSequence > 0
            ? detail.captureSequence
            : null;
        if (
            !conversationId
            || !captureSequence
            || captureSequence <= this.lastCaptureSequence
            || conversationId !== this.model.state.conversationId
            || conversationId !== getChatGPTConversationId(window.location.href)
        ) {
            return;
        }
        this.lastCaptureSequence = captureSequence;
        void this.ensureReady();
    };

    constructor(
        private readonly adapter: SiteAdapter,
        options?: ChatGPTConversationEngineOptions,
    ) {
        this.domFacts = options?.domFacts ?? null;
    }

    init(): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        if (this.initialized) {
            this.syncRoute(window.location.href, window.location.href);
            return;
        }

        this.initialized = true;
        this.lastUrl = window.location.href;
        this.syncInitialRoute();
        window.addEventListener(CAPTURE_EVENT, this.handleBridgeCapture as EventListener);
        this.routeWatcher = new RouteWatcher(
            (nextUrl, prevUrl) => this.syncRoute(nextUrl, prevUrl),
            { intervalMs: 500 },
        );
        this.routeWatcher.start();

        if (isChatGPTConversationPage(window.location.href)) {
            void this.ensureReady();
        }
    }

    dispose(): void {
        if (!this.initialized) return;
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.deactivateDomFacts();
        window.removeEventListener(CAPTURE_EVENT, this.handleBridgeCapture as EventListener);
        this.initialized = false;
        this.flush = null;
    }

    getState(): ChatGPTConversationState {
        return this.model.state;
    }

    subscribe(listener: (state: ChatGPTConversationState) => void): () => void {
        this.subscribers.add(listener);
        listener(this.model.state);
        return () => this.subscribers.delete(listener);
    }

    ensureReady(): Promise<ChatGPTConversationSnapshot | null> {
        this.syncRoute(window.location.href, this.lastUrl || window.location.href);
        const routeEpoch = this.model.state.routeEpoch;
        if (this.flush?.routeEpoch === routeEpoch) return this.flush.promise;
        const conversationId = this.model.state.conversationId;
        const promise = Promise.resolve().then(async () => {
            let observation: ChatGPTDomTurnObservation | null = null;
            if (this.shouldCollectDomFacts()) {
                observation = this.activateDomFacts(routeEpoch, true);
                this.observeDomFacts(observation, routeEpoch);
            }
            if (!conversationId || !isChatGPTConversationPage(window.location.href)) {
                return null;
            }

            const candidate = await this.requestBridgeSnapshot(conversationId);
            if (
                routeEpoch !== this.model.state.routeEpoch
                || conversationId !== this.model.state.conversationId
            ) {
                return null;
            }
            if (isVerifiedGraphSnapshot(candidate, conversationId)) {
                this.reduce({
                    kind: 'graph',
                    routeEpoch,
                    conversationId,
                    branchKey: candidate.branchKey,
                    capturedAt: candidate.capturedAt,
                    rounds: candidate.rounds,
                });
                this.activateDomFacts(routeEpoch, false);
                observation ??= this.readDomFacts(routeEpoch);
                this.observeDomFacts(observation, routeEpoch);
            }
            return this.model.state.snapshot;
        }).finally(() => {
            if (this.flush?.promise === promise) this.flush = null;
        });
        this.flush = { routeEpoch, promise };
        return promise;
    }

    private syncInitialRoute(): void {
        if (this.model.state.routeEpoch > 0) {
            const currentId = getChatGPTConversationId(window.location.href);
            if (currentId === this.model.state.conversationId) {
                if (this.shouldCollectDomFacts()) {
                    const observation = this.activateDomFacts(this.model.state.routeEpoch, true);
                    this.observeDomFacts(observation, this.model.state.routeEpoch);
                }
                return;
            }
        }
        const conversationId = getChatGPTConversationId(window.location.href);
        this.reduce({
            kind: 'route',
            routeEpoch: this.model.state.routeEpoch + 1,
            conversationId,
            allowBirth: false,
            preserveBirth: false,
        });
        if (conversationId === null) {
            const routeEpoch = this.model.state.routeEpoch;
            const observation = this.activateDomFacts(routeEpoch, true);
            this.observeDomFacts(observation, routeEpoch);
        }
    }

    private syncRoute(nextUrl: string, prevUrl: string): void {
        const nextId = getChatGPTConversationId(nextUrl);
        const currentId = this.model.state.conversationId;
        this.lastUrl = nextUrl;
        if (nextId === currentId) return;

        const previousId = getChatGPTConversationId(prevUrl);
        const preserveBirth = previousId === null
            && nextId !== null
            && this.model.birth.eligible;
        this.deactivateDomFacts();
        this.reduce({
            kind: 'route',
            routeEpoch: this.model.state.routeEpoch + 1,
            conversationId: nextId,
            allowBirth: false,
            preserveBirth,
        });
        const routeEpoch = this.model.state.routeEpoch;
        if (nextId === null || this.model.birth.eligible) {
            const observation = this.activateDomFacts(routeEpoch, true);
            this.observeDomFacts(observation, routeEpoch);
        }
        if (nextId && isChatGPTConversationPage(nextUrl)) {
            void this.ensureReady();
        }
    }

    private shouldCollectDomFacts(): boolean {
        return this.model.state.conversationId === null
            || this.model.birth.eligible
            || this.model.proof !== null;
    }

    private activateDomFacts(
        routeEpoch: number,
        readCurrent: boolean,
    ): ChatGPTDomTurnObservation | null {
        if (!this.domFacts) return null;
        if (this.domFactsEpoch !== routeEpoch) {
            this.deactivateDomFacts();
            this.domFactsEpoch = routeEpoch;
            this.domFacts.start((observation) => this.observeDomFacts(observation, routeEpoch));
        }
        return readCurrent ? this.domFacts.read() : null;
    }

    private readDomFacts(routeEpoch: number): ChatGPTDomTurnObservation | null {
        if (!this.domFacts || this.domFactsEpoch !== routeEpoch) return null;
        return this.domFacts.read();
    }

    private deactivateDomFacts(): void {
        if (this.domFactsEpoch === null) return;
        this.domFacts?.stop();
        this.domFactsEpoch = null;
    }

    private observeDomFacts(
        observation: ChatGPTDomTurnObservation | null | undefined,
        routeEpoch = this.model.state.routeEpoch,
    ): void {
        if (!observation || routeEpoch !== this.model.state.routeEpoch) return;
        if (
            this.model.state.conversationId === null
            && observation.rounds.length === 0
            && !this.model.birth.eligible
        ) {
            this.reduce({
                kind: 'route',
                routeEpoch: this.model.state.routeEpoch,
                conversationId: null,
                allowBirth: true,
                preserveBirth: false,
            });
        }
        this.reduce({
            kind: 'dom',
            routeEpoch,
            conversationId: this.model.state.conversationId,
            observation,
        });
    }

    private reduce(fact: Parameters<typeof reduceChatGPTConversation>[1]): void {
        const previousState = this.model.state;
        this.model = reduceChatGPTConversation(this.model, fact);
        if (this.model.state === previousState) return;
        for (const listener of Array.from(this.subscribers)) {
            try {
                listener(this.model.state);
            } catch {
                // One consumer must never prevent the semantic state from reaching the others.
            }
        }
    }

    private requestBridgeSnapshot(
        conversationId: string,
    ): Promise<ChatGPTConversationSnapshotCandidate | null> {
        const requestId = `aimd-chatgpt-snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                window.clearTimeout(timeoutId);
            };
            const finish = (snapshot: ChatGPTConversationSnapshotCandidate | null) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(snapshot);
            };
            const onResponse = (event: Event) => {
                const detail = decodeBridgeDetail<BridgeResponse>(
                    (event as CustomEvent<unknown>).detail,
                );
                if (!detail || detail.requestId !== requestId) return;
                finish(detail.ok ? detail.snapshot ?? null : null);
            };
            const timeoutId = window.setTimeout(() => finish(null), RESPONSE_TIMEOUT_MS);

            window.addEventListener(RESPONSE_EVENT, onResponse as EventListener);
            window.dispatchEvent(new CustomEvent<BridgeWireDetail<BridgeRequest>>(REQUEST_EVENT, {
                detail: encodeBridgeRequest({
                    requestId,
                    type: 'snapshot' as const,
                    conversationId,
                }, browserInfo.isFirefox),
            }));
        });
    }
}

function isVerifiedGraphSnapshot(
    snapshot: ChatGPTConversationSnapshotCandidate | null,
    conversationId: string,
): snapshot is ChatGPTConversationSnapshotCandidate & { branchKey: string } {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.conversationId !== conversationId) return false;
    if (!isNonEmptyIdentity(snapshot.branchKey)) return false;
    if (typeof snapshot.capturedAt !== 'number' || !Number.isFinite(snapshot.capturedAt)) return false;
    if (!Array.isArray(snapshot.rounds) || snapshot.rounds.length === 0) return false;

    const roundIds = new Set<string>();
    const userMessageIds = new Set<string>();
    const assistantMessageIds = new Set<string>();
    for (let index = 0; index < snapshot.rounds.length; index += 1) {
        const round = snapshot.rounds[index];
        if (!round || typeof round !== 'object') return false;
        if (!isNonEmptyIdentity(round.id) || roundIds.has(round.id)) return false;
        if (round.position !== index + 1) return false;
        if (typeof round.userPrompt !== 'string') return false;
        if (typeof round.assistantContent !== 'string') return false;
        if (typeof round.preview !== 'string') return false;
        if (!isNullableIdentity(round.messageId)) return false;
        if (!isNullableIdentity(round.userMessageId)) return false;
        if (!isNullableIdentity(round.assistantMessageId)) return false;
        if (round.userMessageId && userMessageIds.has(round.userMessageId)) return false;
        if (round.assistantMessageId && assistantMessageIds.has(round.assistantMessageId)) return false;
        if (
            round.messageId
            && round.messageId !== round.assistantMessageId
            && !(round.assistantMessageId === null && round.messageId === round.userMessageId)
        ) {
            return false;
        }

        roundIds.add(round.id);
        if (round.userMessageId) userMessageIds.add(round.userMessageId);
        if (round.assistantMessageId) assistantMessageIds.add(round.assistantMessageId);
    }
    return true;
}

function isNonEmptyIdentity(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isNullableIdentity(value: unknown): value is string | null {
    return value === null || isNonEmptyIdentity(value);
}
