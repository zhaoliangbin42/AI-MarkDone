import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ChatGPTConversationDiscoveryAdapter,
    createChatGPTPartialCandidateFromDomObservation,
} from '@/drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';
import { createConversationDocumentKeyV1 } from '@/contracts/conversationContent';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
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
            }],
        });
        window.removeEventListener(REQUEST_EVENT, responder);
        adapter.dispose();
    });

    it('merges a typed DOM successor into a passive graph captured before the latest reply', async () => {
        const passive = snapshot('Answer 1');
        const typedDocument = {
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            conversationId,
        } as const;
        const adapter = new ChatGPTConversationDiscoveryAdapter({
            readTypedDomCandidate: () => ({
                document: typedDocument,
                coverage: 'partial',
                turns: [
                    {
                        key: 'turn-1:assistant-1',
                        ordinal: 1,
                        identity: {
                            turnId: 'turn-1',
                            userMessageId: 'user-1',
                            assistantMessageId: 'assistant-1',
                        },
                        userText: 'Question',
                        assistantMarkdown: 'Answer 1',
                    },
                    {
                        key: 'turn-2:assistant-2',
                        ordinal: 2,
                        identity: {
                            turnId: 'turn-2',
                            userMessageId: 'user-2',
                            assistantMessageId: 'assistant-2',
                        },
                        userText: 'Follow-up',
                        assistantMarkdown: 'Answer 2',
                    },
                ],
            }),
        });
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            expect(request.type).toBe('peek');
            dispatchResponse(request, passive);
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);
        try {
            const result = await adapter.acquire(new AbortController().signal);

            expect(result?.coverage).toBe('complete');
            expect(result?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            window.removeEventListener(REQUEST_EVENT, responder);
            adapter.dispose();
        }
    });

    it('does not perform active acquisition until the real-browser gate enables it', async () => {
        const adapter = new ChatGPTConversationDiscoveryAdapter();
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

    it('retries one timeout/5xx acquisition only when typed DOM evidence exists', async () => {
        vi.useFakeTimers();
        const adapter = new ChatGPTConversationDiscoveryAdapter({
            allowActiveAcquisition: true,
            hasTypedDomEvidence: () => true,
        });
        const requests: string[] = [];
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            requests.push(request.type);
            if (request.type === 'peek') {
                dispatchResponse(request, undefined, { code: 'BRIDGE_UNAVAILABLE', retryable: true });
                return;
            }
            if (requests.filter((type) => type === 'acquire').length === 1) {
                dispatchResponse(request, undefined, { code: 'HTTP_503', retryable: true });
            } else {
                dispatchResponse(request, snapshot('Recovered'));
            }
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);

        const promise = adapter.acquire(new AbortController().signal);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(500);
        const result = await promise;

        expect(requests).toEqual(['peek', 'acquire', 'acquire']);
        expect(result?.turns[0]?.assistantMarkdown).toBe('Recovered');
        window.removeEventListener(REQUEST_EVENT, responder);
        adapter.dispose();
        vi.useRealTimers();
    });

    it('builds only a typed contiguous partial candidate from DOM evidence', () => {
        const result = createChatGPTPartialCandidateFromDomObservation({
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            conversationId,
        }, {
            observedAt: Date.now(),
            rounds: [{
                position: 1,
                roundId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
                assistantTurnId: 'assistant-turn-1',
                userPrompt: 'Question',
                assistantContent: 'Answer',
                status: 'complete',
            }, {
                position: 2,
                roundId: 'turn-2',
                userMessageId: 'user-2',
                assistantMessageId: null,
                assistantTurnId: 'assistant-turn-2',
                userPrompt: 'Pending',
                assistantContent: '',
                status: 'incomplete',
            }],
        });
        expect(result).toMatchObject({
            coverage: 'partial',
            turns: [{
                identity: { assistantMessageId: 'assistant-1' },
            }],
        });
    });

    it('keeps completed typed turns visible when a streaming turn precedes a later mounted turn', () => {
        const result = createChatGPTPartialCandidateFromDomObservation({
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            conversationId,
        }, {
            observedAt: Date.now(),
            rounds: [{
                position: 1,
                roundId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: null,
                assistantTurnId: 'assistant-turn-1',
                userPrompt: 'Streaming',
                assistantContent: '',
                status: 'streaming',
            }, {
                position: 2,
                roundId: 'turn-2',
                userMessageId: 'user-2',
                assistantMessageId: 'assistant-2',
                assistantTurnId: 'assistant-turn-2',
                userPrompt: 'Completed',
                assistantContent: 'Answer',
                status: 'complete',
            }],
        });
        expect(result?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual(['assistant-2']);
    });
});
