import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ChatGPTConversationDiscoveryAdapter } from '@/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';

const conversationId = '12345678-1234-1234-1234-123456789abc';
const bridgeSource = readFileSync(
    resolve(process.cwd(), 'public/page-bridges/chatgpt-conversation-bridge.js'),
    'utf8',
);

function graphPayload() {
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
                    status: 'finished_successfully',
                    content: { content_type: 'text', parts: ['Answer'] },
                },
            },
        },
    };
}

function installBridge(): void {
    new Function(bridgeSource)();
}

describe('ChatGPTConversationDiscoveryAdapter', () => {
    let adapter: ChatGPTConversationDiscoveryAdapter;

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
        adapter = new ChatGPTConversationDiscoveryAdapter();
    });

    afterEach(() => {
        adapter.dispose();
        (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__?.dispose?.();
        delete (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        history.replaceState({}, '', '/');
    });

    it('peeks the real bridge output into one canonical candidate', async () => {
        installBridge();
        await window.fetch(`/backend-api/conversation/${conversationId}`);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const candidate = await adapter.readBaseline(new AbortController().signal);

        expect(candidate).toMatchObject({
            origin: 'source',
            coverage: 'complete',
            document: { conversationId },
            turns: [{
                identity: { assistantMessageId: 'assistant-message' },
                assistantMarkdown: 'Answer',
            }],
        });
    });

    it('re-emits only current-conversation bridge capture signals', () => {
        const listener = vi.fn();
        const unsubscribe = adapter.subscribeSignals(listener);

        window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
            detail: JSON.stringify({ kind: 'graph', conversationId: 'other-conversation' }),
        }));
        window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
            detail: JSON.stringify({ kind: 'graph', conversationId }),
        }));

        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });
});
