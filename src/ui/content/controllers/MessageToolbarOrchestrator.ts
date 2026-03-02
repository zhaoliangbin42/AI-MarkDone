import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { getConversationUrl } from '../../../drivers/content/bookmarks/position';
import { discoverMessageElements } from '../../../drivers/content/injection/messageDiscovery';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { ScanScheduler } from '../../../drivers/content/injection/scanScheduler';
import { logger } from '../../../core/logger';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { collectReaderItems } from '../../../services/reader/collectReaderItems';
import { exportConversationMarkdown, exportConversationPdf } from '../../../services/export/saveMessagesFacade';
import { MessageToolbar, type MessageToolbarAction } from '../MessageToolbar';
import type { BookmarksPanelController } from '../bookmarks/BookmarksPanelController';
import type { ReaderPanel } from '../reader/ReaderPanel';
import { t } from '../components/i18n';
import { WordCounter } from '../../../core/text/wordCounter';
import type { TranslateFn } from '../../../services/export/saveMessagesTypes';
import { bookmarkIcon, copyIcon, downloadIcon, bookOpenIcon, fileCodeIcon } from '../../../assets/icons';

type ToolbarRecord = { message: HTMLElement; toolbar: MessageToolbar; pending: boolean; position: number };

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
    private bookmarksController: BookmarksPanelController | null = null;
    private behavior = { showViewSource: true, showSaveMessages: true, showWordCount: true };
    private wordCounter = new WordCounter();
    private exportT: TranslateFn = (key, args) => {
        if (args === undefined) return t(key);
        if (Array.isArray(args)) return t(key, args.map((x) => String(x)));
        return t(key, String(args));
    };

    constructor(adapter: SiteAdapter, opts: { readerPanel: ReaderPanel; bookmarksController?: BookmarksPanelController; onMessageInjected?: (messageElement: HTMLElement) => void }) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.bookmarksController = opts.bookmarksController || null;
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

        if (this.bookmarksController) {
            void this.bookmarksController.refreshPositionsForUrl(getConversationUrl()).then(() => this.refreshBookmarkActionStates());
        }

        this.rebindObserverIfNeeded(true);

        this.routeWatcher = new RouteWatcher(() => {
            this.disposeObserversOnly();
            this.records.forEach(({ toolbar }) => toolbar.getElement().remove());
            this.records.clear();
            this.scanScheduler?.schedule('route_change');
            this.rebindObserverIfNeeded(true);
            if (this.bookmarksController) {
                void this.bookmarksController.refreshPositionsForUrl(getConversationUrl()).then(() => this.refreshBookmarkActionStates());
            }
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

    setBehaviorFlags(flags: Partial<{ showViewSource: boolean; showSaveMessages: boolean; showWordCount: boolean }>): void {
        this.behavior = { ...this.behavior, ...flags };
    }

    private getPositionForMessage(messageElement: HTMLElement): number {
        const msgId = this.adapter.getMessageId(messageElement);
        if (msgId) return this.records.get(msgId)?.position ?? 0;
        const fallback = Number(messageElement.dataset.aimdMsgPosition || 0);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    private getActionsForMessage(messageElement: HTMLElement, getToolbar: () => MessageToolbar | null): MessageToolbarAction[] {
        const actions: MessageToolbarAction[] = [];

        if (this.bookmarksController) {
            actions.push({
                id: 'bookmark_toggle',
                label: t('btnBookmark'),
                tooltip: t('btnBookmark'),
                icon: bookmarkIcon,
                kind: 'secondary',
                disabledWhenPending: true,
                onClick: async () => {
                    const toolbar = getToolbar();
                    const url = getConversationUrl();
                    const position = this.getPositionForMessage(messageElement);

                    if (!position) return { ok: false, message: 'Position not available' };

                    const userMessage = this.adapter.extractUserPrompt(messageElement) ?? '';
                    if (!userMessage.trim()) return { ok: false, message: 'No user prompt found' };

                    const md = copyMarkdownFromMessage(this.adapter, messageElement);
                    if (!md.ok) return { ok: false, message: md.error.message };

                    const title = userMessage.length > 50 ? `${userMessage.slice(0, 50)}...` : userMessage;
                    const folderPath = this.bookmarksController!.getDefaultFolderPath();

                    const res = await this.bookmarksController!.toggleBookmarkFromToolbar({
                        url,
                        position,
                        folderPath,
                        userMessage,
                        aiResponse: md.markdown,
                        platform: 'ChatGPT',
                        title,
                    });
                    if (!res.ok) return { ok: false, message: res.message };

                    toolbar?.setActionActive('bookmark_toggle', res.data.saved);
                    // Icon-only button; keep label for aria + tooltip.
                    toolbar?.setActionActive('bookmark_toggle', res.data.saved);
                    return { ok: true, message: res.data.saved ? 'Saved' : 'Removed' };
                },
            });
        }

        actions.push({
            id: 'copy_markdown',
            label: t('btnCopy'),
            tooltip: t('btnCopy'),
            icon: copyIcon,
            kind: 'secondary',
            disabledWhenPending: true,
            onClick: async () => {
                const res = copyMarkdownFromMessage(this.adapter, messageElement);
                if (!res.ok) return { ok: false, message: res.error.message };
                const ok = await copyTextToClipboard(res.markdown);
                return ok ? { ok: true, message: 'Copied' } : { ok: false, message: 'Clipboard write failed.' };
            },
        });

        if (this.behavior.showViewSource) {
            actions.push({
                id: 'view_source',
                label: t('btnViewSource'),
                tooltip: t('btnViewSource'),
                icon: fileCodeIcon,
                kind: 'secondary',
                disabledWhenPending: true,
                onClick: async () => {
                    const { items, startIndex } = collectReaderItems(this.adapter, messageElement);
                    await this.readerPanel.show(items, startIndex, this.theme, { initialView: 'source' });
                },
            });
        }

        actions.push({
            id: 'reader',
            label: t('btnReader'),
            tooltip: t('btnReader'),
            icon: bookOpenIcon,
            kind: 'secondary',
            disabledWhenPending: true,
            onClick: async () => {
                const { items, startIndex } = collectReaderItems(this.adapter, messageElement);
                await this.readerPanel.show(items, startIndex, this.theme, { initialView: 'render' });
            },
        });

        if (this.behavior.showSaveMessages) {
            actions.push({
                id: 'export',
                label: t('btnExport'),
                tooltip: t('btnExport'),
                icon: downloadIcon,
                kind: 'secondary',
                disabledWhenPending: true,
                onClick: async () => ({ ok: true }),
                menu: [
                    {
                        id: 'export_md',
                        label: 'Markdown (.md)',
                        onClick: async () => {
                            const position = this.getPositionForMessage(messageElement);
                            if (!position) return { ok: false, message: 'Position not available' };
                            const res = await exportConversationMarkdown(this.adapter, [position - 1], { t: this.exportT });
                            return res.ok && !res.noop ? { ok: true, message: 'Exported' } : { ok: false, message: 'Export failed' };
                        },
                    },
                    {
                        id: 'export_pdf',
                        label: 'PDF (Print)',
                        onClick: async () => {
                            const position = this.getPositionForMessage(messageElement);
                            if (!position) return { ok: false, message: 'Position not available' };
                            const res = await exportConversationPdf(this.adapter, [position - 1], { t: this.exportT });
                            return res.ok && !res.noop ? { ok: true, message: 'Print opened' } : { ok: false, message: 'Export failed' };
                        },
                    },
                ],
            });
        }

        return actions;
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

        nodes.forEach((messageElement, index) => {
            const id = this.adapter.getMessageId(messageElement);
            const injectedFlag = messageElement.dataset.aimdMsgInjected === '1';
            if (!id) {
                if (injectedFlag) return;
            } else {
                if (this.records.has(id)) return;
            }

            const getToolbar = () => (id ? this.records.get(id)?.toolbar ?? null : null);
            const toolbar = new MessageToolbar(this.theme, this.getActionsForMessage(messageElement, getToolbar), { showStats: this.behavior.showWordCount });

            const host = toolbar.getElement();
            const injected = this.adapter.injectToolbar(messageElement, host);
            if (!injected) {
                logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] injectToolbar failed', { id });
                host.remove();
                return;
            }

            // Placement hint for styling:
            // - actionbar: same row as platform official actions
            // - content: fallback below content root
            this.updatePlacementHint(toolbar, messageElement);

            const pending = this.adapter.isStreamingMessage(messageElement);
            toolbar.setPending(pending);

            if (id) {
                this.records.set(id, { message: messageElement, toolbar, pending, position: index + 1 });
            } else {
                // Best-effort: avoid duplicating if adapter cannot produce a stable id.
                messageElement.dataset.aimdMsgInjected = '1';
            }
            messageElement.dataset.aimdMsgPosition = `${index + 1}`;

            this.refreshBookmarkStateForToolbar(toolbar, index + 1);
            this.refreshWordCountForToolbar(toolbar, messageElement, pending);
            this.onMessageInjected?.(messageElement);
        });
    }

    private refreshBookmarkStateForToolbar(toolbar: MessageToolbar, position: number): void {
        if (!this.bookmarksController) return;
        const url = getConversationUrl();
        const active = this.bookmarksController.isPositionBookmarked(url, position);
        toolbar.setActionActive('bookmark_toggle', active);
    }

    private refreshBookmarkActionStates(): void {
        if (!this.bookmarksController) return;
        const url = getConversationUrl();
        this.records.forEach(({ toolbar, position }) => {
            const active = this.bookmarksController!.isPositionBookmarked(url, position);
            toolbar.setActionActive('bookmark_toggle', active);
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
                this.updatePlacementHint(toolbar, message);
            }
            if (record.pending !== pending) {
                this.refreshWordCountForToolbar(toolbar, message, pending);
            }
            record.pending = pending;
        });
    }

    private refreshWordCountForToolbar(toolbar: MessageToolbar, messageElement: HTMLElement, pending: boolean): void {
        if (!this.behavior.showWordCount) return;
        if (pending) {
            toolbar.setStats(['Streaming…']);
            return;
        }

        // Legacy-like: compute when content is stable; if empty, retry a few times.
        const tryCompute = (attempt: number) => {
            const md = copyMarkdownFromMessage(this.adapter, messageElement);
            if (!md.ok) {
                toolbar.setStats(['—']);
                return;
            }
            const text = (md.markdown || '').trim();
            if (text.length === 0) {
                if (attempt < 6) window.setTimeout(() => tryCompute(attempt + 1), 500 * (attempt + 1));
                else toolbar.setStats(['—']);
                return;
            }

            const res = this.wordCounter.count(text);
            const formatted = this.wordCounter.format(res);
            const parts = formatted.split(' / ');
            if (parts.length >= 2) toolbar.setStats([parts[0], parts.slice(1).join(' ')]);
            else toolbar.setStats([formatted]);
        };

        tryCompute(0);
    }

    private updatePlacementHint(toolbar: MessageToolbar, messageElement: HTMLElement): void {
        const host = toolbar.getElement();
        try {
            const actionBarSel = this.adapter.getActionBarSelector();
            const actionBar = actionBarSel ? messageElement.querySelector(actionBarSel) : null;
            const placement = actionBar && host.parentElement === actionBar.parentElement ? 'actionbar' : 'content';
            toolbar.setPlacement(placement);
        } catch {
            toolbar.setPlacement('content');
        }
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
