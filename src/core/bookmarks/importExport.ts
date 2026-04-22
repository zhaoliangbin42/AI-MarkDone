import type {
    Bookmark,
    ExportPayloadV2,
    ImportParseResult,
    ImportPayloadV2,
} from './types';
import { normalizeUrlWithoutProtocol } from './keys';
import { PathUtils } from './path';

export const BOOKMARKS_EXPORT_VERSION = '2.0' as const;
export const DEFAULT_FOLDER_PATH = 'Import';
export const DEFAULT_PLATFORM = 'ChatGPT';

export function validateBookmarkLike(value: unknown): value is {
    url: unknown;
    position: unknown;
    messageId?: unknown;
    userMessage: unknown;
    timestamp: unknown;
} {
    if (typeof value !== 'object' || value === null) return false;
    const rec = value as Record<string, unknown>;
    return (
        typeof rec.url === 'string'
        && typeof rec.position === 'number'
        && typeof rec.userMessage === 'string'
        && typeof rec.timestamp === 'number'
    );
}

export function normalizeBookmarkFolderPath(folderPath: unknown): string {
    if (typeof folderPath !== 'string') return DEFAULT_FOLDER_PATH;
    const trimmed = folderPath.trim();
    if (!trimmed || trimmed === '/') return DEFAULT_FOLDER_PATH;
    return trimmed;
}

export function normalizeImportedBookmark(item: unknown): Bookmark | null {
    if (!validateBookmarkLike(item)) return null;
    const rec = item as Record<string, unknown>;

    const url = rec.url as string;
    const position = rec.position as number;
    const userMessage = rec.userMessage as string;
    const timestamp = rec.timestamp as number;
    const messageId = typeof rec.messageId === 'string' && rec.messageId.trim().length > 0
        ? rec.messageId
        : null;

    const aiResponse = typeof rec.aiResponse === 'string' ? rec.aiResponse : undefined;
    const urlWithoutProtocol = typeof rec.urlWithoutProtocol === 'string'
        ? rec.urlWithoutProtocol
        : normalizeUrlWithoutProtocol(url);

    const title = typeof rec.title === 'string' && rec.title.trim().length > 0
        ? rec.title
        : userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');

    const platform = typeof rec.platform === 'string' && rec.platform.trim().length > 0
        ? rec.platform
        : DEFAULT_PLATFORM;

    let folderPath = normalizeBookmarkFolderPath(rec.folderPath);

    try {
        const normalized = PathUtils.normalize(folderPath);
        const depth = PathUtils.getDepth(normalized);
        folderPath = depth > PathUtils.MAX_DEPTH ? DEFAULT_FOLDER_PATH : normalized;
    } catch {
        folderPath = DEFAULT_FOLDER_PATH;
    }

    return {
        url,
        urlWithoutProtocol,
        position,
        messageId,
        userMessage,
        aiResponse,
        timestamp,
        title,
        platform,
        folderPath,
    };
}

export function parseImportData(data: unknown): ImportParseResult {
    const warnings: string[] = [];
    let sourceFormat: ImportParseResult['sourceFormat'];
    let items: unknown[];

    if (Array.isArray(data)) {
        sourceFormat = 'array';
        items = data;
    } else if (data && typeof data === 'object' && Array.isArray((data as ImportPayloadV2).bookmarks)) {
        sourceFormat = 'v2';
        items = (data as ImportPayloadV2).bookmarks;
    } else {
        return { sourceFormat: 'array', bookmarks: [], invalidCount: 0, warnings: ['Invalid import format'] };
    }

    const bookmarks: Bookmark[] = [];
    let invalidCount = 0;

    for (const item of items) {
        const normalized = normalizeImportedBookmark(item);
        if (!normalized) {
            invalidCount += 1;
            continue;
        }
        bookmarks.push(normalized);
    }

    if (invalidCount > 0) warnings.push(`${invalidCount} invalid bookmark(s) skipped`);

    return { sourceFormat, bookmarks, invalidCount, warnings };
}

export function buildExportPayload(bookmarks: Bookmark[], preserveStructure: boolean): ExportPayloadV2 {
    const exportBookmarks = preserveStructure
        ? bookmarks.map((b) => ({ ...b, folderPath: b.folderPath }))
        : bookmarks.map((b) => ({ ...b, folderPath: null }));

    return {
        version: BOOKMARKS_EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        bookmarks: exportBookmarks,
    };
}

export function collectImportFolderPaths(bookmarks: Bookmark[]): string[] {
    const folderPathsNeeded = new Set<string>();

    const addWithAncestors = (rawPath?: string): void => {
        const input = rawPath?.trim() ? rawPath : DEFAULT_FOLDER_PATH;
        let normalized = DEFAULT_FOLDER_PATH;
        try {
            normalized = PathUtils.normalize(input);
        } catch {
            normalized = DEFAULT_FOLDER_PATH;
        }

        const segments = normalized.split('/').filter(Boolean);
        if (segments.length === 0) {
            folderPathsNeeded.add(DEFAULT_FOLDER_PATH);
            return;
        }

        for (let i = 1; i <= Math.min(segments.length, PathUtils.MAX_DEPTH); i += 1) {
            folderPathsNeeded.add(segments.slice(0, i).join('/'));
        }
    };

    bookmarks.forEach((b) => addWithAncestors(b.folderPath));

    return Array.from(folderPathsNeeded).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
}
