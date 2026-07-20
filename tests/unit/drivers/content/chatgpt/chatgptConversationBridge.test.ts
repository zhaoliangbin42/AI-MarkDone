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

function requestSnapshot(
    conversationId: string,
    options?: { force?: boolean; stringDetail?: boolean; onRawResponse?: (detail: unknown) => void },
): Promise<any> {
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
            force: options?.force ?? true,
        };
        window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
            detail: options?.stringDetail ? JSON.stringify(detail) : detail,
        }));
    });
}

async function observeConversationFetch(conversationId: string): Promise<Response> {
    const response = await window.fetch(`/backend-api/conversation/${conversationId}`);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    return response;
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

function graphPayload(conversationId: string, userText = 'Question', assistantText = 'Answer'): Record<string, unknown> {
    return {
        conversation_id: conversationId,
        current_node: 'assistant-node',
        mapping: {
            root: { id: 'root', parent: null, message: null },
            'user-node': {
                id: 'user-node',
                parent: 'root',
                message: message('user-message', 'user', userText),
            },
            'assistant-node': {
                id: 'assistant-node',
                parent: 'user-node',
                message: message('assistant-message', 'assistant', assistantText),
            },
        },
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
        (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__?.dispose?.();
        delete (window as any).__AIMD_CHATGPT_CONVERSATION_BRIDGE__;
        sessionStorage.clear();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('contains no credential acquisition or authenticated request construction across the discovery chain', () => {
        const source = [
            BRIDGE_PATH,
            'public/page-bridges/chatgpt-conversation-bootstrap.js',
            'src/drivers/content/chatgpt/ChatGPTConversationEngine.ts',
        ].map((path) => readFileSync(path, 'utf-8')).join('\n');
        const forbidden = [
            ['', 'api', 'auth', 'session'].join('/'),
            ['access', 'Token'].join(''),
            ['Author', 'ization'].join(''),
            ['document', 'cookie'].join('.'),
            'credentials',
        ];

        forbidden.forEach((value) => expect(source).not.toContain(value));
    });

    it('builds a canonical snapshot from a verified backend conversation graph', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const payload = {
            conversation_id: conversationId,
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
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`/backend-api/conversation/${conversationId}`);
        expect(response.ok).toBe(true);
        expect(response.snapshot.source).toBe('runtime-bridge');
        expect(response.snapshot.origin).toBe('conversation-graph');
        expect(response.snapshot.coverage).toBe('complete');
        expect(response.snapshot.branchKey).toBe('a2-node');
        expect(response.snapshot.rounds).toHaveLength(2);
        expect(response.snapshot.rounds.map((round: any) => round.userPrompt)).toEqual(['Question 1', 'Question 2']);
        expect(response.snapshot.rounds.map((round: any) => round.assistantContent)).toEqual(['Answer 1', 'Answer 2']);
        expect(response.snapshot.rounds.map((round: any) => round.messageId)).toEqual(['a1', 'a2']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a conversation graph whose payload identity does not match the requested conversation', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const payload = {
            conversation_id: '79e8d157-5fec-839c-9124-2179ba8b7d7d',
            current_node: 'assistant-node',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'user-node': {
                    id: 'user-node',
                    parent: 'root',
                    message: message('user-message', 'user', 'Old conversation question'),
                },
                'assistant-node': {
                    id: 'assistant-node',
                    parent: 'user-node',
                    message: message('assistant-message', 'assistant', 'Old conversation answer'),
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
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
        expect(response.error?.code).toBe('BRIDGE_UNAVAILABLE');
    });

    it('rejects graph content that cannot prove the requested conversation identity', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const payload = {
            current_node: 'assistant-node',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'user-node': {
                    id: 'user-node',
                    parent: 'root',
                    message: message('user-message', 'user', 'Unproven question'),
                },
                'assistant-node': {
                    id: 'assistant-node',
                    parent: 'user-node',
                    message: message('assistant-message', 'assistant', 'Unproven answer'),
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
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('rejects a graph whose active branch has a missing parent node', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const payload = {
            conversation_id: conversationId,
            current_node: 'assistant-node',
            mapping: {
                'user-node': {
                    id: 'user-node',
                    parent: 'missing-root',
                    message: message('user-message', 'user', 'Question'),
                },
                'assistant-node': {
                    id: 'assistant-node',
                    parent: 'user-node',
                    message: message('assistant-message', 'assistant', 'Answer'),
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
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('rejects a rebased hydration window whose parent-null node is a displayable message', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            conversation_id: conversationId,
            current_node: 'assistant-47',
            mapping: {
                'user-44': {
                    id: 'user-44',
                    parent: null,
                    message: message('user-message-44', 'user', 'Prompt 44'),
                },
                'assistant-44': {
                    id: 'assistant-44',
                    parent: 'user-44',
                    message: message('assistant-message-44', 'assistant', 'Answer 44'),
                },
                'user-47': {
                    id: 'user-47',
                    parent: 'assistant-44',
                    message: message('user-message-47', 'user', 'Prompt 47'),
                },
                'assistant-47': {
                    id: 'assistant-47',
                    parent: 'user-47',
                    message: message('assistant-message-47', 'assistant', 'Answer 47'),
                },
            },
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('rejects a graph whose current leaf is missing from the mapping', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            conversation_id: conversationId,
            current_node: 'missing-leaf',
            mapping: {
                root: { id: 'root', parent: null, message: null },
            },
        }), { status: 200 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('rejects a graph whose active branch contains a parent cycle', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            conversation_id: conversationId,
            current_node: 'assistant-node',
            mapping: {
                'user-node': {
                    id: 'user-node',
                    parent: 'assistant-node',
                    message: message('user-message', 'user', 'Question'),
                },
                'assistant-node': {
                    id: 'assistant-node',
                    parent: 'user-node',
                    message: message('assistant-message', 'assistant', 'Answer'),
                },
            },
        }), { status: 200 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('uses a completed Deep Research report from the backend mapping as the assistant content', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const reportMarkdown = '# Deep Research Report\n\n## Findings\n\nFull report body. citeturn0search0';
        const payload = {
            conversation_id: conversationId,
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
        await observeConversationFetch(conversationId);
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
            conversation_id: conversationId,
            current_node: parent,
            mapping,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
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
            conversation_id: conversationId,
            current_node: 'assistant-shell-node',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'user-node': {
                    id: 'user-node',
                    parent: 'root',
                    message: message('turn-user-message', 'user', 'Research this topic'),
                },
                'deep-research-node': {
                    id: 'deep-research-node',
                    parent: 'user-node',
                    message: deepResearchToolMessage(reportMarkdown),
                },
                'assistant-shell-node': {
                    id: 'assistant-shell-node',
                    parent: 'deep-research-node',
                    message: message('', 'assistant', ''),
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
        await observeConversationFetch(conversationId);
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
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(graphPayload(conversationId)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();
        const rawResponses: unknown[] = [];

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId, { onRawResponse: (detail) => rawResponses.push(detail) });

        expect(response.ok).toBe(true);
        expect(typeof rawResponses[0]).toBe('object');
    });

    it('returns string responses for string requests used by Firefox content scripts', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(graphPayload(conversationId)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();
        const rawResponses: unknown[] = [];

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId, {
            stringDetail: true,
            onRawResponse: (detail) => rawResponses.push(detail),
        });

        expect(response.ok).toBe(true);
        expect(typeof rawResponses[0]).toBe('string');
        expect(JSON.parse(rawResponses[0] as string).requestId).toBe(response.requestId);
    });

    it('does not accept structured React turns as a complete snapshot when graph identity is unavailable', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachStructuredTurns();

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('does not accept a completed Deep Research report from unproven structured React turns', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const reportMarkdown = '# Deep Research Report\n\n## Findings\n\nFull report body.';
        const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);
        attachDeepResearchStructuredTurn(reportMarkdown);

        installBridge();
        await observeConversationFetch(conversationId);
        const response = await requestSnapshot(conversationId);

        expect(response.ok).toBe(false);
        expect(response.snapshot).toBeUndefined();
    });

    it('never initiates a conversation request while serving snapshot reads', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const first = await requestSnapshot(conversationId, { force: false });
        const second = await requestSnapshot(conversationId, { force: true });

        expect(first.ok).toBe(false);
        expect(second.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not inspect responses outside the conversation graph transport', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const hostResponse = new Response(JSON.stringify({ state: 'private' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        const cloneSpy = vi.spyOn(hostResponse, 'clone');
        const fetchMock = vi.fn(async () => hostResponse);
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const returned = await window.fetch('/api/session-state');
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const snapshot = await requestSnapshot(conversationId);

        expect(returned).toBe(hostResponse);
        expect(cloneSpy).not.toHaveBeenCalled();
        expect(snapshot.ok).toBe(false);
    });

    it('does not inspect a cross-origin conversation write response', async () => {
        const hostResponse = new Response('data: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
        const cloneSpy = vi.spyOn(hostResponse, 'clone');
        const fetchMock = vi.fn(async () => hostResponse);
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const returned = await window.fetch('https://example.com/backend-api/conversation', {
            method: 'POST',
            body: '{}',
        });
        await new Promise((resolve) => window.setTimeout(resolve, 0));

        expect(returned).toBe(hostResponse);
        expect(cloneSpy).not.toHaveBeenCalled();
    });

    it('does not inspect non-GET responses on graph-read paths', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const hostResponse = new Response(JSON.stringify(graphPayload(conversationId)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        const cloneSpy = vi.spyOn(hostResponse, 'clone');
        const fetchMock = vi.fn(async () => hostResponse);
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const returned = await window.fetch(`/backend-api/conversation/${conversationId}`, { method: 'POST' });
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const snapshot = await requestSnapshot(conversationId);

        expect(returned).toBe(hostResponse);
        expect(cloneSpy).not.toHaveBeenCalled();
        expect(snapshot.ok).toBe(false);
    });

    it('merges an observed hydration window without degrading a previously known parent', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const initialPayload = {
            conversation_id: conversationId,
            current_node: 'assistant-2',
            mapping: {
                root: { id: 'root', parent: null, message: null },
                'user-1': { id: 'user-1', parent: 'root', message: message('u1', 'user', 'Question 1') },
                'assistant-1': { id: 'assistant-1', parent: 'user-1', message: message('a1', 'assistant', 'Answer 1') },
                'user-2': { id: 'user-2', parent: 'assistant-1', message: message('u2', 'user', 'Question 2') },
                'assistant-2': { id: 'assistant-2', parent: 'user-2', message: message('a2', 'assistant', 'Answer 2') },
            },
        };
        const hydrationWindow = {
            conversation_id: conversationId,
            current_node: 'assistant-3',
            mapping: {
                'user-2': { id: 'user-2', parent: null, message: message('u2', 'user', 'Question 2') },
                'assistant-2': { id: 'assistant-2', parent: 'user-2', message: message('a2', 'assistant', 'Answer 2') },
                'user-3': { id: 'user-3', parent: 'assistant-2', message: message('u3', 'user', 'Question 3') },
                'assistant-3': { id: 'assistant-3', parent: 'user-3', message: message('a3', 'assistant', 'Answer 3') },
            },
        };
        let requestCount = 0;
        const fetchMock = vi.fn(async () => {
            requestCount += 1;
            return new Response(JSON.stringify(requestCount === 1 ? initialPayload : hydrationWindow), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
        const initial = await requestSnapshot(conversationId);
        await observeConversationFetch(conversationId);
        const refreshed = await requestSnapshot(conversationId);

        expect(initial.ok).toBe(true);
        expect(initial.snapshot.rounds).toHaveLength(2);
        expect(refreshed.ok).toBe(true);
        expect(refreshed.snapshot.rounds.map((round: any) => round.userPrompt)).toEqual([
            'Question 1',
            'Question 2',
            'Question 3',
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not let an older response overwrite newer content when responses finish out of order', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        let resolveOlder!: (response: Response) => void;
        let resolveNewer!: (response: Response) => void;
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOlder = resolve; }))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveNewer = resolve; }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        const olderFetch = window.fetch(`/backend-api/conversation/${conversationId}`);
        const newerFetch = window.fetch(`/backend-api/conversation/${conversationId}`);
        resolveNewer(new Response(JSON.stringify(graphPayload(conversationId, 'Question', 'Newest answer')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await newerFetch;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        resolveOlder(new Response(JSON.stringify(graphPayload(conversationId, 'Question', 'Older answer')), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await olderFetch;
        await new Promise((resolve) => window.setTimeout(resolve, 0));

        const snapshot = await requestSnapshot(conversationId);
        expect(snapshot.ok).toBe(true);
        expect(snapshot.snapshot.rounds[0].assistantContent).toBe('Newest answer');
    });

    it('does not regress the current leaf when a newer hydration window ends at an ancestor', async () => {
        const conversationId = '69e8d157-5fec-839c-9124-2179ba8b7d7c';
        const fullMapping = {
            root: { id: 'root', parent: null, message: null },
            'user-1': { id: 'user-1', parent: 'root', message: message('u1', 'user', 'Question 1') },
            'assistant-1': { id: 'assistant-1', parent: 'user-1', message: message('a1', 'assistant', 'Answer 1') },
            'user-2': { id: 'user-2', parent: 'assistant-1', message: message('u2', 'user', 'Question 2') },
            'assistant-2': { id: 'assistant-2', parent: 'user-2', message: message('a2', 'assistant', 'Answer 2') },
            'user-3': { id: 'user-3', parent: 'assistant-2', message: message('u3', 'user', 'Question 3') },
            'assistant-3': { id: 'assistant-3', parent: 'user-3', message: message('a3', 'assistant', 'Answer 3') },
        };
        const payloads = [
            { conversation_id: conversationId, current_node: 'assistant-3', mapping: fullMapping },
            {
                conversation_id: conversationId,
                current_node: 'assistant-2',
                mapping: {
                    'user-2': { id: 'user-2', parent: null, message: message('u2', 'user', 'Question 2') },
                    'assistant-2': { id: 'assistant-2', parent: 'user-2', message: message('a2', 'assistant', 'Answer 2') },
                },
            },
        ];
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(payloads.shift()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock });
        vi.stubGlobal('fetch', fetchMock);

        installBridge();
        await observeConversationFetch(conversationId);
        await observeConversationFetch(conversationId);
        const snapshot = await requestSnapshot(conversationId);

        expect(snapshot.ok).toBe(true);
        expect(snapshot.snapshot.branchKey).toBe('assistant-3');
        expect(snapshot.snapshot.rounds.map((round: any) => round.userPrompt)).toEqual([
            'Question 1',
            'Question 2',
            'Question 3',
        ]);
    });
});
