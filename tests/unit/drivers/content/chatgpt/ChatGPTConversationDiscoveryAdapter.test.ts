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

    it('preserves a safe non-UUID conversation token exactly across route and Bridge identity', async () => {
        const genericId = 'conv_ABC-12345678';
        history.replaceState({}, '', `/workspace/g/project/c/${genericId}`);
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            dispatchResponse(request, { ...snapshot(), conversationId: genericId });
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        try {
            expect(adapter.resolveDocument()?.conversationId).toBe(genericId);
            const result = await adapter.peek();
            expect(result?.document.conversationId).toBe(genericId);
        } finally {
            window.removeEventListener(REQUEST_EVENT, responder);
            adapter.dispose();
        }
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

    it('reads a baseline only through passive Bridge memory', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const requests: string[] = [];
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            requests.push(request.type);
            dispatchResponse(request, undefined, { code: 'BRIDGE_UNAVAILABLE', retryable: true });
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        await expect(adapter.readBaseline(new AbortController().signal)).rejects.toMatchObject({
            reason: 'source-unavailable',
        });
        expect(requests).toEqual(['peek']);
        window.removeEventListener(REQUEST_EVENT, responder);
        adapter.dispose();
    });

    it('notifies baseline admission only for a Graph capture on the current conversation', () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const listener = vi.fn();
        const unsubscribe = adapter.subscribeSignals(listener);

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'unrelated-host-event',
                conversationId,
            }),
        }));
        expect(listener).not.toHaveBeenCalled();

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'graph',
                conversationId,
            }),
        }));
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        adapter.dispose();
    });

    it('ignores Graph capture signals for a conversation other than the current route', () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const listener = vi.fn();
        const unsubscribe = adapter.subscribeSignals(listener);
        const nextConversationId = '795499b7-464c-8323-a998-119f661ac954';

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'graph',
                conversationId: nextConversationId,
            }),
        }));
        expect(listener).not.toHaveBeenCalled();

        history.replaceState({}, '', `/c/${nextConversationId}`);
        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                kind: 'graph',
                conversationId: nextConversationId,
            }),
        }));

        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        adapter.dispose();
    });

    it('pulls bridge diagnostics counters and caches the last snapshot', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const bridgeDiagnostics = {
            version: 6,
            observedEligibleGets: 3,
            graphsAccepted: 2,
            graphsRejected: 1,
            capturesPublished: 2,
            evictions: 0,
            bytesSkipped: 0,
            parseFailures: 1,
            graphCount: 1,
        };
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'diagnostics') return;
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: { requestId: request.requestId, ok: true, diagnostics: bridgeDiagnostics },
            }));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        try {
            const diagnostics = await adapter.readBridgeDiagnostics();
            expect(diagnostics).toEqual(bridgeDiagnostics);
            expect(adapter.getCachedBridgeDiagnostics()).toEqual(bridgeDiagnostics);
            expect(adapter.isBridgeUnavailable()).toBe(false);
        } finally {
            window.removeEventListener(REQUEST_EVENT, responder);
            adapter.dispose();
        }
    });

    it('marks the bridge unavailable on BRIDGE_UNAVAILABLE and on bootstrap load failure', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'peek') return;
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        try {
            await expect(adapter.peek()).rejects.toMatchObject({ reason: 'source-unavailable' });
            expect(adapter.isBridgeUnavailable()).toBe(true);
        } finally {
            window.removeEventListener(REQUEST_EVENT, responder);
        }

        const diagnosticsResponder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'diagnostics') return;
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: {
                    requestId: request.requestId,
                    ok: true,
                    diagnostics: {
                        version: 6,
                        observedEligibleGets: 0,
                        graphsAccepted: 0,
                        graphsRejected: 0,
                        capturesPublished: 0,
                        evictions: 0,
                        bytesSkipped: 0,
                        parseFailures: 0,
                        graphCount: 0,
                    },
                },
            }));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, diagnosticsResponder);
        try {
            await adapter.readBridgeDiagnostics();
            expect(adapter.isBridgeUnavailable()).toBe(false);

            window.dispatchEvent(new Event('aimd:chatgpt-conversation-bridge:bootstrap-error'));
            expect(adapter.isBridgeUnavailable()).toBe(true);
        } finally {
            window.removeEventListener(REQUEST_EVENT, diagnosticsResponder);
            adapter.dispose();
        }
    });

    it('counts capture signals only for the current conversation', () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
        // The capture listener registers with the first signal subscriber,
        // matching the production runtime wiring order.
        const unsubscribe = adapter.subscribeSignals(() => {});

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({ kind: 'graph', conversationId }),
        }));
        expect(adapter.getCaptureSignalCount()).toBe(1);

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({ kind: 'graph', conversationId: '795499b7-464c-8323-a998-119f661ac954' }),
        }));
        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({ kind: 'unrelated-host-event', conversationId }),
        }));
        expect(adapter.getCaptureSignalCount()).toBe(1);

        unsubscribe();
        adapter.dispose();
    });
});
