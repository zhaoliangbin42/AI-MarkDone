import type { SiteAdapter } from '../adapters/base';
import { browser } from '../../shared/browser';
import { collectConversationTurnRefs } from '../conversation/collectConversationTurnRefs';
import { copyMarkdownFromTurn } from '../../../services/copy/copy-turn-markdown';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from './types';

const BRIDGE_SCRIPT_ID = 'aimd-chatgpt-conversation-bridge-script';
const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const RESPONSE_TIMEOUT_MS = 2500;
const LIVE_REFRESH_INTERVAL_MS = 1000;

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
    messages?: unknown[];
};

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        const isChatGPT = parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com';
        return isChatGPT && /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function getConversationIdFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.pathname.match(/(?:^|\/)c\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    } catch {
        return null;
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
    if (Array.isArray(record.parts)) {
        const combined = record.parts
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object') {
                    const objectPart = part as Record<string, unknown>;
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

function buildReactPropsFallback(adapter: SiteAdapter, conversationId: string): ChatGPTConversationSnapshot | null {
    const selector = adapter.getMessageSelector();
    const messages = Array.from(document.querySelectorAll(selector)).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (messages.length === 0) return null;

    const rounds: ChatGPTConversationRound[] = [];
    const seen = new Set<string>();

    for (const messageElement of messages) {
        const { turn, parentPromptMessage } = findStructuredTurnData(messageElement);
        const turnId = typeof turn?.id === 'string' ? turn.id : null;
        if (!turnId || seen.has(turnId)) continue;
        seen.add(turnId);

        const assistantContent = normalizeMessageText(
            Array.isArray(turn?.messages)
                ? turn.messages.map((message) => (message as Record<string, unknown>)?.content)
                : null,
        );
        const userPrompt = normalizeMessageText(parentPromptMessage?.content);
        rounds.push({
            id: turnId,
            position: rounds.length + 1,
            userPrompt: userPrompt || `Message ${rounds.length + 1}`,
            assistantContent,
            preview: truncatePreview(userPrompt || assistantContent),
            messageId: adapter.getMessageId(messageElement),
            userMessageId: typeof parentPromptMessage?.id === 'string' ? String(parentPromptMessage.id) : null,
            assistantMessageId: adapter.getMessageId(messageElement),
        });
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

function buildDomFallback(adapter: SiteAdapter, conversationId: string): ChatGPTConversationSnapshot | null {
    const turns = collectConversationTurnRefs(adapter);
    if (turns.length === 0) return null;
    const rounds: ChatGPTConversationRound[] = turns.map((turn, index) => {
        const markdown = copyMarkdownFromTurn(adapter, turn.messageEls);
        const assistantContent = markdown.ok ? markdown.markdown : '';
        return {
            id: turn.messageId ?? `dom-${index + 1}`,
            position: index + 1,
            userPrompt: turn.userPrompt,
            assistantContent,
            preview: truncatePreview(turn.userPrompt || assistantContent),
            messageId: turn.messageId,
            userMessageId: null,
            assistantMessageId: turn.messageId,
        };
    });

    return {
        conversationId,
        buildFingerprint: null,
        rounds,
        source: 'dom',
        capturedAt: Date.now(),
    };
}

export class ChatGPTConversationEngine {
    private adapter: SiteAdapter;
    private bridgeReady = false;
    private bridgeReadyPromise: Promise<void> | null = null;
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
        if (!isChatGPTConversationPage(window.location.href)) return;

        const run = () => {
            void this.getSnapshot();
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            window.setTimeout(run, 600);
        }
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

    private async refreshCurrentConversation(options?: { force?: boolean }): Promise<ChatGPTConversationSnapshot | null> {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId) return null;
        return this.refreshSnapshot(conversationId, { force: options?.force === true });
    }

    private async refreshSnapshot(
        conversationId: string,
        options?: { force?: boolean }
    ): Promise<ChatGPTConversationSnapshot | null> {
        const force = options?.force === true;
        const cached = this.snapshotByConversation.get(conversationId);
        if (cached && !force) return cached;

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

        if (!snapshot) {
            snapshot = buildReactPropsFallback(this.adapter, conversationId) ?? buildDomFallback(this.adapter, conversationId);
        }

        if (snapshot) {
            const previous = this.snapshotByConversation.get(conversationId) ?? null;
            this.snapshotByConversation.set(conversationId, snapshot);
            if (!areSnapshotsEquivalent(previous, snapshot)) {
                this.subscribers.forEach((listener) => listener(snapshot));
            }
        }
        return snapshot;
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
