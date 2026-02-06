import type { Bookmark } from '../storage/types';
import type { Folder } from '../storage/types';
import { PathUtils } from './path-utils';

/**
 * Collect unique folder paths required for import, including all ancestor folders.
 *
 * Example:
 * - Input bookmark folderPath: "Work/AI"
 * - Output includes: "Work", "Work/AI"
 */
export function collectImportFolderPaths(bookmarks: Bookmark[]): string[] {
    const folderPathsNeeded = new Set<string>();

    const addWithAncestors = (rawPath?: string): void => {
        const fallback = 'Import';
        const input = rawPath?.trim() ? rawPath : fallback;

        let normalized = fallback;
        try {
            normalized = PathUtils.normalize(input);
        } catch {
            normalized = fallback;
        }

        const segments = normalized.split('/').filter(Boolean);
        if (segments.length === 0) {
            folderPathsNeeded.add(fallback);
            return;
        }

        // Add each ancestor from root to leaf (depth-first creation order support).
        for (let i = 1; i <= Math.min(segments.length, PathUtils.MAX_DEPTH); i++) {
            folderPathsNeeded.add(segments.slice(0, i).join('/'));
        }
    };

    bookmarks.forEach((bookmark) => addWithAncestors(bookmark.folderPath));

    return Array.from(folderPathsNeeded).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
}

/**
 * Calculate which folder paths should exist for the given bookmarks but are currently missing.
 */
export function findMissingFolderPaths(bookmarks: Bookmark[], existingFolders: Folder[]): string[] {
    const required = collectImportFolderPaths(bookmarks);
    const existing = new Set(existingFolders.map((f) => f.path));
    return required.filter((path) => !existing.has(path));
}
