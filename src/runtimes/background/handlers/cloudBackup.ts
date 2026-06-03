import type { ExtRequest, ExtResponse, ProtocolErrorCode } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import { parseImportData } from '../../../core/bookmarks/importExport';
import { buildBookmarkStorageKey } from '../../../core/bookmarks/keys';
import { buildCloudBackupRestorePlan, createCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import { exportBookmarks, planImportBookmarks } from '../../../services/bookmarks/bookmarksService';
import { cloudBackupQueue } from '../../../drivers/background/cloudBackup/queue';
import { CloudBackupProviderError, type CloudBackupProvider } from '../../../drivers/background/cloudBackup/provider';
import { createGoogleDriveProvider } from '../../../drivers/background/cloudBackup/googleDriveProvider';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { bookmarksIndexStore } from '../../../drivers/background/storage/bookmarksIndexStore';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import {
    ensureFolderRecordsExistForBackground,
    loadAllBookmarksForBackground,
    loadAllFoldersForBackground,
} from './bookmarks';

type HandlerResult = { response: ExtResponse };

let providerFactory: () => CloudBackupProvider = createGoogleDriveProvider;

export function setCloudBackupProviderFactoryForTests(factory: () => CloudBackupProvider): void {
    providerFactory = factory;
}

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: false, type, error: { code, message } };
}

function mapError(error: unknown): { code: ProtocolErrorCode; message: string } {
    if (error instanceof CloudBackupProviderError) {
        return { code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'INTEGRITY_MISMATCH') return { code: 'INTEGRITY_MISMATCH', message: 'Google Drive backup integrity check failed' };
    if (message === 'SCHEMA_UNSUPPORTED') return { code: 'SCHEMA_UNSUPPORTED', message: 'Google Drive backup schema is unsupported' };
    if (message === 'SNAPSHOT_CORRUPTED') return { code: 'SNAPSHOT_CORRUPTED', message: 'Google Drive backup snapshot is corrupted' };
    if (message.includes('already running')) return { code: 'CONFLICT', message };
    return { code: 'INTERNAL_ERROR', message };
}

function getQuotaBytesFallback(): number {
    const chromeAny = (globalThis as any).chrome;
    const quota = chromeAny?.storage?.local?.QUOTA_BYTES;
    if (typeof quota === 'number' && quota > 0) return quota;
    return 10 * 1024 * 1024;
}

async function writeStatus(data: Record<string, unknown>): Promise<void> {
    await localStoragePort.set({ [STORAGE_KEYS.cloudBackupStatusGoogleDriveV1]: data });
}

async function readStatus(): Promise<Record<string, unknown>> {
    const raw = await localStoragePort.get([STORAGE_KEYS.cloudBackupStatusGoogleDriveV1]);
    const value = raw[STORAGE_KEYS.cloudBackupStatusGoogleDriveV1];
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function isStaleBuildConfigurationError(value: unknown): boolean {
    return typeof value === 'string'
        && (
            value.includes('Google Drive backup is not configured in this build')
            || value.includes('Google Drive backup is only available in a Chrome build with the identity permission')
            || value.includes('Google Drive backup is missing the Chrome manifest OAuth client ID')
        );
}

async function readCloudBackupStatus(): Promise<Record<string, unknown>> {
    const stored = await readStatus();
    const configuration = providerFactory().getConfigurationStatus?.();
    if (!configuration || configuration.configured) {
        return {
            ...stored,
            configured: true,
            lastError: isStaleBuildConfigurationError(stored.lastError) ? null : stored.lastError,
        };
    }
    return {
        ...stored,
        configured: false,
        connected: false,
        lastError: configuration.message,
    };
}

async function backupNow() {
    const bookmarks = await backgroundStorageQueue.enqueue(() => loadAllBookmarksForBackground(Date.now()));
    const payload = exportBookmarks({ bookmarks, preserveStructure: true }).payload;
    const snapshot = await createCloudBackupSnapshot(payload);
    const summary = await providerFactory().uploadSnapshot(snapshot);
    await writeStatus({
        connected: true,
        lastBackupAt: new Date().toISOString(),
        lastSnapshotId: summary.snapshotId,
        lastError: null,
    });
    return { summary, bookmarkCount: bookmarks.length, payloadHash: snapshot.payloadHash };
}

async function previewRestore(snapshotId: string, strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal') {
    const snapshot = await providerFactory().downloadSnapshot(snapshotId);
    const parse = parseImportData(snapshot.payload);
    const localBookmarks = await loadAllBookmarksForBackground(Date.now());
    return {
        snapshot: {
            snapshotId: snapshot.snapshotId,
            createdAt: snapshot.createdAt,
            payloadHash: snapshot.payloadHash,
        },
        plan: buildCloudBackupRestorePlan({
            localBookmarks,
            remoteBookmarks: parse.bookmarks,
            strategy,
        }),
    };
}

async function applyRestore(snapshotId: string, strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal') {
    if (strategy !== 'safeMerge') {
        throw new CloudBackupProviderError('INVALID_REQUEST', 'Google Drive backup v1 only supports safe-merge restore');
    }
    const snapshot = await providerFactory().downloadSnapshot(snapshotId);
    const parse = parseImportData(snapshot.payload);
    return backgroundStorageQueue.enqueue(async () => {
        const now = Date.now();
        const existingIndex = await bookmarksIndexStore.buildIndexIfMissing(now);
        const localBookmarks = await loadAllBookmarksForBackground(now);
        const restorePlan = buildCloudBackupRestorePlan({
            localBookmarks,
            remoteBookmarks: parse.bookmarks,
            strategy: 'safeMerge',
        });
        const emergencyPayload = exportBookmarks({ bookmarks: localBookmarks, preserveStructure: true }).payload;
        const emergencySnapshot = await createCloudBackupSnapshot(emergencyPayload);
        const emergencySnapshotKey = `aimd:cloud_backup:emergency_restore:googleDrive:v1:${now}`;
        const usedBytes = await localStoragePort.getBytesInUse(null);
        const importPlan = planImportBookmarks({
            jsonText: JSON.stringify({
                ...snapshot.payload,
                bookmarks: restorePlan.bookmarksToUpsert,
            }),
            existing: localBookmarks,
            existingIndex,
            now,
            usedBytes,
            quotaBytes: getQuotaBytesFallback(),
            saveContextOnly: false,
        });
        if (!importPlan.quota.canImport) {
            throw new CloudBackupProviderError('QUOTA_EXCEEDED', importPlan.quota.message || 'Not enough storage space for Google Drive restore');
        }

        const { folderPaths, folders } = await loadAllFoldersForBackground();
        const ensure = await ensureFolderRecordsExistForBackground({
            requiredPaths: importPlan.foldersToEnsure,
            folderPaths,
            folders,
            now,
        });

        let bookmarksToUpsert = importPlan.bookmarksToUpsert;
        if (ensure.failedPaths.length > 0) {
            const failedPrefixes = ensure.failedPaths.map((p) => `${p}/`);
            bookmarksToUpsert = bookmarksToUpsert.map((bookmark) => {
                const affected = ensure.failedPaths.includes(bookmark.folderPath)
                    || failedPrefixes.some((prefix) => bookmark.folderPath.startsWith(prefix));
                return affected ? { ...bookmark, folderPath: 'Import' } : bookmark;
            });
        }

        const bookmarkPatch: Record<string, unknown> = {};
        for (const bookmark of bookmarksToUpsert) {
            bookmarkPatch[buildBookmarkStorageKey(bookmark.url, bookmark.position)] = bookmark;
        }

        await localStoragePort.set({
            [emergencySnapshotKey]: {
                createdAt: new Date(now).toISOString(),
                sourceSnapshotId: snapshot.snapshotId,
                snapshot: emergencySnapshot,
            },
            ...ensure.folderSetPatch,
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: ensure.updatedFolderPaths,
            ...bookmarkPatch,
            [STORAGE_KEYS.bookmarksIndexV1]: importPlan.updatedIndex,
        });

        return {
            restored: bookmarksToUpsert.length,
            skippedDuplicates: restorePlan.duplicateCount,
            conflicts: restorePlan.conflictCount,
            localOnly: restorePlan.localOnlyCount,
            emergencySnapshotKey,
            folderCreateFailures: ensure.failedPaths.length,
        };
    });
}

export async function handleCloudBackupRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('cloudBackup:')) return null;
    const payload = 'payload' in request ? request.payload as { provider?: string; snapshotId?: string; strategy?: 'previewOnly' | 'safeMerge' | 'replaceLocal' } : null;
    if (payload?.provider !== 'googleDrive') {
        return { response: err(request.id, request.type, 'PROVIDER_UNAVAILABLE', 'Only Google Drive backup is enabled for this validation build') };
    }

    try {
        switch (request.type) {
            case 'cloudBackup:status':
                return { response: ok(request.id, request.type, await readCloudBackupStatus()) };
            case 'cloudBackup:diagnostics': {
                const diagnostics = providerFactory().getDiagnostics?.();
                if (!diagnostics) {
                    throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive backup diagnostics are unavailable in this build');
                }
                return { response: ok(request.id, request.type, diagnostics) };
            }
            case 'cloudBackup:connect': {
                const result = await providerFactory().connect();
                await writeStatus({ connected: true, lastError: null, ...result });
                return { response: ok(request.id, request.type, await readStatus()) };
            }
            case 'cloudBackup:disconnect':
                await providerFactory().disconnect();
                await writeStatus({ connected: false, lastError: null });
                return { response: ok(request.id, request.type, await readStatus()) };
            case 'cloudBackup:backupNow':
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(backupNow)) };
            case 'cloudBackup:listSnapshots':
                return { response: ok(request.id, request.type, { snapshots: await cloudBackupQueue.run(() => providerFactory().listSnapshots()) }) };
            case 'cloudBackup:previewRestore':
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(() => previewRestore(payload.snapshotId ?? '', payload.strategy ?? 'safeMerge'))) };
            case 'cloudBackup:applyRestore':
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(() => applyRestore(payload.snapshotId ?? '', payload.strategy ?? 'safeMerge'))) };
            case 'cloudBackup:deleteSnapshot':
                await cloudBackupQueue.run(() => providerFactory().deleteSnapshot(payload.snapshotId ?? ''));
                return { response: ok(request.id, request.type, { trashed: true }) };
            default:
                return null;
        }
    } catch (error) {
        const mapped = mapError(error);
        await writeStatus({ ...(await readStatus()), lastError: mapped.message });
        return { response: err(request.id, request.type, mapped.code, mapped.message) };
    }
}
