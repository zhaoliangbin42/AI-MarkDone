import type {
    Bookmark,
    BookmarksSortMode,
    Folder,
    ImportParseResult,
    QuarantineEntry,
} from '../../core/bookmarks/types';
import { buildBookmarkStorageKey } from '../../core/bookmarks/keys';
import { buildExportPayload, collectImportFolderPaths, parseImportData } from '../../core/bookmarks/importExport';
import { planImportMerge } from '../../core/bookmarks/merge';
import { PathUtils, PathValidationError } from '../../core/bookmarks/path';
import { buildRepairPlan } from '../../core/bookmarks/repair';
import { canImport as canImportQuota, checkQuota } from '../../core/bookmarks/quota';
import { createOpId, type FolderRelocateJournalV1 } from '../../core/bookmarks/journal';
import { filterBookmarks, sortBookmarks } from '../../core/bookmarks/tree';

const BOOKMARK_KEY_PREFIX = 'bookmark:';
const FOLDER_KEY_PREFIX = 'folder:';
const DEFAULT_FOLDER_PATH = 'Import';
const DEFAULT_PLATFORM = 'ChatGPT';

export type StorageSetPatch = Record<string, unknown>;
export type StorageRemoveKeys = string[];

export type SaveBookmarkInput = {
    url: string;
    position: number;
    userMessage: string;
    aiResponse?: string;
    title?: string;
    platform?: string;
    timestamp?: number;
    folderPath?: string;
};

export type SaveBookmarkPlan = {
    setPatch: Record<string, Bookmark>;
    updatedIndex: string[];
    quota: ReturnType<typeof checkQuota>;
    warnings: string[];
};

export type RemoveBookmarkPlan = {
    removeKeys: string[];
    updatedIndex: string[];
};

export type ListBookmarksResult = {
    bookmarks: Bookmark[];
};

export type ExportBookmarksResult = {
    payload: ReturnType<typeof buildExportPayload>;
};

export type ImportBookmarksPlan = {
    parse: ImportParseResult;
    quota: ReturnType<typeof canImportQuota>;
    foldersToEnsure: string[];
    bookmarksToUpsert: Bookmark[];
    updatedIndex: string[];
    skippedDuplicates: number;
    renamedTitles: Array<{ folderPath: string; from: string; to: string }>;
    warnings: string[];
};

export type CreateFolderPlan = {
    setPatch: Record<string, Folder>;
    updatedFolderPaths: string[];
};

export type DeleteFolderPlan = {
    removeKeys: string[];
    updatedFolderPaths: string[];
};

export type FolderRelocatePlan = {
    journal: FolderRelocateJournalV1;
    folderSetPatch: Record<string, Folder>;
    folderRemoveKeys: string[];
    updatedFolderPaths: string[];
    bookmarkSetPatch: Record<string, Bookmark>;
};

export type RepairPlan = {
    setPatch: Record<string, Bookmark>;
    removeKeys: string[];
    quarantine: QuarantineEntry[];
    updatedIndex: string[] | null;
    stats: ReturnType<typeof buildRepairPlan>['stats'];
};

function truncateContext(text: string): string {
    if (text.length <= 500) return text;
    const front = text.slice(0, 250);
    const back = text.slice(-250);
    return `${front} ... ${back}`;
}

function normalizeFolderPath(folderPath?: string): string {
    const trimmed = (folderPath ?? '').trim();
    if (!trimmed || trimmed === '/') return DEFAULT_FOLDER_PATH;
    return trimmed;
}

export function planSaveBookmark(params: {
    input: SaveBookmarkInput;
    existingIndex: string[];
    now: number;
    usedBytes: number;
    quotaBytes: number;
    saveContextOnly: boolean;
}): SaveBookmarkPlan {
    const warnings: string[] = [];
    const quota = checkQuota({ usedBytes: params.usedBytes, quotaBytes: params.quotaBytes });
    if (!quota.canProceed) {
        warnings.push(quota.message ?? 'Storage quota exceeded');
    }

    const timestamp = params.input.timestamp ?? params.now;
    const platform = (params.input.platform ?? DEFAULT_PLATFORM).trim() || DEFAULT_PLATFORM;

    const title = (params.input.title ?? '').trim()
        ? String(params.input.title).trim()
        : params.input.userMessage.substring(0, 50) + (params.input.userMessage.length > 50 ? '...' : '');

    const folderPath = normalizeFolderPath(params.input.folderPath);

    const finalUserMessage = params.saveContextOnly ? truncateContext(params.input.userMessage) : params.input.userMessage;
    const finalAiResponse = params.saveContextOnly && params.input.aiResponse
        ? truncateContext(params.input.aiResponse)
        : params.input.aiResponse;

    const key = buildBookmarkStorageKey(params.input.url, params.input.position);
    const urlWithoutProtocol = key.slice(BOOKMARK_KEY_PREFIX.length, key.lastIndexOf(':'));

    const bookmark: Bookmark = {
        url: params.input.url,
        urlWithoutProtocol,
        position: params.input.position,
        userMessage: finalUserMessage,
        aiResponse: finalAiResponse,
        timestamp,
        title,
        platform,
        folderPath,
    };

    const updatedIndex = params.existingIndex.includes(key)
        ? [...params.existingIndex]
        : [...params.existingIndex, key];

    return {
        setPatch: { [key]: bookmark },
        updatedIndex,
        quota,
        warnings,
    };
}

export function planRemoveBookmark(params: {
    url: string;
    position: number;
    existingIndex: string[];
}): RemoveBookmarkPlan {
    const key = buildBookmarkStorageKey(params.url, params.position);
    const updatedIndex = params.existingIndex.filter((k) => k !== key);
    return { removeKeys: [key], updatedIndex };
}

export function listBookmarks(params: {
    bookmarks: Bookmark[];
    query?: string;
    platform?: string;
    folderPath?: string;
    recursive?: boolean;
    sortMode?: BookmarksSortMode;
}): ListBookmarksResult {
    let items = params.bookmarks;

    if (params.folderPath) {
        const fp = params.folderPath;
        items = items.filter((b) => {
            if (params.recursive) {
                return b.folderPath === fp || b.folderPath.startsWith(`${fp}/`);
            }
            return b.folderPath === fp;
        });
    }

    items = filterBookmarks({ bookmarks: items, query: params.query, platform: params.platform });
    items = sortBookmarks(items, params.sortMode ?? 'time-desc');
    return { bookmarks: items };
}

export function exportBookmarks(params: {
    bookmarks: Bookmark[];
    preserveStructure: boolean;
}): ExportBookmarksResult {
    return { payload: buildExportPayload(params.bookmarks, params.preserveStructure) };
}

export function planImportBookmarks(params: {
    jsonText: string;
    existing: Bookmark[];
    existingIndex: string[];
    now: number;
    usedBytes: number;
    quotaBytes: number;
    saveContextOnly: boolean;
    maxBookmarks?: number;
}): ImportBookmarksPlan {
    let data: unknown;
    try {
        data = JSON.parse(params.jsonText);
    } catch {
        return {
            parse: { sourceFormat: 'array', bookmarks: [], invalidCount: 0, warnings: ['Invalid JSON'] },
            quota: { canImport: false, estimatedBytes: 0, currentUsed: params.usedBytes, projectedPercentage: 0, message: 'Invalid JSON' },
            foldersToEnsure: [],
            bookmarksToUpsert: [],
            updatedIndex: params.existingIndex,
            skippedDuplicates: 0,
            renamedTitles: [],
            warnings: ['Invalid JSON'],
        };
    }

    const parse = parseImportData(data);
    const warnings = [...parse.warnings];
    const maxBookmarks = params.maxBookmarks ?? 10_000;
    if (parse.bookmarks.length > maxBookmarks) {
        warnings.push(`Too many bookmarks (${parse.bookmarks.length}). Max supported: ${maxBookmarks}.`);
        return {
            parse,
            quota: { canImport: false, estimatedBytes: 0, currentUsed: params.usedBytes, projectedPercentage: 0, message: warnings[warnings.length - 1] },
            foldersToEnsure: [],
            bookmarksToUpsert: [],
            updatedIndex: params.existingIndex,
            skippedDuplicates: 0,
            renamedTitles: [],
            warnings,
        };
    }

    const incoming = params.saveContextOnly
        ? parse.bookmarks.map((b) => ({
            ...b,
            userMessage: truncateContext(b.userMessage),
            aiResponse: b.aiResponse ? truncateContext(b.aiResponse) : undefined,
        }))
        : parse.bookmarks;

    const merge = planImportMerge({
        incoming,
        existing: params.existing,
        importFolderKeys: new Set<string>(),
    });

    const bookmarksToUpsert = merge.accepted.map((b) => ({
        ...b,
        folderPath: normalizeFolderPath(b.folderPath),
        platform: (b.platform || DEFAULT_PLATFORM).trim() || DEFAULT_PLATFORM,
        title: (b.title || '').trim() || 'Untitled',
        timestamp: b.timestamp || params.now,
    }));

    const quota = canImportQuota({
        currentUsedBytes: params.usedBytes,
        incomingBookmarks: bookmarksToUpsert,
        quotaBytes: params.quotaBytes,
    });
    if (!quota.canImport) warnings.push(quota.message ?? 'Not enough storage space');

    const foldersToEnsure = collectImportFolderPaths(bookmarksToUpsert);

    const nextIndex = new Set<string>(params.existingIndex);
    for (const b of bookmarksToUpsert) {
        nextIndex.add(buildBookmarkStorageKey(b.url, b.position));
    }

    return {
        parse,
        quota,
        foldersToEnsure,
        bookmarksToUpsert,
        updatedIndex: Array.from(nextIndex),
        skippedDuplicates: merge.skippedDuplicates,
        renamedTitles: merge.renamed,
        warnings,
    };
}

export function planCreateFolder(params: {
    path: string;
    existingFolders: Folder[];
    folderPaths: string[];
    now: number;
}): CreateFolderPlan {
    PathUtils.validatePath(params.path);
    const normalized = PathUtils.normalize(params.path);
    const depth = PathUtils.getDepth(normalized);

    if (params.folderPaths.includes(normalized)) {
        throw new Error(`Folder already exists: ${normalized}`);
    }

    if (depth > 1) {
        const parentPath = PathUtils.getParentPath(normalized);
        if (parentPath && !params.folderPaths.includes(parentPath)) {
            throw new Error(`Parent folder does not exist: ${parentPath}`);
        }
    }

    const name = PathUtils.getFolderName(normalized);
    const parentPath = PathUtils.getParentPath(normalized);
    const siblingNames = params.existingFolders
        .filter((f) => PathUtils.getParentPath(f.path) === parentPath)
        .map((f) => f.name);
    if (PathUtils.hasNameConflict(name, siblingNames)) {
        throw new Error(`Folder "${name}" already exists at this level`);
    }

    const folder: Folder = {
        path: normalized,
        name,
        depth,
        createdAt: params.now,
        updatedAt: params.now,
    };

    return {
        setPatch: { [`${FOLDER_KEY_PREFIX}${normalized}`]: folder },
        updatedFolderPaths: [...params.folderPaths, normalized],
    };
}

export function planDeleteFolder(params: {
    path: string;
    folderPaths: string[];
    bookmarks: Bookmark[];
}): DeleteFolderPlan {
    const normalized = PathUtils.normalize(params.path);
    if (!params.folderPaths.includes(normalized)) {
        throw new Error(`Folder not found: ${normalized}`);
    }

    const hasChildren = params.folderPaths.some((p) => PathUtils.isDescendantOf(p, normalized));
    const hasBookmarks = params.bookmarks.some((b) => b.folderPath === normalized || PathUtils.isDescendantOf(b.folderPath, normalized));
    if (hasChildren || hasBookmarks) {
        throw new Error('Folder must be empty before deletion');
    }

    return {
        removeKeys: [`${FOLDER_KEY_PREFIX}${normalized}`],
        updatedFolderPaths: params.folderPaths.filter((p) => p !== normalized),
    };
}

export function planFolderRelocate(params: {
    oldPath: string;
    newPath: string;
    folders: Folder[];
    folderPaths: string[];
    bookmarks: Bookmark[];
    now: number;
    opId?: string;
}): FolderRelocatePlan {
    const oldPath = PathUtils.normalize(params.oldPath);
    const newPath = PathUtils.normalize(params.newPath);

    PathUtils.validatePath(newPath);
    if (!params.folderPaths.includes(oldPath)) {
        throw new Error(`Folder not found: ${oldPath}`);
    }

    if (oldPath !== newPath && PathUtils.isDescendantOf(newPath, oldPath)) {
        throw new Error('Cannot move folder into its own descendant');
    }

    const newParentPath = PathUtils.getParentPath(newPath);
    if (newParentPath && !params.folderPaths.includes(newParentPath)) {
        throw new Error(`Parent folder does not exist: ${newParentPath}`);
    }

    const targetName = PathUtils.getFolderName(newPath);
    const parentPath = PathUtils.getParentPath(newPath);
    const siblingNames = params.folders
        .filter((f) => PathUtils.getParentPath(f.path) === parentPath)
        .filter((f) => f.path !== oldPath)
        .map((f) => f.name);
    if (PathUtils.hasNameConflict(targetName, siblingNames)) {
        throw new Error(`Folder "${targetName}" already exists at this level`);
    }

    const opId = params.opId ?? createOpId(params.now);
    const journal: FolderRelocateJournalV1 = {
        v: 1,
        opId,
        type: 'folder_relocate',
        oldPath,
        newPath,
        startedAt: params.now,
    };

    const affectedFolderPaths = params.folderPaths.filter((p) => p === oldPath || p.startsWith(`${oldPath}/`));
    const folderSetPatch: Record<string, Folder> = {};
    const folderRemoveKeys: string[] = [];

    const folderByPath = new Map<string, Folder>();
    for (const f of params.folders) folderByPath.set(f.path, f);

    for (const p of affectedFolderPaths) {
        const existing = folderByPath.get(p);
        if (!existing) continue;
        const updatedPath = PathUtils.updatePathPrefix(oldPath, newPath, existing.path);
        const updated: Folder = {
            ...existing,
            path: updatedPath,
            name: PathUtils.getFolderName(updatedPath),
            depth: PathUtils.getDepth(updatedPath),
            updatedAt: params.now,
        };
        folderSetPatch[`${FOLDER_KEY_PREFIX}${updatedPath}`] = updated;
        if (updatedPath !== existing.path) {
            folderRemoveKeys.push(`${FOLDER_KEY_PREFIX}${existing.path}`);
        }
    }

    const updatedFolderPaths = params.folderPaths.map((p) => PathUtils.updatePathPrefix(oldPath, newPath, p));

    const bookmarkSetPatch: Record<string, Bookmark> = {};
    for (const b of params.bookmarks) {
        if (b.folderPath !== oldPath && !b.folderPath.startsWith(`${oldPath}/`)) continue;
        const updatedFolderPath = PathUtils.updatePathPrefix(oldPath, newPath, b.folderPath);
        const key = `${BOOKMARK_KEY_PREFIX}${b.urlWithoutProtocol}:${b.position}`;
        bookmarkSetPatch[key] = { ...b, folderPath: updatedFolderPath };
    }

    return { journal, folderSetPatch, folderRemoveKeys, updatedFolderPaths, bookmarkSetPatch };
}

export function planRepair(params: {
    rawStorage: Record<string, unknown>;
    existingIndex: string[] | null;
    now: number;
}): RepairPlan {
    const plan = buildRepairPlan({ rawStorage: params.rawStorage, now: params.now, bookmarkKeyPrefix: BOOKMARK_KEY_PREFIX });

    const updatedIndex = params.existingIndex
        ? params.existingIndex.filter((k) => !plan.removeKeys.includes(k))
        : null;

    return {
        setPatch: plan.setPatch,
        removeKeys: plan.removeKeys,
        quarantine: plan.quarantine,
        updatedIndex,
        stats: plan.stats,
    };
}

export function ensurePathOrThrow(path: string): string {
    try {
        PathUtils.validatePath(path);
        return PathUtils.normalize(path);
    } catch (err) {
        if (err instanceof PathValidationError) throw err;
        throw new Error('Invalid path');
    }
}
