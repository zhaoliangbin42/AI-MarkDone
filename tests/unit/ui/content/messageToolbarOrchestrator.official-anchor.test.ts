import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeOfficialToolbarAdapter extends SiteAdapter {
    private streaming = false;

    matches(): boolean {
        return true;
    }

    getPlatformId(): string {
        return 'test-platform';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    extractUserPrompt(): string | null {
        return 'Prompt';
    }

    getMessageSelector(): string {
        return '.assistant-message';
    }

    getMessageContentSelector(): string {
        return '.content';
    }

    getActionBarSelector(): string {
        return '.official-toolbar';
    }

    getToolbarAnchorElement(messageElement: HTMLElement): HTMLElement | null {
        const actionBar = messageElement.querySelector('.official-toolbar');
        return actionBar instanceof HTMLElement ? actionBar : null;
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const anchor = this.getToolbarAnchorElement(messageElement);
        if (!anchor) return false;
        toolbarHost.dataset.aimdPlacement = 'actionbar';
        toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
        anchor.appendChild(toolbarHost);
        return true;
    }

    isStreamingMessage(): boolean {
        return this.streaming;
    }

    getMessageId(messageElement: HTMLElement): string | null {
        return messageElement.getAttribute('data-message-id');
    }

    getObserverContainer(): HTMLElement | null {
        return document.body;
    }

    setStreaming(streaming: boolean): void {
        this.streaming = streaming;
    }
}

function getToolbarCount(root: ParentNode = document): number {
    return root.querySelectorAll('[data-aimd-role="message-toolbar"]').length;
}

describe('MessageToolbarOrchestrator official-anchor sync', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('does not inject for messages whose official toolbar is absent', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
          <div class="assistant-message" data-message-id="m2">
            <div class="content">Second</div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        const readerPanel = { setTheme() {}, show: async () => undefined } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject();

        const first = document.querySelector('[data-message-id="m1"] .official-toolbar') as HTMLElement;
        const second = document.querySelector('[data-message-id="m2"]') as HTMLElement;

        expect(first.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        expect(second.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(0);
        expect(getToolbarCount()).toBe(1);
    });

    it('injects once when the official toolbar appears later', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        const readerPanel = { setTheme() {}, show: async () => undefined } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject();
        expect(getToolbarCount()).toBe(0);

        const message = document.querySelector('[data-message-id="m1"]') as HTMLElement;
        const actionBar = document.createElement('div');
        actionBar.className = 'official-toolbar';
        actionBar.appendChild(document.createElement('button'));
        message.appendChild(actionBar);

        (orchestrator as any).scanAndInject();
        (orchestrator as any).scanAndInject();

        expect(actionBar.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        expect(getToolbarCount()).toBe(1);
    });

    it('immediately removes only the affected message toolbar when its official toolbar disappears', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
          <div class="assistant-message" data-message-id="m2">
            <div class="content">Second</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        const readerPanel = { setTheme() {}, show: async () => undefined } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject();
        expect(getToolbarCount()).toBe(2);

        const firstActionBar = document.querySelector('[data-message-id="m1"] .official-toolbar') as HTMLElement;
        const secondActionBar = document.querySelector('[data-message-id="m2"] .official-toolbar') as HTMLElement;
        secondActionBar.remove();

        (orchestrator as any).refreshPendingStates();

        expect(firstActionBar.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        expect(document.querySelector('[data-message-id="m2"] [data-aimd-role="message-toolbar"]')).toBeNull();
        expect(getToolbarCount()).toBe(1);
    });

    it('uses incremental mutation candidates for added messages instead of forcing a full rescan', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        const readerPanel = { setTheme() {}, show: async () => undefined } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject(new Set(['init']));
        expect(getToolbarCount()).toBe(1);

        const fullScanSpy = vi.spyOn(orchestrator as any, 'buildFullScanSnapshot');

        const message = document.createElement('div');
        message.className = 'assistant-message';
        message.setAttribute('data-message-id', 'm2');
        message.innerHTML = `
          <div class="content">Second</div>
          <div class="official-toolbar"><button>copy</button></div>
        `;
        document.body.appendChild(message);

        (orchestrator as any).handleObservedMutations([
            {
                addedNodes: [message],
                removedNodes: [],
            },
        ]);
        (orchestrator as any).scanAndInject(new Set(['mutation']));

        expect(fullScanSpy).not.toHaveBeenCalled();
        expect(getToolbarCount()).toBe(2);
        expect(message.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
    });

    it('falls back to a full rescan when mutations remove nodes', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
          <div class="assistant-message" data-message-id="m2">
            <div class="content">Second</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        const readerPanel = { setTheme() {}, show: async () => undefined } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject(new Set(['init']));
        expect(getToolbarCount()).toBe(2);

        const fullScanSpy = vi.spyOn(orchestrator as any, 'buildFullScanSnapshot');
        const removed = document.querySelector('[data-message-id="m2"]') as HTMLElement;
        removed.remove();

        (orchestrator as any).handleObservedMutations([
            {
                addedNodes: [],
                removedNodes: [removed],
            },
        ]);
        (orchestrator as any).scanAndInject(new Set(['mutation']));

        expect(fullScanSpy).toHaveBeenCalledTimes(1);
        expect(getToolbarCount()).toBe(1);
        expect(document.querySelector('[data-message-id="m2"] [data-aimd-role="message-toolbar"]')).toBeNull();
    });

    it('keeps toolbar actions enabled but guards reader while the message is still streaming', async () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new FakeOfficialToolbarAdapter();
        adapter.setStreaming(true);
        const readerPanel = { setTheme() {}, show: vi.fn(async () => undefined) } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false, showViewSource: false });

        (orchestrator as any).scanAndInject(new Set(['init']));

        const toolbarHost = document.querySelector('[data-aimd-role="message-toolbar"]') as HTMLElement;
        const shadow = toolbarHost.shadowRoot as ShadowRoot;
        const readerButton = shadow.querySelector<HTMLButtonElement>('[data-action="reader"]');

        expect(readerButton).toBeTruthy();
        expect(readerButton?.disabled).toBe(false);

        readerButton?.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(readerPanel.show).not.toHaveBeenCalled();

        adapter.setStreaming(false);
        readerButton?.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(readerPanel.show).toHaveBeenCalledTimes(1);
    });
});
