import type { Theme } from '../../../core/types/theme';
import type { Bookmark, Folder, BookmarksSortMode } from '../../../core/bookmarks/types';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { PathUtils } from '../../../core/bookmarks/path';
import { bookmarksClient } from '../../../drivers/shared/clients/bookmarksClient';
import type { Result } from '../../../drivers/shared/clients/bookmarksClient';
import { computeBookmarksPanelViewModel, type BookmarksPanelState, type BookmarksPanelViewModel } from '../../../services/bookmarks/panelModel';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { isSamePageUrl, setPendingNavigation } from '../../../drivers/content/bookmarks/navigation';
import { scrollToConversationTargetWithRetry } from '../../../drivers/content/conversation/navigation';
import { t } from '../components/i18n';

export type BookmarkIdentityKey = string; // `${urlWithoutProtocol}:${position}`

function getBookmarkIdentityKey(b: Bookmark): BookmarkIdentityKey {
    return `${b.urlWithoutProtocol}:${b.position}`;
}

function folderKey(path: string): string {
    return `folder:${path}`;
}

function bookmarkKey(id: BookmarkIdentityKey): string {
    return `bm:${id}`;
}

function parseBookmarkIdentityKey(key: string): BookmarkIdentityKey | null {
    if (!key.startsWith('bm:')) return null;
    return key.slice(3);
}

function formatDate(ts: number): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return String(ts);
    }
}

export type BookmarksPanelSnapshot = {
    vm: BookmarksPanelViewModel;
    folders: Folder[];
    folderPaths: string[];
    selectedKeys: Set<string>;
    previewId: BookmarkIdentityKey | null;
    status: string;
};

export class BookmarksPanelController {
    private adapter: SiteAdapter;
    private theme: Theme = 'light';

    private bookmarks: Bookmark[] = [];
    private folders: Folder[] = [];
    private folderPaths: string[] = [];

    private positionsForCurrentUrl = new Set<number>();
    private positionsUrl: string | null = null;

    private state: BookmarksPanelState = {
        query: '',
        platform: 'All',
        sortMode: 'time-desc',
        selectedFolderPath: null,
        recursive: true,
        expandedPaths: new Set<string>(),
        selectedKeys: new Set<string>(),
    };

    private previewId: BookmarkIdentityKey | null = null;
    private status: string = '';
    private refreshSeq: number = 0;

    private listeners = new Set<(snapshot: BookmarksPanelSnapshot) => void>();

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    getAdapter(): SiteAdapter {
        return this.adapter;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.emit();
    }

    getTheme(): Theme {
        return this.theme;
    }

    subscribe(listener: (snapshot: BookmarksPanelSnapshot) => void): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    getSnapshot(): BookmarksPanelSnapshot {
        const vm = computeBookmarksPanelViewModel({
            folders: this.folders,
            bookmarks: this.bookmarks,
            state: this.state,
        });
        return {
            vm,
            folders: this.folders,
            folderPaths: this.folderPaths,
            selectedKeys: this.state.selectedKeys,
            previewId: this.previewId,
            status: this.status,
        };
    }

    private emit(): void {
        const snap = this.getSnapshot();
        this.listeners.forEach((l) => l(snap));
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
        this.setStatus(t('loading'));
        const [listRes, foldersRes] = await Promise.all([
            bookmarksClient.list({ sortMode: this.state.sortMode }),
            bookmarksClient.foldersList(),
        ]);
        if (seq !== this.refreshSeq) return;

        if (listRes.ok) this.bookmarks = listRes.data.bookmarks;
        if (foldersRes.ok) {
            this.folders = foldersRes.data.folders;
            this.folderPaths = foldersRes.data.folderPaths;
        }

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
        this.emit();
    }

    async refreshPositionsForUrl(url: string): Promise<void> {
        this.positionsUrl = url;
        const res = await bookmarksClient.positions({ url });
        if (res.ok) {
            this.positionsForCurrentUrl = new Set(res.data.positions);
        } else {
            this.positionsForCurrentUrl = new Set();
        }
        this.emit();
    }

    isPositionBookmarked(url: string, position: number): boolean {
        if (!this.positionsUrl || !isSamePageUrl(this.positionsUrl, url)) return false;
        return this.positionsForCurrentUrl.has(position);
    }

    getDefaultFolderPath(): string {
        return this.state.selectedFolderPath || 'Import';
    }

    setQuery(query: string): void {
        this.state.query = query;
        this.emit();
    }

    setPlatform(platform: string): void {
        this.state.platform = platform;
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
        const keys = this.getDescendantKeysForFolder(path);
        if (keys.length === 0) {
            return {
                checked: this.state.selectedKeys.has(folderKey(path)),
                indeterminate: false,
            };
        }
        let selected = 0;
        for (const k of keys) if (this.state.selectedKeys.has(k)) selected += 1;
        if (selected === 0) return { checked: false, indeterminate: false };
        if (selected === keys.length) return { checked: true, indeterminate: false };
        return { checked: false, indeterminate: true };
    }

    toggleFolderSelection(path: string): void {
        const key = folderKey(path);
        const descendants = this.getDescendantKeysForFolder(path);
        const allKeys = [key, ...descendants];
        const anySelected = allKeys.some((k) => this.state.selectedKeys.has(k));
        if (anySelected) {
            allKeys.forEach((k) => this.state.selectedKeys.delete(k));
        } else {
            allKeys.forEach((k) => this.state.selectedKeys.add(k));
        }
        this.emit();
    }

    toggleBookmarkSelection(bookmark: Bookmark): void {
        const id = getBookmarkIdentityKey(bookmark);
        const key = bookmarkKey(id);
        if (this.state.selectedKeys.has(key)) this.state.selectedKeys.delete(key);
        else this.state.selectedKeys.add(key);
        this.emit();
    }

    clearSelection(): void {
        this.state.selectedKeys.clear();
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
        const text = bookmark.aiResponse ?? '';
        const ok = await copyTextToClipboard(text);
        this.setStatus(ok ? t('btnCopied') : t('copyFailed'));
    }

    async deleteBookmark(bookmark: Bookmark): Promise<void> {
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
        const items = this.getSelectedBookmarkItems();
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
        const items = this.getSelectedBookmarkItems();
        const res = await bookmarksClient.bulkRemove({ items });
        if (res.ok) {
            await this.refreshAll();
            this.clearSelection();
        }
        return res;
    }

    async batchMove(targetFolderPath: string): Promise<Result<any>> {
        const items = this.getSelectedBookmarkItems();
        const res = await bookmarksClient.bulkMove({ items, targetFolderPath });
        if (res.ok) {
            await this.refreshAll();
            this.clearSelection();
        }
        return res;
    }

    async moveBookmark(bookmark: Bookmark, targetFolderPath: string): Promise<Result<any>> {
        const res = await bookmarksClient.bulkMove({
            items: [{ url: bookmark.url, position: bookmark.position }],
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
        if (isSamePageUrl(current, target)) {
            this.setStatus('Navigating…');
            await scrollToConversationTargetWithRetry(
                this.adapter,
                { kind: 'legacyAssistantPosition', position: bookmark.position },
                { timeoutMs: 2000, intervalMs: 200 }
            );
            return;
        }
        setPendingNavigation({ url: target, position: bookmark.position });
        window.location.href = target;
    }

    getSelectedBookmarkItems(): Array<{ url: string; position: number }> {
        const ids = new Set<BookmarkIdentityKey>();
        for (const key of this.state.selectedKeys) {
            const id = parseBookmarkIdentityKey(key);
            if (id) ids.add(id);
        }

        const items: Array<{ url: string; position: number }> = [];
        for (const id of ids) {
            const bm = this.getBookmarkById(id);
            if (bm) items.push({ url: bm.url, position: bm.position });
        }
        return items;
    }

    getPlatforms(): string[] {
        const set = new Set<string>();
        this.bookmarks.forEach((b) => set.add(b.platform || 'ChatGPT'));
        return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
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
        return `${bookmark.platform} · ${bookmark.folderPath} · ${formatDate(bookmark.timestamp)}`;
    }

    private getDescendantKeysForFolder(path: string): string[] {
        const normalized = PathUtils.normalize(path);
        const keys: string[] = [];

        for (const f of this.folders) {
            if (f.path === normalized) continue;
            if (PathUtils.isDescendantOf(f.path, normalized)) keys.push(folderKey(f.path));
        }

        for (const b of this.bookmarks) {
            if (b.folderPath === normalized || PathUtils.isDescendantOf(b.folderPath, normalized)) {
                keys.push(bookmarkKey(getBookmarkIdentityKey(b)));
            }
        }

        return keys;
    }

    async toggleBookmarkFromToolbar(params: {
        url: string;
        position: number;
        folderPath: string;
        userMessage: string;
        aiResponse: string;
        platform: string;
        title: string;
    }): Promise<Result<{ saved: boolean }>> {
        const isBookmarked = this.isPositionBookmarked(params.url, params.position);
        if (isBookmarked) {
            const res = await bookmarksClient.remove({ url: params.url, position: params.position });
            if (!res.ok) return res;
            this.positionsForCurrentUrl.delete(params.position);
            this.emit();
            return { ok: true, data: { saved: false } };
        }

        const res = await bookmarksClient.save({
            url: params.url,
            position: params.position,
            userMessage: params.userMessage,
            aiResponse: params.aiResponse,
            title: params.title,
            platform: params.platform,
            folderPath: params.folderPath,
            timestamp: Date.now(),
            options: { saveContextOnly: false },
        });
        if (!res.ok) return res;
        this.positionsForCurrentUrl.add(params.position);
        this.emit();
        return { ok: true, data: { saved: true } };
    }
}
