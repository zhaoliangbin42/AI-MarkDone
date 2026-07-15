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

function attachDeepResearchStructuredTurn(reportMarkdown: string): void {
    document.body.innerHTML = `
      <main>
        <div data-turn-id-container id="deep-user"></div>
        <div data-turn-id-container id="deep-assistant"></div>
      </main>
    `;
    const attachTurn = (id: string, turn: Record<string, unknown>) => {
        const element = document.getElementById(id) as any;
        element.__reactFiber$aimd = {
            pendingProps: { value: { currentTurn: turn } },
            return: null,
        };
    };
    attachTurn('deep-user', {
        id: 'turn-deep-user',
        author: { role: 'user' },
        messages: [message('deep-user-message', 'user', 'Research this topic')],
    });
    attachTurn('deep-assistant', {
        id: 'turn-deep-assistant',
        author: { role: 'assistant' },
        messages: [
            message('uploaded-file', 'tool', 'Private uploaded manuscript body'),
            deepResearchToolMessage(reportMarkdown),
            message('deep-assistant-shell', 'assistant', 'Research report ready.'),
        ],
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

function deepResearchToolMessage(
    reportMarkdown: string,
    options: {
        stateStatus?: string;
        reportStatus?: string;
        reportComplete?: boolean;
        resourceName?: string;
        resourceUri?: string;
        widgetState?: string;
    } = {},
): Record<string, unknown> {
    const reportMessage = message('deep-research-report', 'assistant', reportMarkdown, {
        status: options.reportStatus ?? 'finished_successfully',
        metadata: {
            is_complete: options.reportComplete ?? true,
            finish_details: { type: 'stop' },
        },
    });
    const widgetState = options.widgetState ?? JSON.stringify({
        status: options.stateStatus ?? 'completed',
        report_message: reportMessage,
    });

    return message('deep-research-tool', 'tool', 'Internal tool shell', {
        metadata: {
            invoked_resource: {
                resource_uri: options.resourceUri ?? '/connector_openai_deep_research/start',
            },
            chatgpt_sdk: {
                resource_name: options.resourceName ?? 'Deep Research App_start',
                widget_state: widgetState,
            },
        },
    });
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

    it('uses a completed Deep Research report from the backend mapping as the assistant content', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const reportMarkdown = '# Deep Research Report\n\n## Findings\n\nFull report body. citeturn0search0';
        const payload = {
            current_node: 'assistant-shell-node',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'user-node': {
                    id: 'user-node',
                    parent: 'root',
                    message: message('user-message', 'user', 'Research this topic'),
                },
                'upload-node': {
                    id: 'upload-node',
                    parent: 'user-node',
                    message: message('uploaded-file', 'tool', 'Private uploaded manuscript body'),
                },
                'deep-research-node': {
                    id: 'deep-research-node',
                    parent: 'upload-node',
                    message: deepResearchToolMessage(reportMarkdown),
                },
                'assistant-shell-node': {
                    id: 'assistant-shell-node',
                    parent: 'deep-research-node',
                    message: message('assistant-shell', 'assistant', 'Research report ready.'),
                },
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

        expect(response.ok).toBe(true);
        expect(response.snapshot.rounds).toHaveLength(1);
        expect(response.snapshot.rounds[0]).toMatchObject({
            userPrompt: 'Research this topic',
            assistantContent: reportMarkdown,
            messageId: 'assistant-shell',
            assistantMessageId: 'assistant-shell',
        });
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Private uploaded manuscript body');
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Internal tool shell');
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Research report ready.');
    });

    it('fails closed for incomplete, unrelated, malformed, or empty embedded reports', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const cases = [
            deepResearchToolMessage('Partial report must stay hidden', {
                stateStatus: 'in_progress',
                reportStatus: 'in_progress',
                reportComplete: false,
            }),
            deepResearchToolMessage('Unknown widget report must stay hidden', {
                resourceName: 'Unknown App_start',
                resourceUri: '/connector_unknown/start',
            }),
            deepResearchToolMessage('Malformed report must stay hidden', {
                widgetState: '{not-json',
            }),
            deepResearchToolMessage('', {}),
        ];
        const mapping: Record<string, unknown> = {
            root: { id: 'root', parent: null, message: null },
        };
        let parent = 'root';
        cases.forEach((toolMessage, index) => {
            const position = index + 1;
            const userNode = `user-${position}`;
            const toolNode = `tool-${position}`;
            const assistantNode = `assistant-${position}`;
            mapping[userNode] = {
                id: userNode,
                parent,
                message: message(`user-message-${position}`, 'user', `Question ${position}`),
            };
            mapping[toolNode] = { id: toolNode, parent: userNode, message: toolMessage };
            mapping[assistantNode] = {
                id: assistantNode,
                parent: toolNode,
                message: message(`assistant-message-${position}`, 'assistant', `Fallback answer ${position}`),
            };
            parent = assistantNode;
        });
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            current_node: parent,
            mapping,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(true);
        expect(response.snapshot.rounds.map((round: any) => round.assistantContent)).toEqual([
            'Fallback answer 1',
            'Fallback answer 2',
            'Fallback answer 3',
            'Fallback answer 4',
        ]);
    });

    it('uses the nested report id when a turn-array Deep Research shell has no message id', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const reportMarkdown = '# Deep Research Report\n\nFull report body.';
        const payload = {
            turns: [
                {
                    id: 'turn-user',
                    role: 'user',
                    messages: [message('turn-user-message', 'user', 'Research this topic')],
                },
                {
                    id: 'turn-assistant-status',
                    role: 'assistant',
                    messages: [message('assistant-status', 'assistant', 'Research underway.')],
                },
                {
                    id: 'turn-assistant',
                    role: 'assistant',
                    messages: [
                        deepResearchToolMessage(reportMarkdown),
                        message('', 'assistant', ''),
                    ],
                },
            ],
        };
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(true);
        expect(response.snapshot.rounds[0]).toMatchObject({
            assistantContent: reportMarkdown,
            messageId: 'deep-research-report',
            assistantMessageId: 'deep-research-report',
        });
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Research underway.');
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

    it('prefers a completed Deep Research report over the assistant shell in structured React turns', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const reportMarkdown = '# Deep Research Report\n\n## Findings\n\nFull report body.';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachDeepResearchStructuredTurn(reportMarkdown);

        installBridge();
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(true);
        expect(response.snapshot.rounds).toHaveLength(1);
        expect(response.snapshot.rounds[0]).toMatchObject({
            userPrompt: 'Research this topic',
            assistantContent: reportMarkdown,
            messageId: 'deep-assistant-shell',
            assistantMessageId: 'deep-assistant-shell',
        });
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Research report ready.');
        expect(response.snapshot.rounds[0].assistantContent).not.toContain('Private uploaded manuscript body');
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
