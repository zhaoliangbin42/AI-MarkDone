import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { discoverMessageElements } from '../../../drivers/content/injection/messageDiscovery';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { ScanScheduler } from '../../../drivers/content/injection/scanScheduler';
import { logger } from '../../../core/logger';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { collectReaderItems } from '../../../services/reader/collectReaderItems';
import { MessageToolbar, type MessageToolbarAction } from '../MessageToolbar';
import type { ReaderPanel } from '../reader/ReaderPanel';

type ToolbarRecord = { message: HTMLElement; toolbar: MessageToolbar; pending: boolean };

export class MessageToolbarOrchestrator {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private records = new Map<string, ToolbarRecord>();
    private theme: Theme = 'light';
    private onMessageInjected: ((messageElement: HTMLElement) => void) | null = null;
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private observedContainer: HTMLElement | null = null;
    private readerPanel: ReaderPanel;

    constructor(adapter: SiteAdapter, opts: { readerPanel: ReaderPanel; onMessageInjected?: (messageElement: HTMLElement) => void }) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.onMessageInjected = opts.onMessageInjected || null;
    }

    init(): void {
        this.scanScheduler = new ScanScheduler(
            () => {
                this.scanAndInject();
                this.refreshPendingStates();
                this.rebindObserverIfNeeded();
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200 }
        );

        // Why: SPA first render often re-parents nodes rapidly; a short delay reduces "inject too early" failures.
        window.setTimeout(() => this.scanScheduler?.schedule('init'), 600);
        this.scanScheduler.schedule('init');

        this.rebindObserverIfNeeded(true);

        this.routeWatcher = new RouteWatcher(() => {
            this.disposeObserversOnly();
            this.records.forEach(({ toolbar }) => toolbar.getElement().remove());
            this.records.clear();
            this.scanScheduler?.schedule('route_change');
            this.rebindObserverIfNeeded(true);
        }, { intervalMs: 500 });
        this.routeWatcher.start();
    }

    dispose(): void {
        this.scanScheduler?.dispose();
        this.scanScheduler = null;
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.observer?.disconnect();
        this.observer = null;
        this.observedContainer = null;
        this.records.forEach(({ toolbar }) => toolbar.getElement().remove());
        this.records.clear();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.records.forEach(({ toolbar }) => toolbar.setTheme(theme));
        this.readerPanel.setTheme(theme);
    }

    private getActionsForMessage(messageElement: HTMLElement): MessageToolbarAction[] {
        return [
            {
                id: 'reader',
                label: 'Reader',
                kind: 'secondary',
                disabledWhenPending: true,
                onClick: async () => {
                    const { items, startIndex } = collectReaderItems(this.adapter, messageElement);
                    await this.readerPanel.show(items, startIndex, this.theme);
                },
            },
            {
                id: 'copy_markdown',
                label: 'Copy Markdown',
                kind: 'primary',
                disabledWhenPending: true,
                onClick: async () => {
                    const res = copyMarkdownFromMessage(this.adapter, messageElement);
                    if (!res.ok) return { ok: false, message: res.error.message };
                    const ok = await copyTextToClipboard(res.markdown);
                    return ok ? { ok: true, message: 'Copied' } : { ok: false, message: 'Clipboard write failed.' };
                },
            },
        ];
    }

    private scanAndInject(): void {
        const selector = this.adapter.getMessageSelector();
        const container = this.adapter.getObserverContainer() || document.body;
        const nodes = discoverMessageElements(container, selector);

        logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] scan', {
            selector,
            found: nodes.length,
            containerTag: container.tagName,
        });

        nodes.forEach((messageElement) => {
            const id = this.adapter.getMessageId(messageElement);
            const injectedFlag = messageElement.dataset.aimdMsgInjected === '1';
            if (!id) {
                if (injectedFlag) return;
            } else {
                if (this.records.has(id)) return;
            }

            const toolbar = new MessageToolbar(this.theme, this.getActionsForMessage(messageElement));

            const host = toolbar.getElement();
            const injected = this.adapter.injectToolbar(messageElement, host);
            if (!injected) {
                logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] injectToolbar failed', { id });
                host.remove();
                return;
            }

            const pending = this.adapter.isStreamingMessage(messageElement);
            toolbar.setPending(pending);

            if (id) {
                this.records.set(id, { message: messageElement, toolbar, pending });
            } else {
                // Best-effort: avoid duplicating if adapter cannot produce a stable id.
                messageElement.dataset.aimdMsgInjected = '1';
            }

            this.onMessageInjected?.(messageElement);
        });
    }

    private refreshPendingStates(): void {
        this.records.forEach((record, id) => {
            const { message, toolbar } = record;
            if (!document.contains(message)) {
                toolbar.getElement().remove();
                this.records.delete(id);
                return;
            }

            const pending = this.adapter.isStreamingMessage(message);
            toolbar.setPending(pending);
            if (record.pending && !pending) {
                // Why: ChatGPT may only render the official action bar after streaming completes.
                // Re-run injection to move our toolbar into the action bar row once the anchor exists.
                this.adapter.injectToolbar(message, toolbar.getElement());
            }
            record.pending = pending;
        });
    }

    private disposeObserversOnly(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedContainer = null;
    }

    private rebindObserverIfNeeded(force: boolean = false): void {
        const nextContainer = this.adapter.getObserverContainer() || document.body;
        if (!force && this.observedContainer === nextContainer && this.observer) return;

        this.disposeObserversOnly();

        this.observedContainer = nextContainer;
        this.observer = new MutationObserver(() => this.scanScheduler?.schedule('mutation'));
        this.observer.observe(nextContainer, { childList: true, subtree: true });
    }
}
