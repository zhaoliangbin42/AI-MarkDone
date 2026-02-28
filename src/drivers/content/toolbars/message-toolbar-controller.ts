import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../adapters/base';
import { copyTextToClipboard } from '../clipboard/clipboard';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { collectReaderItems } from '../../../services/reader/collectReaderItems';
import { discoverMessageElements } from '../injection/messageDiscovery';
import { RouteWatcher } from '../injection/routeWatcher';
import { ScanScheduler } from '../injection/scanScheduler';
import { MessageToolbar } from '../../../ui/content/MessageToolbar';
import type { ReaderPanel } from '../../../ui/content/reader/ReaderPanel';
import { logger } from '../../../core/logger';

type ToolbarRecord = { message: HTMLElement; toolbar: MessageToolbar };

export class MessageToolbarController {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private records = new Map<string, ToolbarRecord>();
    private theme: Theme = 'light';
    private onMessageInjected: ((messageElement: HTMLElement) => void) | null = null;
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private observedContainer: HTMLElement | null = null;
    private readerPanel: ReaderPanel | null = null;

    constructor(
        adapter: SiteAdapter,
        opts?: { onMessageInjected?: (messageElement: HTMLElement) => void; readerPanel?: ReaderPanel }
    ) {
        this.adapter = adapter;
        this.onMessageInjected = opts?.onMessageInjected || null;
        this.readerPanel = opts?.readerPanel || null;
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

        // Delay start slightly: SPA first render often re-parents nodes rapidly.
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
        this.readerPanel?.setTheme(theme);
    }

    getMessageElements(): HTMLElement[] {
        return Array.from(this.records.values()).map((r) => r.message);
    }

    private scanAndInject(): void {
        const selector = this.adapter.getMessageSelector();
        const container = this.adapter.getObserverContainer() || document.body;
        const nodes = discoverMessageElements(container, selector);

        logger.debug('[AI-MarkDone][MessageToolbarController] scan', {
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

            const toolbar = new MessageToolbar(this.theme, {
                onCopyMarkdown: async () => {
                    const res = copyMarkdownFromMessage(this.adapter, messageElement);
                    if (!res.ok) return { ok: false, message: res.error.message };
                    const ok = await copyTextToClipboard(res.markdown);
                    return ok ? { ok: true } : { ok: false, message: 'Clipboard write failed.' };
                },
                onOpenReader: async () => {
                    if (!this.readerPanel) return;
                    const { items, startIndex } = collectReaderItems(this.adapter, messageElement);
                    await this.readerPanel.show(items, startIndex, this.theme);
                },
            });

            const host = toolbar.getElement();
            const injected = this.adapter.injectToolbar(messageElement, host);
            if (!injected) {
                logger.debug('[AI-MarkDone][MessageToolbarController] injectToolbar failed', { id });
                host.remove();
                return;
            }

            if (id) {
                this.records.set(id, { message: messageElement, toolbar });
            } else {
                // Best-effort: avoid duplicating if adapter cannot produce a stable id.
                messageElement.dataset.aimdMsgInjected = '1';
            }
            this.onMessageInjected?.(messageElement);
        });
    }

    private refreshPendingStates(): void {
        this.records.forEach(({ message, toolbar }, id) => {
            if (!document.contains(message)) {
                toolbar.getElement().remove();
                this.records.delete(id);
                return;
            }

            const pending = this.adapter.isStreamingMessage(message);
            toolbar.setPending(pending);
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
