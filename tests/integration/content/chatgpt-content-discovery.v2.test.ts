import { describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { WordCounter } from '@/core/text/wordCounter';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import { createConversationContentSource } from '../../helpers/chatgptContentFixtures';

function appendShell(root: HTMLElement, key: string): HTMLElement {
    const shell = document.createElement('div');
    shell.setAttribute('data-turn-id-container', key);
    root.appendChild(shell);
    return shell;
}

function appendNestedHydratedRole(
    root: HTMLElement,
    slotKey: string,
    role: 'user' | 'assistant',
    turnId: string,
    messageId: string,
    text: string,
): HTMLElement {
    const outer = document.createElement('div');
    outer.setAttribute('data-turn-id-container', slotKey);
    const inner = document.createElement('section');
    // The live page duplicates this marker on the virtualization wrapper and
    // the hydrated section.  The host adapter must collapse that nesting
    // before decoding the sibling topology.
    inner.setAttribute('data-turn-id-container', slotKey);
    inner.setAttribute('data-testid', `conversation-turn-${messageId}`);
    inner.setAttribute('data-turn', role);
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', role);
    message.setAttribute('data-message-id', messageId);
    if (role === 'assistant') {
        message.innerHTML = `<div class="markdown prose"><p>${text}</p></div><div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>`;
    } else {
        message.innerHTML = `<div class="whitespace-pre-wrap">${text}</div>`;
    }
    inner.appendChild(message);
    outer.appendChild(inner);
    root.appendChild(outer);
    return outer;
}

describe('ChatGPT content discovery V2', () => {
    it('normalizes live nested virtualization markers before publishing directory topology', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        const main = document.querySelector('main') as HTMLElement;
        appendShell(main, 'client-created-root');
        appendNestedHydratedRole(main, 'user-1', 'user', 'turn-1', 'user-1', 'Question 1');
        appendNestedHydratedRole(main, 'assistant-1', 'assistant', 'turn-1', 'assistant-1', 'Answer 1');
        appendShell(main, 'user-2');
        appendShell(main, 'assistant-2');

        const adapter = new ChatGPTAdapter();
        const source = createConversationContentSource({
            conversationId: '695499b7-464c-8323-a998-119f661ac953',
            rounds: [
                {
                    id: 'turn-1',
                    userPrompt: 'Question 1',
                    assistantContent: 'Answer 1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                {
                    id: 'turn-2',
                    userPrompt: 'Question 2',
                    assistantContent: 'Answer 2',
                    userMessageId: 'user-2',
                    assistantMessageId: 'assistant-2',
                },
            ],
        });
        const materialization = {
            read: () => ({ materializationToken: 'mat-1', contentToken: '1', entries: [] }),
            subscribe: () => () => undefined,
        } as any;
        const directory = new ChatGPTDirectoryController(adapter, null, {
            contentSource: source,
            materialization,
        });
        try {
            directory.init('light');
            const rail = document.getElementById('aimd-chatgpt-directory-rail');
            const items = Array.from(rail?.shadowRoot?.querySelectorAll<HTMLElement>('.rail__item') ?? []);
            expect(items).toHaveLength(2);
            expect(items.map((item) => item.getAttribute('data-position'))).toEqual(['1', '2']);
        } finally {
            directory.dispose();
            adapter.dispose();
        }
    });

    it('publishes a recognized user prompt to the directory before assistant content is ready', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        const main = document.querySelector('main') as HTMLElement;
        appendShell(main, 'client-created-root');
        appendNestedHydratedRole(main, 'user-1', 'user', 'turn-1', 'user-1', 'Question discovered early');
        appendShell(main, 'assistant-1');

        const adapter = new ChatGPTAdapter();
        const source = createConversationContentSource({
            conversationId: '695499b7-464c-8323-a998-119f661ac953',
            rounds: [{
                id: 'turn-1',
                userPrompt: 'Question discovered early',
                assistantContent: 'Answer 1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }],
        });
        const directory = new ChatGPTDirectoryController(adapter, null, {
            contentSource: source,
            materialization: {
                read: () => ({ materializationToken: 'mat-1', contentToken: '1', entries: [] }),
                subscribe: () => () => undefined,
            } as any,
        });
        try {
            directory.init('light');
            const rail = document.getElementById('aimd-chatgpt-directory-rail');
            const item = rail?.shadowRoot?.querySelector<HTMLElement>('.rail__item');
            expect(item?.getAttribute('aria-label')).toContain('Question discovered early');
        } finally {
            directory.dispose();
            adapter.dispose();
        }
    });

    it('computes word count from the same sealed V2 turn used by Reader', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        const main = document.querySelector('main') as HTMLElement;
        appendShell(main, 'client-created-root');
        appendNestedHydratedRole(main, 'user-1', 'user', 'turn-1', 'user-1', 'Question 1');
        appendNestedHydratedRole(main, 'assistant-1', 'assistant', 'turn-1', 'assistant-1', 'Canonical answer');

        const adapter = new ChatGPTAdapter();
        const source = createConversationContentSource({
            conversationId: '695499b7-464c-8323-a998-119f661ac953',
            rounds: [{
                id: 'turn-1',
                userPrompt: 'Question 1',
                assistantContent: 'Canonical answer',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }],
        });
        getChatGPTConversationIndex(adapter).bindConversationSource(source);
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource: source,
            conversationMaterialization: {
                resolveElement: () => ({
                    documentKey: source.read().document!.key,
                    turnId: 'turn-1',
                    assistantMessageId: 'assistant-1',
                    userMessageId: 'user-1',
                }),
                read: () => ({ materializationToken: 'mat-1', contentToken: '1', entries: [] }),
                subscribe: () => () => undefined,
            } as any,
        });
        const toolbar = { setStats: vi.fn() };
        try {
            const assistant = document.querySelector('[data-message-author-role="assistant"]') as HTMLElement;
            const assistantContent = assistant.querySelector('.markdown.prose');
            assistantContent!.textContent = 'Mounted DOM drift';

            (orchestrator as any).refreshWordCountForToolbar(toolbar, assistant, false);
            await vi.waitFor(() => expect(toolbar.setStats).toHaveBeenCalledWith(['2 Words', '15 Chars']));
            expect(new WordCounter().count('Canonical answer')).toMatchObject({ words: 2, chars: 15 });
        } finally {
            orchestrator.dispose();
            adapter.dispose();
        }
    });
});
