import { describe, expect, it } from 'vitest';
import { buildExportPayload } from '../../../../src/core/bookmarks/importExport';
import { buildLibraryRestorePlan, isLibraryBackupPayload } from '../../../../src/core/cloudBackup/library';
import { createLibraryCloudBackupSnapshot, validateCloudBackupSnapshot } from '../../../../src/core/cloudBackup/snapshot';
import type { LibraryExportPayloadV4 } from '../../../../src/core/cloudBackup/types';
import type { ReaderAnnotationRecord } from '../../../../src/contracts/readerAnnotations';

const document = { platform: 'chatgpt' as const, conversationId: 'conversation-1', title: 'Conversation' };
const record: ReaderAnnotationRecord = {
    id: 'mark-1', itemId: 'item-1', target: { assistantMessageId: 'assistant-1' },
    quoteText: 'selected text', sourceMarkdown: 'selected text', comment: 'local note',
    selectors: { textQuote: { exact: 'selected text', prefix: '', suffix: '' }, textPosition: { start: 0, end: 13 }, domRange: null, atomicRefs: [] },
    createdAt: 1, updatedAt: 1, revision: 1, lastKnownAnchorState: 'anchored',
};
const { comment: _comment, lastKnownAnchorState: _anchorState, ...highlightRecord } = record;

function payload(): LibraryExportPayloadV4 {
    return {
        version: '4.0', exportDate: '2026-09-25T00:00:00.000Z',
        bookmarks: buildExportPayload([], true).bookmarks, bookmarkFolders: ['Work'],
        highlights: [{ schemaVersion: 1, document, highlights: [{ ...highlightRecord, color: 'blue' }] }],
        annotations: [{ schemaVersion: 1, document, annotations: [{ ...record }] }],
        markCatalog: {
            schemaVersion: 1, revision: 1,
            folders: [{ id: 'folder-1', parentId: null, name: 'Saved', createdAt: 1, updatedAt: 1 }],
            conversations: [{ document, folderId: 'folder-1', customTitle: 'Research', updatedAt: 1 }],
        },
    };
}

describe('complete Library cloud snapshot', () => {
    it('retains optional text fragments in the snapshot and restore plan without migrating legacy marks', async () => {
        const source = payload();
        source.highlights[0]!.highlights[0]!.fragments = [{ quoteText: 'selected text', selectors: record.selectors }];
        const snapshot = await createLibraryCloudBackupSnapshot(source);
        const restored = await validateCloudBackupSnapshot(JSON.parse(JSON.stringify(snapshot)));
        const plan = buildLibraryRestorePlan(payload(), restored.payload, 'replaceLocal');
        expect(plan.highlightsToWrite[0]!.highlights[0]!.fragments).toEqual(source.highlights[0]!.highlights[0]!.fragments);
        expect(payload().highlights[0]!.highlights[0]!.fragments).toBeUndefined();
    });
    it('validates all Library domains and hashes them as one version 3 payload', async () => {
        const source = payload();
        const snapshot = await createLibraryCloudBackupSnapshot(source, new Date('2026-09-25T00:00:00.000Z'));
        expect(snapshot).toMatchObject({ schemaVersion: 3, kind: 'library' });
        expect(await validateCloudBackupSnapshot(snapshot)).toEqual(snapshot);
        snapshot.payload.annotations[0]!.annotations[0]!.comment = 'tampered';
        await expect(validateCloudBackupSnapshot(snapshot)).rejects.toThrow('INTEGRITY_MISMATCH');
    });

    it('rejects malformed bundles, repeated IDs and broken folder references', () => {
        const malformed = payload();
        malformed.highlights[0]!.highlights.push({ ...malformed.highlights[0]!.highlights[0]! });
        expect(isLibraryBackupPayload(malformed)).toBe(false);
        const broken = payload();
        broken.markCatalog.conversations[0]!.folderId = 'missing';
        expect(isLibraryBackupPayload(broken)).toBe(false);
        const repeated = payload();
        repeated.annotations.push({ ...repeated.annotations[0]! });
        expect(isLibraryBackupPayload(repeated)).toBe(false);
    });

    it('adds remote-only marks while retaining local conflicts and mapping colliding folders', () => {
        const local = payload();
        local.markCatalog.folders[0]!.name = 'Local';
        local.markCatalog.conversations = [];
        const remote = payload();
        remote.highlights[0]!.highlights.push({ ...remote.highlights[0]!.highlights[0]!, id: 'mark-2' });
        remote.annotations[0]!.annotations.push({ ...record, id: 'note-2', comment: 'remote note' });
        remote.annotations[0]!.annotations[0]!.comment = 'remote conflict';

        const plan = buildLibraryRestorePlan(local, remote, 'safeMerge');
        expect(plan.counts.highlights).toMatchObject({ added: 1 });
        expect(plan.counts.annotations).toMatchObject({ added: 1, conflict: 1 });
        expect(plan.annotationsToWrite[0]!.annotations).toHaveLength(2);
        expect(plan.annotationsToWrite[0]!.annotations[0]!.comment).toBe('local note');
        expect(plan.markCatalogToWrite!.folders).toHaveLength(2);
        expect(plan.markCatalogToWrite!.conversations[0]!.folderId).not.toBe('folder-1');
        expect(isLibraryBackupPayload({ ...local, markCatalog: plan.markCatalogToWrite! })).toBe(true);

        const repeated = buildLibraryRestorePlan({ ...local, highlights: plan.highlightsToWrite, annotations: plan.annotationsToWrite, markCatalog: plan.markCatalogToWrite! }, remote, 'safeMerge');
        expect(repeated.counts.folders.added).toBe(0);
        expect(repeated.counts.conversations.added).toBe(0);
    });

    it('plans explicit replacement with exactly the remote marks and catalog', () => {
        const local = payload();
        const remote = payload();
        remote.annotations[0]!.annotations[0]!.comment = 'remote';
        const plan = buildLibraryRestorePlan(local, remote, 'replaceLocal');
        expect(plan.annotationsToWrite[0]!.annotations[0]!.comment).toBe('remote');
        expect(plan.markCatalogToWrite!.revision).toBeGreaterThan(local.markCatalog.revision);
    });
});
