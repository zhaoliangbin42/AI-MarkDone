import { LEGACY_STORAGE_KEYS } from '../../../contracts/storage';
import { logger } from '../../../core/logger';
import { localStoragePort } from './localStoragePort';

function normalizeFolderPaths(paths: string[]): string[] {
    const unique = Array.from(new Set(paths.filter((p) => typeof p === 'string' && p.trim().length > 0)));
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return unique;
}

export const folderIndexStore = {
    async loadFolderPaths(): Promise<string[]> {
        const result = await localStoragePort.get(LEGACY_STORAGE_KEYS.folderPathsIndex);
        const raw = result[LEGACY_STORAGE_KEYS.folderPathsIndex];
        if (!Array.isArray(raw)) return [];
        return normalizeFolderPaths(raw.filter((p) => typeof p === 'string') as string[]);
    },

    async setFolderPaths(paths: string[]): Promise<void> {
        await localStoragePort.set({ [LEGACY_STORAGE_KEYS.folderPathsIndex]: normalizeFolderPaths(paths) });
    },

    async buildFolderPathsIfMissing(): Promise<string[]> {
        const current = await this.loadFolderPaths();
        if (current.length > 0) return current;

        logger.info('[AI-MarkDone][FolderIndex] Building folderPaths index from folder records...');
        const all = await localStoragePort.get(null);
        const paths = Object.keys(all)
            .filter((k) => k.startsWith(LEGACY_STORAGE_KEYS.folderKeyPrefix))
            .map((k) => k.slice(LEGACY_STORAGE_KEYS.folderKeyPrefix.length))
            .filter(Boolean);

        const normalized = normalizeFolderPaths(paths);
        await this.setFolderPaths(normalized);
        logger.info(`[AI-MarkDone][FolderIndex] Built folderPaths: ${normalized.length} paths`);
        return normalized;
    },
};
