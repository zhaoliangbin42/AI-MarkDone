import type { Theme } from '../../../core/types/theme';
import {
    DEFAULT_EXPORT_SETTINGS,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
    type ExportSettings,
} from '../../../core/settings/export';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { scrollToBookmarkTargetWithRetry } from '../../../drivers/content/bookmarks/navigation';
import { getConversationUrl } from '../../../drivers/content/bookmarks/position';
import { discoverMessageElements } from '../../../drivers/content/injection/messageDiscovery';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { ScanScheduler } from '../../../drivers/content/injection/scanScheduler';
import { logger } from '../../../core/logger';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { copyMarkdownFromTurn } from '../../../services/copy/copy-turn-markdown';
import type { copyMessagePng } from '../../../services/copy/copy-turn-png';
import { buildConversationMetadata } from '../../../drivers/content/conversation/metadata';
import {
    isCopyPngDebugEnabled,
    logCopyPngDebugEvent,
    nowMs,
    type CopyPngDebugEvent,
} from '../../../services/copy/copy-png-debug';
import type { ImageExportProgressEvent } from '../../../services/export/imageExportContracts';
import { collectConversationTurnRefs, type ConversationTurnRef } from '../../../drivers/content/conversation/collectConversationTurnRefs';
import { buildReaderItemFromTurn, stripHash as stripReaderUrl } from '../../../services/reader/collectReaderItems';
import { collectFreshCurrentReaderItem, collectFreshReaderContent } from '../../../services/reader/readerContentSource';
import { resolveContent, type ReaderItem } from '../../../services/reader/types';
import { copyReaderItemMarkdownToClipboard, resolveReaderItemMarkdown } from '../../../services/reader/readerMarkdownCopy';
import { MessageToolbar, type MessageToolbarAction, type ToolbarActionContext } from '../MessageToolbar';
import type { BookmarksPanelController } from '../bookmarks/BookmarksPanelController';
import type { ReaderPanelAction, ReaderPanelActionContext } from '../reader/ReaderPanel';
import type { ReaderPanelPort } from '../reader/ReaderPanelPort';
import { createConversationReaderActions } from '../reader/conversationReaderActions';
import type { SendController } from '../sending/SendController';
import { subscribeLocaleChange, t } from '../components/i18n';
import { WordCounter } from '../../../core/text/wordCounter';
import { bookmarkIcon, copyIcon, downloadIcon, bookOpenIcon, imageIcon } from '../../../assets/icons';
import type { BookmarkSaveDialogPort, SaveMessagesDialogPort } from '../ContentDialogPorts';
import { resolveMessageKey, stripHash } from './messageToolbarKeys';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { buildChatGPTConversationTurns, resolveChatGPTConversationRound } from '../../../drivers/content/chatgpt/chatgptConversationSource';
import type { ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import { navigateChatGPTDirectoryTarget, resolveChatGPTSkeletonPositionForMessage } from '../chatgptDirectory/navigation';
import type { UserThemeOverrides } from '../../../style/tokens';
import { targetSurfacePolicy } from '../../../config/targetSurface';
import { buildChatGPTReaderItems } from '../../../services/reader/chatgptReaderItems';

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

type ReaderTailSyncState = {
    conversationUrl: string;
    knownPositions: Set<number>;
    pendingPositions: Set<number>;
    refreshing: Promise<void> | null;
};

type ChatGptToolbarPhase = 'anchor_pending' | 'injected' | 'stale';

type ChatGptToolbarState = {
    messageKey: string;
    message: HTMLElement;
    position: number;
    anchor: HTMLElement | null;
    pending: boolean;
    phase: ChatGptToolbarPhase;
};

type MessageToolbarBehaviorFlags = {
    showMessageToolbar: boolean;
    showSaveMessages: boolean;
    showWordCount: boolean;
};

const CHATGPT_TOOLBAR_RECOVERY_BASE_MS = 400;
const CHATGPT_TOOLBAR_RECOVERY_MAX_MS = 4000;

export class MessageToolbarOrchestrator {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private recordsByMessageKey = new Map<string, ToolbarRecord>();
    private dirtyMessages = new Set<HTMLElement>();
    private needsFullRescan = false;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private observedContainer: HTMLElement | null = null;
    private readerPanel: ReaderPanelPort;
    private sendController: SendController | null = null;
    private bookmarksController: BookmarksPanelController | null = null;
    private chatGptConversationEngine: ChatGPTConversationEngine | null = null;
    private behavior: MessageToolbarBehaviorFlags = {
        showMessageToolbar: true,
        showSaveMessages: true,
        showWordCount: true,
    };
    private resolvedPngWidth = resolvePngExportWidth(DEFAULT_EXPORT_SETTINGS);
    private resolvedPngPixelRatio = resolvePngExportPixelRatio(DEFAULT_EXPORT_SETTINGS);
    private wordCounter = new WordCounter();
    private messageOrder: HTMLElement[] = [];
    private messagePositionByElement = new WeakMap<HTMLElement, number>();
    private messageSegmentIndexByElement = new WeakMap<HTMLElement, number>();
    private turnRefs: ConversationTurnRef[] = [];
    private turnRefBySegment = new WeakMap<HTMLElement, ConversationTurnRef>();
    private readerTailSyncState: ReaderTailSyncState | null = null;
    private chatGptToolbarStatesByMessageKey = new Map<string, ChatGptToolbarState>();
    private chatGptToolbarRecoveryAttemptsByMessageKey = new Map<string, number>();
    private chatGptToolbarRecoveryTimer: number | null = null;
    private currentReaderItemByMessageKey = new Map<string, Promise<ReaderItem | null>>();
    private intentionallyRemovedToolbarHosts = new WeakSet<HTMLElement>();
    private readonly saveMessagesDialog: SaveMessagesDialogPort | null;
    private readonly bookmarkSaveDialog: BookmarkSaveDialogPort | null;
    private readonly copyMessagePng: typeof copyMessagePng | null;

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

    private getUserPromptForElement(messageElement: HTMLElement): string {
        const turn = this.getTurnRefForElement(messageElement);
        return turn?.userPrompt ?? this.adapter.extractUserPrompt(messageElement) ?? '';
    }

    private getMergedMarkdownForElement(messageElement: HTMLElement): ReturnType<typeof copyMarkdownFromMessage> {
        const turn = this.getTurnRefForElement(messageElement);
        if (!turn) return copyMarkdownFromMessage(this.adapter, messageElement);
        return copyMarkdownFromTurn(this.adapter, turn.messageEls);
    }

    private getReaderItemCacheKey(messageElement: HTMLElement): string {
        const position = this.getPositionForMessage(messageElement);
        const messageKey = resolveMessageKey(this.adapter, messageElement, position, {
            segmentIndexByElement: this.messageSegmentIndexByElement,
        });
        return `${this.getBookmarkPageUrl()}::${messageKey}`;
    }

    private clearReaderItemCache(): void {
        this.currentReaderItemByMessageKey.clear();
    }

    private invalidateReaderItemForMessage(messageElement: HTMLElement): void {
        try {
            this.currentReaderItemByMessageKey.delete(this.getReaderItemCacheKey(messageElement));
        } catch {
            // A transient host DOM can make message identity unavailable; stale content is worse than a cache miss.
            this.clearReaderItemCache();
        }
    }

    private markMessageDirty(messageElement: HTMLElement): void {
        this.dirtyMessages.add(messageElement);
        this.invalidateReaderItemForMessage(messageElement);
    }

    private requireFullRescan(): void {
        this.needsFullRescan = true;
        this.clearReaderItemCache();
    }

    private async resolveCurrentReaderItemForElement(messageElement: HTMLElement): Promise<ReaderItem | null> {
        return collectFreshCurrentReaderItem(this.adapter, messageElement, {
            chatGptConversationEngine: this.chatGptConversationEngine,
            pageUrl: this.getBookmarkPageUrl(),
        });
    }

    private prepareCurrentReaderItemForElement(messageElement: HTMLElement): Promise<ReaderItem | null> {
        if (this.guardMessageReady(messageElement)) {
            this.currentReaderItemByMessageKey.delete(this.getReaderItemCacheKey(messageElement));
            return Promise.resolve(null);
        }

        const key = this.getReaderItemCacheKey(messageElement);
        let promise = this.currentReaderItemByMessageKey.get(key);
        if (!promise) {
            promise = this.resolveCurrentReaderItemForElement(messageElement)
                .then((item) => {
                    if (!item) this.currentReaderItemByMessageKey.delete(key);
                    return item;
                })
                .catch(() => {
                    this.currentReaderItemByMessageKey.delete(key);
                    return null;
                });
            this.currentReaderItemByMessageKey.set(key, promise);
        }
        return promise;
    }

    private async getReaderTurnForElement(messageElement: HTMLElement): Promise<{ user: string; assistant: string; index: number } | null> {
        const item = await this.prepareCurrentReaderItemForElement(messageElement);
        if (!item) return null;
        return {
            user: item.userPrompt,
            assistant: await resolveReaderItemMarkdown(item),
            index: 0,
        };
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
        return platformId;
    }

    private async runBookmarkToggle(params: BookmarkToggleParams): Promise<BookmarkToggleResult> {
        if (!this.bookmarksController) return { ok: false, message: t('contentNotFound') };
        if (!params.position) return { ok: false, message: t('positionNotAvailable') };

        const userPrompt = params.userPrompt.trim();
        if (!userPrompt) return { ok: false, message: t('failedToExtractUserMessage') };

        if (!params.alreadyBookmarked) {
            const currentFolderPath = this.bookmarksController.getDefaultFolderPath();
            const dialogRes = await this.bookmarkSaveDialog!.open({
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

    private resolveChatGptReaderItemIndex(snapshot: ChatGPTConversationSnapshot, item: ReaderItem): number {
        const position = Number(item.meta?.position ?? 0);
        if (Number.isInteger(position) && position > 0) {
            const byPosition = snapshot.rounds.findIndex((round) => round.position === position);
            if (byPosition >= 0) return byPosition;
        }

        const messageId = typeof item.meta?.messageId === 'string' && item.meta.messageId.trim()
            ? item.meta.messageId.trim()
            : null;
        if (messageId) {
            const byMessageId = snapshot.rounds.findIndex((round) => (
                round.messageId === messageId
                || round.assistantMessageId === messageId
                || round.userMessageId === messageId
                || round.id === messageId
            ));
            if (byMessageId >= 0) return byMessageId;
        }

        return Math.max(0, snapshot.rounds.length - 1);
    }

    private attachChatGptLiveTailReaderItem(items: ReaderItem[]): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        if (!this.chatGptConversationEngine) return;
        const tail = items[items.length - 1];
        if (!tail) return;

        const fallbackContent = tail.content;
        tail.content = async () => {
            const fallback = async () => resolveContent(fallbackContent);
            try {
                if (typeof this.chatGptConversationEngine?.forceRefreshCurrentConversation !== 'function') {
                    return await fallback();
                }
                const snapshot = await this.chatGptConversationEngine.forceRefreshCurrentConversation();
                if (!snapshot?.rounds?.length) return await fallback();
                const index = this.resolveChatGptReaderItemIndex(snapshot, tail);
                const refreshed = buildChatGPTConversationTurns(snapshot)[index]?.assistant;
                return refreshed ?? await fallback();
            } catch {
                return await fallback();
            }
        };
    }

    private resolveRefreshedReaderIndex(items: ReaderItem[], currentItem: ReaderItem, fallbackIndex: number): number {
        const currentPosition = this.getReaderTailPosition(currentItem);
        if (currentPosition) {
            const index = items.findIndex((item) => this.getReaderTailPosition(item) === currentPosition);
            if (index >= 0) return index;
        }

        const currentMessageId = typeof currentItem.meta?.messageId === 'string' && currentItem.meta.messageId.trim()
            ? currentItem.meta.messageId.trim()
            : null;
        if (currentMessageId) {
            const index = items.findIndex((item) => item.meta?.messageId === currentMessageId);
            if (index >= 0) return index;
        }

        const idIndex = items.findIndex((item) => item.id === currentItem.id);
        if (idIndex >= 0) return idIndex;

        return Math.max(0, Math.min(fallbackIndex, Math.max(0, items.length - 1)));
    }

    private async refreshConversationReader(messageElement: HTMLElement, ctx: ReaderPanelActionContext): Promise<void> {
        const result = await collectFreshReaderContent(this.adapter, null, {
            chatGptConversationEngine: this.chatGptConversationEngine,
            pageUrl: this.getBookmarkPageUrl(),
        });
        const { items } = result;
        if (items.length < 1) {
            ctx.notify(t('contentNotFound'));
            return;
        }

        this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
        this.attachChatGptLiveTailReaderItem(items);
        const nextIndex = this.resolveRefreshedReaderIndex(items, ctx.item, ctx.index);
        await this.readerPanel.show(items, nextIndex, this.theme, {
            profile: 'conversation-reader',
            actions: this.getReaderActions(messageElement),
        });
    }

    private getReaderActions(messageElement: HTMLElement): ReaderPanelAction[] {
        return createConversationReaderActions({
            refresh: {
                refresh: (ctx) => this.refreshConversationReader(messageElement, ctx),
            },
            bookmark: this.bookmarksController
                ? {
                    resolveUrl: () => this.getBookmarkPageUrl(),
                    isBookmarked: (url, position) => this.bookmarksController!.isPositionBookmarked(url, position),
                    toggle: (input) => this.runBookmarkToggle(input),
                }
                : null,
            send: this.sendController
                ? {
                    open: (ctx) => {
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
                }
                : null,
            locate: {
                beforeLocate: () => {
                    this.readerPanel.hide();
                },
                locate: async ({ position, messageId }) => {
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
                    return { ok: result.ok };
                },
            },
        });
    }

    constructor(
        adapter: SiteAdapter,
        opts: {
            readerPanel: ReaderPanelPort;
            sendController?: SendController;
            bookmarksController?: BookmarksPanelController;
            chatGptConversationEngine?: ChatGPTConversationEngine;
            saveMessagesDialog?: SaveMessagesDialogPort;
            bookmarkSaveDialog?: BookmarkSaveDialogPort;
            copyMessagePng?: typeof copyMessagePng;
        }
    ) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.sendController = opts.sendController ?? null;
        this.bookmarksController = opts.bookmarksController || null;
        this.chatGptConversationEngine = opts.chatGptConversationEngine ?? null;
        this.saveMessagesDialog = opts.saveMessagesDialog ?? null;
        this.bookmarkSaveDialog = opts.bookmarkSaveDialog ?? null;
        this.copyMessagePng = opts.copyMessagePng ?? null;
    }

    private getBookmarkPageUrl(): string {
        // Why: ChatGPT uses hash routes like `#settings`; bookmarks should remain scoped to the conversation URL.
        return stripHash(getConversationUrl());
    }

    private removeRecord(messageKey: string): void {
        const record = this.recordsByMessageKey.get(messageKey);
        if (!record) return;
        const host = record.toolbar.getElement();
        record.toolbar.dispose();
        if (host.isConnected) this.intentionallyRemovedToolbarHosts.add(host);
        host.remove();
        this.recordsByMessageKey.delete(messageKey);
        this.currentReaderItemByMessageKey.delete(`${record.boundAtUrl}::${messageKey}`);
    }

    private clearAllToolbars(): void {
        for (const messageKey of Array.from(this.recordsByMessageKey.keys())) {
            this.removeRecord(messageKey);
        }
        this.chatGptToolbarStatesByMessageKey.clear();
        this.clearReaderItemCache();
    }

    init(): void {
        this.scanScheduler = new ScanScheduler(
            (reasons) => {
                this.scanAndInject(reasons);
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
                this.clearReaderItemCache();
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
        if (this.chatGptToolbarRecoveryTimer !== null) {
            window.clearTimeout(this.chatGptToolbarRecoveryTimer);
            this.chatGptToolbarRecoveryTimer = null;
        }
        this.chatGptToolbarRecoveryAttemptsByMessageKey.clear();
        this.clearReaderItemCache();
        this.clearAllToolbars();
    }

    private usesChatGptToolbarLifecycle(): boolean {
        return this.adapter.getPlatformId() === 'chatgpt';
    }

    private rememberChatGptToolbarState(
        item: Pick<ScanSnapshotItem, 'messageKey' | 'message' | 'position' | 'pending'>,
        phase: ChatGptToolbarPhase,
        anchor: HTMLElement | null
    ): void {
        if (!this.usesChatGptToolbarLifecycle()) return;
        this.chatGptToolbarStatesByMessageKey.set(item.messageKey, {
            messageKey: item.messageKey,
            message: item.message,
            position: item.position,
            anchor,
            pending: item.pending,
            phase,
        });
        if (phase === 'injected') {
            this.chatGptToolbarRecoveryAttemptsByMessageKey.delete(item.messageKey);
            return;
        }
        this.scheduleChatGptToolbarRecovery();
    }

    private clearChatGptToolbarState(messageKey: string): void {
        this.chatGptToolbarStatesByMessageKey.delete(messageKey);
        this.chatGptToolbarRecoveryAttemptsByMessageKey.delete(messageKey);
    }

    private scheduleChatGptToolbarRecovery(): void {
        if (!this.usesChatGptToolbarLifecycle()) return;
        if (this.chatGptToolbarRecoveryTimer !== null) return;

        const recoverable = Array.from(this.chatGptToolbarStatesByMessageKey.values())
            .filter((state) => state.phase !== 'injected' && document.contains(state.message));
        if (recoverable.length === 0) return;

        const minAttempts = Math.min(...recoverable.map((state) => this.chatGptToolbarRecoveryAttemptsByMessageKey.get(state.messageKey) ?? 0));
        const delayMs = Math.min(
            CHATGPT_TOOLBAR_RECOVERY_MAX_MS,
            CHATGPT_TOOLBAR_RECOVERY_BASE_MS * (2 ** Math.max(0, minAttempts)),
        );

        this.chatGptToolbarRecoveryTimer = window.setTimeout(() => {
            this.chatGptToolbarRecoveryTimer = null;
            this.recoverChatGptToolbarStates();
        }, delayMs);
    }

    private recoverChatGptToolbarStates(): void {
        if (!this.usesChatGptToolbarLifecycle()) return;

        let hasRecoverable = false;
        for (const [messageKey, state] of Array.from(this.chatGptToolbarStatesByMessageKey.entries())) {
            if (state.phase === 'injected') continue;
            if (!document.contains(state.message)) {
                this.clearChatGptToolbarState(messageKey);
                continue;
            }

            hasRecoverable = true;
            this.markMessageDirty(state.message);
            const attempts = this.chatGptToolbarRecoveryAttemptsByMessageKey.get(messageKey) ?? 0;
            this.chatGptToolbarRecoveryAttemptsByMessageKey.set(messageKey, attempts + 1);
        }

        if (!hasRecoverable) return;
        this.scanAndInject(new Set(['mutation']));
        this.scheduleChatGptToolbarRecovery();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        for (const record of this.recordsByMessageKey.values()) {
            record.toolbar.setTheme(theme);
        }
        this.readerPanel.setTheme(theme);
        this.bookmarkSaveDialog?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        for (const record of this.recordsByMessageKey.values()) {
            record.toolbar.setThemeOverrides(this.themeOverrides);
        }
        this.readerPanel.setThemeOverrides(this.themeOverrides);
        this.bookmarkSaveDialog?.setThemeOverrides(this.themeOverrides);
    }

    setBehaviorFlags(flags: Partial<MessageToolbarBehaviorFlags>): void {
        const wasToolbarVisible = this.behavior.showMessageToolbar;
        this.behavior = { ...this.behavior, ...flags };
        if (!this.behavior.showMessageToolbar) {
            this.clearAllToolbars();
            return;
        }
        if (!wasToolbarVisible && this.scanScheduler) {
            this.scanScheduler.schedule('manual');
        }
    }

    setExportSettings(settings: ExportSettings): void {
        this.resolvedPngWidth = resolvePngExportWidth(settings);
        this.resolvedPngPixelRatio = resolvePngExportPixelRatio(settings);
    }

    private getPositionForMessage(messageElement: HTMLElement): number {
        const fallback = Number(messageElement.dataset.aimdMsgPosition || 0);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    private writeMessagePosition(messageElement: HTMLElement, position: number): void {
        const next = `${position}`;
        if (messageElement.dataset.aimdMsgPosition !== next) {
            messageElement.dataset.aimdMsgPosition = next;
        }
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

        if (this.bookmarksController && this.bookmarkSaveDialog) {
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
                    const item = await this.prepareCurrentReaderItemForElement(messageElement);
                    if (!item) return { ok: false, message: t('contentNotFound') };
                    const markdown = await resolveReaderItemMarkdown(item);
                    const result = await this.runBookmarkToggle({
                        url,
                        position: target.position,
                        messageId: target.messageId,
                        userPrompt: target.userPrompt,
                        markdown,
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

        const copyMarkdownAction: MessageToolbarAction = {
            id: 'copy_markdown',
            label: t('btnCopy'),
            tooltip: t('btnCopy'),
            icon: copyIcon,
            kind: 'secondary',
            disabledWhenPending: true,
            onClick: async () => {
                const guard = this.guardMessageReady(messageElement);
                if (guard) return guard;
                const item = await this.prepareCurrentReaderItemForElement(messageElement);
                if (!item) return { ok: false, message: t('contentNotFound') };
                const ok = await copyReaderItemMarkdownToClipboard(item);
                return ok ? { ok: true, message: t('btnCopied') } : { ok: false, message: t('clipboardWriteFailed') };
            },
        };
        if (targetSurfacePolicy.binaryClipboardCopyActions && this.copyMessagePng) {
            copyMarkdownAction.hoverAction = {
                id: 'copy_png',
                label: t('btnCopyAsPng'),
                icon: imageIcon,
                onClick: async (ctx?: ToolbarActionContext) => {
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
                    const currentTurn = await this.getReaderTurnForElement(messageElement);
                    if (!currentTurn) {
                        finishDebug('NO_MESSAGE');
                        return { ok: false, message: t('contentNotFound') };
                    }
                    const metadata = buildConversationMetadata(this.adapter, 1);
                    emitDebug({
                        stage: 'collect_turns',
                        durationMs: Math.round(nowMs() - collectStartedAt),
                        totalMs: Math.round(nowMs() - copyStartedAt),
                        selectedIndex: currentTurn.index,
                        turnCount: 1,
                    });
                    const result = await this.copyMessagePng!(currentTurn, metadata, {
                        t: (key: string, args?: unknown) => {
                            if (typeof args === 'string' || Array.isArray(args)) return t(key, args);
                            return t(key);
                        },
                        png: { width: this.resolvedPngWidth, pixelRatio: this.resolvedPngPixelRatio },
                        onDebug: emitDebug,
                        signal: ctx?.signal,
                        onProgress: (event) => {
                            ctx?.onProgress(this.formatCopyPngProgress(event));
                        },
                    });
                    if (!result.ok) {
                        finishDebug(result.error.code);
                        if (result.cancelled) return { ok: false, message: this.getCopyPngCancelledLabel() };
                        return { ok: false, message: result.error.message };
                    }
                    if (result.noop) {
                        finishDebug('noop');
                        return { ok: false, message: t('contentNotFound') };
                    }
                    if (result.fallback === 'download') {
                        finishDebug('download');
                        return { ok: true, message: t('btnCopyAsPngDownloaded') };
                    }
                    finishDebug('ok');
                    return { ok: true, message: t('btnCopyAsPngCopied') };
                },
            };
        }
        actions.push(copyMarkdownAction);

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
                const itemsResult = await collectFreshReaderContent(this.adapter, messageElement, {
                    chatGptConversationEngine: this.chatGptConversationEngine,
                    pageUrl: this.getBookmarkPageUrl(),
                });
                const { items, startIndex } = itemsResult;
                this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
                this.attachChatGptLiveTailReaderItem(items);
                await this.readerPanel.show(items, startIndex, this.theme, {
                    profile: 'conversation-reader',
                    actions: this.getReaderActions(messageElement) as any,
                });
            },
        });

        if (this.behavior.showSaveMessages && this.saveMessagesDialog) {
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
                    await this.saveMessagesDialog!.open(this.adapter, this.theme, {
                        chatGptConversationEngine: this.chatGptConversationEngine,
                        startMessageElement: messageElement,
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
        if (!this.behavior.showMessageToolbar) {
            this.removeExistingToolbarsInAnchor(params.anchor);
            return null;
        }
        let recordRef: ToolbarRecord | null = null;
        const getToolbar = () => recordRef?.toolbar ?? null;
        const toolbar = new MessageToolbar(this.theme, this.getActionsForMessage(params.message, getToolbar), {
            showStats: this.behavior.showWordCount,
            themeOverrides: this.themeOverrides,
        });
        const host = toolbar.getElement();
        host.setAttribute('data-aimd-role', 'message-toolbar');
        host.setAttribute('data-aimd-message-key', params.messageKey);

        this.removeExistingToolbarsInAnchor(params.anchor, host);
        const injected = this.adapter.injectToolbar(params.message, host);
        if (!injected) {
            logger.debug('[AI-MarkDone][MessageToolbarOrchestrator] injectToolbar failed');
            this.rememberChatGptToolbarState(params, 'stale', params.anchor);
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
        this.rememberChatGptToolbarState(params, 'injected', params.anchor);
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
            this.writeMessagePosition(messageElement, position);

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
        let nodes: HTMLElement[];
        if (this.usesChatGptToolbarLifecycle()) {
            this.rebuildTurnIndex();
            nodes = this.turnRefs
                .map((turn) => turn.primaryMessageEl)
                .filter((message) => message.isConnected);
        } else {
            const selector = this.adapter.getMessageSelector();
            const container = this.adapter.getObserverContainer() || document.body;
            nodes = discoverMessageElements(container, selector);
            this.rebuildTurnIndex();
        }
        this.rebuildMessageCaches(nodes);
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
        this.writeMessagePosition(messageElement, position);

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
        const canonicalCandidates = this.usesChatGptToolbarLifecycle()
            ? candidates.map((message) => this.getTurnRefForElement(message)?.primaryMessageEl ?? message)
            : candidates;
        const sortedCandidates = this.sortMessagesByDocumentOrder(
            Array.from(new Set(canonicalCandidates)).filter((node) => node.isConnected),
        );
        if (sortedCandidates.length === 0) return new Map<string, ScanSnapshotItem>();

        for (const messageElement of sortedCandidates) {
            const position = this.resolveIncrementalPosition(messageElement);
            if (!position) {
                this.requireFullRescan();
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
                this.rememberChatGptToolbarState(item, 'anchor_pending', null);
                continue;
            }
            const anchor = item.anchor;

            if (!existing) {
                const created = this.createToolbarRecord({
                    ...item,
                    anchor,
                });
                if (created) this.recordsByMessageKey.set(messageKey, created);
                else this.rememberChatGptToolbarState(item, 'stale', anchor);
                continue;
            }

            existing.message = item.message;
            existing.position = item.position;
            existing.boundAtUrl = this.getBookmarkPageUrl();

            if (existing.anchor !== anchor || !existing.toolbar.getElement().isConnected) {
                this.rememberChatGptToolbarState(item, 'stale', anchor);
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
                this.rememberChatGptToolbarState(item, 'injected', anchor);
                continue;
            }

            existing.pending = item.pending;
            this.refreshBookmarkStateForToolbar(existing.toolbar, item.message, item.position);
            this.refreshWordCountForToolbar(existing.toolbar, item.message, item.pending);
            this.rememberChatGptToolbarState(item, 'injected', anchor);
        }

        if (mode === 'full') {
            for (const [messageKey] of Array.from(this.recordsByMessageKey.entries())) {
                if (!snapshot.has(messageKey)) {
                    this.removeRecord(messageKey);
                    this.clearChatGptToolbarState(messageKey);
                }
            }
            if (this.usesChatGptToolbarLifecycle()) {
                for (const messageKey of Array.from(this.chatGptToolbarStatesByMessageKey.keys())) {
                    if (!snapshot.has(messageKey)) this.clearChatGptToolbarState(messageKey);
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

        if (this.adapter.getPlatformId() === 'chatgpt') {
            await this.syncChatGptReaderTailPages(currentItems, turns);
            return;
        }

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

    private getReaderTailPosition(item: ReaderItem): number | null {
        const position = Number(item.meta?.position ?? 0);
        return Number.isInteger(position) && position > 0 ? position : null;
    }

    private getTurnTailPosition(turn: ConversationTurnRef): number | null {
        const position = turn.index + 1;
        return Number.isInteger(position) && position > 0 ? position : null;
    }

    private syncReaderTailKnownPositions(state: ReaderTailSyncState, currentItems: ReaderItem[]): void {
        state.knownPositions.clear();
        for (const item of currentItems) {
            const position = this.getReaderTailPosition(item);
            if (!position) continue;
            state.knownPositions.add(position);
            state.pendingPositions.delete(position);
        }
    }

    private getReaderTailSyncState(currentItems: ReaderItem[]): ReaderTailSyncState {
        const conversationUrl = this.getBookmarkPageUrl();
        if (!this.readerTailSyncState || this.readerTailSyncState.conversationUrl !== conversationUrl) {
            this.readerTailSyncState = {
                conversationUrl,
                knownPositions: new Set<number>(),
                pendingPositions: new Set<number>(),
                refreshing: null,
            };
        }
        this.syncReaderTailKnownPositions(this.readerTailSyncState, currentItems);
        return this.readerTailSyncState;
    }

    private async syncChatGptReaderTailPages(currentItems: ReaderItem[], turns: ConversationTurnRef[]): Promise<void> {
        if (!this.chatGptConversationEngine) return;
        const state = this.getReaderTailSyncState(currentItems);
        const maxKnownPosition = Math.max(0, ...state.knownPositions);
        for (const turn of turns) {
            const position = this.getTurnTailPosition(turn);
            if (!position || position <= maxKnownPosition || state.knownPositions.has(position)) continue;
            state.pendingPositions.add(position);
        }
        if (state.pendingPositions.size === 0) return;
        if (state.refreshing) return state.refreshing;

        state.refreshing = this.flushChatGptReaderTailPages(state);
        try {
            await state.refreshing;
        } finally {
            if (this.readerTailSyncState === state) state.refreshing = null;
        }
    }

    private async flushChatGptReaderTailPages(state: ReaderTailSyncState): Promise<void> {
        if (!this.chatGptConversationEngine) return;
        const snapshot = await this.chatGptConversationEngine.forceRefreshCurrentConversation().catch(() => null);
        if (!snapshot?.rounds?.length) return;

        const result = buildChatGPTReaderItems(snapshot, null, this.getBookmarkPageUrl());
        const latestItems = this.readerPanel.getItemsSnapshot();
        this.syncReaderTailKnownPositions(state, latestItems);
        const renderablePositions = new Set(snapshot.rounds
            .filter((round) => typeof round.assistantContent === 'string' && round.assistantContent.trim().length > 0)
            .map((round) => round.position));
        const newItems = result.items.filter((item) => {
            const position = this.getReaderTailPosition(item);
            return Boolean(position && state.pendingPositions.has(position) && !state.knownPositions.has(position) && renderablePositions.has(position));
        });
        if (newItems.length === 0) return;

        this.decorateReaderItems(newItems as Array<{ meta?: Record<string, unknown> }>);
        this.attachChatGptLiveTailReaderItem([...latestItems, ...newItems]);
        for (const item of newItems) {
            await this.readerPanel.appendItem(item);
            const position = this.getReaderTailPosition(item);
            if (!position) continue;
            state.knownPositions.add(position);
            state.pendingPositions.delete(position);
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

    private getRecordForToolbarHost(node: Node): ToolbarRecord | null {
        if (!(node instanceof HTMLElement)) return null;
        for (const record of this.recordsByMessageKey.values()) {
            if (record.toolbar.getElement() === node) return record;
        }
        return null;
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

    private getMessageForMutationTarget(target?: Node | null): HTMLElement | null {
        const element = target instanceof Element ? target : target?.parentElement ?? null;
        if (!element || this.isToolbarManagedHostNode(element)) return null;
        try {
            const message = element.matches(this.adapter.getMessageSelector())
                ? element
                : element.closest(this.adapter.getMessageSelector());
            return message instanceof HTMLElement ? message : null;
        } catch {
            return null;
        }
    }

    private collectChatGptMessagesFromActionAnchorMutation(node: Node): HTMLElement[] {
        if (!this.usesChatGptToolbarLifecycle()) return [];
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return [];
        if (node instanceof Element && this.isToolbarManagedHostNode(node)) return [];

        const messages: HTMLElement[] = [];
        const messageSelector = this.adapter.getMessageSelector();
        const actionSelector = this.adapter.getActionBarSelector();

        const addMessage = (candidate: Element | null): void => {
            if (candidate instanceof HTMLElement) messages.push(candidate);
        };
        const addFirstMessageIn = (scope: ParentNode | null): void => {
            if (!scope) return;
            try {
                const message = scope.querySelector(messageSelector);
                addMessage(message);
            } catch {
                // Ignore transient selector failures from host mutations.
            }
        };

        const actionNodes: HTMLElement[] = [];
        try {
            if (node instanceof HTMLElement && node.matches(actionSelector)) {
                actionNodes.push(node);
            }
            const nested = Array.from(node.querySelectorAll(actionSelector))
                .filter((el): el is HTMLElement => el instanceof HTMLElement);
            actionNodes.push(...nested);
        } catch {
            return [];
        }

        for (const actionNode of actionNodes) {
            try {
                addMessage(actionNode.closest(messageSelector));
            } catch {
                // Ignore and keep walking structural scopes below.
            }

            addFirstMessageIn(actionNode.closest('[data-testid^="conversation-turn-"]'));
            addFirstMessageIn(actionNode.closest('article'));

            let scope = actionNode.parentElement;
            for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
                const before = messages.length;
                addFirstMessageIn(scope);
                if (messages.length > before) break;
            }
        }

        return this.sortMessagesByDocumentOrder(Array.from(new Set(messages)).filter((message) => message.isConnected));
    }

    private collectChatGptMessagesFromActionAnchorRemoval(node: Node, target?: Node | null): HTMLElement[] {
        if (!this.usesChatGptToolbarLifecycle()) return [];
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return [];
        if (node instanceof Element && this.isToolbarManagedHostNode(node)) return [];

        const messages: HTMLElement[] = [];
        const messageSelector = this.adapter.getMessageSelector();
        const actionSelector = this.adapter.getActionBarSelector();

        const removedLooksLikeActionSubtree = (() => {
            try {
                if (node instanceof Element && node.matches(actionSelector)) return true;
                return node.querySelector(actionSelector) instanceof HTMLElement;
            } catch {
                return false;
            }
        })();

        const addMessage = (candidate: Element | null): void => {
            if (candidate instanceof HTMLElement && candidate.isConnected) messages.push(candidate);
        };

        if (target instanceof Element) {
            try {
                addMessage(target.matches(messageSelector) ? target : target.closest(messageSelector));
                addMessage(target.querySelector(messageSelector));
            } catch {
                // Ignore transient host DOM while ChatGPT is rehydrating action rows.
            }
        }

        for (const record of this.recordsByMessageKey.values()) {
            const anchor = record.anchor;
            const targetElement = target instanceof Element ? target : null;
            const removedElement = node instanceof Element ? node : null;
            if (
                anchor === node
                || anchor === target
                || (removedElement && removedElement.contains(anchor))
                || (targetElement && (targetElement === record.message || targetElement.contains(anchor) || record.message.contains(targetElement)))
            ) {
                messages.push(record.message);
            }
        }

        if (!removedLooksLikeActionSubtree && messages.length === 0) return [];
        return this.sortMessagesByDocumentOrder(Array.from(new Set(messages)).filter((message) => message.isConnected));
    }

    private nodeContainsActionBarAnchor(node: Node): boolean {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return false;
        if (node instanceof Element && this.isToolbarManagedHostNode(node)) return false;

        try {
            const selector = this.adapter.getActionBarSelector();
            if (node instanceof Element && node.matches(selector)) return true;
            return node.querySelector(selector) instanceof HTMLElement;
        } catch {
            return false;
        }
    }

    private formatCopyPngProgress(event: ImageExportProgressEvent): {
        label: string;
        completed?: number;
        total?: number;
        value?: number;
        indeterminate?: boolean;
    } {
        const completed = event.completed;
        const total = event.total;
        const hasRatio = Number.isFinite(completed) && Number.isFinite(total) && (total ?? 0) > 0;
        const base = hasRatio ? `${completed}/${total}` : '0/1';
        switch (event.phase) {
            case 'preparing':
                return { label: t('pngExportPreparing', base), value: 0, indeterminate: false };
            case 'queued':
            case 'compiling':
            case 'layout':
                return { label: t('pngExportPreparing', base), value: 0, indeterminate: false };
            case 'rasterizing':
                return {
                    label: t('pngExportRendering', hasRatio ? base : '0/1'),
                    completed,
                    total,
                    value: hasRatio ? undefined : 0,
                    indeterminate: false,
                };
            case 'encoding':
                return { label: t('pngExportDownloading'), value: 95, indeterminate: false };
            case 'finalizing':
                return { label: t('pngExportDone', '1/1'), completed: 1, total: 1 };
            default:
                return { label: t('btnCopyAsPng'), indeterminate: true };
        }
    }

    private getCopyPngCancelledLabel(): string {
        const translated = t('copyPngCancelled');
        return translated && translated !== 'copyPngCancelled' ? translated : 'Cancelled';
    }

    private handleObservedMutations(mutations: ArrayLike<MutationRecord | { target?: Node; addedNodes?: ArrayLike<Node>; removedNodes?: ArrayLike<Node> }>): void {
        let shouldSchedule = false;

        for (const mutation of Array.from(mutations)) {
            const removedNodes = Array.from(mutation.removedNodes || []);
            const addedNodes = Array.from(mutation.addedNodes || []);
            const changedNodes = [...removedNodes, ...addedNodes];
            const targetMessage = this.getMessageForMutationTarget(mutation.target);
            const isCharacterData = 'type' in mutation && mutation.type === 'characterData';
            const intentionallyRemovedHosts = new Set<Node>();
            const externallyRemovedHosts = new Set<Node>();
            for (const node of removedNodes) {
                if (!this.isToolbarManagedHostNode(node)) continue;
                if (node instanceof HTMLElement && this.intentionallyRemovedToolbarHosts.delete(node)) {
                    intentionallyRemovedHosts.add(node);
                } else {
                    externallyRemovedHosts.add(node);
                }
            }

            const hasHostPageChange = isCharacterData
                ? targetMessage !== null
                : changedNodes.some((node) => !this.isToolbarManagedHostNode(node));
            if (!hasHostPageChange && externallyRemovedHosts.size === 0) continue;
            if (hasHostPageChange) this.invalidateTurnIndex();
            if (isCharacterData) {
                if (targetMessage) {
                    this.markMessageDirty(targetMessage);
                    shouldSchedule = true;
                }
                continue;
            }

            for (const node of removedNodes) {
                if (intentionallyRemovedHosts.has(node)) continue;
                if (externallyRemovedHosts.has(node)) {
                    const record = this.getRecordForToolbarHost(node);
                    if (record?.message.isConnected) {
                        this.markMessageDirty(record.message);
                        shouldSchedule = true;
                    }
                    continue;
                }
                const chatGptActionMessages = this.collectChatGptMessagesFromActionAnchorRemoval(node, mutation.target);
                if (chatGptActionMessages.length > 0) {
                    for (const message of chatGptActionMessages) {
                        this.markMessageDirty(message);
                    }
                    shouldSchedule = true;
                    continue;
                }

                const removedMessages = this.collectMutationMessageCandidates(node);
                if (removedMessages.length > 0) {
                    this.requireFullRescan();
                    shouldSchedule = true;
                    continue;
                }

                if (targetMessage) {
                    this.markMessageDirty(targetMessage);
                    shouldSchedule = true;
                }
            }

            for (const node of addedNodes) {
                const candidates = this.collectMutationMessageCandidates(node);
                if (candidates.length === 0) {
                    const chatGptActionMessages = this.collectChatGptMessagesFromActionAnchorMutation(node);
                    if (chatGptActionMessages.length > 0) {
                        for (const message of chatGptActionMessages) {
                            this.markMessageDirty(message);
                        }
                        shouldSchedule = true;
                        continue;
                    }
                    if (targetMessage) {
                        this.markMessageDirty(targetMessage);
                        shouldSchedule = true;
                        continue;
                    }
                    if (!this.nodeContainsActionBarAnchor(node)) continue;
                    this.requireFullRescan();
                    shouldSchedule = true;
                    continue;
                }
                for (const candidate of candidates) {
                    this.markMessageDirty(candidate);
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
        this.observer.observe(nextContainer, { childList: true, characterData: true, subtree: true });
    }
}
