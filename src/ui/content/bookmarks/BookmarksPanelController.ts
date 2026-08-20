import type { Theme } from '../../../core/types/theme';
import type { Bookmark, BookmarksKindFilter, Folder, BookmarksSortMode } from '../../../core/bookmarks/types';
import type { StorageUsageResponse } from '../../../drivers/shared/clients/bookmarksClient';
import {
    createProtocolClientFailure,
    type RuntimeClientFailure,
    type RuntimeClientResult,
} from '../../../drivers/shared/clients/clientResult';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import { PathUtils } from '../../../core/bookmarks/path';
import { bookmarksClient } from '../../../drivers/shared/clients/bookmarksClient';
import type { BookmarksBulkItem } from '../../../contracts/protocol';
import type { Result } from '../../../drivers/shared/clients/bookmarksClient';
import { computeBookmarksPanelViewModel, type BookmarksPanelState, type BookmarksPanelViewModel } from '../../../services/bookmarks/panelModel';
import { formatCanonicalMarkdownForCopy } from '../../../services/copy/canonicalMarkdownCopy';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import {
    getBookmarkUrlCandidates,
    isSamePageUrl,
    scrollToBookmarkTargetWithRetry,
    setPendingNavigation,
} from '../../../drivers/content/bookmarks/navigation';
import {
    resolveConversationBookmarkPositions,
    type CanonicalBookmarkTurnRef,
} from '../../../services/bookmarks/conversationBookmarkResolver';
import { t } from '../components/i18n';
import { logger } from '../../../core/logger';
import {
    bookmarkKey,
    expandPathChain,
    folderKey,
    formatBookmarkTimestamp,
    getBookmarkIdentityKey,
} from './bookmarksPanelControllerHelpers';
import {
    buildFolderCheckboxStateIndex,
    getDescendantKeysForFolder,
    getSelectedBookmarkItems,
    getSelectedFolderPaths,
    type FolderCheckboxState,
} from './bookmarksPanelControllerSelection';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';

export type BookmarkIdentityKey = string; // `message:${urlWithoutProtocol}:${position}` or `page:${urlWithoutProtocol}`

declare global {
    interface Window {
        __AIMD_BOOKMARKS_PERF__?: boolean;
    }
}

function shouldLogBookmarksPerf(): boolean {
    try {
        if (typeof window !== 'undefined' && window.__AIMD_BOOKMARKS_PERF__) return true;
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('aimd:bookmarks-perf') === '1';
        }
    } catch {
        // ignore
    }
    return false;
}

function logBookmarksPerf(stage: string, payload: Record<string, unknown>): void {
    if (!shouldLogBookmarksPerf()) return;
    logger.debug(`[AI-MarkDone][BookmarksPanelController][Perf] ${stage}`, payload);
}

export type BookmarksPanelSnapshot = {
    vm: BookmarksPanelViewModel;
    folders: Folder[];
    folderPaths: string[];
    selectedKeys: Set<string>;
    previewId: BookmarkIdentityKey | null;
    status: string;
    dataState: BookmarksDataState;
    storageUsage: StorageUsageResponse | null;
};

export type BookmarksDataState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready' }
    | { kind: 'error'; failure: RuntimeClientFailure };

function getFailure(result: RuntimeClientResult<unknown>): RuntimeClientFailure | null {
    if (result.ok) return null;
    return result.failure;
}

function selectRefreshFailure(
    results: Array<RuntimeClientResult<unknown>>,
): RuntimeClientFailure | null {
    const failures = results.map(getFailure).filter((failure): failure is RuntimeClientFailure => Boolean(failure));
    return failures.find((failure) => failure.kind === 'transport') ?? failures[0] ?? null;
}

export class BookmarksPanelController {
    private adapter: SiteAdapter;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');

    private bookmarks: Bookmark[] = [];
    private folders: Folder[] = [];
    private folderPaths: string[] = [];

    private positionsForCurrentUrl = new Set<number>();
    private positionsUrl: string | null = null;
    private positionsLookupSeq = 0;
    private conversationBookmarksForResolution: Bookmark[] | null = null;
    private conversationBookmarksLoadPromise: Promise<void> | null = null;
    private pageBookmarkUrl: string | null = null;
    private pageBookmarkSaved = false;
    private pageBookmarkLookupSeq = 0;

    private state: BookmarksPanelState = {
        query: '',
        kind: 'all',
        sortMode: 'time-desc',
        selectedFolderPath: null,
        recursive: true,
        expandedPaths: new Set<string>(),
        selectedKeys: new Set<string>(),
    };

    private previewId: BookmarkIdentityKey | null = null;
    private status: string = '';
    private dataState: BookmarksDataState = { kind: 'idle' };
    private storageUsage: StorageUsageResponse | null = null;
    private refreshSeq: number = 0;
    private folderCheckboxStateByPath: Map<string, FolderCheckboxState> | null = null;

    private listeners = new Set<(snapshot: BookmarksPanelSnapshot) => void>();

    constructor(adapter: SiteAdapter, options: Readonly<{
        navigation?: ConversationNavigationPortV1 | null;
        conversationContentSource?: ConversationContentSourceV1 | null;
    }> = {}) {
        this.adapter = adapter;
        this.navigation = options.navigation ?? null;
        this.conversationContentSource = options.conversationContentSource ?? null;
    }

    private readonly navigation: ConversationNavigationPortV1 | null;
    private readonly conversationContentSource: ConversationContentSourceV1 | null;

    private async ensureConversationBookmarksForResolution(): Promise<void> {
        if (this.adapter.getPlatformId?.() !== 'chatgpt' || !this.conversationContentSource) return;
        if (this.conversationBookmarksForResolution !== null) return;
        if (this.conversationBookmarksLoadPromise) {
            await this.conversationBookmarksLoadPromise;
            return;
        }

        const load = bookmarksClient.list({ kind: 'message', platform: 'ChatGPT' })
            .then((result) => {
                if (result.ok) this.conversationBookmarksForResolution = result.data.bookmarks;
            })
            .finally(() => {
                this.conversationBookmarksLoadPromise = null;
            });
        this.conversationBookmarksLoadPromise = load;
        await load;
    }

    /** ChatGPT query flags (for example mweb_fallback) are transport hints, not bookmark identity. */
    private normalizeBookmarkUrl(url: string): string {
        return this.adapter.getPlatformId?.() === 'chatgpt'
            ? getBookmarkUrlCandidates(url)[0] ?? url
            : url;
    }

    private bookmarkUrlCandidates(url: string): string[] {
        return this.adapter.getPlatformId?.() === 'chatgpt'
            ? getBookmarkUrlCandidates(url)
            : [url];
    }

    getAdapter(): SiteAdapter {
        return this.adapter;
    }

    getTheme(): Theme {
        return this.appearance.theme;
    }

    getAppearance(): AppearanceSnapshot {
        return this.appearance;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.emit();
    }

    subscribe(listener: (snapshot: BookmarksPanelSnapshot) => void): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    getSnapshot(): BookmarksPanelSnapshot {
        const startedAt = performance.now();
        const vm = computeBookmarksPanelViewModel({
            folders: this.folders,
            bookmarks: this.bookmarks,
            state: this.state,
        });
        logBookmarksPerf('controller:getSnapshot', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            bookmarks: this.bookmarks.length,
            folders: this.folders.length,
            visibleBookmarks: vm.bookmarks.length,
            folderTreeRoots: vm.folderTree.length,
            selectedKeys: this.state.selectedKeys.size,
            query: this.state.query,
            sortMode: this.state.sortMode,
        });
        return {
            vm,
            folders: this.folders,
            folderPaths: this.folderPaths,
            selectedKeys: this.state.selectedKeys,
            previewId: this.previewId,
            status: this.status,
            dataState: this.dataState,
            storageUsage: this.storageUsage,
        };
    }

    private emit(): void {
        const snap = this.getSnapshot();
        this.listeners.forEach((l) => l(snap));
    }

    private invalidateFolderCheckboxStateIndex(): void {
        this.folderCheckboxStateByPath = null;
    }

    private setStatus(text: string): void {
        this.status = text;
        this.emit();
    }

    setPanelStatus(text: string): void {
        this.setStatus(text);
    }

    async refreshAll(): Promise<void> {
        const seq = ++this.refreshSeq;
        this.dataState = { kind: 'loading' };
        this.setStatus(t('loading'));
        const [listRes, foldersRes, storageUsageRes] = await Promise.all([
            bookmarksClient.list({ sortMode: this.state.sortMode }),
            bookmarksClient.foldersList(),
            bookmarksClient.storageUsage(),
        ]);
        if (seq !== this.refreshSeq) return;

        if (listRes.ok) {
            this.bookmarks = listRes.data.bookmarks;
            if (this.conversationContentSource) {
                this.conversationBookmarksForResolution = listRes.data.bookmarks;
            }
        }
        if (foldersRes.ok) {
            this.folders = foldersRes.data.folders;
            this.folderPaths = foldersRes.data.folderPaths;
        }
        this.invalidateFolderCheckboxStateIndex();
        if (storageUsageRes.ok) this.storageUsage = storageUsageRes.data;
        const refreshFailure = selectRefreshFailure([listRes, foldersRes]);
        this.dataState = refreshFailure
            ? { kind: 'error', failure: refreshFailure }
            : { kind: 'ready' };

        if (!listRes.ok && !foldersRes.ok) {
            this.setStatus(`${listRes.message}; ${foldersRes.message}`);
        } else if (!listRes.ok) {
            this.setStatus(listRes.message);
        } else if (!foldersRes.ok) {
            this.setStatus(foldersRes.message);
        } else {
            this.setStatus('');
        }

        this.emit();
    }

    async refreshUiState(): Promise<void> {
        const res = await bookmarksClient.uiStateGetLastSelectedFolderPath();
        if (!res.ok) return;
        this.state.selectedFolderPath = res.data.value ?? null;
        this.state.expandedPaths = expandPathChain(this.state.selectedFolderPath, this.state.expandedPaths);
        this.emit();
    }

    async refreshPositionsForUrl(url: string): Promise<void> {
        await Promise.all([
            this.readPositionBookmarkStatus(url, 0),
            this.ensureConversationBookmarksForResolution(),
        ]);
    }

    async readPositionBookmarkStatus(url: string, position: number): Promise<Result<{ saved: boolean }>> {
        // ChatGPT bookmark state is resolved against the canonical message
        // index. Ensure that the persisted message records are available
        // before a toolbar decides whether a toggle means save or remove.
        await this.ensureConversationBookmarksForResolution();
        const seq = ++this.positionsLookupSeq;
        const canonicalUrl = this.normalizeBookmarkUrl(url);
        const results = await Promise.all(
            this.bookmarkUrlCandidates(url).map((candidate) => bookmarksClient.positions({ url: candidate })),
        );
        const failure = results.find((result) => !result.ok);
        if (failure && !failure.ok) return failure;
        const positions = new Set(
            results.flatMap((result) => result.ok ? result.data.positions : []),
        );
        if (seq === this.positionsLookupSeq) {
            this.positionsUrl = canonicalUrl;
            this.positionsForCurrentUrl = positions;
            this.emit();
        }
        return { ok: true, data: { saved: position > 0 && positions.has(position) } };
    }

    async refreshPageBookmarkStatus(url: string): Promise<boolean> {
        const res = await this.readPageBookmarkStatus(url);
        return res.ok ? res.data.saved : this.isCurrentPageBookmarked(url);
    }

    async readPageBookmarkStatus(url: string): Promise<Result<{ saved: boolean }>> {
        const seq = ++this.pageBookmarkLookupSeq;
        const canonicalUrl = this.normalizeBookmarkUrl(url);
        const results = await Promise.all(
            this.bookmarkUrlCandidates(url).map((candidate) => bookmarksClient.pageStatus({ url: candidate })),
        );
        const failure = results.find((result) => !result.ok);
        if (failure && !failure.ok) return failure;
        const saved = results.some((result) => result.ok && result.data.saved);
        if (seq === this.pageBookmarkLookupSeq) {
            this.pageBookmarkUrl = canonicalUrl;
            this.pageBookmarkSaved = saved;
            this.emit();
        }
        return { ok: true, data: { saved } };
    }

    isCurrentPageBookmarked(url: string): boolean {
        if (!this.pageBookmarkUrl || !isSamePageUrl(this.pageBookmarkUrl, url)) return false;
        return this.pageBookmarkSaved;
    }

    isPositionBookmarked(url: string, position: number): boolean {
        if (!this.positionsUrl || !isSamePageUrl(this.positionsUrl, url)) return false;
        return this.positionsForCurrentUrl.has(position);
    }

    /**
     * Resolve persisted message bookmarks against canonical conversation
     * turns. This is a read-only projection; it never rewrites old records,
     * storage keys, or the import/export format.
     */
    resolveConversationBookmarkPositions(
        url: string,
        turns: readonly CanonicalBookmarkTurnRef[],
    ): ReadonlySet<number> {
        if (this.conversationContentSource) {
            // Once the canonical source is injected, position-only state is
            // not a safe projection for ChatGPT. During source or bookmark
            // loading, fail closed until both facts are available.
            if (!this.conversationContentSource.read().snapshot) return new Set();
            if (this.conversationBookmarksForResolution === null) return new Set();
            return resolveConversationBookmarkPositions(
                this.conversationBookmarksForResolution,
                url,
                turns,
                isSamePageUrl,
            );
        }

        const records = this.conversationBookmarksForResolution ?? this.bookmarks;
        const hasLoadedRecords = this.conversationBookmarksForResolution !== null
            || this.dataState.kind === 'ready';
        if (hasLoadedRecords) {
            return resolveConversationBookmarkPositions(records, url, turns, isSamePageUrl);
        }
        if (!this.positionsUrl || !isSamePageUrl(this.positionsUrl, url)) return new Set();
        return new Set(this.positionsForCurrentUrl);
    }

    getDefaultFolderPath(): string {
        return this.state.selectedFolderPath || 'Import';
    }

    setQuery(query: string): void {
        this.state.query = query;
        this.emit();
    }

    setKindFilter(kind: BookmarksKindFilter): void {
        this.state.kind = kind;
        this.emit();
    }

    setSortMode(mode: BookmarksSortMode): void {
        this.state.sortMode = mode;
        this.emit();
    }

    toggleRecursive(): void {
        this.state.recursive = !this.state.recursive;
        this.emit();
    }

    selectFolder(path: string | null): void {
        this.state.selectedFolderPath = path;
        this.state.expandedPaths = expandPathChain(path, this.state.expandedPaths);
        this.emit();
        void bookmarksClient.uiStateSetLastSelectedFolderPath(path);
    }

    toggleFolderExpanded(path: string): void {
        const set = this.state.expandedPaths;
        if (set.has(path)) set.delete(path);
        else set.add(path);
        this.emit();
    }

    getFolderCheckboxState(path: string): { checked: boolean; indeterminate: boolean } {
        if (!this.folderCheckboxStateByPath) {
            this.folderCheckboxStateByPath = buildFolderCheckboxStateIndex({
                folders: this.folders,
                bookmarks: this.bookmarks,
                selectedKeys: this.state.selectedKeys,
            });
        }
        try {
            const normalized = PathUtils.normalize(path);
            return this.folderCheckboxStateByPath.get(normalized) ?? {
                checked: this.state.selectedKeys.has(folderKey(normalized)),
                indeterminate: false,
            };
        } catch {
            return { checked: false, indeterminate: false };
        }
    }

    toggleFolderSelection(path: string): void {
        const key = folderKey(path);
        const descendants = getDescendantKeysForFolder({
            path,
            folders: this.folders,
            bookmarks: this.bookmarks,
        });
        const allKeys = [key, ...descendants];
        const anySelected = allKeys.some((k) => this.state.selectedKeys.has(k));
        if (anySelected) {
            allKeys.forEach((k) => this.state.selectedKeys.delete(k));
        } else {
            allKeys.forEach((k) => this.state.selectedKeys.add(k));
        }
        this.invalidateFolderCheckboxStateIndex();
        this.emit();
    }

    toggleBookmarkSelection(bookmark: Bookmark): void {
        const id = getBookmarkIdentityKey(bookmark);
        const key = bookmarkKey(id);
        if (this.state.selectedKeys.has(key)) this.state.selectedKeys.delete(key);
        else this.state.selectedKeys.add(key);
        this.invalidateFolderCheckboxStateIndex();
        this.emit();
    }

    clearSelection(): void {
        this.state.selectedKeys.clear();
        this.invalidateFolderCheckboxStateIndex();
        this.emit();
    }

    setPreview(id: BookmarkIdentityKey | null): void {
        this.previewId = id;
        this.emit();
    }

    getBookmarkById(id: BookmarkIdentityKey): Bookmark | null {
        return this.bookmarks.find((b) => getBookmarkIdentityKey(b) === id) || null;
    }

    async copyBookmarkMarkdown(bookmark: Bookmark): Promise<void> {
        const text = bookmark.kind === 'page'
            ? `${bookmark.title}\n${bookmark.url}`
            : formatCanonicalMarkdownForCopy(bookmark.aiResponse ?? '');
        const ok = await copyTextToClipboard(text);
        this.setStatus(ok ? t('btnCopied') : t('copyFailed'));
    }

    async deleteBookmark(bookmark: Bookmark): Promise<void> {
        if (bookmark.kind === 'page') {
            const res = await bookmarksClient.pageRemove({ url: bookmark.url });
            if (!res.ok) {
                this.setStatus(res.message);
                return;
            }
            if (this.pageBookmarkUrl && isSamePageUrl(this.pageBookmarkUrl, bookmark.url)) {
                this.pageBookmarkSaved = false;
            }
            await this.refreshAll();
            this.setStatus(t('deletedStatus'));
            return;
        }
        if (typeof bookmark.position !== 'number') return;
        const res = await bookmarksClient.remove({ url: bookmark.url, position: bookmark.position });
        if (!res.ok) {
            this.setStatus(res.message);
            return;
        }
        if (this.positionsUrl && isSamePageUrl(this.positionsUrl, bookmark.url)) {
            this.positionsForCurrentUrl.delete(bookmark.position);
        }
        await this.refreshAll();
        this.setStatus(t('deletedStatus'));
    }

    async exportAll(preserveStructure: boolean): Promise<Result<{ payload: any }>> {
        return bookmarksClient.exportAll({ preserveStructure });
    }

    async exportSelected(preserveStructure: boolean): Promise<Result<{ payload: any }>> {
        const items = getSelectedBookmarkItems({
            bookmarks: this.bookmarks,
            selectedKeys: this.state.selectedKeys,
        });
        return bookmarksClient.exportSelected({ items, preserveStructure });
    }

    async importJsonText(jsonText: string, saveContextOnly: boolean): Promise<Result<any>> {
        const res = await bookmarksClient.import({ jsonText, options: { saveContextOnly } });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async repair(): Promise<Result<any>> {
        const res = await bookmarksClient.repair();
        if (res.ok) await this.refreshAll();
        return res;
    }

    async createFolder(path: string): Promise<Result<any>> {
        const normalized = PathUtils.normalize(path);
        const res = await bookmarksClient.foldersCreate({ path: normalized });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async renameFolder(oldPath: string, newName: string): Promise<Result<any>> {
        const res = await bookmarksClient.foldersRename({ oldPath, newName });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async renameBookmark(bookmark: Bookmark, title: string): Promise<Result<any>> {
        if (bookmark.kind === 'page') {
            const res = await bookmarksClient.pageSave({
                url: bookmark.url,
                title,
                platform: bookmark.platform,
                folderPath: bookmark.folderPath,
                timestamp: bookmark.timestamp,
            });
            if (res.ok) await this.refreshAll();
            return res;
        }
        if (typeof bookmark.position !== 'number' || typeof bookmark.userMessage !== 'string') {
            return createProtocolClientFailure('INVALID_REQUEST', 'Invalid message bookmark');
        }
        const res = await bookmarksClient.save({
            url: bookmark.url,
            position: bookmark.position,
            messageId: bookmark.messageId ?? null,
            userMessage: bookmark.userMessage,
            aiResponse: bookmark.aiResponse,
            title,
            platform: bookmark.platform,
            folderPath: bookmark.folderPath,
            timestamp: bookmark.timestamp,
            options: { saveContextOnly: false },
        });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async moveFolder(sourcePath: string, targetParentPath: string): Promise<Result<any>> {
        const res = await bookmarksClient.foldersMove({ sourcePath, targetParentPath });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async deleteFolder(path: string): Promise<Result<any>> {
        const res = await bookmarksClient.foldersDelete({ path });
        if (res.ok) await this.refreshAll();
        return res;
    }

    async batchDelete(): Promise<Result<any>> {
        const items = getSelectedBookmarkItems({
            bookmarks: this.bookmarks,
            selectedKeys: this.state.selectedKeys,
        });
        const folderPaths = getSelectedFolderPaths(this.state.selectedKeys);
        const res = await bookmarksClient.bulkRemove({ items, folderPaths });
        if (res.ok) {
            await this.refreshAll();
            this.clearSelection();
        }
        return res;
    }

    async batchMove(targetFolderPath: string): Promise<Result<any>> {
        const items = getSelectedBookmarkItems({
            bookmarks: this.bookmarks,
            selectedKeys: this.state.selectedKeys,
        });
        const res = await bookmarksClient.bulkMove({ items, targetFolderPath });
        if (res.ok) {
            await this.refreshAll();
            this.clearSelection();
        }
        return res;
    }

    async moveBookmark(bookmark: Bookmark, targetFolderPath: string): Promise<Result<any>> {
        const item: BookmarksBulkItem | null = bookmark.kind === 'page'
            ? { kind: 'page', url: bookmark.url }
            : (typeof bookmark.position === 'number' ? { kind: 'message', url: bookmark.url, position: bookmark.position } : null);
        if (!item) return createProtocolClientFailure('INVALID_REQUEST', 'Invalid bookmark');
        const res = await bookmarksClient.bulkMove({
            items: [item],
            targetFolderPath,
        });
        if (res.ok) {
            await this.refreshAll();
        }
        return res;
    }

    async goToBookmark(bookmark: Bookmark): Promise<void> {
        const current = window.location.href;
        const target = bookmark.url;
        if (bookmark.kind === 'page') {
            if (!isSamePageUrl(current, target)) window.location.href = target;
            else this.setStatus(t('alreadyOnPageStatus'));
            return;
        }
        if (typeof bookmark.position !== 'number') return;
        if (isSamePageUrl(current, target)) {
            this.setStatus('Navigating…');
            const targetRef = { position: bookmark.position, messageId: bookmark.messageId ?? null };
            if (this.adapter.getPlatformId() === 'chatgpt') {
                const result = this.navigation
                    ? await this.navigation.navigate({
                        position: targetRef.position,
                        messageId: targetRef.messageId,
                        assistantMessageId: targetRef.messageId,
                        source: 'bookmark',
                    }, { timeoutMs: 15_000, align: 'start' })
                    : { ok: false as const, reason: 'source-unavailable' as const };
                if (!result.ok) this.setStatus('Bookmark target unavailable');
            } else {
                await scrollToBookmarkTargetWithRetry(this.adapter, targetRef, { timeoutMs: 2000, intervalMs: 200 });
            }
            return;
        }
        setPendingNavigation({ url: target, position: bookmark.position, messageId: bookmark.messageId ?? null });
        window.location.href = target;
    }

    getSelectedBookmarkItems(): BookmarksBulkItem[] {
        return getSelectedBookmarkItems({
            bookmarks: this.bookmarks,
            selectedKeys: this.state.selectedKeys,
        });
    }

    getSelectedFolderPaths(): string[] {
        return getSelectedFolderPaths(this.state.selectedKeys);
    }

    getSortModes(): Array<{ id: BookmarksSortMode; label: string }> {
        return [
            { id: 'time-desc', label: 'Time ↓' },
            { id: 'time-asc', label: 'Time ↑' },
            { id: 'alpha-asc', label: 'A → Z' },
            { id: 'alpha-desc', label: 'Z → A' },
        ];
    }

    getBookmarkRowSubtitle(bookmark: Bookmark): string {
        const type = bookmark.kind === 'page' ? t('bookmarkTypePage') : t('bookmarkTypeMessage');
        return `${type} · ${bookmark.platform} · ${bookmark.folderPath} · ${formatBookmarkTimestamp(bookmark.timestamp)}`;
    }

    async togglePageBookmarkForCurrentPage(params: {
        url: string;
        title: string;
        platform: string;
        folderPath?: string;
    }): Promise<Result<{ saved: boolean }>> {
        const statusRes = await this.readPageBookmarkStatus(params.url);
        if (!statusRes.ok) return statusRes;
        return this.setPageBookmarkSaved(params, !statusRes.data.saved);
    }

    async setPageBookmarkSaved(params: {
        url: string;
        title: string;
        platform: string;
        folderPath?: string;
    }, saved: boolean): Promise<Result<{ saved: boolean }>> {
        const canonicalUrl = this.normalizeBookmarkUrl(params.url);
        if (!saved) {
            const results = await Promise.all(
                this.bookmarkUrlCandidates(params.url).map((candidate) => bookmarksClient.pageRemove({ url: candidate })),
            );
            const failure = results.find((result) => !result.ok);
            if (failure && !failure.ok) return failure;
            if (this.pageBookmarkUrl && isSamePageUrl(this.pageBookmarkUrl, params.url)) {
                this.pageBookmarkSaved = false;
            }
            await this.refreshAll();
            this.emit();
            return { ok: true, data: { saved: false } };
        }

        const res = await bookmarksClient.pageSave({
            url: canonicalUrl,
            title: params.title,
            platform: params.platform,
            folderPath: params.folderPath ?? this.getDefaultFolderPath(),
            timestamp: Date.now(),
        });
        if (!res.ok) return res;
        if (!this.pageBookmarkUrl || isSamePageUrl(this.pageBookmarkUrl, params.url)) {
            this.pageBookmarkUrl = canonicalUrl;
            this.pageBookmarkSaved = true;
        }
        await this.refreshAll();
        this.emit();
        return { ok: true, data: { saved: true } };
    }

    async toggleBookmarkFromToolbar(params: {
        url: string;
        position: number;
        messageId?: string | null;
        folderPath: string;
        userMessage: string;
        aiResponse: string;
        platform: string;
        title: string;
    }): Promise<Result<{ saved: boolean }>> {
        const positionsRes = await this.readPositionBookmarkStatus(params.url, params.position);
        if (!positionsRes.ok) return positionsRes;
        return this.setPositionBookmarkSaved(params, !positionsRes.data.saved);
    }

    async setPositionBookmarkSaved(params: {
        url: string;
        position: number;
        messageId?: string | null;
        folderPath: string;
        userMessage: string;
        aiResponse: string;
        platform: string;
        title: string;
    }, saved: boolean): Promise<Result<{ saved: boolean }>> {
        const canonicalUrl = this.normalizeBookmarkUrl(params.url);
        if (!saved) {
            const results = await Promise.all(
                this.bookmarkUrlCandidates(params.url).map((candidate) => bookmarksClient.remove({ url: candidate, position: params.position })),
            );
            const failure = results.find((result) => !result.ok);
            if (failure && !failure.ok) return failure;
            if (this.positionsUrl && isSamePageUrl(this.positionsUrl, params.url)) {
                this.positionsForCurrentUrl.delete(params.position);
            }
            this.conversationBookmarksForResolution = null;
            void this.ensureConversationBookmarksForResolution().then(() => this.emit());
            this.emit();
            return { ok: true, data: { saved: false } };
        }

        const res = await bookmarksClient.save({
            url: canonicalUrl,
            position: params.position,
            messageId: params.messageId ?? null,
            userMessage: params.userMessage,
            aiResponse: params.aiResponse,
            title: params.title,
            platform: params.platform,
            folderPath: params.folderPath,
            timestamp: Date.now(),
            options: { saveContextOnly: false },
        });
        if (!res.ok) return res;
        if (this.positionsUrl && isSamePageUrl(this.positionsUrl, params.url)) {
            this.positionsForCurrentUrl.add(params.position);
        }
        this.conversationBookmarksForResolution = null;
        void this.ensureConversationBookmarksForResolution().then(() => this.emit());
        this.emit();
        return { ok: true, data: { saved: true } };
    }
}
