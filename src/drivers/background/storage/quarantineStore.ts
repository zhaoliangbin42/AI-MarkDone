import { STORAGE_KEYS } from '../../../contracts/storage';
import { localStoragePort } from './localStoragePort';

export type QuarantineRecord = {
    originalKey: string;
    capturedAt: number;
    rawValue: unknown;
};

function createQuarantineKey(now: number): string {
    const rand = Math.random().toString(16).slice(2);
    return `${STORAGE_KEYS.bookmarksQuarantinePrefixV1}${now.toString(16)}_${rand}`;
}

export const quarantineStore = {
    async writeEntries(entries: Array<{ originalKey: string; rawValue: unknown }>, now: number): Promise<number> {
        if (entries.length === 0) return 0;
        const patch: Record<string, unknown> = {};

        for (const entry of entries) {
            const key = createQuarantineKey(now);
            const record: QuarantineRecord = {
                originalKey: entry.originalKey,
                capturedAt: now,
                rawValue: entry.rawValue,
            };
            patch[key] = record;
        }

        await localStoragePort.set(patch);
        return entries.length;
    },
};

