export type BookmarkPlatform = string;

export type BookmarkKind = 'message' | 'page';

export interface Bookmark {
    kind?: BookmarkKind;
    url: string;
    urlWithoutProtocol: string;
    position?: number;
    pageKey?: string;
    messageId?: string | null;
    userMessage?: string;
    aiResponse?: string;
    timestamp: number;
    title: string;
    platform: BookmarkPlatform;
    folderPath: string;
}

export function getBookmarkKind(bookmark: Bookmark): BookmarkKind {
    return bookmark.kind === 'page' ? 'page' : 'message';
}

export function isPageBookmark(bookmark: Bookmark): boolean {
    return getBookmarkKind(bookmark) === 'page';
}

export function isMessageBookmark(bookmark: Bookmark): boolean {
    return getBookmarkKind(bookmark) === 'message';
}

export interface Folder {
    path: string;
    name: string;
    depth: number;
    createdAt: number;
    updatedAt: number;
}

export interface FolderTreeNode {
    folder: Folder;
    children: FolderTreeNode[];
    bookmarks: Bookmark[];
    isExpanded: boolean;
    isSelected: boolean;
}

export type BookmarksSortMode = 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';
export type BookmarksKindFilter = 'all' | 'page' | 'message';

export type ExportBookmark = Omit<Bookmark, 'folderPath'> & { folderPath: string | null };

export type ExportPayloadV2 = {
    version: '2.0';
    exportDate: string;
    bookmarks: ExportBookmark[];
};

export type ImportPayloadV2 = {
    version?: string;
    exportDate?: string;
    bookmarks: unknown[];
};

export type ImportSourceFormat = 'array' | 'v2';

export type ImportParseResult = {
    sourceFormat: ImportSourceFormat;
    bookmarks: Bookmark[];
    invalidCount: number;
    warnings: string[];
};

export type ImportMergeStatus = 'normal' | 'rename' | 'import' | 'duplicate';

export type ImportMergeEntry = {
    bookmark: Bookmark;
    status: ImportMergeStatus;
    renameTo?: string;
    existingTitle?: string;
    existingFolderPath?: string;
};

export type QuotaWarningLevel = 'none' | 'warning' | 'critical';

export type QuotaCheckResult = {
    canProceed: boolean;
    warningLevel: QuotaWarningLevel;
    usedPercentage: number;
    message?: string;
};

export type RepairStats = {
    examined: number;
    repaired: number;
    removed: number;
    quarantined: number;
};

export type QuarantineEntry = {
    originalKey: string;
    rawValue: unknown;
};
