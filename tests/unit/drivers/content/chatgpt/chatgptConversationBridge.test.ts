import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
