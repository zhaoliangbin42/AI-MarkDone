import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../../../contracts/storage';
import { logger } from '../../../core/logger';
import { localStoragePort } from './localStoragePort';

function normalizeIndex(index: string[]): string[] {
    const unique = Array.from(new Set(index.filter((k) => typeof k === 'string' && k.startsWith(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix))));
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return unique;
}

export const bookmarksIndexStore = {
    async loadIndex(): Promise<string[] | null> {
        const result = await localStoragePort.get(STORAGE_KEYS.bookmarksIndexV1);
        const raw = result[STORAGE_KEYS.bookmarksIndexV1];
        if (!Array.isArray(raw)) return null;
        return raw.filter((k) => typeof k === 'string') as string[];
    },

    async setIndex(index: string[], options?: { builtAt?: number }): Promise<void> {
        const patch: Record<string, unknown> = {
            [STORAGE_KEYS.bookmarksIndexV1]: normalizeIndex(index),
        };
        if (typeof options?.builtAt === 'number') {
            patch[STORAGE_KEYS.bookmarksIndexBuiltAt] = options.builtAt;
        }
        await localStoragePort.set(patch);
    },

    async buildIndexIfMissing(now: number): Promise<string[]> {
        const existing = await this.loadIndex();
        if (existing) return normalizeIndex(existing);

        logger.info('[AI-MarkDone][BookmarksIndex] Building bookmarks index from storage...');
        const all = await localStoragePort.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix));
        const normalized = normalizeIndex(keys);
        await this.setIndex(normalized, { builtAt: now });
        logger.info(`[AI-MarkDone][BookmarksIndex] Built index: ${normalized.length} keys`);
        return normalized;
    },
};
