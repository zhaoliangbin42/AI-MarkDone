import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationContentStateV1 } from '@/contracts/conversationContent';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import {
    createConversationContentSource,
    readyConversationState,
} from '../../../helpers/chatgptContentFixtures';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeOfficialToolbarAdapter extends SiteAdapter {
    private streaming = false;

    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return 'Prompt'; }
    getMessageSelector(): string { return '.assistant-message'; }
    getMessageContentSelector(): string { return '.content'; }
    getActionBarSelector(): string { return '.official-toolbar'; }
    getToolbarAnchorElement(messageElement: HTMLElement): HTMLElement | null {
        const actionBar = messageElement.querySelector('.official-toolbar');
        return actionBar instanceof HTMLElement ? actionBar : null;
    }
    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const anchor = this.getToolbarAnchorElement(messageElement);
        if (!anchor) return false;
        anchor.appendChild(toolbarHost);
        return true;
    }
    isStreamingMessage(): boolean { return this.streaming; }
    getMessageId(messageElement: HTMLElement): string | null {
        return messageElement.getAttribute('data-message-id');
    }
    getObserverContainer(): HTMLElement | null { return document.body; }
    setStreaming(streaming: boolean): void { this.streaming = streaming; }
}

const SNAPSHOT = {
    conversationId: 'conv-1',
    revision: 1,
    rounds: [{
        id: 'round-1',
        position: 1,
        userPrompt: 'Prompt',
        assistantContent: 'First complete answer',
        preview: 'Prompt',
        messageId: 'm1',
        userMessageId: 'u1',
        assistantMessageId: 'm1',
    }],
};

type Harness = {
    adapter: FakeOfficialToolbarAdapter;
    source: ReturnType<typeof createConversationContentSource>;
    surface: ChatGPTConversationSurface;
    orchestrator: MessageToolbarOrchestrator;
};

const harnesses = new Set<Harness>();

function renderTurn(options: { officialToolbar?: boolean; stopButton?: boolean } = {}): void {
    document.body.innerHTML = `
      <main>
        <article data-turn="user" data-turn-id="round-1">
          <div data-message-author-role="user" data-message-id="u1">Prompt</div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-1">
          <div class="assistant-message" data-message-author-role="assistant" data-message-id="m1">
            <div class="content">First complete answer</div>
            ${options.officialToolbar === false ? '' : '<div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy</button></div>'}
          </div>
        </article>
      </main>
      ${options.stopButton ? '<button data-testid="stop-button">Stop</button>' : ''}
    `;
}

function createHarness(initial?: ConversationContentStateV1): Harness {
    const adapter = new FakeOfficialToolbarAdapter();
    const source = createConversationContentSource(initial ?? SNAPSHOT);
    const surface = new ChatGPTConversationSurface({ adapter, content: source });
    const orchestrator = new MessageToolbarOrchestrator(adapter, {
        readerPanel: { setTheme() {}, show: async () => undefined } as any,
        conversationContentSource: source,
        conversationMaterialization: surface.materialization,
        conversationSurface: surface,
    });
    const harness = { adapter, source, surface, orchestrator };
    harnesses.add(harness);
    return harness;
}

function toolbarHosts(): NodeListOf<HTMLElement> {
    return document.querySelectorAll<HTMLElement>('[data-aimd-role="message-toolbar"]');
}

describe('MessageToolbarOrchestrator Surface-driven official toolbar lifecycle', () => {
    afterEach(() => {
        for (const harness of harnesses) {
            harness.orchestrator.dispose();
            harness.surface.dispose();
            harness.adapter.dispose?.();
        }
        harnesses.clear();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('waits for the official action row and injects once when PageIndex observes it', async () => {
        renderTurn({ officialToolbar: false });
        const { orchestrator } = createHarness();
        orchestrator.init();

        expect(toolbarHosts()).toHaveLength(0);

        const message = document.querySelector('.assistant-message');
        if (!(message instanceof HTMLElement)) throw new Error('assistant fixture is missing');
        message.insertAdjacentHTML(
            'beforeend',
            '<div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy</button></div>',
        );

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('removes only extension UI when the toolbar feature is disabled', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        orchestrator.setBehaviorFlags({ showMessageToolbar: false });

        expect(toolbarHosts()).toHaveLength(0);
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
        expect(document.querySelector('.official-toolbar')).toBeTruthy();
    });

    it('repairs a removed extension host through the shared PageIndex without duplicating it', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        toolbarHosts()[0]?.remove();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('follows an official action-row replacement and never removes host controls', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        const previous = document.querySelector('.official-toolbar');
        if (!(previous instanceof HTMLElement)) throw new Error('official toolbar fixture is missing');
        const replacement = document.createElement('div');
        replacement.className = 'official-toolbar';
        replacement.innerHTML = '<button data-testid="copy-turn-action-button">Copy replacement</button>';
        previous.replaceWith(replacement);

        await vi.waitFor(() => {
            expect(replacement.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        });
        expect(toolbarHosts()).toHaveLength(1);
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('keeps official controls untouched while content is pending, then upgrades from the pool', async () => {
        renderTurn({ stopButton: true });
        const documentRef = readyConversationState(SNAPSHOT).document;
        const syncing: ConversationContentStateV1 = {
            kind: 'syncing',
            document: documentRef,
            snapshot: null,
        };
        const harness = createHarness(syncing);
        harness.adapter.setStreaming(true);
        harness.orchestrator.init();

        expect(toolbarHosts()).toHaveLength(0);
        expect(document.querySelector('[data-testid="stop-button"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();

        harness.adapter.setStreaming(false);
        harness.source.publish(SNAPSHOT);

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        const stats = toolbarHosts()[0]?.shadowRoot
            ?.querySelector<HTMLElement>('[data-role="stats"]')
            ?.textContent?.trim();
        expect(stats).toBeTruthy();
        expect(stats).not.toContain('—');
        expect(document.querySelector('[data-testid="stop-button"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();
    });
});
