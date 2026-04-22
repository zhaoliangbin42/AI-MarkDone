import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
    },
}));

import { ChatGPTConversationEngine } from '@/drivers/content/chatgpt/ChatGPTConversationEngine';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';

function createAdapter() {
    return {
        getPlatformId: () => 'chatgpt',
        getMessageSelector: () => '[data-message-author-role="assistant"][data-message-id]',
        getMessageContentSelector: () => '.markdown',
        getObserverContainer: () => document.body,
        getMessageId: (el: HTMLElement) => el.getAttribute('data-message-id'),
        extractUserPrompt: () => 'Prompt from adapter',
        getMarkdownParserAdapter: () => null,
    } as any;
}

describe('ChatGPTConversationEngine', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        history.replaceState({}, '', `/c/${conversationId}`);
        vi.restoreAllMocks();
    });

    it('loads a bridge snapshot once and serves subsequent requests from cache', async () => {
        const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', ((event: Event) => {
            const detail = (event as CustomEvent<any>).detail;
            requestCount += 1;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: detail.requestId,
                    ok: true,
                    snapshot: {
                        conversationId,
                        buildFingerprint: 'build-1',
                        capturedAt: 1,
                        source: 'runtime-bridge',
                        rounds: [],
                    },
                },
            }));
        }) as EventListener, { once: false });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const first = await engine.getSnapshot();
        const second = await engine.getSnapshot();

        expect(first?.source).toBe('runtime-bridge');
        expect(second).toBe(first);
        expect(requestCount).toBe(1);
        expect(appendSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to DOM extraction if the bridge script fails to load', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onerror?.(new Event('error')), 0);
            return node;
        });
        document.body.innerHTML = `
          <article data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt</div></div>
          </article>
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a1">
              <div class="markdown prose">Answer</div>
            </div>
          </article>
        `;

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshot = await engine.getSnapshot();

        expect(snapshot?.source).toBe('dom');
        expect(snapshot?.rounds).toHaveLength(1);
        expect(snapshot?.rounds[0]).toEqual(expect.objectContaining({
            position: 1,
            messageId: 'a1',
        }));
    });
});
