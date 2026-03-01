import { STORAGE_KEYS } from '../../../contracts/storage';
import type { BookmarksJournalRecord } from '../../../core/bookmarks/journal';
import { localStoragePort } from './localStoragePort';

export const journalStore = {
    async getJournal(): Promise<BookmarksJournalRecord | null> {
        const result = await localStoragePort.get(STORAGE_KEYS.bookmarksJournalV1);
        const raw = result[STORAGE_KEYS.bookmarksJournalV1];
        if (!raw || typeof raw !== 'object') return null;
        return raw as BookmarksJournalRecord;
    },

    async setJournal(record: BookmarksJournalRecord): Promise<void> {
        await localStoragePort.set({ [STORAGE_KEYS.bookmarksJournalV1]: record as any });
    },

    async clearJournal(): Promise<void> {
        await localStoragePort.remove(STORAGE_KEYS.bookmarksJournalV1);
    },
};

