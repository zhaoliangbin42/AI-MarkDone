import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ScanScheduler } from '@/drivers/content/injection/scanScheduler';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeScheduledToolbarAdapter extends SiteAdapter {
    public streaming = true;

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
        const anchor = messageElement.querySelector('.official-toolbar');
        return anchor instanceof HTMLElement ? anchor : null;
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
}

class MainScopedToolbarAdapter extends FakeScheduledToolbarAdapter {
    getPlatformId(): string {
        return 'chatgpt';
    }

    getObserverContainer(): HTMLElement | null {
        return document.querySelector('main');
    }
}

function attachScheduler(orchestrator: MessageToolbarOrchestrator) {
    (orchestrator as any).scanScheduler = new ScanScheduler(
        () => {
            (orchestrator as any).scanAndInject();
        },
        { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
    );
    return (orchestrator as any).scanScheduler as ScanScheduler;
}

function getToolbar(root: ParentNode = document): HTMLElement | null {
    return root.querySelector('[data-aimd-role="message-toolbar"]');
}

describe('MessageToolbarOrchestrator scheduler integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('eventually injects when the official toolbar appears during continuous rescheduling', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
          </div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });
        const scheduler = attachScheduler(orchestrator);

        for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
            if (elapsed === 850) {
                const message = document.querySelector('.assistant-message') as HTMLElement;
                const anchor = document.createElement('div');
                anchor.className = 'official-toolbar';
                message.appendChild(anchor);
            }
            scheduler.schedule('mutation');
            vi.advanceTimersByTime(50);
        }

        vi.runOnlyPendingTimers();

        const anchor = document.querySelector('.assistant-message .official-toolbar') as HTMLElement | null;
        expect(anchor).toBeTruthy();
        expect(anchor?.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        expect(getToolbar()).toBeTruthy();
    });

    it('keeps actions clickable but guards reader until streaming completes under continuous rescheduling', async () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"></div>
          </div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        const readerPanel = { setTheme() {}, show: vi.fn(async () => undefined) } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel,
        });
        const scheduler = attachScheduler(orchestrator);

        (orchestrator as any).scanAndInject();
        const toolbar = getToolbar() as HTMLElement | null;
        expect(toolbar).toBeTruthy();
        const readerButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="reader"]');
        expect(readerButton?.disabled).toBe(false);

        readerButton?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(readerPanel.show).not.toHaveBeenCalled();

        for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
            if (elapsed === 850) {
                adapter.streaming = false;
            }
            scheduler.schedule('mutation');
            vi.advanceTimersByTime(50);
        }

        vi.runOnlyPendingTimers();

        readerButton?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(readerPanel.show).toHaveBeenCalledTimes(1);
    });

    it('does not rewrite stable message-position attributes on an unchanged rescan', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"></div>
          </div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });
        const message = document.querySelector('.assistant-message');
        if (!(message instanceof HTMLElement)) throw new Error('fixture message is missing');
        const observer = new MutationObserver(() => undefined);
        observer.observe(message, {
            attributes: true,
            attributeFilter: ['data-aimd-msg-position'],
        });

        try {
            (orchestrator as any).scanAndInject();
            observer.takeRecords();
            (orchestrator as any).scanAndInject();

            expect(observer.takeRecords()).toHaveLength(0);
        } finally {
            observer.disconnect();
            orchestrator.dispose();
        }
    });

    it('reconciles text replacement inside one message without falling back to a full scan', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"></div>
          </div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });
        (orchestrator as any).scanAndInject();
        const fullScan = vi.spyOn(orchestrator as any, 'buildFullScanSnapshot');
        const incrementalScan = vi.spyOn(orchestrator as any, 'buildIncrementalSnapshot');
        const message = document.querySelector('.assistant-message');
        const content = document.querySelector('.content');
        if (!(message instanceof HTMLElement) || !(content instanceof HTMLElement)) {
            throw new Error('fixture message content is missing');
        }
        const observer = new MutationObserver(() => undefined);
        observer.observe(document.body, { childList: true, subtree: true });

        try {
            content.textContent = 'Updated';
            (orchestrator as any).handleObservedMutations(observer.takeRecords());
            expect((orchestrator as any).dirtyMessages.has(message)).toBe(true);
            (orchestrator as any).scanAndInject(new Set(['mutation']));

            expect(incrementalScan).toHaveBeenCalled();
            expect(fullScan).not.toHaveBeenCalled();
            expect(getToolbar()).toBeTruthy();
        } finally {
            observer.disconnect();
            orchestrator.dispose();
        }
    });

    it('ignores text replacement outside assistant messages', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"></div>
          </div>
          <div class="unrelated">Unrelated</div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });
        (orchestrator as any).scanAndInject();
        const scheduler = attachScheduler(orchestrator);
        const fullScan = vi.spyOn(orchestrator as any, 'buildFullScanSnapshot');
        const incrementalScan = vi.spyOn(orchestrator as any, 'buildIncrementalSnapshot');
        const unrelated = document.querySelector('.unrelated');
        if (!(unrelated instanceof HTMLElement)) throw new Error('fixture unrelated node is missing');
        const observer = new MutationObserver(() => undefined);
        observer.observe(document.body, { childList: true, subtree: true });

        try {
            unrelated.textContent = 'Updated';
            (orchestrator as any).handleObservedMutations(observer.takeRecords());
            vi.advanceTimersByTime(500);
            vi.runOnlyPendingTimers();

            expect(fullScan).not.toHaveBeenCalled();
            expect(incrementalScan).not.toHaveBeenCalled();
        } finally {
            observer.disconnect();
            scheduler.dispose();
            orchestrator.dispose();
        }
    });

    it('does not run a second global pending-state pass after the scheduled reconcile', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"></div>
          </div>
        `;

        const adapter = new FakeScheduledToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });
        const recordsBefore = (orchestrator as any).recordsByMessageKey.size;

        try {
            orchestrator.init();
            vi.advanceTimersByTime(250);
            vi.runOnlyPendingTimers();

            expect(getToolbar()).toBeTruthy();
            expect((orchestrator as any).recordsByMessageKey.size).toBe(recordsBefore + 1);
        } finally {
            orchestrator.dispose();
        }
    });

    it('recovers toolbars when ChatGPT replaces the observed conversation root', async () => {
        document.body.innerHTML = `
          <main>
            <div class="assistant-message" data-message-id="m1">
              <div class="content">First</div>
              <div class="official-toolbar"></div>
            </div>
          </main>
        `;

        const adapter = new MainScopedToolbarAdapter();
        adapter.streaming = false;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
        });

        try {
            orchestrator.init();
            vi.advanceTimersByTime(1_000);
            expect(document.querySelector('[data-message-id="m1"] [data-aimd-role="message-toolbar"]')).toBeTruthy();

            const nextMain = document.createElement('main');
            nextMain.innerHTML = `
              <div class="assistant-message" data-message-id="m2">
                <div class="content">Second</div>
                <div class="official-toolbar"></div>
              </div>
            `;
            document.querySelector('main')?.replaceWith(nextMain);
            await Promise.resolve();
            await Promise.resolve();
            vi.advanceTimersByTime(1_000);

            expect(nextMain.querySelector('[data-message-id="m2"] [data-aimd-role="message-toolbar"]')).toBeTruthy();
            expect(nextMain.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        } finally {
            orchestrator.dispose();
        }
    });
});
