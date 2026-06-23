import type { Bookmark, ExportPayloadV2 } from '../bookmarks/types';
import { parseImportData } from '../bookmarks/importExport';
import { buildBookmarkStorageKeyForBookmark } from '../bookmarks/keys';
import type { CloudBackupRestorePlan, CloudBackupSnapshotV1 } from './types';

function canonicalJson(value: unknown): string {
    return JSON.stringify(value);
}

function toHex(bytes: ArrayBuffer): string {
    return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashCloudBackupPayload(payload: ExportPayloadV2): Promise<string> {
    const bytes = new TextEncoder().encode(canonicalJson(payload));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${toHex(digest)}`;
}

export async function createCloudBackupSnapshot(payload: ExportPayloadV2, now = new Date()): Promise<CloudBackupSnapshotV1> {
    const snapshotId = crypto.randomUUID?.() ?? `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
    return {
        schemaVersion: 1,
        app: 'AI-MarkDone',
        kind: 'bookmarks',
        snapshotId,
        createdAt: now.toISOString(),
        payloadHash: await hashCloudBackupPayload(payload),
        payload,
    };
}

export async function validateCloudBackupSnapshot(value: unknown): Promise<CloudBackupSnapshotV1> {
    if (!value || typeof value !== 'object') {
        throw new Error('SNAPSHOT_CORRUPTED');
    }
    const rec = value as Record<string, unknown>;
    if (rec.schemaVersion !== 1 || rec.app !== 'AI-MarkDone' || rec.kind !== 'bookmarks') {
        throw new Error('SCHEMA_UNSUPPORTED');
    }
    if (typeof rec.snapshotId !== 'string' || typeof rec.createdAt !== 'string' || typeof rec.payloadHash !== 'string') {
        throw new Error('SNAPSHOT_CORRUPTED');
    }
    const parse = parseImportData(rec.payload);
    if (parse.sourceFormat !== 'v2' || parse.invalidCount > 0) {
        throw new Error('SNAPSHOT_CORRUPTED');
    }
    const payload = rec.payload as ExportPayloadV2;
    const expectedHash = await hashCloudBackupPayload(payload);
    if (expectedHash !== rec.payloadHash) {
        throw new Error('INTEGRITY_MISMATCH');
    }
    return rec as CloudBackupSnapshotV1;
}

function keyOf(bookmark: Bookmark): string {
    return buildBookmarkStorageKeyForBookmark(bookmark);
}

function sameBookmark(a: Bookmark, b: Bookmark): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function buildCloudBackupRestorePlan(params: {
    localBookmarks: Bookmark[];
    remoteBookmarks: Bookmark[];
    strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal';
}): CloudBackupRestorePlan {
    if (params.strategy === 'replaceLocal') {
        return {
            strategy: params.strategy,
            bookmarksToUpsert: [...params.remoteBookmarks],
            localOnlyCount: 0,
            duplicateCount: 0,
            conflictCount: 0,
            remoteCount: params.remoteBookmarks.length,
            localCount: params.localBookmarks.length,
        };
    }

    const localByKey = new Map(params.localBookmarks.map((bookmark) => [keyOf(bookmark), bookmark]));
    const remoteKeySet = new Set<string>();
    const bookmarksToUpsert: Bookmark[] = [];
    let duplicateCount = 0;
    let conflictCount = 0;

    for (const bookmark of params.remoteBookmarks) {
        const key = keyOf(bookmark);
        remoteKeySet.add(key);
        const local = localByKey.get(key);
        if (!local) {
            bookmarksToUpsert.push(bookmark);
        } else if (sameBookmark(local, bookmark)) {
            duplicateCount += 1;
        } else {
            conflictCount += 1;
        }
    }

    const localOnlyCount = params.localBookmarks.filter((bookmark) => !remoteKeySet.has(keyOf(bookmark))).length;
    return {
        strategy: params.strategy,
        bookmarksToUpsert,
        localOnlyCount,
        duplicateCount,
        conflictCount,
        remoteCount: params.remoteBookmarks.length,
        localCount: params.localBookmarks.length,
    };
}
