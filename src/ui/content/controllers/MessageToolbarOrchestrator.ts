import {
    DEFAULT_EXPORT_SETTINGS,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
    type ExportSettings,
} from '../../../core/settings/export';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { scrollToBookmarkTargetWithRetry } from '../../../drivers/content/bookmarks/navigation';
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
import {
    collectFreshCurrentReaderItem,
    collectFreshReaderContent,
    isReaderContentSourceRevisionCurrent,
    readCurrentReaderContentSourceRevision,
    type FreshReaderItemResult,
    type ReaderContentSourceRevision,
} from '../../../services/reader/readerContentSource';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveReaderReplacementIndex } from '../../../services/reader/readerItemIdentity';
import { copyReaderItemMarkdownToClipboard, resolveReaderItemMarkdown } from '../../../services/reader/readerMarkdownCopy';
import { prepareChatGPTBookmark } from '../../../services/bookmarks/conversationBookmarkPreparation';
import type { CanonicalBookmarkTurnRef } from '../../../services/bookmarks/conversationBookmarkResolver';
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
import type {
    ConversationContentSourceV1,
} from '../../../contracts/conversationContent';
import type { ConversationTurnReadPortV1 } from '../../../contracts/conversationDiscovery';
import type {
    ConversationMaterializationPortV1,
} from '../../../contracts/conversationMaterialization';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import { ChatGptToolbarFrameIndex } from './ChatGptToolbarFrameIndex';
import {
    AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE,
    type ConversationSurfaceFrameV1,
    type ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';
import {
    presentImageExportProgress,
    retainMonotonicImageExportProgress,
    type ImageExportProgressPresentation,
} from '../export/imageExportProgressPresentation';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { targetSurfacePolicy } from '../../../config/targetSurface';

type ToolbarRecord = {
    messageKey: string;
    platformId: string;
    message: HTMLElement;
    anchor: HTMLElement;
    toolbar: MessageToolbar;
    pending: boolean;
    position: number;
    boundAtUrl: string;
    lastDerivedStateKey?: string;
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
    sourceRevision?: ReaderContentSourceRevision;
};

type BookmarkToggleResult =
    | { ok: true; saved: boolean; bookmarked: boolean; message: string; folderPath?: string }
    | { ok: false; message?: string; cancelled?: boolean };

type MessageToolbarBehaviorFlags = {
    showMessageToolbar: boolean;
    showSaveMessages: boolean;
    showWordCount: boolean;
};

export class MessageToolbarOrchestrator {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private recordsByMessageKey = new Map<string, ToolbarRecord>();
    private dirtyMessages = new Set<HTMLElement>();
    private needsFullRescan = false;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private scanScheduler: ScanScheduler | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private unsubscribeConversationSurface: (() => void) | null = null;
    private observedContainer: HTMLElement | null = null;
    private readerPanel: ReaderPanelPort;
    private sendController: SendController | null = null;
    private bookmarksController: BookmarksPanelController | null = null;
    private conversationContentSource: ConversationContentSourceV1 | null = null;
    private conversationMaterialization: ConversationMaterializationPortV1 | null = null;
    private conversationSurface: ConversationSurfacePortV1 | null = null;
    private conversationNavigation: ConversationNavigationPortV1 | null = null;
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
    private readonly chatGptFrameIndex = new ChatGptToolbarFrameIndex();
    private wordStatsByTurnKey = new Map<string, string[]>();
    private frameBookmarkPositions: ReadonlySet<number> | null = null;
    private frameBookmarkUrl: string | null = null;
    private frameBookmarkToken: string | null = null;
    private currentReaderItemByMessageKey = new Map<string, Promise<FreshReaderItemResult | null>>();
    private conversationSnapshotRevision = 0;
    private lastConversationSemanticKey: string | null = null;
    private lastConversationHadSnapshot = false;
    private intentionallyRemovedToolbarHosts = new WeakSet<HTMLElement>();
    private lastChatGptMaterializationUrl: string | null = null;
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
            // A transient host DOM can make message identity unavailable; a
            // cache miss is safer than inventing a different content source.
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

    private readChatGptTurnForElement(messageElement: HTMLElement) {
        const indexed = this.chatGptFrameIndex.read(messageElement);
        if (indexed) return indexed.turn;
        const source = this.conversationContentSource as (
            ConversationContentSourceV1 & Partial<ConversationTurnReadPortV1>
        ) | null;
        const target = this.conversationMaterialization?.resolveElement(messageElement) ?? null;
        if (!source?.readTurn || !target) return null;
        const result = source.readTurn(target);
        return result.kind === 'ready' ? result.turn : null;
    }

    private handleChatGptSurface(frame: ConversationSurfaceFrameV1): void {
        if (!this.usesChatGptToolbarLifecycle()) return;
        if (!this.behavior.showMessageToolbar) {
            this.clearAllToolbars();
            return;
        }

        const semanticKey = frame.snapshot
            ? `${frame.projectionId ?? ''}:${frame.contentToken ?? ''}`
            : `missing:${frame.contentKind}:${frame.projectionId ?? ''}`;
        if (semanticKey !== this.lastConversationSemanticKey) {
            const shouldCloseDialog = Boolean(
                this.saveMessagesDialog?.isOpen()
                && (!frame.snapshot || (this.lastConversationSemanticKey !== null && this.lastConversationHadSnapshot)),
            );
            this.lastConversationSemanticKey = semanticKey;
            this.lastConversationHadSnapshot = Boolean(frame.snapshot);
            this.conversationSnapshotRevision += 1;
            this.clearReaderItemCache();
            this.wordStatsByTurnKey.clear();
            if (shouldCloseDialog) this.saveMessagesDialog?.close();
        }

        this.chatGptFrameIndex.setFrame(frame);
        const canonicalUrl = frame.document?.conversationId
            ? frame.document.canonicalUrl?.split('#')[0] ?? this.getBookmarkPageUrl()
            : null;
        if (this.frameBookmarkUrl !== canonicalUrl || this.frameBookmarkToken !== frame.contentToken) {
            this.frameBookmarkUrl = canonicalUrl;
            this.frameBookmarkToken = frame.contentToken;
            this.frameBookmarkPositions = canonicalUrl
                ? this.resolveCanonicalBookmarkPositions(canonicalUrl)
                : null;
        }

        const items = new Map<string, ScanSnapshotItem>();
        const mountedMessages: HTMLElement[] = [];
        const append = (
            message: HTMLElement,
            position: number,
            pending: boolean,
            anchor: HTMLElement | null,
        ) => {
            if (!message.isConnected) return;
            this.messagePositionByElement.set(message, position);
            this.messageSegmentIndexByElement.set(message, 0);
            mountedMessages.push(message);
            const messageKey = resolveMessageKey(this.adapter, message, position, {
                segmentIndexByElement: this.messageSegmentIndexByElement,
            });
            items.set(messageKey, { messageKey, message, anchor, position, pending });
        };

        for (const entry of frame.obtainedTurns) {
            const mounted = entry.materialization;
            if (!mounted) continue;
            append(
                mounted.messageElement,
                entry.turn.ordinal,
                false,
                this.getAnchorForMessage(mounted.messageElement),
            );
        }
        for (const entry of frame.pendingSurfaces) {
            const message = entry.materialization.messageElement;
            const anchor = this.getAnchorForMessage(message);
            const pending = !anchor || this.adapter.isStreamingMessage(message);
            // Toolbar placement is a live host-surface capability. Once the
            // official row exists and generation has ended, pool admission is
            // not an additional gate.
            append(message, 0, pending, pending ? null : anchor);
        }

        this.messageOrder = this.sortMessagesByDocumentOrder(mountedMessages);
        this.reconcileScanSnapshot(items, 'full');

        if (this.bookmarksController && canonicalUrl && canonicalUrl !== this.lastChatGptMaterializationUrl) {
            this.lastChatGptMaterializationUrl = canonicalUrl;
            void this.bookmarksController.refreshPositionsForUrl(canonicalUrl)
                .then(() => this.refreshBookmarkActionStates());
        } else if (!canonicalUrl) {
            this.lastChatGptMaterializationUrl = null;
            for (const record of this.recordsByMessageKey.values()) {
                record.toolbar.setActionActive('bookmark_toggle', false);
            }
        }
    }

    private async resolveCurrentReaderItemForElement(messageElement: HTMLElement): Promise<FreshReaderItemResult | null> {
        if (this.adapter.getPlatformId() === 'chatgpt') {
            const turn = this.getTurnRefForElement(messageElement);
            const markdown = turn
                ? copyMarkdownFromTurn(this.adapter, turn.messageEls)
                : copyMarkdownFromMessage(this.adapter, messageElement);
            if (!markdown.ok || !markdown.markdown.trim()) return null;

            const canonicalTurn = this.readChatGptTurnForElement(messageElement);
            const assistantMessageId = this.adapter.getMessageId(messageElement)?.trim()
                || canonicalTurn?.identity.assistantMessageId
                || null;
            const item: ReaderItem = {
                id: `chatgpt-${assistantMessageId ?? this.getReaderItemCacheKey(messageElement)}`,
                userPrompt: turn?.userPrompt ?? this.adapter.extractUserPrompt(messageElement) ?? '',
                content: markdown.markdown,
                meta: {
                    platformId: 'chatgpt',
                    messageId: assistantMessageId,
                    assistantMessageId,
                    userMessageId: canonicalTurn?.identity.userMessageId ?? null,
                    roundId: canonicalTurn?.identity.turnId ?? null,
                    position: canonicalTurn?.ordinal ?? 0,
                    url: this.getBookmarkPageUrl(),
                    bookmarkable: Boolean(canonicalTurn && this.getAvailableBookmarkUrl()),
                    bookmarked: false,
                    sourceQuality: 'host-rendered',
                },
            };
            return {
                item,
                sourceRevision: canonicalTurn ? this.captureCurrentSourceRevision() : undefined,
            };
        }
        return collectFreshCurrentReaderItem(this.adapter, messageElement, {
            conversationContentSource: this.conversationContentSource,
            conversationMaterialization: this.conversationMaterialization,
            pageUrl: this.getBookmarkPageUrl(),
        });
    }

    private prepareCurrentReaderSelectionForElement(messageElement: HTMLElement): Promise<FreshReaderItemResult | null> {
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

    private async prepareCurrentReaderItemForElement(messageElement: HTMLElement): Promise<ReaderItem | null> {
        return (await this.prepareCurrentReaderSelectionForElement(messageElement))?.item ?? null;
    }

    private async getReaderTurnForElement(messageElement: HTMLElement): Promise<{ user: string; assistant: string; index: number } | null> {
        const item = await this.prepareCurrentReaderItemForElement(messageElement);
        if (!item || item.meta?.sourceQuality === 'reconstructed') return null;
        return {
            user: item.userPrompt,
            assistant: await resolveReaderItemMarkdown(item),
            index: 0,
        };
    }

    private getBookmarkPlatformLabel(): string {
        const platformId = this.adapter.getPlatformId();
        if (platformId === 'chatgpt') return 'ChatGPT';
        return platformId;
    }

    private captureCurrentSourceRevision(): ReaderContentSourceRevision | undefined {
        if (this.adapter.getPlatformId() !== 'chatgpt') return undefined;
        const source = this.conversationContentSource;
        return source ? readCurrentReaderContentSourceRevision(source) : undefined;
    }

    private isSourceRevisionCurrent(expected: ReaderContentSourceRevision | undefined): boolean {
        if (this.adapter.getPlatformId() !== 'chatgpt') return true;
        const source = this.conversationContentSource;
        return isReaderContentSourceRevisionCurrent(
            source,
            expected,
        );
    }

    private async runBookmarkToggle(params: BookmarkToggleParams): Promise<BookmarkToggleResult> {
        if (!this.bookmarksController) return { ok: false, message: t('contentNotFound') };
        if (!params.position) return { ok: false, message: t('positionNotAvailable') };
        const sourceRevision = params.sourceRevision ?? this.captureCurrentSourceRevision();
        if (!this.isSourceRevisionCurrent(sourceRevision)) {
            return { ok: false, message: t('contentNotFound') };
        }
        if (
            this.adapter.getPlatformId() === 'chatgpt'
            && this.conversationContentSource
            && !this.conversationContentSource.read().snapshot
        ) {
            return { ok: false, message: t('contentNotFound') };
        }

        const userPrompt = params.userPrompt.trim();
        if (!userPrompt) return { ok: false, message: t('failedToExtractUserMessage') };

        const status = await this.bookmarksController.readPositionBookmarkStatus(params.url, params.position);
        if (!status.ok) return { ok: false, message: status.message };
        const resolvedBookmarkPositions = this.resolveCanonicalBookmarkPositions(params.url);
        const alreadySaved = this.isBookmarkActive(params.url, params.position, resolvedBookmarkPositions)
            || (
                this.adapter.getPlatformId() !== 'chatgpt'
                && status.data.saved
            );

        if (!alreadySaved) {
            if (
                this.adapter.getPlatformId() === 'chatgpt'
                && (!params.userPrompt.trim() || !params.markdown.trim())
            ) {
                return { ok: false, message: t('contentNotFound') };
            }
            if (this.adapter.getPlatformId() === 'chatgpt' && !params.messageId?.trim()) {
                return { ok: false, message: t('contentNotFound') };
            }
            const currentFolderPath = this.bookmarksController.getDefaultFolderPath();
            const dialogRes = await this.bookmarkSaveDialog!.open({
                theme: this.appearance.theme,
                userPrompt,
                existingTitle: userPrompt,
                currentFolderPath,
                mode: 'create',
            });
            if (!dialogRes.ok) return { ok: false, cancelled: true };
            if (!this.isSourceRevisionCurrent(sourceRevision)) {
                return { ok: false, message: t('contentNotFound') };
            }
            if (this.getBookmarkPageUrl() !== params.url) {
                return { ok: false, message: t('contentNotFound') };
            }

            const saveRes = await this.bookmarksController.setPositionBookmarkSaved({
                url: params.url,
                position: params.position,
                messageId: params.messageId ?? null,
                folderPath: dialogRes.folderPath,
                userMessage: userPrompt,
                aiResponse: params.markdown,
                platform: this.getBookmarkPlatformLabel(),
                title: dialogRes.title,
            }, true);
            if (!saveRes.ok) return { ok: false, message: saveRes.message };

            return {
                ok: true,
                saved: true,
                bookmarked: true,
                message: t('savedStatus'),
                folderPath: dialogRes.folderPath,
            };
        }

        if (!this.isSourceRevisionCurrent(sourceRevision)) {
            return { ok: false, message: t('contentNotFound') };
        }
        if (this.getBookmarkPageUrl() !== params.url) {
            return { ok: false, message: t('contentNotFound') };
        }
        const title = userPrompt.length > 50 ? `${userPrompt.slice(0, 50)}...` : userPrompt;
        const removeRes = await this.bookmarksController.setPositionBookmarkSaved({
            url: params.url,
            position: params.position,
            messageId: params.messageId ?? null,
            folderPath: this.bookmarksController.getDefaultFolderPath(),
            userMessage: userPrompt,
            aiResponse: params.markdown,
            platform: this.getBookmarkPlatformLabel(),
            title,
        }, false);
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
        const resolvedBookmarkPositions = this.resolveCanonicalBookmarkPositions(url);
        for (const item of items) {
            const position = Number(item.meta?.position ?? 0);
            item.meta = {
                ...(item.meta || {}),
                url,
                bookmarkable: position > 0,
                bookmarked: position > 0
                    ? this.isBookmarkActive(url, position, resolvedBookmarkPositions)
                    : false,
            };
        }
    }

    private isBookmarkActive(
        url: string,
        position: number,
        resolvedPositions: ReadonlySet<number> | null = this.resolveCanonicalBookmarkPositions(url),
    ): boolean {
        if (!this.bookmarksController || position <= 0) return false;
        if (this.adapter.getPlatformId() === 'chatgpt' && this.conversationContentSource) {
            // Canonical ChatGPT state is authoritative. A missing projection
            // means the source or persisted records are not ready, not that a
            // position-only bookmark is safe to use.
            return resolvedPositions?.has(position) ?? false;
        }
        return resolvedPositions?.has(position)
            ?? this.bookmarksController.isPositionBookmarked(url, position);
    }

    private resolveCanonicalBookmarkPositions(url: string): ReadonlySet<number> | null {
        if (this.adapter.getPlatformId() !== 'chatgpt') return null;
        const source = this.conversationContentSource;
        const controller = this.bookmarksController;
        const snapshot = source?.read().snapshot;
        if (!snapshot || !controller?.resolveConversationBookmarkPositions) return null;
        const turns: CanonicalBookmarkTurnRef[] = snapshot.turns.map((turn) => ({
            position: turn.ordinal,
            assistantMessageId: turn.identity.assistantMessageId,
        }));
        return controller.resolveConversationBookmarkPositions(url, turns);
    }

    private resolveRefreshedReaderIndex(items: ReaderItem[], currentItem: ReaderItem, fallbackIndex: number): number {
        return resolveReaderReplacementIndex(currentItem, items, fallbackIndex);
    }

    private async refreshConversationReader(messageElement: HTMLElement, ctx: ReaderPanelActionContext): Promise<void> {
        // This is the explicit Reader Refresh action.  Ordinary Reader and
        // export clicks use the published snapshot through the compatibility
        // collector without entering this path.
        if (this.conversationContentSource) {
            try {
                await this.conversationContentSource.refresh();
            } catch {
                // Keep the maintained snapshot consumable if a local flush
                // fails; the projection below reads it directly.
            }
        }
        const result = await collectFreshReaderContent(this.adapter, null, {
            conversationContentSource: this.conversationContentSource,
            conversationMaterialization: this.conversationMaterialization,
            pageUrl: this.getBookmarkPageUrl(),
        });
        const { items } = result;
        if (items.length < 1) {
            ctx.notify(t('contentNotFound'));
            return;
        }
        if (!this.isSourceRevisionCurrent(result.sourceRevision)) {
            ctx.notify(t('contentNotFound'));
            return;
        }

        this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
        const nextIndex = this.resolveRefreshedReaderIndex(items, ctx.item, ctx.index);
        await this.readerPanel.show(items, nextIndex, this.appearance.theme, {
            profile: 'conversation-reader',
            annotationDocument: result.annotationDocument,
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
                    isBookmarked: (url, position) => this.isBookmarkActive(url, position),
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
                        ? this.conversationNavigation
                            ? await this.conversationNavigation.navigate({
                                position,
                                messageId,
                                assistantMessageId: messageId,
                                source: 'reader',
                            }, { timeoutMs: 15_000, align: 'start' })
                            : { ok: false as const, reason: 'source-unavailable' as const }
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
            conversationContentSource?: ConversationContentSourceV1 | null;
            conversationMaterialization?: ConversationMaterializationPortV1 | null;
            conversationSurface?: ConversationSurfacePortV1 | null;
            conversationNavigation?: ConversationNavigationPortV1 | null;
            saveMessagesDialog?: SaveMessagesDialogPort;
            bookmarkSaveDialog?: BookmarkSaveDialogPort;
            copyMessagePng?: typeof copyMessagePng;
        }
    ) {
        this.adapter = adapter;
        this.readerPanel = opts.readerPanel;
        this.sendController = opts.sendController ?? null;
        this.bookmarksController = opts.bookmarksController || null;
        this.conversationContentSource = opts.conversationContentSource ?? null;
        this.conversationMaterialization = opts.conversationMaterialization ?? null;
        this.conversationSurface = opts.conversationSurface ?? null;
        this.conversationNavigation = opts.conversationNavigation ?? null;
        this.saveMessagesDialog = opts.saveMessagesDialog ?? null;
        this.bookmarkSaveDialog = opts.bookmarkSaveDialog ?? null;
        this.copyMessagePng = opts.copyMessagePng ?? null;
    }

    private getBookmarkPageUrl(): string {
        // Why: ChatGPT uses hash routes like `#settings`; bookmarks should remain scoped to the conversation URL.
        return stripHash(window.location.href);
    }

    private getAvailableBookmarkUrl(): string | null {
        if (this.adapter.getPlatformId() !== 'chatgpt') return this.getBookmarkPageUrl();
        const documentRef = this.conversationSurface?.readFrame().document
            ?? this.conversationContentSource?.read().document
            ?? null;
        if (!documentRef?.conversationId) return null;
        return stripHash(documentRef.canonicalUrl?.trim() || this.getBookmarkPageUrl());
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
        this.clearReaderItemCache();
    }

    init(): void {
        const usesLocalDomLifecycle = !this.usesChatGptToolbarLifecycle();
        if (usesLocalDomLifecycle) {
            this.scanScheduler = new ScanScheduler(
                (reasons) => {
                    this.scanAndInject(reasons);
                    this.rebindObserverIfNeeded();
                },
                { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
            );

            // Why: non-ChatGPT adapters still own their local DOM discovery lifecycle.
            window.setTimeout(() => this.scanScheduler?.schedule('init'), 600);
            this.scanScheduler.schedule('init');
        }

        const bookmarkUrl = this.getAvailableBookmarkUrl();
        if (this.bookmarksController && bookmarkUrl) {
            void this.bookmarksController.refreshPositionsForUrl(bookmarkUrl).then(() => this.refreshBookmarkActionStates());
        }

        if (usesLocalDomLifecycle) {
            this.rebindObserverIfNeeded(true);
            this.routeWatcher = new RouteWatcher((nextUrl, prevUrl) => {
                const hardChange = stripHash(nextUrl) !== stripHash(prevUrl);
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
        }

        this.unsubscribeLocale = subscribeLocaleChange(() => {
            this.refreshExistingToolbarsForLocale();
        });
        if (this.conversationSurface && !this.unsubscribeConversationSurface) {
            this.unsubscribeConversationSurface = this.conversationSurface.subscribeFrame(
                (frame) => this.handleChatGptSurface(frame),
            );
        }
    }

    dispose(): void {
        this.scanScheduler?.dispose();
        this.scanScheduler = null;
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.unsubscribeConversationSurface?.();
        this.unsubscribeConversationSurface = null;
        this.observer?.disconnect();
        this.observer = null;
        this.observedContainer = null;
        this.dirtyMessages.clear();
        this.needsFullRescan = false;
        this.clearReaderItemCache();
        this.lastConversationSemanticKey = null;
        this.lastConversationHadSnapshot = false;
        this.lastChatGptMaterializationUrl = null;
        this.chatGptFrameIndex.clear();
        this.wordStatsByTurnKey.clear();
        this.frameBookmarkPositions = null;
        this.frameBookmarkUrl = null;
        this.frameBookmarkToken = null;
        this.clearAllToolbars();
    }

    private usesChatGptToolbarLifecycle(): boolean {
        return this.adapter.getPlatformId() === 'chatgpt';
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        for (const record of this.recordsByMessageKey.values()) {
            record.toolbar.setAppearance(snapshot);
        }
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
        } else if (!wasToolbarVisible && this.conversationSurface) {
            this.handleChatGptSurface(this.conversationSurface.readFrame());
        }
    }

    setExportSettings(settings: ExportSettings): void {
        this.resolvedPngWidth = resolvePngExportWidth(settings);
        this.resolvedPngPixelRatio = resolvePngExportPixelRatio(settings);
    }

    private getPositionForMessage(messageElement: HTMLElement): number {
        const canonical = this.resolveCanonicalPosition(messageElement);
        if (canonical !== null) return canonical;
        if (this.adapter.getPlatformId() === 'chatgpt') return 0;
        const fallback = Number(messageElement.dataset.aimdMsgPosition || 0);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    private resolveCanonicalPosition(messageElement: HTMLElement): number | null {
        if (this.adapter.getPlatformId() !== 'chatgpt') return null;
        if (this.conversationSurface) {
            const target = this.conversationSurface.materialization.resolveElement(messageElement);
            if (!target) return null;
            return this.conversationSurface.readFrame().obtainedTurns.find((entry) => (
                entry.target.turnId === target.turnId
                && entry.target.assistantMessageId === target.assistantMessageId
            ))?.turn.ordinal ?? null;
        }
        return null;
    }

    private writeMessagePosition(messageElement: HTMLElement, position: number): void {
        // The ChatGPT Content Session owns canonical order. Never stamp a
        // consumer-local DOM ordinal that virtualization could invalidate.
        if (this.adapter.getPlatformId() === 'chatgpt') return;
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
                    if (this.adapter.getPlatformId() === 'chatgpt') {
                        const source = this.conversationContentSource;
                        const materialization = this.conversationMaterialization;
                        if (!source || !materialization) return { ok: false, message: t('contentNotFound') };
                        const prepared = await prepareChatGPTBookmark(source, materialization, messageElement);
                        if (!prepared) return { ok: false, message: t('contentNotFound') };
                        const result = await this.runBookmarkToggle({
                            url,
                            position: prepared.position,
                            messageId: prepared.messageId,
                            userPrompt: prepared.userMessage,
                            markdown: prepared.assistantMarkdown,
                            sourceRevision: {
                                routeEpoch: 0,
                                revision: 0,
                                conversationId: source.read().document?.conversationId ?? '',
                                contentToken: prepared.contentRevision,
                            },
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
                    }
                    const selection = await this.prepareCurrentReaderSelectionForElement(messageElement);
                    if (!selection) return { ok: false, message: t('contentNotFound') };
                    const { item, sourceRevision } = selection;
                    if (item.meta?.sourceQuality === 'reconstructed') {
                        return { ok: false, message: t('contentNotFound') };
                    }
                    const position = this.adapter.getPlatformId() === 'chatgpt'
                        ? Number(item.meta?.position ?? 0)
                        : this.getPositionForMessage(messageElement);
                    if (!Number.isInteger(position) || position <= 0) {
                        return { ok: false, message: t('positionNotAvailable') };
                    }
                    const messageId = String(
                        this.adapter.getPlatformId() === 'chatgpt'
                            ? item.meta?.assistantMessageId ?? item.meta?.messageId ?? ''
                            : this.adapter.getMessageId(messageElement) ?? '',
                    ).trim() || null;
                    const markdown = await resolveReaderItemMarkdown(item);
                    const result = await this.runBookmarkToggle({
                        url,
                        position,
                        messageId,
                        userPrompt: item.userPrompt,
                        markdown,
                        sourceRevision,
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
                    let progressPresentation: ImageExportProgressPresentation | null = null;
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
                            progressPresentation = retainMonotonicImageExportProgress(
                                progressPresentation,
                                this.formatCopyPngProgress(event),
                            );
                            ctx?.onProgress({
                                ...progressPresentation,
                                indeterminate: false,
                            });
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
                    conversationContentSource: this.conversationContentSource,
                    conversationMaterialization: this.conversationMaterialization,
                    pageUrl: this.getBookmarkPageUrl(),
                });
                let { items, startIndex } = itemsResult;
                let usedLocalItem = false;
                if (items.length === 0) {
                    const localItem = await this.prepareCurrentReaderItemForElement(messageElement);
                    if (!localItem) return { ok: false, message: t('contentNotFound') };
                    items = [localItem];
                    startIndex = 0;
                    usedLocalItem = true;
                }
                const shouldValidateSourceRevision = itemsResult.status === undefined
                    || (itemsResult.status === 'ready' && !usedLocalItem);
                if (shouldValidateSourceRevision && !this.isSourceRevisionCurrent(itemsResult.sourceRevision)) {
                    return { ok: false, message: t('contentNotFound') };
                }
                this.decorateReaderItems(items as Array<{ meta?: Record<string, unknown> }>);
                await this.readerPanel.show(items, startIndex, this.appearance.theme, {
                    profile: 'conversation-reader',
                    annotationDocument: itemsResult.annotationDocument,
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
                    const currentReaderItem = await this.prepareCurrentReaderItemForElement(messageElement);
                    if (!currentReaderItem) return { ok: false, message: t('contentNotFound') };
                    const opened = await this.saveMessagesDialog!.open(this.adapter, this.appearance.theme, {
                        conversationContentSource: this.conversationContentSource,
                        conversationMaterialization: this.conversationMaterialization,
                        startMessageElement: messageElement,
                        currentReaderItem,
                    });
                    if (opened === false) {
                        return { ok: false, message: t('contentNotFound') };
                    }
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
        const toolbar = new MessageToolbar(this.appearance.theme, this.getActionsForMessage(params.message, getToolbar), {
            showStats: this.behavior.showWordCount,
            themeOverrides: this.appearance.overrides,
        });
        const host = toolbar.getElement();
        host.setAttribute('data-aimd-role', 'message-toolbar');
        host.setAttribute('data-aimd-message-key', params.messageKey);
        if (this.adapter.getPlatformId() === 'chatgpt') {
            host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        }

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
        const selector = this.adapter.getMessageSelector();
        const container = this.adapter.getObserverContainer() || document.body;
        const nodes = discoverMessageElements(container, selector);
        this.rebuildTurnIndex();
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
        const sortedCandidates = this.sortMessagesByDocumentOrder(
            Array.from(new Set(candidates)).filter((node) => node.isConnected),
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
            this.refreshDerivedStateForToolbar(existing, item.message, item.position, item.pending);
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
        const url = this.getAvailableBookmarkUrl();
        if (!url) {
            toolbar.setActionActive('bookmark_toggle', false);
            toolbar.setActionDisabled('bookmark_toggle', true);
            return;
        }
        toolbar.setActionDisabled('bookmark_toggle', false);
        if (this.adapter.getPlatformId() !== 'chatgpt' || !this.conversationContentSource) {
            const active = this.bookmarksController.isPositionBookmarked(url, fallbackPosition);
            toolbar.setActionActive('bookmark_toggle', active);
            return;
        }

        const indexedPosition = this.chatGptFrameIndex.read(messageElement)?.position
            ?? this.resolveCanonicalPosition(messageElement);
        const resolvedBookmarkPositions = this.frameBookmarkUrl === url
            ? this.frameBookmarkPositions
            : this.resolveCanonicalBookmarkPositions(url);
        const active = indexedPosition
            ? this.isBookmarkActive(url, indexedPosition, resolvedBookmarkPositions)
            : false;
        toolbar.setActionActive('bookmark_toggle', active);
    }

    /**
     * Surface frames can change because another virtualized turn mounted while
     * this toolbar's canonical turn and bookmark context stayed identical.
     * Avoid repeating bookmark lookup and word-count derivation for that stable
     * record; explicit bookmark-state refreshes still bypass this cache.
     */
    private refreshDerivedStateForToolbar(
        record: ToolbarRecord,
        messageElement: HTMLElement,
        position: number,
        pending: boolean,
    ): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') {
            this.refreshBookmarkStateForToolbar(record.toolbar, messageElement, position);
            this.refreshWordCountForToolbar(record.toolbar, messageElement, pending);
            return;
        }

        const indexed = this.chatGptFrameIndex.read(messageElement);
        const key = [
            indexed?.turnKey ?? `pending:${position}`,
            String(position),
            pending ? 'pending' : 'ready',
            this.behavior.showWordCount ? 'word-count' : 'no-word-count',
            this.frameBookmarkUrl ?? '',
            this.frameBookmarkToken ?? '',
        ].join('|');
        if (record.lastDerivedStateKey === key) return;
        record.lastDerivedStateKey = key;
        this.refreshBookmarkStateForToolbar(record.toolbar, messageElement, position);
        this.refreshWordCountForToolbar(record.toolbar, messageElement, pending);
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

        if (this.adapter.getPlatformId() === 'chatgpt') {
            const turn = this.readChatGptTurnForElement(messageElement);
            if (turn) {
                this.applyWordCount(toolbar, turn.assistantMarkdown);
                return;
            }
            const markdown = copyMarkdownFromMessage(this.adapter, messageElement);
            if (markdown.ok && markdown.markdown.trim()) this.applyWordCount(toolbar, markdown.markdown);
            else toolbar.setStats(['—']);
            return;
        }

        // Non-ChatGPT adapters keep their DOM-local behavior; ChatGPT semantics above are canonical-only.
        const tryCompute = (attempt: number) => {
            const turn = this.getTurnRefForElement(messageElement);
            const md = turn
                ? copyMarkdownFromTurn(this.adapter, turn.messageEls)
                : copyMarkdownFromMessage(this.adapter, messageElement);
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

            this.applyWordCount(toolbar, text);
        };

        tryCompute(0);
    }

    private applyWordCount(toolbar: MessageToolbar, text: string): void {
        const normalized = text.trim();
        if (!normalized) {
            toolbar.setStats(['—']);
            return;
        }
        const key = normalized;
        let stats = this.wordStatsByTurnKey.get(key);
        if (!stats) {
            const res = this.wordCounter.count(normalized);
            const formatted = this.wordCounter.format(res);
            const parts = formatted.split(' / ');
            stats = parts.length >= 2
                ? [parts[0]!, parts.slice(1).join(' ')]
                : [formatted];
            this.wordStatsByTurnKey.set(key, stats);
        }
        toolbar.setStats(stats);
    }

    private async syncReaderTailPages(): Promise<void> {
        if (typeof this.readerPanel.isShowingConversationReader !== 'function') return;
        if (typeof this.readerPanel.getItemsSnapshot !== 'function') return;
        if (typeof this.readerPanel.appendItem !== 'function') return;
        if (!this.readerPanel.isShowingConversationReader()) return;
        if (this.adapter.getPlatformId() === 'chatgpt') return;
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

    private formatCopyPngProgress(event: ImageExportProgressEvent): ImageExportProgressPresentation {
        return presentImageExportProgress(event, (key, substitutions) => (
            substitutions ? t(key, substitutions) : t(key)
        ));
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
