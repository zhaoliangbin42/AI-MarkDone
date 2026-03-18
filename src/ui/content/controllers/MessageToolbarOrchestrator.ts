import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { scrollToAssistantPositionWithRetry } from '../../../drivers/content/bookmarks/navigation';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { getConversationUrl } from '../../../drivers/content/bookmarks/position';
import { discoverMessageElements } from '../../../drivers/content/injection/messageDiscovery';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { ScanScheduler } from '../../../drivers/content/injection/scanScheduler';
import { logger } from '../../../core/logger';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { copyMarkdownFromTurn } from '../../../services/copy/copy-turn-markdown';
import { collectConversationTurnRefs, type ConversationTurnRef } from '../../../drivers/content/conversation/collectConversationTurnRefs';
import { collectReaderItems } from '../../../services/reader/collectReaderItems';
import { resolveContent } from '../../../services/reader/types';
import { MessageToolbar, type MessageToolbarAction } from '../MessageToolbar';
import type { BookmarksPanelController } from '../bookmarks/BookmarksPanelController';
import type { ReaderPanel, ReaderPanelAction } from '../reader/ReaderPanel';
import type { SendController } from '../sending/SendController';
import { subscribeLocaleChange, t } from '../components/i18n';
import { WordCounter } from '../../../core/text/wordCounter';
import { bookmarkIcon, copyIcon, downloadIcon, bookOpenIcon, fileCodeIcon, locateIcon, sendIcon } from '../../../assets/icons';
import { saveMessagesDialog } from '../export/SaveMessagesDialog';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { bookmarkSaveDialog } from '../bookmarks/save/bookmarkSaveDialogSingleton';

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
    private sendController: SendController | null = null;
    private bookmarksController: BookmarksPanelController | null = null;
    private behavior = { showViewSource: true, showSaveMessages: true, showWordCount: true };
    private wordCounter = new WordCounter();
    private turnRefs: ConversationTurnRef[] = [];
    private turnRefBySegment = new WeakMap<HTMLElement, ConversationTurnRef>();

    private rebuildTurnIndex(): void {
        try {
            const turns = collectConversationTurnRefs(this.adapter);
            this.turnRefs = turns;
            this.turnRefBySegment = new WeakMap<HTMLElement, ConversationTurnRef>();
            for (const turn of turns) {
                for (const el of turn.messageEls) this.turnRefBySegment.set(el, turn);
            }
        } catch {
            this.turnRefs = [];
            this.turnRefBySegment = new WeakMap<HTMLElement, ConversationTurnRef>();
        }
    }

    private getTurnRefForElement(messageElement: HTMLElement): ConversationTurnRef | null {
        const direct = this.turnRefBySegment.get(messageElement);
        if (direct) return direct;
        for (const turn of this.turnRefs) {
            for (const el of turn.messageEls) {
                if (el === messageElement || el.contains(messageElement) || messageElement.contains(el)) return turn;
            }
        }
        return null;
    }

    private getMergedMarkdownForElement(messageElement: HTMLElement): ReturnType<typeof copyMarkdownFromMessage> {
        const turn = this.getTurnRefForElement(messageElement);
        if (!turn) return copyMarkdownFromMessage(this.adapter, messageElement);
        return copyMarkdownFromTurn(this.adapter, turn.messageEls);
    }

    private getUserPromptForElement(messageElement: HTMLElement): string {
        const turn = this.getTurnRefForElement(messageElement);
        return turn?.userPrompt ?? this.adapter.extractUserPrompt(messageElement) ?? '';
    }

    private decorateReaderItems(items: Array<{ meta?: Record<string, unknown> }>): void {
        if (!this.bookmarksController) return;
        const url = this.getBookmarkPageUrl();
        for (const item of items) {
            const position = Number(item.meta?.position ?? 0);
            item.meta = {
                ...(item.meta || {}),
                url,
                bookmarkable: position > 0,
                bookmarked: position > 0 ? this.bookmarksController.isPositionBookmarked(url, position) : false,
            };
        }
    }

    private getReaderActions(_messageElement: HTMLElement): ReaderPanelAction[] {
        const actions: ReaderPanelAction[] = [];

        if (this.bookmarksController) {
            actions.push({
                id: 'bookmark_toggle',
                label: t('btnBookmark'),
                tooltip: t('btnBookmark'),
                icon: bookmarkIcon,
                placement: 'header',
                toggle: true,
                isActive: (ctx: any) => Boolean(ctx?.item?.meta?.bookmarked),
                onClick: async (ctx: any) => {
                    const meta = (ctx?.item?.meta || {}) as Record<string, unknown>;
                    const url = typeof meta.url === 'string' ? meta.url : this.getBookmarkPageUrl();
                    const position = Number(meta.position ?? 0);
                    if (!position) {
                        ctx?.notify?.(t('positionNotAvailable'));
                        return;
                    }

                    const userPrompt = String(ctx?.item?.userPrompt || '').trim();
                    if (!userPrompt) {
                        ctx?.notify?.(t('failedToExtractUserMessage'));
                        return;
                    }

                    const markdown = await resolveContent(ctx.item.content);
                    const already = this.bookmarksController!.isPositionBookmarked(url, position);

                    if (!already) {
                        const currentFolderPath = this.bookmarksController!.getDefaultFolderPath();
                        const res = await bookmarkSaveDialog.open({
                            theme: this.theme,
                            userPrompt,
                            existingTitle: userPrompt,
                            currentFolderPath,
                            mode: 'create',
                        });
                        if (!res.ok) return;

                        const saveRes = await this.bookmarksController!.toggleBookmarkFromToolbar({
                            url,
                            position,
                            folderPath: res.folderPath,
                            userMessage: userPrompt,
                            aiResponse: markdown,
                            platform: 'ChatGPT',
                            title: res.title,
                        });
                        if (!saveRes.ok) {
                            ctx?.notify?.(saveRes.message);
                            return;
                        }
                        ctx.item.meta = { ...(ctx.item.meta || {}), url, position, bookmarked: true, bookmarkable: true };
                        ctx?.notify?.(t('savedStatus'));
                        ctx?.rerender?.();
                        return;
                    }

                    const folderPath = this.bookmarksController!.getDefaultFolderPath();
                    const title = userPrompt.length > 50 ? `${userPrompt.slice(0, 50)}...` : userPrompt;
                    const res = await this.bookmarksController!.toggleBookmarkFromToolbar({
                        url,
                        position,
                        folderPath,
                        userMessage: userPrompt,
                        aiResponse: markdown,
                        platform: 'ChatGPT',
                        title,
                    });
                    if (!res.ok) {
                        ctx?.notify?.(res.message);
                        return;
                    }
                    ctx.item.meta = { ...(ctx.item.meta || {}), url, position, bookmarked: res.data.saved, bookmarkable: true };
                    ctx?.notify?.(res.data.saved ? t('savedStatus') : t('removedStatus'));
                    ctx?.rerender?.();
                },
            });
        }

        if (this.sendController) {
            actions.push({
                id: 'send',
                label: t('send'),
                icon: sendIcon,
                kind: 'primary',
                placement: 'footer_left',
                toggle: true,
                rerenderOnClick: false,
                onClick: (ctx: any) => {
                    const shadow = ctx?.shadow as ShadowRoot | undefined;
                    const anchorBtn = ctx?.anchorEl as HTMLElement | undefined;
                    if (!shadow || !anchorBtn) return;
                    const anchorWrap = anchorBtn.closest?.('[data-role="footer-left-actions"]') as HTMLElement | null;
                    this.sendController?.togglePopover({ adapter: this.adapter, shadow, anchor: anchorWrap || anchorBtn });
                },
            });
        }

        actions.push({
            id: 'locate',
            label: t('jumpToMessage'),
            tooltip: t('jumpToMessage'),
            icon: locateIcon,
            placement: 'footer_left',
            onClick: async (ctx: any) => {
                const meta = (ctx?.item?.meta || {}) as Record<string, unknown>;
                const position = Number(meta.position ?? 0);
                if (!position) {
                    ctx?.notify?.(t('positionNotAvailable'));
                    return;
                }

                this.readerPanel.hide();
                const result = await scrollToAssistantPositionWithRetry(this.adapter, position, { timeoutMs: 2500, intervalMs: 200 });
                if (!result.ok) ctx?.notify?.(t('positionNotAvailable'));
            },
        });

        return actions;
    }

    constructor(
        adapter: SiteAdapter,
        opts: {
            readerPanel: ReaderPanel;
            sendController?: SendController;
            bookmarksController?: BookmarksPanelController;
            onMessageInjected?: (messageElement: HTMLElement) => void;
        }
    ) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.sendController = opts.sendController ?? null;
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
        bookmarkSaveDialog.setTheme(theme);
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

                    if (!position) return { ok: false, message: t('positionNotAvailable') };

                    const already = this.bookmarksController!.isPositionBookmarked(url, position);
                    if (!already) {
                        // Open a dedicated save dialog (Google/Material style) to pick title + folder.
                        // Do not block the toolbar action handler while the dialog is open.
                        void (async () => {
                            const userMessage = this.getUserPromptForElement(messageElement);
                            if (!userMessage.trim()) return;

                            const md = this.getMergedMarkdownForElement(messageElement);
                            if (!md.ok) return;

                            const currentFolderPath = this.bookmarksController!.getDefaultFolderPath();
                            const res = await bookmarkSaveDialog.open({
                                theme: this.theme,
                                userPrompt: userMessage,
                                existingTitle: userMessage,
                                currentFolderPath,
                                mode: 'create',
                            });
                            if (!res.ok) return;

                            const saveRes = await this.bookmarksController!.toggleBookmarkFromToolbar({
                                url,
                                position,
                                folderPath: res.folderPath,
                                userMessage,
                                aiResponse: md.markdown,
                                platform: 'ChatGPT',
                                title: res.title,
                            });
                            if (!saveRes.ok) return;

                            toolbar?.setActionActive('bookmark_toggle', true);
                            this.bookmarksController!.selectFolder(res.folderPath);
                        })();

                        return;
                    }

                    const userMessage = this.getUserPromptForElement(messageElement);
                    if (!userMessage.trim()) return { ok: false, message: t('failedToExtractUserMessage') };

                    const md = this.getMergedMarkdownForElement(messageElement);
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
                    return { ok: true, message: res.data.saved ? t('savedStatus') : t('removedStatus') };
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
                    const res = this.getMergedMarkdownForElement(messageElement);
                    if (!res.ok) return { ok: false, message: res.error.message };
                    const ok = await copyTextToClipboard(res.markdown);
                    return ok ? { ok: true, message: t('btnCopied') } : { ok: false, message: t('clipboardWriteFailed') };
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
                    const res = this.getMergedMarkdownForElement(messageElement);
                    if (!res.ok) return { ok: false, message: res.error.message };
                    sourcePanel.show({ theme: this.theme, title: t('modalSourceTitle'), content: res.markdown });
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
                this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
                await this.readerPanel.show(items, startIndex, this.theme, {
                    initialView: 'render',
                    showOpenConversation: false,
                    actions: this.getReaderActions(messageElement) as any,
                });
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
                onClick: async () => {
                    saveMessagesDialog.open(this.adapter, this.theme);
                },
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
        this.rebuildTurnIndex();
        const selector = this.adapter.getMessageSelector();
        const container = this.adapter.getObserverContainer() || document.body;
        const nodes = discoverMessageElements(container, selector);

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
        // Keep the turn index reasonably fresh for stats/actions without rebuilding per-click.
        if (this.turnRefs.length === 0) this.rebuildTurnIndex();
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
            // Avoid duplicating the streaming note ("Streaming…") in both the stats area and the note field.
            // During pending/streaming, keep the stats area quiet and recompute once stable.
            toolbar.setStats([]);
            return;
        }

        // Legacy-like: compute when content is stable; if empty, retry a few times.
        const tryCompute = (attempt: number) => {
            const md = this.getMergedMarkdownForElement(messageElement);
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
