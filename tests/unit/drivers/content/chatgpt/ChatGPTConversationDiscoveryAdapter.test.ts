import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ChatGPTConversationDiscoveryAdapter,
} from '@/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const conversationId = '695499b7-464c-8323-a998-119f661ac953';

function dispatchResponse(request: any, snapshot?: any, error?: any): void {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
        detail: {
            requestId: request.requestId,
            ok: Boolean(snapshot),
            snapshot,
            error,
        },
    }));
}

function snapshot(answer = 'Answer'): any {
    return {
        conversationId,
        capturedAt: Date.now(),
        branchKey: 'assistant-1',
        rounds: [{
            id: 'turn-1',
            position: 1,
            userPrompt: 'Question',
            assistantContent: answer,
            preview: 'Question',
            messageId: 'assistant-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }],
    };
}

describe('ChatGPTConversationDiscoveryAdapter', () => {
    beforeEach(() => {
        history.replaceState({}, '', `/c/${conversationId}?branch=latest#turn-1`);
    });

    it('maps a verified passive graph to the provider-neutral candidate contract', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            expect(request.type).toBe('peek');
            dispatchResponse(request, snapshot());
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        const result = await adapter.peek();

        expect(result).toMatchObject({
            document: {
                platformId: 'chatgpt',
                conversationId,
            },
            coverage: 'complete',
            turns: [{
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                assistantMarkdown: 'Answer',
                assistantProvenance: {
                    authority: 'verified-derived',
                    fidelity: 'normalized',
                    producer: 'chatgpt-markdown-source-adapter',
                },
            }],
        });
        window.removeEventListener(REQUEST_EVENT, responder);
        adapter.dispose();
    });

    it('adapts provider-specific Markdown once before it crosses the content port', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            dispatchResponse(request, snapshot(
                'Read [the paper](https://example.com/paper) citeturn0search0 and \\(x+y\\).',
            ));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        try {
            const result = await adapter.peek();

            expect(result?.turns[0]).toMatchObject({
                assistantMarkdown: 'Read the paper  and $x+y$.',
                assistantProvenance: {
                    authority: 'verified-derived',
                    fidelity: 'normalized',
                    producer: 'chatgpt-markdown-source-adapter',
                },
            });
        } finally {
            window.removeEventListener(REQUEST_EVENT, responder);
            adapter.dispose();
        }
    });

    it('never performs active acquisition even when the legacy option is enabled', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter({ allowActiveAcquisition: true });
        const requests: string[] = [];
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            requests.push(request.type);
            dispatchResponse(request, undefined, { code: 'BRIDGE_UNAVAILABLE', retryable: true });
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        await expect(adapter.acquire(new AbortController().signal)).rejects.toMatchObject({
            reason: 'source-unavailable',
        });
        expect(requests).toEqual(['peek']);
        window.removeEventListener(REQUEST_EVENT, responder);
        adapter.dispose();
    });

    it('scopes transport completion evidence to the current assistant generation', () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const listener = vi.fn();
        const unsubscribe = adapter.subscribeSignals(listener);

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'generation-complete',
                conversationId,
                assistantMessageId: 'assistant-1',
            }),
        }));
        expect(adapter.getCompletedAssistantMessageId(conversationId)).toBe('assistant-1');

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'generation-start',
                conversationId,
            }),
        }));
        expect(adapter.getCompletedAssistantMessageId(conversationId)).toBeNull();
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        adapter.dispose();
    });

    it('retains completion evidence only for the current conversation', () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const unsubscribe = adapter.subscribeSignals(() => undefined);
        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'generation-complete',
                conversationId,
                assistantMessageId: 'assistant-1',
            }),
        }));

        const nextConversationId = '795499b7-464c-8323-a998-119f661ac954';
        history.replaceState({}, '', `/c/${nextConversationId}`);
        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'generation-complete',
                conversationId: nextConversationId,
                assistantMessageId: 'assistant-2',
            }),
        }));

        expect(adapter.getCompletedAssistantMessageId(conversationId)).toBeNull();
        expect(adapter.getCompletedAssistantMessageId(nextConversationId)).toBe('assistant-2');
        unsubscribe();
        adapter.dispose();
    });

});
