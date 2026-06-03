import type { Bookmark, ExportPayloadV2 } from '../bookmarks/types';

export type CloudBackupSnapshotV1 = {
    schemaVersion: 1;
    app: 'AI-MarkDone';
    kind: 'bookmarks';
    snapshotId: string;
    createdAt: string;
    payloadHash: string;
    payload: ExportPayloadV2;
};

export type CloudBackupSnapshotSummary = {
    snapshotId: string;
    name: string;
    createdAt: string;
    size: number;
};

export type CloudBackupRestorePlan = {
    strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal';
    bookmarksToUpsert: Bookmark[];
    localOnlyCount: number;
    duplicateCount: number;
    conflictCount: number;
    remoteCount: number;
    localCount: number;
};
