import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationEngine } from '@/drivers/content/chatgpt/ChatGPTConversationEngine';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import { ChatGPTDomTurnFactSource } from '@/services/content/ChatGPTDomTurnFactSource';
import {
    collectFreshReaderContent,
    readerItemsToChatTurns,
} from '@/services/reader/readerContentSource';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';
const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';

function appendRound(position: number, completed: boolean): void {
    document.querySelector('main')?.insertAdjacentHTML('beforeend', `
        <article data-turn="user" data-turn-id="user-turn-${position}">
            <div data-message-author-role="user" data-message-id="user-${position}">
                <div class="whitespace-pre-wrap">Question ${position}</div>
            </div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-${position}">
            <div data-message-author-role="assistant" data-message-id="assistant-${position}">
                <div class="markdown prose"><strong>Answer ${position}</strong></div>
            </div>
            ${completed ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
        </article>
    `);
}

function completeRound(position: number): void {
    document.querySelector(`article[data-turn-id="assistant-turn-${position}"]`)?.insertAdjacentHTML(
        'beforeend',
        '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
    );
}

describe('ChatGPT content discovery chain integration', () => {
    let adapter: ChatGPTAdapter;
    let engine: ChatGPTConversationEngine;
    let directory: ChatGPTDirectoryController | null;
    let removeBridgeResponder: (() => void) | null;

    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        const responder = ((event: Event) => {
            const rawDetail = (event as CustomEvent<unknown>).detail;
            const detail = typeof rawDetail === 'string' ? JSON.parse(rawDetail) : rawDetail as any;
            const payload = { requestId: detail.requestId, ok: false };
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: typeof rawDetail === 'string' ? JSON.stringify(payload) : payload,
            }));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, responder);
        removeBridgeResponder = () => window.removeEventListener(REQUEST_EVENT, responder);

        adapter = new ChatGPTAdapter();
        engine = new ChatGPTConversationEngine(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
        });
        getChatGPTConversationIndex(adapter).bindConversationSource(engine);
        directory = null;
        engine.init();
    });

    afterEach(() => {
        directory?.dispose();
        engine.dispose();
        adapter.dispose();
        removeBridgeResponder?.();
        removeBridgeResponder = null;
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('keeps directory, toolbar, Reader, export, and bookmark semantics on one birth snapshot', async () => {
        appendRound(1, false);
        document.body.insertAdjacentHTML('beforeend', '<button aria-label="Stop generating">Stop</button>');
        history.replaceState({}, '', `/c/${conversationId}`);
        await vi.advanceTimersByTimeAsync(500);

        expect(engine.getState()).toMatchObject({
            status: 'collecting',
            snapshot: null,
        });

        document.querySelector('[aria-label="Stop generating"]')?.remove();
        completeRound(1);
        const first = await engine.ensureReady();
        expect(first).toMatchObject({
            proof: 'birth-epoch',
            rounds: [{ assistantContent: '**Answer 1**' }],
        });

        const index = getChatGPTConversationIndex(adapter);
        expect(index.getRounds()).toHaveLength(1);

        directory = new ChatGPTDirectoryController(adapter);
        directory.init('light');
        await Promise.resolve();
        expect(
            document.getElementById('aimd-chatgpt-directory-rail')
                ?.shadowRoot
                ?.querySelectorAll('.rail__item'),
        ).toHaveLength(1);

        const assistant = document.querySelector<HTMLElement>('[data-message-id="assistant-1"]');
        if (!assistant) throw new Error('assistant fixture is missing');
        const reader = await collectFreshReaderContent(adapter, assistant, {
            chatGptConversationSource: engine,
            pageUrl: window.location.href,
        });
        expect(reader.items).toHaveLength(1);
        expect(reader.items[0]).toMatchObject({
            userPrompt: 'Question 1',
            content: '**Answer 1**',
        });
        await expect(readerItemsToChatTurns(reader.items)).resolves.toEqual([{
            user: 'Question 1',
            assistant: '**Answer 1**',
            index: 0,
        }]);

        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            chatGptConversationSource: engine,
        }) as any;
        orchestrator.wordCounter = {
            count: vi.fn((text: string) => ({ text })),
            format: vi.fn(() => '2 Words / 12 Chars'),
        };
        const toolbar = { setStats: vi.fn() };
        orchestrator.refreshWordCountForToolbar(toolbar, assistant, false);
        await vi.waitFor(() => expect(toolbar.setStats).toHaveBeenCalledWith(['2 Words', '12 Chars']));

        appendRound(2, false);
        document.body.insertAdjacentHTML('beforeend', '<button aria-label="Stop generating">Stop</button>');
        await Promise.resolve();
        await Promise.resolve();
        expect(engine.getState().snapshot?.rounds).toHaveLength(1);

        document.querySelector('[aria-label="Stop generating"]')?.remove();
        completeRound(2);
        const second = await engine.ensureReady();
        expect(second?.rounds).toHaveLength(2);
        const secondRevision = second?.revision;

        appendRound(3, false);
        document.body.insertAdjacentHTML('beforeend', '<button aria-label="Stop generating">Stop</button>');
        await Promise.resolve();
        await Promise.resolve();
        expect(engine.getState().snapshot).toMatchObject({
            revision: secondRevision,
            rounds: [{ position: 1 }, { position: 2 }],
        });
    });
});
