import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BRIDGE_PATH = 'public/page-bridges/chatgpt-conversation-bridge.js';
const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';

function installBridge(): void {
    const script = readFileSync(BRIDGE_PATH, 'utf-8');
    window.eval(script);
}

function decodeDetail(detail: unknown): any {
    return typeof detail === 'string' ? JSON.parse(detail) : detail;
}

function requestSnapshot(conversationId: string, options?: { stringDetail?: boolean; onRawResponse?: (detail: unknown) => void }): Promise<any> {
    const requestId = `test-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
        const listener = ((event: Event) => {
            const rawDetail = (event as CustomEvent<any>).detail;
            options?.onRawResponse?.(rawDetail);
            const detail = decodeDetail(rawDetail);
            if (detail?.requestId !== requestId) return;
            window.removeEventListener(RESPONSE_EVENT, listener);
            resolve(detail);
        }) as EventListener;
        window.addEventListener(RESPONSE_EVENT, listener);
        const detail = {
            requestId,
            type: 'snapshot',
            conversationId,
            force: true,
        };
        window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
            detail: options?.stringDetail ? JSON.stringify(detail) : detail,
        }));
    });
}

function attachStructuredTurns(): void {
    document.body.innerHTML = `
      <main>
        <div data-turn-id-container id="u1"></div>
        <div data-turn-id-container id="a1"></div>
        <div data-turn-id-container id="u2"></div>
        <div data-turn-id-container id="a2"></div>
      </main>
    `;
    const attachTurn = (id: string, turn: Record<string, unknown>) => {
        const element = document.getElementById(id) as any;
        element.__reactFiber$aimd = {
            pendingProps: { value: { currentTurn: turn } },
            return: null,
        };
    };
    attachTurn('u1', {
        id: 'turn-u1',
        author: { role: 'user' },
        messages: [message('u1-message', 'user', 'Question 1')],
    });
    attachTurn('a1', {
        id: 'turn-a1',
        author: { role: 'assistant' },
        messages: [
            message('tool-message', 'tool', 'Hidden file content', {
                metadata: { is_visually_hidden_from_conversation: true },
            }),
            message('a1-message', 'assistant', 'Answer 1'),
        ],
    });
    attachTurn('u2', {
        id: 'turn-u2',
        role: 'user',
        messages: [message('u2-message', 'user', 'Question 2')],
    });
    attachTurn('a2', {
        id: 'turn-a2',
        role: 'assistant',
        messages: [message('a2-message', 'assistant', 'Answer 2')],
    });
}

function message(id: string, role: string, text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        author: { role },
        content: {
            content_type: 'text',
            parts: [text],
        },
        ...extra,
    };
}

describe('ChatGPT conversation bridge', () => {
    beforeEach(() => {
        delete (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__;
        sessionStorage.clear();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('builds a full snapshot from the backend conversation mapping before using DOM or store fallbacks', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const payload = {
            current_node: 'a2-node',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'u1-node': { id: 'u1-node', parent: 'root', message: message('u1', 'user', 'Question 1') },
                'a1-node': { id: 'a1-node', parent: 'u1-node', message: message('a1', 'assistant', 'Answer 1') },
                'tool-node': {
                    id: 'tool-node',
                    parent: 'a1-node',
                    message: message('tool1', 'tool', 'Hidden file content', {
                        metadata: { is_visually_hidden_from_conversation: true },
                    }),
                },
                'u2-node': { id: 'u2-node', parent: 'tool-node', message: message('u2', 'user', 'Question 2') },
                'a2-node': { id: 'a2-node', parent: 'u2-node', message: message('a2', 'assistant', 'Answer 2') },
            },
        };
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const response = await requestSnapshot(conversationId);

        expect(fetchMock).toHaveBeenCalledWith(`/backend-api/conversation/${conversationId}`, {
            credentials: 'include',
        });
        expect(response.ok).toBe(true);
        expect(response.snapshot.source).toBe('runtime-bridge');
        expect(response.snapshot.rounds).toHaveLength(2);
        expect(response.snapshot.rounds.map((round: any) => round.userPrompt)).toEqual(['Question 1', 'Question 2']);
        expect(response.snapshot.rounds.map((round: any) => round.assistantContent)).toEqual(['Answer 1', 'Answer 2']);
        expect(response.snapshot.rounds.map((round: any) => round.messageId)).toEqual(['a1', 'a2']);
    });

    it('keeps object responses for object requests', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();
        const rawResponses: unknown[] = [];

        installBridge();
        const response = await requestSnapshot(conversationId, { onRawResponse: (detail) => rawResponses.push(detail) });

        expect(response.ok).toBe(true);
        expect(typeof rawResponses[0]).toBe('object');
    });

    it('returns string responses for string requests used by Firefox content scripts', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();
        const rawResponses: unknown[] = [];

        installBridge();
        const response = await requestSnapshot(conversationId, {
            stringDetail: true,
            onRawResponse: (detail) => rawResponses.push(detail),
        });

        expect(response.ok).toBe(true);
        expect(typeof rawResponses[0]).toBe('string');
        expect(JSON.parse(rawResponses[0] as string).requestId).toBe(response.requestId);
    });

    it('builds a full snapshot from structured React turn containers when backend payload is unavailable', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();

        installBridge();
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(true);
        expect(response.snapshot.source).toBe('runtime-bridge');
        expect(response.snapshot.rounds).toHaveLength(2);
        expect(response.snapshot.rounds.map((round: any) => round.userPrompt)).toEqual(['Question 1', 'Question 2']);
        expect(response.snapshot.rounds.map((round: any) => round.assistantContent)).toEqual(['Answer 1', 'Answer 2']);
        expect(response.snapshot.rounds.map((round: any) => round.assistantMessageId)).toEqual(['a1-message', 'a2-message']);
    });

    it('does not repeatedly request a backend payload after a 404 for the same conversation', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();

        installBridge();
        const first = await requestSnapshot(conversationId);
        const second = await requestSnapshot(conversationId);

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(first.snapshot.rounds).toHaveLength(2);
        expect(second.snapshot.rounds).toHaveLength(2);
        const backendCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/backend-api/conversation/'));
        expect(backendCalls).toHaveLength(1);
    });
});
