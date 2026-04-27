import type { SiteAdapter } from '../adapters/base';
import { browser } from '../../shared/browser';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from './types';
import { RouteWatcher } from '../injection/routeWatcher';

const BRIDGE_SCRIPT_ID = 'aimd-chatgpt-conversation-bridge-script';
const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const FETCH_EVENT = 'aimd:chatgpt-conversation-fetch';
const RESPONSE_TIMEOUT_MS = 2500;
const LIVE_REFRESH_INTERVAL_MS = 5000;
const REBUILD_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

type BridgeRequest =
    | {
        requestId: string;
        type: 'snapshot';
        conversationId: string;
        force?: boolean;
    };

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: ChatGPTConversationSnapshot;
    error?: { code?: string; message?: string };
};

type ReactTurnLike = {
    id?: string | null;
    role?: string | null;
    author?: { role?: string | null } | null;
    messages?: unknown[];
};

type MessageRole = 'user' | 'assistant';

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(url);
    }
}

function getConversationIdFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.pathname.match(/(?:^|\/)c\/([0-9a-f-]{8,})/i)?.[1]
            ?? parsed.pathname.match(/(?:^|\/)conversation\/([0-9a-f-]{8,})/i)?.[1]
            ?? null;
    } catch {
        return url.match(/(?:^|\/)(?:c|conversation)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    }
}

function getRuntimeUrl(path: string): string {
    return browser.runtime.getURL(path);
}

function truncatePreview(text: string, maxLen = 180): string {
    const value = text.trim().replace(/\s+/g, ' ');
    if (!value) return '';
    return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
    if (!record) return null;
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readAuthorRole(message: Record<string, unknown>): string | null {
    const author = readRecord(message.author);
    return readString(author ?? message, 'role');
}

function isHiddenMessage(message: Record<string, unknown>): boolean {
    const metadata = readRecord(message.metadata);
    if (!metadata) return false;
    return metadata.is_visually_hidden_from_conversation === true
        || metadata.is_hidden === true
        || metadata.hidden === true;
}

function isDisplayableMessage(message: unknown, expectedRole: MessageRole): message is Record<string, unknown> {
    const record = readRecord(message);
    if (!record) return false;
    if (isHiddenMessage(record)) return false;

    const role = readAuthorRole(record);
    if (role && role !== expectedRole) return false;

    const recipient = readString(record, 'recipient');
    if (recipient && recipient !== 'all') return false;

    const channel = readString(record, 'channel');
    if (channel && channel !== 'final') return false;

    return true;
}

function isTextContentRecord(record: Record<string, unknown>): boolean {
    const contentType = readString(record, 'content_type');
    return !contentType || contentType === 'text' || contentType === 'multimodal_text';
}

function isTextPartRecord(record: Record<string, unknown>): boolean {
    const contentType = readString(record, 'content_type') ?? readString(record, 'type');
    return !contentType || contentType === 'text' || contentType === 'output_text';
}

function normalizeMessageText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeMessageText(item))
            .filter(Boolean)
            .join('\n\n')
            .trim();
    }
    if (!value || typeof value !== 'object') return '';

    const record = value as Record<string, unknown>;
    if (!isTextContentRecord(record)) return '';

    if (Array.isArray(record.parts)) {
        const combined = record.parts
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object') {
                    const objectPart = part as Record<string, unknown>;
                    if (!isTextPartRecord(objectPart)) return '';
                    if (typeof objectPart.text === 'string') return objectPart.text;
                    if (typeof objectPart.content === 'string') return objectPart.content;
                    if (typeof objectPart.markdown === 'string') return objectPart.markdown;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n\n')
            .trim();
        if (combined) return combined;
    }

    if (typeof record.text === 'string') return record.text.trim();
    if (typeof record.content === 'string') return record.content.trim();
    if (typeof record.markdown === 'string') return record.markdown.trim();
    return '';
}

function getMessageId(message: unknown): string | null {
    const record = readRecord(message);
    return record ? readString(record, 'id') : null;
}

function getTurnRole(turn: ReactTurnLike | null | undefined): MessageRole | null {
    const author = readRecord(turn?.author);
    const role = readString(author, 'role') ?? (typeof turn?.role === 'string' ? turn.role : null);
    if (role === 'user' || role === 'assistant') return role;
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = readRecord(messages[index]);
        const messageRole = readAuthorRole(message ?? {});
        if (messageRole === 'user' || messageRole === 'assistant') return messageRole;
    }
    return null;
}

function getTurnId(turn: ReactTurnLike | null | undefined): string | null {
    return typeof turn?.id === 'string' && turn.id.trim() ? turn.id.trim() : null;
}

function getDisplayableMessageContent(message: unknown, expectedRole: MessageRole): string {
    if (!isDisplayableMessage(message, expectedRole)) return '';
    return normalizeMessageText(message.content);
}

function getLastDisplayableMessage(turn: ReactTurnLike | null | undefined, expectedRole: MessageRole): Record<string, unknown> | null {
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = readRecord(messages[index]);
        if (!message || !isDisplayableMessage(message, expectedRole)) continue;
        const content = getDisplayableMessageContent(message, expectedRole);
        if (getMessageId(message) || content) return message;
    }
    return null;
}

function getReactKeys(element: HTMLElement): Array<string> {
    return Object.keys(element).filter((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$'));
}

function getReactRootCandidate(element: HTMLElement): any {
    for (const key of getReactKeys(element)) {
        const value = (element as unknown as Record<string, unknown>)[key];
        if (value) return value;
    }
    return null;
}

function findStructuredTurnData(messageElement: HTMLElement): {
    turn: ReactTurnLike | null;
    parentPromptMessage: Record<string, unknown> | null;
} {
    let fiber = getReactRootCandidate(messageElement);
    let depth = 0;

    while (fiber && depth < 12) {
        const candidates = [
            fiber.pendingProps,
            fiber.memoizedProps,
            fiber.pendingProps?.value,
            fiber.memoizedProps?.value,
        ].filter(Boolean) as Array<Record<string, unknown>>;

        for (const candidate of candidates) {
            const turn =
                (candidate.turn as ReactTurnLike | undefined)
                ?? (candidate.currentTurn as ReactTurnLike | undefined)
                ?? (candidate.prevTurn as ReactTurnLike | undefined)
                ?? null;
            const parentPromptMessage =
                (candidate.parentPromptMessage as Record<string, unknown> | undefined)
                ?? (candidate.lastUserMessage as Record<string, unknown> | undefined)
                ?? null;

            if (turn || parentPromptMessage) {
                return { turn, parentPromptMessage };
            }
        }

        fiber = fiber.return ?? null;
        depth += 1;
    }

    return { turn: null, parentPromptMessage: null };
}

function collectStructuredTurnRefs(adapter: SiteAdapter): Array<{
    element: HTMLElement;
    messageElement: HTMLElement | null;
    turn: ReactTurnLike;
    parentPromptMessage: Record<string, unknown> | null;
}> {
    const refs: Array<{
        element: HTMLElement;
        messageElement: HTMLElement | null;
        turn: ReactTurnLike;
        parentPromptMessage: Record<string, unknown> | null;
    }> = [];
    const seen = new Set<string>();
    const push = (element: HTMLElement, messageElement: HTMLElement | null) => {
        const { turn, parentPromptMessage } = findStructuredTurnData(element);
        const role = getTurnRole(turn);
        if (!turn || !role) return;
        const id = getTurnId(turn) ?? `${role}-${refs.length + 1}`;
        const key = `${role}:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        refs.push({ element, messageElement, turn, parentPromptMessage });
    };

    const root = adapter.getObserverContainer?.() ?? document;
    root.querySelectorAll('[data-turn-id-container]').forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const messageElement = node.querySelector(adapter.getMessageSelector());
        push(node, messageElement instanceof HTMLElement ? messageElement : null);
    });

    if (refs.length > 0) return refs;

    root.querySelectorAll(adapter.getMessageSelector()).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        push(node, node);
    });

    return refs;
}

function buildReactPropsFallback(adapter: SiteAdapter, conversationId: string): ChatGPTConversationSnapshot | null {
    const structuredTurns = collectStructuredTurnRefs(adapter);
    if (structuredTurns.length === 0) return null;
    const rounds: ChatGPTConversationRound[] = [];
    let pendingUser: {
        turnId: string | null;
        userPrompt: string;
        userMessageId: string | null;
    } | null = null;

    for (const ref of structuredTurns) {
        const role = getTurnRole(ref.turn);

        if (role === 'user') {
            const userMessage = getLastDisplayableMessage(ref.turn, 'user');
            const userPrompt = getDisplayableMessageContent(userMessage, 'user');
            pendingUser = {
                turnId: getTurnId(ref.turn),
                userPrompt: userPrompt || `Message ${rounds.length + 1}`,
                userMessageId: getMessageId(userMessage),
            };
            continue;
        }

        if (role !== 'assistant') continue;
        const assistantMessage = getLastDisplayableMessage(ref.turn, 'assistant');
        const assistantContent = getDisplayableMessageContent(assistantMessage, 'assistant');
        const fallbackPrompt = getDisplayableMessageContent(ref.parentPromptMessage, 'user');
        const userPrompt = pendingUser?.userPrompt || fallbackPrompt || `Message ${rounds.length + 1}`;
        rounds.push({
            id: getTurnId(ref.turn) ?? pendingUser?.turnId ?? `react-turn-${rounds.length + 1}`,
            position: rounds.length + 1,
            userPrompt,
            assistantContent,
            preview: truncatePreview(userPrompt || assistantContent),
            messageId: (ref.messageElement ? adapter.getMessageId(ref.messageElement) : null) ?? getMessageId(assistantMessage),
            userMessageId: pendingUser?.userMessageId ?? getMessageId(ref.parentPromptMessage),
            assistantMessageId: getMessageId(assistantMessage) ?? (ref.messageElement ? adapter.getMessageId(ref.messageElement) : null),
        });
        pendingUser = null;
    }

    if (rounds.length === 0) return null;
    return {
        conversationId,
        buildFingerprint: null,
        rounds,
        source: 'react-props',
        capturedAt: Date.now(),
    };
}

function buildBestFallback(adapter: SiteAdapter, conversationId: string): ChatGPTConversationSnapshot | null {
    return buildReactPropsFallback(adapter, conversationId);
}

export class ChatGPTConversationEngine {
    private adapter: SiteAdapter;
    private bridgeReady = false;
    private bridgeReadyPromise: Promise<void> | null = null;
    private initialized = false;
    private routeWatcher: RouteWatcher | null = null;
    private currentConversationId: string | null = null;
    private rebuildRetryTimer: number | null = null;
    private rebuildRetryCount = 0;
    private staleConversationIds = new Set<string>();
    private snapshotByConversation = new Map<string, ChatGPTConversationSnapshot>();
    private inFlightByConversation = new Map<string, Promise<ChatGPTConversationSnapshot | null>>();
    private subscribers = new Set<(snapshot: ChatGPTConversationSnapshot | null) => void>();
    private liveRefreshTimer: number | null = null;
    private readonly handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return;
        void this.refreshCurrentConversation({ force: true });
    };

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    init(): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        if (this.initialized) {
            this.handleRouteChange(window.location.href, window.location.href);
            return;
        }
        this.initialized = true;
        this.currentConversationId = getConversationIdFromUrl(window.location.href);
        this.routeWatcher = new RouteWatcher((nextUrl, prevUrl) => this.handleRouteChange(nextUrl, prevUrl), { intervalMs: 500 });
        this.routeWatcher.start();
        window.addEventListener(FETCH_EVENT, this.handleConversationFetch as EventListener);

        if (!isChatGPTConversationPage(window.location.href)) return;

        const run = () => {
            this.markCurrentConversationStale();
            void this.rebuildCurrentConversation();
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            window.setTimeout(run, 600);
        }
    }

    dispose(): void {
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        window.removeEventListener(FETCH_EVENT, this.handleConversationFetch as EventListener);
        if (this.rebuildRetryTimer !== null) {
            window.clearTimeout(this.rebuildRetryTimer);
            this.rebuildRetryTimer = null;
        }
        this.stopLiveRefresh();
        this.initialized = false;
    }

    subscribe(listener: (snapshot: ChatGPTConversationSnapshot | null) => void): () => void {
        this.subscribers.add(listener);
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (conversationId) {
            const cached = this.snapshotByConversation.get(conversationId) ?? null;
            if (cached) listener(cached);
        }
        this.startLiveRefresh();
        return () => {
            this.subscribers.delete(listener);
            if (this.subscribers.size === 0) this.stopLiveRefresh();
        };
    }

    async getSnapshot(): Promise<ChatGPTConversationSnapshot | null> {
        return this.refreshCurrentConversation({ force: false });
    }

    forceRefreshCurrentConversation(): Promise<ChatGPTConversationSnapshot | null> {
        this.markCurrentConversationStale();
        return this.rebuildCurrentConversation();
    }

    private async refreshCurrentConversation(options?: { force?: boolean }): Promise<ChatGPTConversationSnapshot | null> {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId) return null;
        this.currentConversationId = conversationId;
        return this.refreshSnapshot(conversationId, { force: options?.force === true });
    }

    private async refreshSnapshot(
        conversationId: string,
        options?: { force?: boolean }
    ): Promise<ChatGPTConversationSnapshot | null> {
        const force = options?.force === true || this.staleConversationIds.has(conversationId);
        const cached = this.snapshotByConversation.get(conversationId);
        if (cached && !force && !this.staleConversationIds.has(conversationId)) return cached;

        const inFlight = this.inFlightByConversation.get(conversationId);
        if (inFlight) return inFlight;

        const promise = this.loadSnapshot(conversationId, { force }).finally(() => {
            this.inFlightByConversation.delete(conversationId);
        });
        this.inFlightByConversation.set(conversationId, promise);
        return promise;
    }

    private async loadSnapshot(
        conversationId: string,
        options?: { force?: boolean }
    ): Promise<ChatGPTConversationSnapshot | null> {
        let snapshot: ChatGPTConversationSnapshot | null = null;
        try {
            await this.ensureBridgeReady();
            snapshot = await this.requestBridgeSnapshot(conversationId, options?.force === true);
        } catch {
            snapshot = null;
        }

        if (!snapshot) snapshot = buildBestFallback(this.adapter, conversationId);

        if (snapshot) {
            const previous = this.snapshotByConversation.get(conversationId) ?? null;
            if (
                previous?.source === 'runtime-bridge'
                && snapshot.source !== 'runtime-bridge'
                && snapshot.rounds.length < previous.rounds.length
            ) {
                this.scheduleRebuildRetry(conversationId);
                return previous;
            }
            this.snapshotByConversation.set(conversationId, snapshot);
            this.staleConversationIds.delete(conversationId);
            if (!areSnapshotsEquivalent(previous, snapshot)) {
                this.subscribers.forEach((listener) => listener(snapshot));
            }
        }
        return snapshot;
    }

    private handleRouteChange(nextUrl: string, prevUrl: string): void {
        const previousId = getConversationIdFromUrl(prevUrl);
        const nextId = getConversationIdFromUrl(nextUrl);
        if (previousId === nextId && nextId === this.currentConversationId) return;

        this.currentConversationId = nextId;
        this.rebuildRetryCount = 0;
        if (this.rebuildRetryTimer !== null) {
            window.clearTimeout(this.rebuildRetryTimer);
            this.rebuildRetryTimer = null;
        }

        if (!nextId || !isChatGPTConversationPage(nextUrl)) {
            this.subscribers.forEach((listener) => listener(null));
            return;
        }

        this.staleConversationIds.add(nextId);
        void this.rebuildCurrentConversation();
    }

    private readonly handleConversationFetch = (event: Event) => {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId || !isChatGPTConversationPage(window.location.href)) return;

        const detail = (event as CustomEvent<{ url?: string }>).detail;
        const fetchedConversationId = typeof detail?.url === 'string'
            ? getConversationIdFromUrl(detail.url)
            : null;
        if (fetchedConversationId && fetchedConversationId !== conversationId) return;

        this.currentConversationId = conversationId;
        this.staleConversationIds.add(conversationId);
        this.rebuildRetryCount = 0;
        void this.rebuildCurrentConversation();
    };

    private markCurrentConversationStale(): void {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId) return;
        this.currentConversationId = conversationId;
        this.staleConversationIds.add(conversationId);
    }

    private async rebuildCurrentConversation(): Promise<ChatGPTConversationSnapshot | null> {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId || !isChatGPTConversationPage(window.location.href)) return null;
        this.currentConversationId = conversationId;
        const snapshot = await this.refreshSnapshot(conversationId, { force: true });
        if (!snapshot || snapshot.source !== 'runtime-bridge') this.scheduleRebuildRetry(conversationId);
        else this.rebuildRetryCount = 0;
        return snapshot;
    }

    private scheduleRebuildRetry(conversationId: string): void {
        if (this.rebuildRetryTimer !== null) return;
        if (this.rebuildRetryCount >= REBUILD_RETRY_DELAYS_MS.length) return;
        const delay = REBUILD_RETRY_DELAYS_MS[this.rebuildRetryCount] ?? REBUILD_RETRY_DELAYS_MS[REBUILD_RETRY_DELAYS_MS.length - 1];
        this.rebuildRetryCount += 1;
        this.rebuildRetryTimer = window.setTimeout(() => {
            this.rebuildRetryTimer = null;
            if (this.currentConversationId !== conversationId) return;
            if (document.visibilityState !== 'visible') return;
            void this.rebuildCurrentConversation();
        }, delay);
    }

    private startLiveRefresh(): void {
        if (this.subscribers.size === 0) return;
        if (this.liveRefreshTimer !== null) return;
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.liveRefreshTimer = window.setInterval(() => {
            if (this.subscribers.size === 0) {
                this.stopLiveRefresh();
                return;
            }
            if (!isChatGPTConversationPage(window.location.href)) return;
            if (document.visibilityState !== 'visible') return;
            void this.refreshCurrentConversation({ force: true });
        }, LIVE_REFRESH_INTERVAL_MS);
    }

    private stopLiveRefresh(): void {
        if (this.liveRefreshTimer !== null) {
            window.clearInterval(this.liveRefreshTimer);
            this.liveRefreshTimer = null;
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private async ensureBridgeReady(): Promise<void> {
        if (this.bridgeReady) return;
        if (this.bridgeReadyPromise) return this.bridgeReadyPromise;

        this.bridgeReadyPromise = new Promise<void>((resolve, reject) => {
            const existing = document.getElementById(BRIDGE_SCRIPT_ID);
            if (existing) {
                this.bridgeReady = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.id = BRIDGE_SCRIPT_ID;
            script.src = getRuntimeUrl('page-bridges/chatgpt-conversation-bridge.js');
            script.async = true;
            script.onload = () => {
                this.bridgeReady = true;
                resolve();
                script.remove();
            };
            script.onerror = () => {
                script.remove();
                reject(new Error('Failed to load ChatGPT bridge'));
            };
            (document.head || document.documentElement).appendChild(script);
        }).finally(() => {
            this.bridgeReadyPromise = null;
        });

        return this.bridgeReadyPromise;
    }

    private requestBridgeSnapshot(conversationId: string, force = false): Promise<ChatGPTConversationSnapshot | null> {
        const requestId = `aimd-chatgpt-snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                window.clearTimeout(timeoutId);
            };

            const onResponse = (event: Event) => {
                const custom = event as CustomEvent<BridgeResponse>;
                if (!custom.detail || custom.detail.requestId !== requestId) return;
                settled = true;
                cleanup();
                resolve(custom.detail.ok ? custom.detail.snapshot ?? null : null);
            };

            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                cleanup();
                resolve(null);
            }, RESPONSE_TIMEOUT_MS);

            window.addEventListener(RESPONSE_EVENT, onResponse as EventListener);
            window.dispatchEvent(new CustomEvent<BridgeRequest>(REQUEST_EVENT, {
                detail: {
                    requestId,
                    type: 'snapshot',
                    conversationId,
                    force,
                },
            }));
        });
    }
}

function areSnapshotsEquivalent(
    previous: ChatGPTConversationSnapshot | null,
    next: ChatGPTConversationSnapshot | null
): boolean {
    if (!previous || !next) return false;
    if (previous.conversationId !== next.conversationId) return false;
    if (previous.rounds.length !== next.rounds.length) return false;
    for (let index = 0; index < previous.rounds.length; index += 1) {
        const a = previous.rounds[index];
        const b = next.rounds[index];
        if (!b) return false;
        if (
            a.id !== b.id
            || a.position !== b.position
            || a.userPrompt !== b.userPrompt
            || a.assistantContent !== b.assistantContent
            || a.preview !== b.preview
            || a.messageId !== b.messageId
            || a.userMessageId !== b.userMessageId
            || a.assistantMessageId !== b.assistantMessageId
        ) {
            return false;
        }
    }
    return true;
}
