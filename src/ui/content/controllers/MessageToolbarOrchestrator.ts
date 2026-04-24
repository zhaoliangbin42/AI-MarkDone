import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { scrollToBookmarkTargetWithRetry } from '../../../drivers/content/bookmarks/navigation';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { getConversationUrl } from '../../../drivers/content/bookmarks/position';
import { discoverMessageElements } from '../../../drivers/content/injection/messageDiscovery';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { ScanScheduler } from '../../../drivers/content/injection/scanScheduler';
import { logger } from '../../../core/logger';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { copyMarkdownFromTurn } from '../../../services/copy/copy-turn-markdown';
import { copyTurnsPng } from '../../../services/copy/copy-turn-png';
import { buildConversationMetadata } from '../../../drivers/content/conversation/metadata';
import {
    isCopyPngDebugEnabled,
    logCopyPngDebugEvent,
    nowMs,
    type CopyPngDebugEvent,
} from '../../../services/copy/copy-png-debug';
import { collectConversationTurnRefs, type ConversationTurnRef } from '../../../drivers/content/conversation/collectConversationTurnRefs';
import { buildReaderItemFromTurn, collectReaderItems, stripHash as stripReaderUrl } from '../../../services/reader/collectReaderItems';
import { resolveContent } from '../../../services/reader/types';
import { MessageToolbar, type MessageToolbarAction } from '../MessageToolbar';
import type { BookmarksPanelController } from '../bookmarks/BookmarksPanelController';
import type { ReaderPanel, ReaderPanelAction } from '../reader/ReaderPanel';
import type { SendController } from '../sending/SendController';
import { subscribeLocaleChange, t } from '../components/i18n';
import { WordCounter } from '../../../core/text/wordCounter';
import { bookmarkIcon, copyIcon, downloadIcon, bookOpenIcon, locateIcon, sendIcon, imageIcon } from '../../../assets/icons';
import { saveMessagesDialog } from '../export/SaveMessagesDialog';
import { bookmarkSaveDialog } from '../bookmarks/save/bookmarkSaveDialogSingleton';
import { resolveMessageKey, stripHash } from './messageToolbarKeys';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { buildChatGPTReaderItems } from '../../../services/reader/chatgptReaderItems';
import { resolveChatGPTConversationRound } from '../../../drivers/content/chatgpt/chatgptConversationSource';
import { navigateChatGPTDirectoryTarget, resolveChatGPTSkeletonPositionForMessage } from '../chatgptDirectory/navigation';

type ToolbarRecord = {
    messageKey: string;
    platformId: string;
    message: HTMLElement;
    anchor: HTMLElement;
    toolbar: MessageToolbar;
    pending: boolean;
    position: number;
    boundAtUrl: string;
};

type ScanSnapshotItem = {
    messageKey: string;
    message: HTMLElement;
    anchor: HTMLElement | null;
    position: number;
    pending: boolean;
};

type BookmarkToggleParams = {
    url: string;
    position: number;
    messageId?: string | null;
    userPrompt: string;
    markdown: string;
    alreadyBookmarked: boolean;
};

type BookmarkToggleResult =
    | { ok: true; saved: boolean; bookmarked: boolean; message: string; folderPath?: string }
    | { ok: false; message?: string; cancelled?: boolean };

type ToolbarBookmarkTarget = {
    position: number;
    messageId: string | null;
    userPrompt: string;
};

export class MessageToolbarOrchestrator {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private recordsByMessageKey = new Map<string, ToolbarRecord>();
    private dirtyMessages = new Set<HTMLElement>();
    private needsFullRescan = false;
    private theme: Theme = 'light';
    private onMessageInjected: ((messageElement: HTMLElement) => void) | null = null;
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private observedContainer: HTMLElement | null = null;
    private readerPanel: ReaderPanel;
    private sendController: SendController | null = null;
    private bookmarksController: BookmarksPanelController | null = null;
    private chatGptConversationEngine: ChatGPTConversationEngine | null = null;
    private behavior = { showSaveMessages: true, showWordCount: true };
    private wordCounter = new WordCounter();
    private messageOrder: HTMLElement[] = [];
    private messagePositionByElement = new WeakMap<HTMLElement, number>();
    private messageSegmentIndexByElement = new WeakMap<HTMLElement, number>();
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
        if (this.turnRefs.length === 0) {
            this.rebuildTurnIndex();
        }
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

    private async resolveToolbarBookmarkTarget(messageElement: HTMLElement): Promise<ToolbarBookmarkTarget | null> {
        const fallback: ToolbarBookmarkTarget = {
            position: this.getPositionForMessage(messageElement),
            messageId: this.adapter.getMessageId(messageElement),
            userPrompt: this.getUserPromptForElement(messageElement),
        };

        if (this.adapter.getPlatformId() !== 'chatgpt' || !this.chatGptConversationEngine) {
            return fallback.position > 0 ? fallback : null;
        }

        const skeletonPosition = resolveChatGPTSkeletonPositionForMessage(this.adapter, messageElement);
        const snapshot = await this.chatGptConversationEngine.getSnapshot().catch(() => null);
        if (!snapshot?.rounds?.length) {
            return skeletonPosition
                ? { ...fallback, position: skeletonPosition }
                : null;
        }

        if (skeletonPosition) {
            const bySkeletonPosition = resolveChatGPTConversationRound(snapshot, {
                position: skeletonPosition,
                positionSource: 'snapshot',
            });
            if (bySkeletonPosition) {
                return {
                    position: bySkeletonPosition.position,
                    messageId: bySkeletonPosition.messageId ?? bySkeletonPosition.assistantMessageId ?? fallback.messageId ?? bySkeletonPosition.userMessageId ?? null,
                    userPrompt: bySkeletonPosition.userPrompt || fallback.userPrompt,
                };
            }
        }

        const round = resolveChatGPTConversationRound(snapshot, {
            messageId: fallback.messageId,
            userPrompt: fallback.userPrompt,
        });
        if (!round) return null;

        return {
            position: round.position,
            messageId: round.messageId ?? round.assistantMessageId ?? fallback.messageId ?? round.userMessageId ?? null,
            userPrompt: round.userPrompt || fallback.userPrompt,
        };
    }

    private getBookmarkPlatformLabel(): string {
        const platformId = this.adapter.getPlatformId();
        if (platformId === 'chatgpt') return 'ChatGPT';
        if (platformId === 'claude') return 'Claude';
        if (platformId === 'gemini') return 'Gemini';
        if (platformId === 'deepseek') return 'DeepSeek';
        return platformId;
    }

    private async runBookmarkToggle(params: BookmarkToggleParams): Promise<BookmarkToggleResult> {
        if (!this.bookmarksController) return { ok: false, message: t('contentNotFound') };
        if (!params.position) return { ok: false, message: t('positionNotAvailable') };

        const userPrompt = params.userPrompt.trim();
        if (!userPrompt) return { ok: false, message: t('failedToExtractUserMessage') };

        if (!params.alreadyBookmarked) {
            const currentFolderPath = this.bookmarksController.getDefaultFolderPath();
            const dialogRes = await bookmarkSaveDialog.open({
                theme: this.theme,
                userPrompt,
                existingTitle: userPrompt,
                currentFolderPath,
                mode: 'create',
            });
            if (!dialogRes.ok) return { ok: false, cancelled: true };

            const saveRes = await this.bookmarksController.toggleBookmarkFromToolbar({
                url: params.url,
                position: params.position,
                messageId: params.messageId ?? null,
                folderPath: dialogRes.folderPath,
                userMessage: userPrompt,
                aiResponse: params.markdown,
                platform: this.getBookmarkPlatformLabel(),
                title: dialogRes.title,
            });
            if (!saveRes.ok) return { ok: false, message: saveRes.message };

            return {
                ok: true,
                saved: true,
                bookmarked: true,
                message: t('savedStatus'),
                folderPath: dialogRes.folderPath,
            };
        }

        const title = userPrompt.length > 50 ? `${userPrompt.slice(0, 50)}...` : userPrompt;
        const removeRes = await this.bookmarksController.toggleBookmarkFromToolbar({
            url: params.url,
            position: params.position,
            messageId: params.messageId ?? null,
            folderPath: this.bookmarksController.getDefaultFolderPath(),
            userMessage: userPrompt,
            aiResponse: params.markdown,
            platform: this.getBookmarkPlatformLabel(),
            title,
        });
        if (!removeRes.ok) return { ok: false, message: removeRes.message };

        return {
            ok: true,
            saved: removeRes.data.saved,
            bookmarked: removeRes.data.saved,
            message: removeRes.data.saved ? t('savedStatus') : t('removedStatus'),
        };
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
                    const messageId = typeof meta.messageId === 'string' ? meta.messageId : null;
                    const userPrompt = String(ctx?.item?.userPrompt || '').trim();
                    const markdown = await resolveContent(ctx.item.content);
                    const result = await this.runBookmarkToggle({
                        url,
                        position,
                        messageId,
                        userPrompt,
                        markdown,
                        alreadyBookmarked: this.bookmarksController!.isPositionBookmarked(url, position),
                    });
                    if (!result.ok) {
                        if (!result.cancelled && result.message) ctx?.notify?.(result.message);
                        return;
                    }
                    ctx.item.meta = { ...(ctx.item.meta || {}), url, position, messageId, bookmarked: result.bookmarked, bookmarkable: true };
                    ctx?.notify?.(result.message);
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
                    this.sendController?.togglePopover({
                        adapter: this.adapter,
                        shadow,
                        anchor: anchorWrap || anchorBtn,
                        commentInsert: this.readerPanel.getCommentExportContext(),
                    });
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
                const messageId = typeof meta.messageId === 'string' ? meta.messageId : null;
                if (!position && !messageId) {
                    ctx?.notify?.(t('positionNotAvailable'));
                    return;
                }

                this.readerPanel.hide();
                const result = this.adapter.getPlatformId() === 'chatgpt'
                    ? await navigateChatGPTDirectoryTarget(
                        this.adapter,
                        { position, messageId },
                        { timeoutMs: 2500, intervalMs: 200 },
                    )
                    : await scrollToBookmarkTargetWithRetry(
                        this.adapter,
                        { position, messageId },
                        { timeoutMs: 2500, intervalMs: 200 }
                    );
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
            chatGptConversationEngine?: ChatGPTConversationEngine;
            onMessageInjected?: (messageElement: HTMLElement) => void;
        }
    ) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.sendController = opts.sendController ?? null;
        this.bookmarksController = opts.bookmarksController || null;
        this.chatGptConversationEngine = opts.chatGptConversationEngine ?? null;
        this.onMessageInjected = opts.onMessageInjected || null;
    }

    private getBookmarkPageUrl(): string {
        // Why: ChatGPT uses hash routes like `#settings`; bookmarks should remain scoped to the conversation URL.
        return stripHash(getConversationUrl());
    }

    private removeRecord(messageKey: string): void {
        const record = this.recordsByMessageKey.get(messageKey);
        if (!record) return;
        record.toolbar.dispose();
        record.toolbar.getElement().remove();
        this.recordsByMessageKey.delete(messageKey);
    }

    private clearAllToolbars(): void {
        for (const messageKey of Array.from(this.recordsByMessageKey.keys())) {
            this.removeRecord(messageKey);
        }
    }

    init(): void {
        this.scanScheduler = new ScanScheduler(
            (reasons) => {
                this.scanAndInject(reasons);
                this.refreshPendingStates();
                this.rebindObserverIfNeeded();
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
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

        this.unsubscribeLocale = subscribeLocaleChange(() => {
            this.refreshExistingToolbarsForLocale();
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
        this.dirtyMessages.clear();
        this.needsFullRescan = false;
        this.clearAllToolbars();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        for (const record of this.recordsByMessageKey.values()) {
            record.toolbar.setTheme(theme);
        }
        this.readerPanel.setTheme(theme);
        bookmarkSaveDialog.setTheme(theme);
    }

    setBehaviorFlags(flags: Partial<{ showSaveMessages: boolean; showWordCount: boolean }>): void {
        this.behavior = { ...this.behavior, ...flags };
    }

    private getPositionForMessage(messageElement: HTMLElement): number {
        const fallback = Number(messageElement.dataset.aimdMsgPosition || 0);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    private guardMessageReady(_messageElement: HTMLElement): { ok: false; message: string } | null {
        try {
            return this.adapter.isStreamingMessage(_messageElement) ? { ok: false, message: t('streamingStatus') } : null;
        } catch {
            return null;
        }
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
                    const guard = this.guardMessageReady(messageElement);
                    if (guard) return guard;
                    const toolbar = getToolbar();
                    const url = this.getBookmarkPageUrl();
                    const target = await this.resolveToolbarBookmarkTarget(messageElement);
                    if (!target) return { ok: false, message: t('positionNotAvailable') };
                    const md = this.getMergedMarkdownForElement(messageElement);
                    if (!md.ok) return { ok: false, message: md.error.message };
                    const result = await this.runBookmarkToggle({
                        url,
                        position: target.position,
                        messageId: target.messageId,
                        userPrompt: target.userPrompt,
                        markdown: md.markdown,
                        alreadyBookmarked: this.bookmarksController!.isPositionBookmarked(url, target.position),
                    });
                    if (!result.ok) {
                        if (result.cancelled) return;
                        return { ok: false, message: result.message ?? t('contentNotFound') };
                    }

                    toolbar?.setActionActive('bookmark_toggle', result.bookmarked);
                    if (result.saved && result.folderPath) {
                        this.bookmarksController!.selectFolder(result.folderPath);
                        return;
                    }
                    return { ok: true, message: result.message };
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
                const guard = this.guardMessageReady(messageElement);
                if (guard) return guard;
                const res = this.getMergedMarkdownForElement(messageElement);
                if (!res.ok) return { ok: false, message: res.error.message };
                const ok = await copyTextToClipboard(res.markdown);
                return ok ? { ok: true, message: t('btnCopied') } : { ok: false, message: t('clipboardWriteFailed') };
            },
            hoverAction: {
                id: 'copy_png',
                label: t('btnCopyAsPng'),
                icon: imageIcon,
                onClick: async () => {
                    const debugEnabled = isCopyPngDebugEnabled();
                    const copyStartedAt = nowMs();
                    const debugEvents: CopyPngDebugEvent[] = [];
                    const emitDebug = (event: CopyPngDebugEvent) => {
                        if (!debugEnabled) return;
                        debugEvents.push(event);
                        logCopyPngDebugEvent(event);
                    };
                    const finishDebug = (result: string) => {
                        if (!debugEnabled) return;
                        const summary = {
                            result,
                            totalMs: Math.round(nowMs() - copyStartedAt),
                            stages: debugEvents,
                        };
                        try {
                            console.info('[AI-MarkDone][CopyPNG][PerfSummary]', summary);
                            console.table(debugEvents);
                        } catch {
                            // ignore debug logging failures
                        }
                    };

                    const guard = this.guardMessageReady(messageElement);
                    if (guard) {
                        finishDebug('guard_blocked');
                        return guard;
                    }
                    const collectStartedAt = nowMs();
                    const markdownResult = this.getMergedMarkdownForElement(messageElement);
                    if (!markdownResult.ok) {
                        finishDebug(markdownResult.error.code);
                        return { ok: false, message: markdownResult.error.message };
                    }
                    const fallbackPosition = this.getPositionForMessage(messageElement);
                    const currentTurn = {
                        user: this.getUserPromptForElement(messageElement),
                        assistant: markdownResult.markdown,
                        index: fallbackPosition > 0 ? fallbackPosition - 1 : 0,
                    };
                    const metadata = buildConversationMetadata(this.adapter, 1);
                    emitDebug({
                        stage: 'collect_turns',
                        durationMs: Math.round(nowMs() - collectStartedAt),
                        totalMs: Math.round(nowMs() - copyStartedAt),
                        selectedIndex: currentTurn.index,
                        turnCount: 1,
                    });
                    const result = await copyTurnsPng([currentTurn], [0], metadata, {
                        t: (key: string, args?: unknown) => {
                            if (typeof args === 'string' || Array.isArray(args)) return t(key, args);
                            return t(key);
                        },
                        onDebug: emitDebug,
                    });
                    if (!result.ok) {
                        finishDebug(result.error.code);
                        return { ok: false, message: result.error.message };
                    }
                    if (result.noop) {
                        finishDebug('noop');
                        return { ok: false, message: t('contentNotFound') };
                    }
                    finishDebug('ok');
                    return { ok: true, message: t('btnCopyAsPngCopied') };
                },
            },
        });

        actions.push({
            id: 'reader',
            label: t('btnReader'),
            tooltip: t('btnReader'),
            icon: bookOpenIcon,
            kind: 'secondary',
            disabledWhenPending: true,
            onClick: async () => {
                const guard = this.guardMessageReady(messageElement);
                if (guard) return guard;
                let itemsResult = null as ReturnType<typeof collectReaderItems> | ReturnType<typeof buildChatGPTReaderItems> | null;
                if (this.adapter.getPlatformId() === 'chatgpt' && this.chatGptConversationEngine) {
                    const snapshot = await this.chatGptConversationEngine.getSnapshot();
                    const startTarget = {
                        messageId: this.adapter.getMessageId(messageElement),
                        userPrompt: this.getUserPromptForElement(messageElement),
                    };
                    if (snapshot?.rounds?.length) {
                        itemsResult = buildChatGPTReaderItems(snapshot, startTarget, this.getBookmarkPageUrl());
                    }
                }
                if (!itemsResult) {
                    this.rebuildTurnIndex();
                    itemsResult = collectReaderItems(this.adapter, messageElement);
                }
                const { items, startIndex } = itemsResult;
                this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
                await this.readerPanel.show(items, startIndex, this.theme, {
                    profile: 'conversation-reader',
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
                    const guard = this.guardMessageReady(messageElement);
                    if (guard) return guard;
                    await saveMessagesDialog.open(this.adapter, this.theme, {
                        chatGptConversationEngine: this.chatGptConversationEngine,
                    });
                },
            });
        }

        return actions;
    }

    private getAnchorForMessage(messageElement: HTMLElement): HTMLElement | null {
        try {
            return this.adapter.getToolbarAnchorElement(messageElement);
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

    private createToolbarRecord(params: {
        messageKey: string;
        message: HTMLElement;
        anchor: HTMLElement;
        position: number;
        pending: boolean;
    }): ToolbarRecord | null {
        let recordRef: ToolbarRecord | null = null;
        const getToolbar = () => recordRef?.toolbar ?? null;
        const toolbar = new MessageToolbar(this.theme, this.getActionsForMessage(params.message, getToolbar), { showStats: this.behavior.showWordCount });
        const host = toolbar.getElement();
        host.setAttribute('data-aimd-role', 'message-toolbar');
        host.setAttribute('data-aimd-message-key', params.messageKey);

        this.removeExistingToolbarsInAnchor(params.anchor, host);
        const injected = this.adapter.injectToolbar(params.message, host);
        if (!injected) {
            logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] injectToolbar failed');
            toolbar.dispose();
            host.remove();
            return null;
        }

        this.updatePlacementHint(toolbar, params.message);

        const record: ToolbarRecord = {
            messageKey: params.messageKey,
            platformId: this.adapter.getPlatformId(),
            message: params.message,
            anchor: params.anchor,
            toolbar,
            pending: params.pending,
            position: params.position,
            boundAtUrl: this.getBookmarkPageUrl(),
        };
        recordRef = record;

        this.refreshBookmarkStateForToolbar(toolbar, params.message, params.position);
        this.refreshWordCountForToolbar(toolbar, params.message, params.pending);
        this.onMessageInjected?.(params.message);
        return record;
    }

    private rebuildToolbarRecord(record: ToolbarRecord): ToolbarRecord | null {
        record.toolbar.dispose();
        record.toolbar.getElement().remove();
        return this.createToolbarRecord({
            messageKey: record.messageKey,
            message: record.message,
            anchor: record.anchor,
            position: record.position,
            pending: record.pending,
        });
    }

    private refreshExistingToolbarsForLocale(): void {
        for (const [messageKey, record] of Array.from(this.recordsByMessageKey.entries())) {
            if (!document.contains(record.message) || !document.contains(record.anchor)) {
                this.removeRecord(messageKey);
                continue;
            }
            const refreshed = this.rebuildToolbarRecord(record);
            if (!refreshed) {
                this.removeRecord(messageKey);
                continue;
            }
            this.recordsByMessageKey.set(messageKey, refreshed);
        }
    }

    private invalidateTurnIndex(): void {
        this.turnRefs = [];
        this.turnRefBySegment = new WeakMap<HTMLElement, ConversationTurnRef>();
    }

    private rebuildMessageCaches(nodes: HTMLElement[]): void {
        this.messageOrder = [...nodes];
        this.messagePositionByElement = new WeakMap<HTMLElement, number>();
        this.messageSegmentIndexByElement = new WeakMap<HTMLElement, number>();

        const segmentCountByTurn = new Map<HTMLElement | null, number>();
        nodes.forEach((messageElement, index) => {
            const position = index + 1;
            this.messagePositionByElement.set(messageElement, position);
            messageElement.dataset.aimdMsgPosition = `${position}`;

            const turnRoot = this.adapter.getTurnRootElement?.(messageElement) ?? null;
            const currentSegmentIndex = segmentCountByTurn.get(turnRoot) ?? 0;
            this.messageSegmentIndexByElement.set(messageElement, currentSegmentIndex);
            segmentCountByTurn.set(turnRoot, currentSegmentIndex + 1);
        });
    }

    private buildSnapshotFromNodes(nodes: HTMLElement[]): Map<string, ScanSnapshotItem> {
        const snapshot = new Map<string, ScanSnapshotItem>();

        nodes.forEach((messageElement, index) => {
            const position = this.messagePositionByElement.get(messageElement) ?? index + 1;
            const messageKey = resolveMessageKey(this.adapter, messageElement, position, {
                segmentIndexByElement: this.messageSegmentIndexByElement,
            });
            const next: ScanSnapshotItem = {
                messageKey,
                message: messageElement,
                anchor: this.getAnchorForMessage(messageElement),
                position,
                pending: this.adapter.isStreamingMessage(messageElement),
            };
            const prev = snapshot.get(messageKey);
            if (!prev || (!prev.anchor && next.anchor)) {
                snapshot.set(messageKey, next);
            }
        });

        return snapshot;
    }

    private buildFullScanSnapshot(): Map<string, ScanSnapshotItem> {
        const selector = this.adapter.getMessageSelector();
        const container = this.adapter.getObserverContainer() || document.body;
        const nodes = discoverMessageElements(container, selector);
        this.rebuildMessageCaches(nodes);
        this.rebuildTurnIndex();
        return this.buildSnapshotFromNodes(nodes);
    }

    private sortMessagesByDocumentOrder(nodes: HTMLElement[]): HTMLElement[] {
        return [...nodes].sort((left, right) => {
            if (left === right) return 0;
            const position = left.compareDocumentPosition(right);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
    }

    private resolveIncrementalPosition(messageElement: HTMLElement): number | null {
        const cached = this.messagePositionByElement.get(messageElement);
        if (cached) return cached;
        if (this.messageOrder.length === 0) return null;

        const lastKnown = this.messageOrder[this.messageOrder.length - 1];
        if (!lastKnown) return null;

        const relation = lastKnown.compareDocumentPosition(messageElement);
        if ((relation & Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
            return null;
        }

        const position = this.messageOrder.length + 1;
        this.messageOrder.push(messageElement);
        this.messagePositionByElement.set(messageElement, position);
        messageElement.dataset.aimdMsgPosition = `${position}`;

        const turnRoot = this.adapter.getTurnRootElement?.(messageElement) ?? null;
        const selector = this.adapter.getMessageSelector();
        const segmentIndex = turnRoot
            ? Array.from(turnRoot.querySelectorAll(selector)).filter((node): node is HTMLElement => node instanceof HTMLElement).indexOf(messageElement)
            : 0;
        this.messageSegmentIndexByElement.set(messageElement, segmentIndex >= 0 ? segmentIndex : 0);
        this.invalidateTurnIndex();
        return position;
    }

    private buildIncrementalSnapshot(candidates: HTMLElement[]): Map<string, ScanSnapshotItem> | null {
        const sortedCandidates = this.sortMessagesByDocumentOrder(Array.from(new Set(candidates)).filter((node) => node.isConnected));
        if (sortedCandidates.length === 0) return new Map<string, ScanSnapshotItem>();

        for (const messageElement of sortedCandidates) {
            const position = this.resolveIncrementalPosition(messageElement);
            if (!position) {
                this.needsFullRescan = true;
                return null;
            }
        }

        return this.buildSnapshotFromNodes(sortedCandidates);
    }

    private reconcileScanSnapshot(snapshot: Map<string, ScanSnapshotItem>, mode: 'full' | 'incremental'): void {
        for (const [messageKey, item] of snapshot.entries()) {
            const existing = this.recordsByMessageKey.get(messageKey) || null;

            if (!item.anchor) {
                if (existing) this.removeRecord(messageKey);
                continue;
            }
            const anchor = item.anchor;

            if (!existing) {
                const created = this.createToolbarRecord({
                    ...item,
                    anchor,
                });
                if (created) this.recordsByMessageKey.set(messageKey, created);
                continue;
            }

            existing.message = item.message;
            existing.position = item.position;
            existing.boundAtUrl = this.getBookmarkPageUrl();

            if (existing.anchor !== anchor || !existing.toolbar.getElement().isConnected) {
                existing.anchor = anchor;
                const refreshed = this.rebuildToolbarRecord({
                    ...existing,
                    pending: item.pending,
                });
                if (!refreshed) {
                    this.removeRecord(messageKey);
                    continue;
                }
                this.recordsByMessageKey.set(messageKey, refreshed);
                continue;
            }

            existing.pending = item.pending;
            this.refreshBookmarkStateForToolbar(existing.toolbar, item.message, item.position);
            this.refreshWordCountForToolbar(existing.toolbar, item.message, item.pending);
        }

        if (mode === 'full') {
            for (const [messageKey] of Array.from(this.recordsByMessageKey.entries())) {
                if (!snapshot.has(messageKey)) {
                    this.removeRecord(messageKey);
                }
            }
        }
    }

    private scanAndInject(reasons: Set<string> = new Set(['manual'])): void {
        const shouldRunFull =
            reasons.has('init')
            || reasons.has('route_change')
            || reasons.has('manual')
            || this.needsFullRescan
            || this.messageOrder.length === 0;

        if (shouldRunFull) {
            const snapshot = this.buildFullScanSnapshot();
            this.needsFullRescan = false;
            this.dirtyMessages.clear();
            this.reconcileScanSnapshot(snapshot, 'full');
            void this.syncReaderTailPages();
            return;
        }

        const snapshot = this.buildIncrementalSnapshot(Array.from(this.dirtyMessages));
        this.dirtyMessages.clear();
        if (snapshot === null) {
            const fullSnapshot = this.buildFullScanSnapshot();
            this.needsFullRescan = false;
            this.reconcileScanSnapshot(fullSnapshot, 'full');
            void this.syncReaderTailPages();
            return;
        }

        this.reconcileScanSnapshot(snapshot, 'incremental');
        void this.syncReaderTailPages();
    }

    private refreshBookmarkStateForToolbar(toolbar: MessageToolbar, messageElement: HTMLElement, fallbackPosition: number): void {
        if (!this.bookmarksController) return;
        const url = this.getBookmarkPageUrl();
        if (this.adapter.getPlatformId() !== 'chatgpt' || !this.chatGptConversationEngine) {
            const active = this.bookmarksController.isPositionBookmarked(url, fallbackPosition);
            toolbar.setActionActive('bookmark_toggle', active);
            return;
        }

        void this.resolveToolbarBookmarkTarget(messageElement)
            .then((target) => {
                const active = target ? this.bookmarksController!.isPositionBookmarked(url, target.position) : false;
                toolbar.setActionActive('bookmark_toggle', active);
            })
            .catch(() => toolbar.setActionActive('bookmark_toggle', false));
    }

    private refreshBookmarkActionStates(): void {
        if (!this.bookmarksController) return;
        for (const record of this.recordsByMessageKey.values()) {
            this.refreshBookmarkStateForToolbar(record.toolbar, record.message, record.position);
        }
    }

    private refreshPendingStates(): void {
        if (this.turnRefs.length === 0) this.rebuildTurnIndex();
        for (const [messageKey, record] of Array.from(this.recordsByMessageKey.entries())) {
            const { message, toolbar } = record;
            if (!document.contains(message)) {
                this.removeRecord(messageKey);
                continue;
            }

            const nextAnchor = this.getAnchorForMessage(message);
            if (!nextAnchor) {
                this.removeRecord(messageKey);
                continue;
            }

            if (nextAnchor !== record.anchor || !toolbar.getElement().isConnected) {
                record.anchor = nextAnchor;
                const refreshed = this.rebuildToolbarRecord(record);
                if (!refreshed) {
                    this.removeRecord(messageKey);
                    continue;
                }
                this.recordsByMessageKey.set(messageKey, refreshed);
                continue;
            }

            const pending = this.adapter.isStreamingMessage(message);
            if (record.pending !== pending) {
                this.refreshWordCountForToolbar(toolbar, message, pending);
            }
            record.pending = pending;
        }
        void this.syncReaderTailPages();
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

    private async syncReaderTailPages(): Promise<void> {
        if (typeof this.readerPanel.isShowingConversationReader !== 'function') return;
        if (typeof this.readerPanel.getItemsSnapshot !== 'function') return;
        if (typeof this.readerPanel.appendItem !== 'function') return;
        if (!this.readerPanel.isShowingConversationReader()) return;
        const currentItems = this.readerPanel.getItemsSnapshot();
        const turns = collectConversationTurnRefs(this.adapter);
        if (turns.length <= currentItems.length) return;

        const pageUrl = stripReaderUrl(window.location.href);
        for (let index = currentItems.length; index < turns.length; index += 1) {
            const turn = turns[index];
            if (!turn) break;
            if (this.adapter.isStreamingMessage(turn.primaryMessageEl)) break;

            const item = buildReaderItemFromTurn(this.adapter, turn, index, pageUrl);
            this.decorateReaderItems([item as unknown as { meta?: Record<string, unknown> }]);
            await this.readerPanel.appendItem(item);
        }
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

    private isToolbarManagedHostNode(node: Node): boolean {
        return node instanceof Element && node.matches('[data-aimd-role="message-toolbar"], .aimd-message-toolbar-host');
    }

    private collectMutationMessageCandidates(node: Node): HTMLElement[] {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return [];
        if (node instanceof Element && this.isToolbarManagedHostNode(node)) return [];
        try {
            return discoverMessageElements(node, this.adapter.getMessageSelector());
        } catch {
            return [];
        }
    }

    private handleObservedMutations(mutations: ArrayLike<MutationRecord | { addedNodes?: ArrayLike<Node>; removedNodes?: ArrayLike<Node> }>): void {
        let shouldSchedule = false;

        for (const mutation of Array.from(mutations)) {
            const removedNodes = Array.from(mutation.removedNodes || []);
            for (const node of removedNodes) {
                if (this.isToolbarManagedHostNode(node)) continue;
                this.needsFullRescan = true;
                shouldSchedule = true;
            }

            const addedNodes = Array.from(mutation.addedNodes || []);
            for (const node of addedNodes) {
                const candidates = this.collectMutationMessageCandidates(node);
                if (candidates.length === 0) continue;
                for (const candidate of candidates) {
                    this.dirtyMessages.add(candidate);
                }
                shouldSchedule = true;
            }
        }

        if (shouldSchedule) {
            this.scanScheduler?.schedule('mutation');
        }
    }

    private rebindObserverIfNeeded(force: boolean = false): void {
        const nextContainer = this.adapter.getObserverContainer() || document.body;
        if (!force && this.observedContainer === nextContainer && this.observer) return;

        this.disposeObserversOnly();

        this.observedContainer = nextContainer;
        this.needsFullRescan = true;
        this.observer = new MutationObserver((mutations) => this.handleObservedMutations(mutations));
        this.observer.observe(nextContainer, { childList: true, subtree: true });
    }
}
