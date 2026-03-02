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
import { subscribeLocaleChange, t } from '../components/i18n';
import { WordCounter } from '../../../core/text/wordCounter';
import type { TranslateFn } from '../../../services/export/saveMessagesTypes';
import { bookmarkIcon, copyIcon, downloadIcon, bookOpenIcon, fileCodeIcon } from '../../../assets/icons';

type ToolbarRecord = { message: HTMLElement; toolbar: MessageToolbar; pending: boolean; position: number };

function stripHash(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        return `${u.origin}${u.pathname}${u.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export class MessageToolbarOrchestrator {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private recordsByAnchor = new WeakMap<HTMLElement, ToolbarRecord>();
    private anchorKeys = new Set<HTMLElement>();
    private recordsByMessage = new WeakMap<HTMLElement, ToolbarRecord>();
    private pendingMessageKeys = new Set<HTMLElement>();
    private theme: Theme = 'light';
    private onMessageInjected: ((messageElement: HTMLElement) => void) | null = null;
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private unsubscribeLocale: (() => void) | null = null;
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

    private getBookmarkPageUrl(): string {
        // Why: ChatGPT uses hash routes like `#settings`; bookmarks should remain scoped to the conversation URL.
        return stripHash(getConversationUrl());
    }

    private clearAllToolbars(): void {
        // Anchor-keyed records
        for (const anchor of Array.from(this.anchorKeys)) {
            const record = this.recordsByAnchor.get(anchor);
            if (record) {
                record.toolbar.getElement().remove();
            }
        }
        this.anchorKeys.clear();
        this.recordsByAnchor = new WeakMap<HTMLElement, ToolbarRecord>();

        // Message-keyed fallback records
        for (const messageEl of Array.from(this.pendingMessageKeys)) {
            const record = this.recordsByMessage.get(messageEl);
            if (record) {
                record.toolbar.getElement().remove();
            }
        }
        this.pendingMessageKeys.clear();
        this.recordsByMessage = new WeakMap<HTMLElement, ToolbarRecord>();
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
            void this.bookmarksController.refreshPositionsForUrl(this.getBookmarkPageUrl()).then(() => this.refreshBookmarkActionStates());
        }

        this.rebindObserverIfNeeded(true);

        this.routeWatcher = new RouteWatcher((nextUrl, prevUrl) => {
            const hardChange = stripHash(nextUrl) !== stripHash(prevUrl);
            // Why: hash-only changes (e.g. `#settings`) should not cause a visible "blink" by tearing down toolbars.
            if (hardChange) {
                this.disposeObserversOnly();
                this.clearAllToolbars();
            }
            this.scanScheduler?.schedule('route_change');
            this.rebindObserverIfNeeded(true);
            if (this.bookmarksController) {
                void this.bookmarksController.refreshPositionsForUrl(this.getBookmarkPageUrl()).then(() => this.refreshBookmarkActionStates());
            }
        }, { intervalMs: 500 });
        this.routeWatcher.start();

        // If locale changes, rebuild UI strings (labels/tooltips) by re-injecting toolbars.
        // This is UI-only and avoids threading locale concerns into services/drivers.
        this.unsubscribeLocale = subscribeLocaleChange(() => {
            this.clearAllToolbars();
            this.scanScheduler?.schedule('manual');
        });
    }

    dispose(): void {
        this.scanScheduler?.dispose();
        this.scanScheduler = null;
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.observer?.disconnect();
        this.observer = null;
        this.observedContainer = null;
        this.clearAllToolbars();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        for (const anchor of Array.from(this.anchorKeys)) {
            const record = this.recordsByAnchor.get(anchor);
            record?.toolbar.setTheme(theme);
        }
        for (const messageEl of Array.from(this.pendingMessageKeys)) {
            const record = this.recordsByMessage.get(messageEl);
            record?.toolbar.setTheme(theme);
        }
        this.readerPanel.setTheme(theme);
    }

    setBehaviorFlags(flags: Partial<{ showViewSource: boolean; showSaveMessages: boolean; showWordCount: boolean }>): void {
        this.behavior = { ...this.behavior, ...flags };
    }

    private getPositionForMessage(messageElement: HTMLElement): number {
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
                    const url = this.getBookmarkPageUrl();
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

    private getAnchorForMessage(messageElement: HTMLElement): HTMLElement | null {
        try {
            return this.adapter.getToolbarAnchorElement?.(messageElement) ?? null;
        } catch {
            return null;
        }
    }

    private removeExistingToolbarsInAnchor(anchor: HTMLElement, keepHost?: HTMLElement): void {
        const existing = Array.from(anchor.querySelectorAll<HTMLElement>('[data-aimd-role="message-toolbar"], .aimd-message-toolbar-host'));
        for (const el of existing) {
            if (keepHost && el === keepHost) continue;
            el.remove();
        }
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
            const position = index + 1;
            messageElement.dataset.aimdMsgPosition = `${position}`;

            const anchor = this.getAnchorForMessage(messageElement);

            // If we previously injected a fallback toolbar into the message content, migrate it to the official bar when ready.
            if (anchor) {
                const existingPending = this.recordsByMessage.get(messageElement) || null;
                if (existingPending) {
                    if (!this.recordsByAnchor.get(anchor)) {
                        const host = existingPending.toolbar.getElement();
                        host.setAttribute('data-aimd-role', 'message-toolbar');
                        this.removeExistingToolbarsInAnchor(anchor, host);
                        this.adapter.injectToolbar(messageElement, host);
                        this.updatePlacementHint(existingPending.toolbar, messageElement);
                        this.recordsByAnchor.set(anchor, existingPending);
                        this.anchorKeys.add(anchor);
                    }
                    this.pendingMessageKeys.delete(messageElement);
                    return;
                }

                if (this.recordsByAnchor.get(anchor)) {
                    // Already injected for this official action bar container.
                    return;
                }

                // If an orphaned toolbar exists (from prior hydration/container replacement), remove it before reinjecting.
                this.removeExistingToolbarsInAnchor(anchor);
            } else {
                // Fallback (streaming/anchor not rendered yet): avoid duplicating within the message subtree.
                if (this.recordsByMessage.get(messageElement)) return;
                if (messageElement.dataset.aimdMsgInjected === '1') return;
                const turn = messageElement.closest('article') || messageElement;
                if ((turn as HTMLElement).querySelector?.('[data-aimd-role="message-toolbar"], .aimd-message-toolbar-host')) {
                    return;
                }
            }

            let recordRef: ToolbarRecord | null = null;
            const getToolbar = () => recordRef?.toolbar ?? null;
            const toolbar = new MessageToolbar(this.theme, this.getActionsForMessage(messageElement, getToolbar), { showStats: this.behavior.showWordCount });
            const host = toolbar.getElement();
            host.setAttribute('data-aimd-role', 'message-toolbar');

            const injected = this.adapter.injectToolbar(messageElement, host);
            if (!injected) {
                logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] injectToolbar failed');
                host.remove();
                return;
            }

            this.updatePlacementHint(toolbar, messageElement);

            const pending = this.adapter.isStreamingMessage(messageElement);
            toolbar.setPending(pending);

            const record: ToolbarRecord = { message: messageElement, toolbar, pending, position };
            recordRef = record;

            if (anchor) {
                this.recordsByAnchor.set(anchor, record);
                this.anchorKeys.add(anchor);
            } else {
                this.recordsByMessage.set(messageElement, record);
                this.pendingMessageKeys.add(messageElement);
                messageElement.dataset.aimdMsgInjected = '1';
            }

            this.refreshBookmarkStateForToolbar(toolbar, position);
            this.refreshWordCountForToolbar(toolbar, messageElement, pending);
            this.onMessageInjected?.(messageElement);
        });
    }

    private refreshBookmarkStateForToolbar(toolbar: MessageToolbar, position: number): void {
        if (!this.bookmarksController) return;
        const url = this.getBookmarkPageUrl();
        const active = this.bookmarksController.isPositionBookmarked(url, position);
        toolbar.setActionActive('bookmark_toggle', active);
    }

    private refreshBookmarkActionStates(): void {
        if (!this.bookmarksController) return;
        const url = this.getBookmarkPageUrl();
        for (const anchor of Array.from(this.anchorKeys)) {
            const record = this.recordsByAnchor.get(anchor);
            if (!record) continue;
            const active = this.bookmarksController!.isPositionBookmarked(url, record.position);
            record.toolbar.setActionActive('bookmark_toggle', active);
        }
        for (const messageEl of Array.from(this.pendingMessageKeys)) {
            const record = this.recordsByMessage.get(messageEl);
            if (!record) continue;
            const active = this.bookmarksController!.isPositionBookmarked(url, record.position);
            record.toolbar.setActionActive('bookmark_toggle', active);
        }
    }

    private refreshPendingStates(): void {
        // Anchor-keyed records
        for (const anchor of Array.from(this.anchorKeys)) {
            const record = this.recordsByAnchor.get(anchor);
            if (!record) {
                this.anchorKeys.delete(anchor);
                continue;
            }

            const { message, toolbar } = record;
            if (!document.contains(message)) {
                toolbar.getElement().remove();
                this.anchorKeys.delete(anchor);
                continue;
            }

            // If anchor was replaced, re-key and reattach.
            const nextAnchor = this.getAnchorForMessage(message);
            if (nextAnchor && nextAnchor !== anchor) {
                this.removeExistingToolbarsInAnchor(nextAnchor, toolbar.getElement());
                this.recordsByAnchor.set(nextAnchor, record);
                this.anchorKeys.add(nextAnchor);
                this.anchorKeys.delete(anchor);
            }

            const pending = this.adapter.isStreamingMessage(message);
            toolbar.setPending(pending);

            // Why: ChatGPT may only render the official action bar after streaming completes or after route subviews.
            if (!toolbar.getElement().isConnected || (record.pending && !pending)) {
                const a = this.getAnchorForMessage(message);
                if (a) this.removeExistingToolbarsInAnchor(a, toolbar.getElement());
                this.adapter.injectToolbar(message, toolbar.getElement());
                this.updatePlacementHint(toolbar, message);
            }

            if (record.pending !== pending) {
                this.refreshWordCountForToolbar(toolbar, message, pending);
            }
            record.pending = pending;
        }

        // Message-keyed fallback records (anchor not yet present). Try to migrate when possible.
        for (const messageEl of Array.from(this.pendingMessageKeys)) {
            const record = this.recordsByMessage.get(messageEl);
            if (!record) {
                this.pendingMessageKeys.delete(messageEl);
                continue;
            }

            const { message, toolbar } = record;
            if (!document.contains(message)) {
                toolbar.getElement().remove();
                this.pendingMessageKeys.delete(messageEl);
                continue;
            }

            const anchor = this.getAnchorForMessage(message);
            if (anchor) {
                if (!this.recordsByAnchor.get(anchor)) {
                    this.removeExistingToolbarsInAnchor(anchor, toolbar.getElement());
                    this.adapter.injectToolbar(message, toolbar.getElement());
                    this.updatePlacementHint(toolbar, message);
                    this.recordsByAnchor.set(anchor, record);
                    this.anchorKeys.add(anchor);
                }
                this.pendingMessageKeys.delete(messageEl);
                continue;
            }

            const pending = this.adapter.isStreamingMessage(message);
            toolbar.setPending(pending);
            if (record.pending !== pending) {
                this.refreshWordCountForToolbar(toolbar, message, pending);
            }
            record.pending = pending;
        }
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
            const anchor = this.getAnchorForMessage(messageElement);
            if (anchor && (host.parentElement === anchor || anchor.contains(host))) {
                toolbar.setPlacement('actionbar');
                return;
            }
            toolbar.setPlacement('content');
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
