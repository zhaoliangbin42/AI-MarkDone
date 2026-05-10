import { describe, expect, it } from 'vitest';
import type { Bookmark } from '../../../../src/core/bookmarks/types';
import { buildExportPayload } from '../../../../src/core/bookmarks/importExport';
import { createCloudBackupSnapshot, validateCloudBackupSnapshot } from '../../../../src/core/cloudBackup/snapshot';

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

describe('cloud backup snapshot', () => {
    it('wraps the existing bookmarks export payload with a verifiable hash', async () => {
        const payload = buildExportPayload([bookmark()], true);
        const snapshot = await createCloudBackupSnapshot(payload, new Date('2026-05-08T12:00:00.000Z'));

        expect(snapshot.schemaVersion).toBe(1);
        expect(snapshot.app).toBe('AI-MarkDone');
        expect(snapshot.kind).toBe('bookmarks');
        expect(snapshot.payload.version).toBe('2.0');
        expect(snapshot.payloadHash).toMatch(/^sha256:/);

        const result = await validateCloudBackupSnapshot(snapshot);
        expect(result.snapshotId).toBe(snapshot.snapshotId);
    });

    it('rejects snapshots when the payload hash no longer matches', async () => {
        const payload = buildExportPayload([bookmark()], true);
        const snapshot = await createCloudBackupSnapshot(payload, new Date('2026-05-08T12:00:00.000Z'));
        snapshot.payload.bookmarks[0]!.title = 'Tampered';

        await expect(validateCloudBackupSnapshot(snapshot)).rejects.toThrow('INTEGRITY_MISMATCH');
    });
});
