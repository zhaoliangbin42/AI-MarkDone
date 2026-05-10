import type { Bookmark } from '../../core/bookmarks/types';
import { parseImportData } from '../../core/bookmarks/importExport';
import { exportBookmarks } from '../bookmarks/bookmarksService';
import { buildCloudBackupRestorePlan, createCloudBackupSnapshot as buildSnapshot, validateCloudBackupSnapshot } from '../../core/cloudBackup/snapshot';
import type { CloudBackupSnapshotV1 } from '../../core/cloudBackup/types';
import type { CloudBackupRestoreStrategy } from '../../contracts/protocol';

export type CreateCloudBackupSnapshotParams = {
    bookmarks: Bookmark[];
    now?: Date;
};

export function createCloudBackupSnapshot(params: CreateCloudBackupSnapshotParams): Promise<CloudBackupSnapshotV1> {
    const { payload } = exportBookmarks({
        bookmarks: params.bookmarks,
        preserveStructure: true,
    });
    return buildSnapshot(payload, params.now);
}

export async function validateCloudBackupSnapshotForRestore(snapshot: unknown): Promise<CloudBackupSnapshotV1> {
    return validateCloudBackupSnapshot(snapshot);
}

export function previewCloudBackupRestore(params: {
    snapshot: CloudBackupSnapshotV1;
    localBookmarks: Bookmark[];
    strategy?: CloudBackupRestoreStrategy;
}) {
    const parse = parseImportData(params.snapshot.payload);
    return {
        parse,
        plan: buildCloudBackupRestorePlan({
            localBookmarks: params.localBookmarks,
            remoteBookmarks: parse.bookmarks,
            strategy: params.strategy ?? 'safeMerge',
        }),
    };
}
