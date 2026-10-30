import { getChatGPTConversationId } from './chatgptRoute';
import type { MessageMetadata, MessageMetadataSource } from '../../../contracts/messageMetadata';

const REQUEST = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE = 'aimd:chatgpt-conversation-bridge:capture';
let sequence = 0;

/** Reads passive host metadata, falling back to an explicitly associated DOM prompt time. */
export class ChatGPTMessageMetadataReader implements MessageMetadataSource {
    private readonly cache = new Map<string, Map<string, MessageMetadata | null>>();
    private readonly listeners = new Set<() => void>();
    private readonly onCapture = () => {
        this.cache.clear();
        this.listeners.forEach(listener => listener());
    };
    read(conversationId: string, messageId: string): MessageMetadata | null {
        let document = this.cache.get(conversationId);
        if (!document) {
            if (this.cache.size >= 3) this.cache.delete(this.cache.keys().next().value!);
            document = new Map(); this.cache.set(conversationId, document);
        }
        if (document.has(messageId)) return document.get(messageId)!;
        const requestId = `metadata-${++sequence}`;
        let metadata: MessageMetadata | null = null;
        const receive = (event: Event) => {
            try {
                const raw = (event as CustomEvent).detail;
                const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (result?.requestId !== requestId || result?.ok !== true) return;
                const validTime = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8.64e15 ? value : undefined;
                const createdAt = validTime(result.metadata?.createdAt);
                const updatedAt = validTime(result.metadata?.updatedAt);
                if (createdAt !== undefined || updatedAt !== undefined) metadata = { createdAt, updatedAt };
            } catch { /* Ignore malformed page events. */ }
        };
        window.addEventListener(RESPONSE, receive);
        try {
            // The cache-only bridge responds synchronously; no timeout or polling is needed.
            window.dispatchEvent(new CustomEvent(REQUEST, { detail: JSON.stringify({ type: 'metadata', requestId, conversationId, messageId }) }));
        } finally { window.removeEventListener(RESPONSE, receive); }
        // The host cache can hydrate after the message element; missing time
        // must remain retryable on the next shared Surface update.
        if (metadata) document.set(messageId, metadata);
        return metadata ?? this.readPromptTime(conversationId, messageId);
    }
    private readPromptTime(conversationId: string, messageId: string): MessageMetadata | null {
        if (getChatGPTConversationId(window.location.href) !== conversationId) return null;
        const matches = Array.from(document.querySelectorAll<HTMLElement>('[data-dil-message-id], [data-chatgpt-search-message-ids]'))
            .filter(element => element.getAttribute('data-dil-message-id') === messageId
                || element.getAttribute('data-chatgpt-search-message-ids')?.split(/\s+/).includes(messageId));
        const turns = new Set(matches.map(element => element.closest('[data-turn-key]')).filter(Boolean));
        if (turns.size !== 1) return null;
        const turn = [...turns][0]!;
        const times = Array.from(turn.querySelectorAll('[role="separator"][data-markdown-copy="exclude"] time[datetime]'))
            .filter(time => time.closest('[data-turn-key]') === turn);
        if (times.length !== 1) return null;
        const value = Date.parse(times[0]!.getAttribute('datetime') ?? '');
        // DOM time belongs to the prompt, never to the assistant reply. Do not cache:
        // virtualized turns may be replaced, and host metadata can arrive later.
        return Number.isFinite(value) && value > 0 ? { promptCreatedAt: value } : null;
    }
    subscribe(listener: () => void): () => void {
        if (!this.listeners.size) window.addEventListener(CAPTURE, this.onCapture);
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) { window.removeEventListener(CAPTURE, this.onCapture); this.cache.clear(); }
        };
    }
}
