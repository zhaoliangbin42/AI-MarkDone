import { describe, expect, it } from 'vitest';
import type { Bookmark } from '../../../../src/core/bookmarks/types';
import { buildCloudBackupRestorePlan } from '../../../../src/core/cloudBackup/snapshot';

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
    return {
        url: 'https://chatgpt.com/c/1',
        urlWithoutProtocol: 'chatgpt.com/c/1',
        position: 1,
        messageId: null,
        userMessage: 'hello',
        aiResponse: 'world',
        timestamp: 1,
        title: 'Hello',
        platform: 'ChatGPT',
        folderPath: 'Import',
        ...overrides,
    };
}

describe('cloud backup restore plan', () => {
    it('plans a first-device restore as additions only when local data is empty', () => {
        const plan = buildCloudBackupRestorePlan({
            localBookmarks: [],
            remoteBookmarks: [
                bookmark({ position: 1 }),
                bookmark({ url: 'https://chatgpt.com/c/2', urlWithoutProtocol: 'chatgpt.com/c/2', position: 2 }),
            ],
            strategy: 'safeMerge',
        });

        expect(plan).toMatchObject({
            strategy: 'safeMerge',
            localCount: 0,
            remoteCount: 2,
            localOnlyCount: 0,
            duplicateCount: 0,
            conflictCount: 0,
        });
        expect(plan.bookmarksToUpsert).toHaveLength(2);
    });

    it('keeps local data for conflicts during safe merge', () => {
        const local = [
            bookmark({ position: 1, title: 'Local' }),
            bookmark({ url: 'https://chatgpt.com/c/local-only', urlWithoutProtocol: 'chatgpt.com/c/local-only', position: 3 }),
        ];
        const remote = [
            bookmark({ position: 1, title: 'Remote' }),
            bookmark({ url: 'https://chatgpt.com/c/remote-only', urlWithoutProtocol: 'chatgpt.com/c/remote-only', position: 2 }),
        ];

        const plan = buildCloudBackupRestorePlan({ localBookmarks: local, remoteBookmarks: remote, strategy: 'safeMerge' });

        expect(plan.bookmarksToUpsert).toEqual([remote[1]]);
        expect(plan.conflictCount).toBe(1);
        expect(plan.localOnlyCount).toBe(1);
        expect(plan.bookmarksToUpsert).toEqual([remote[1]]);
    });

    it('plans replaceLocal by upserting the full remote snapshot without conflict merging', () => {
        const local = [
            bookmark({ position: 1, title: 'Local' }),
            bookmark({ url: 'https://chatgpt.com/c/local-only', urlWithoutProtocol: 'chatgpt.com/c/local-only', position: 3 }),
        ];
        const remote = [
            bookmark({ position: 1, title: 'Remote' }),
            bookmark({ url: 'https://chatgpt.com/c/remote-only', urlWithoutProtocol: 'chatgpt.com/c/remote-only', position: 2 }),
        ];

        const plan = buildCloudBackupRestorePlan({ localBookmarks: local, remoteBookmarks: remote, strategy: 'replaceLocal' });

        expect(plan.strategy).toBe('replaceLocal');
        expect(plan.bookmarksToUpsert).toEqual(remote);
        expect(plan.localCount).toBe(2);
        expect(plan.remoteCount).toBe(2);
        expect(plan.conflictCount).toBe(0);
    });
});
