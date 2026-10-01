import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatGPTMessageMetadataReader } from '@/drivers/content/chatgpt/ChatGPTMessageMetadataReader';

const bridgeSource = readFileSync(
    resolve(process.cwd(), 'public/page-bridges/chatgpt-conversation-bridge.js'),
    'utf8',
);

const conversationId = '12345678-1234-1234-1234-123456789abc';

function graphPayload(options: { incomplete?: boolean } = {}) {
    return {
        conversation_id: conversationId,
        current_node: 'assistant-node',
        mapping: {
            root: { id: 'root', parent: null, children: ['user-node'] },
            'user-node': {
                id: 'user-node',
                parent: 'root',
                children: ['assistant-node'],
                message: {
                    id: 'user-message',
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: ['Question'] },
                },
            },
            'assistant-node': {
                id: 'assistant-node',
                parent: 'user-node',
                children: [],
                message: {
                    id: 'assistant-message',
                    author: { role: 'assistant' },
                    status: options.incomplete ? 'streaming' : 'finished_successfully',
                    content: { content_type: 'text', parts: [options.incomplete ? 'Partial' : 'Answer'] },
                },
            },
        },
    };
}

function installBridge(): void {
    new Function(bridgeSource)();
}

describe('ChatGPT conversation bridge', () => {
    beforeEach(() => {
        history.replaceState({}, '', `/c/${conversationId}`);
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            url: `/backend-api/conversation/${conversationId}`,
            headers: { get: (name: string) => name === 'content-type' ? 'application/json' : '' },
            clone() {
                return { json: async () => graphPayload() };
            },
        })));
        window.fetch = globalThis.fetch as typeof window.fetch;
    });

    afterEach(() => {
        (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__?.dispose?.();
        delete (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__;
        vi.unstubAllGlobals();
        history.replaceState({}, '', '/');
    });

    it('reads only timestamps from the already-loaded page cache without requesting content', async () => {
        const payload = graphPayload();
        Object.assign(payload.mapping['assistant-node'].message, { create_time: 1700000000, update_time: 1700000060 });
        Object.assign(payload.mapping['user-node'].message, { create_time: 1700000000 });
        const originalFetch = vi.mocked(globalThis.fetch);
        const data = { conversation_id: conversationId, mapping: payload.mapping };
        const query = { queryKey: ['chatgpt-conversation', conversationId], state: { data } };
        const main = document.createElement('main');
        Object.defineProperty(main, '__reactFiber$fixture', { enumerable: true, value: {
            memoizedProps: { value: new Map([[Symbol('scope'), {
                queryClient: { getQueryCache: () => ({ getAll: () => [query] }) },
            }]]) },
            return: null,
        } });
        document.body.replaceChildren(main);
        installBridge();
        const reader = new ChatGPTMessageMetadataReader();
        const changed = vi.fn(); const unsubscribe = reader.subscribe(changed);
        try {
            query.state.data = undefined as any;
            expect(reader.read(conversationId, 'assistant-message')).toBeNull();
            query.state.data = data;
            expect(reader.read(conversationId, 'assistant-message')).toEqual({ createdAt: 1700000000000, updatedAt: 1700000060000 });
            expect(reader.read(conversationId, 'user-message')).toBeNull();
            expect(reader.read('other-conversation', 'assistant-message')).toBeNull();
            expect(originalFetch).not.toHaveBeenCalled();
            Object.assign(payload.mapping['assistant-node'].message, { update_time: 1700000120 });
            query.state.data = { conversation_id: conversationId, mapping: payload.mapping };
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture'));
            expect(reader.read(conversationId, 'assistant-message')?.updatedAt).toBe(1700000120000);
            expect(changed).toHaveBeenCalledTimes(1);
            expect(originalFetch).not.toHaveBeenCalled();
        } finally { unsubscribe(); }
    });

    it('observes the website-owned GET and exposes a mapping/current_node snapshot through peek', async () => {
        installBridge();
        await window.fetch(`/backend-api/conversation/${conversationId}`);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const response = await new Promise<any>((resolveResponse) => {
            window.addEventListener('aimd:chatgpt-conversation-bridge:response', (responseEvent) => {
                resolveResponse((responseEvent as CustomEvent<any>).detail);
            }, { once: true });
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:request', {
                detail: { requestId: 'peek-test', type: 'peek', conversationId },
            }));
        });

        const parsed = typeof response === 'string' ? JSON.parse(response) : response;
        expect(parsed.ok).toBe(true);
        expect(parsed.snapshot.rounds).toEqual([
            expect.objectContaining({
                identity: expect.objectContaining({ assistantMessageId: 'assistant-message' }),
                assistantMarkdown: 'Answer',
            }),
        ]);
    });

    it('captures a conversation GET issued before SPA navigation updates the address', async () => {
        history.replaceState({}, '', '/');
        installBridge();
        await window.fetch(`/backend-api/conversation/${conversationId}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        history.replaceState({}, '', `/c/${conversationId}`);
        const response = await new Promise<any>((resolveResponse) => {
            window.addEventListener('aimd:chatgpt-conversation-bridge:response', (event) => {
                resolveResponse((event as CustomEvent<any>).detail);
            }, { once: true });
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:request', {
                detail: { requestId: 'peek-prefetched', type: 'peek', conversationId },
            }));
        });
        const parsed = typeof response === 'string' ? JSON.parse(response) : response;
        expect(parsed.ok).toBe(true);
        expect(parsed.snapshot.rounds).toHaveLength(1);
    });

    it('does not publish an incomplete streaming tail as source content', async () => {
        const fetchMock = vi.mocked(globalThis.fetch);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            url: `/backend-api/conversation/${conversationId}`,
            headers: { get: () => 'application/json' },
            clone: () => ({ json: async () => graphPayload({ incomplete: true }) }),
        } as any);
        installBridge();
        await window.fetch(`/backend-api/conversation/${conversationId}`);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const response = await new Promise<any>((resolveResponse) => {
            window.addEventListener('aimd:chatgpt-conversation-bridge:response', (event) => {
                resolveResponse((event as CustomEvent<any>).detail);
            }, { once: true });
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:request', {
                detail: { requestId: 'peek-incomplete', type: 'peek', conversationId },
            }));
        });

        const parsed = typeof response === 'string' ? JSON.parse(response) : response;
        expect(parsed.ok).toBe(false);
    });
});
