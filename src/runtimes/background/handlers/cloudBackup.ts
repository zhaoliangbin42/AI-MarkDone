import type { ExtRequest, ExtResponse, ProtocolErrorCode } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { STORAGE_KEYS } from '../../../contracts/storage';
import { parseImportData } from '../../../core/bookmarks/importExport';
import { buildCloudBackupRestorePlan, createCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import { exportBookmarks } from '../../../services/bookmarks/bookmarksService';
import { cloudBackupQueue } from '../../../drivers/background/cloudBackup/queue';
import { CloudBackupProviderError, type CloudBackupProvider } from '../../../drivers/background/cloudBackup/provider';
import { createGoogleDriveProvider } from '../../../drivers/background/cloudBackup/googleDriveProvider';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import { loadAllBookmarksForBackground } from './bookmarks';

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
    if (message === 'INTEGRITY_MISMATCH') return { code: 'INTEGRITY_MISMATCH', message: 'Cloud backup integrity check failed' };
    if (message === 'SCHEMA_UNSUPPORTED') return { code: 'SCHEMA_UNSUPPORTED', message: 'Cloud backup schema is unsupported' };
    if (message === 'SNAPSHOT_CORRUPTED') return { code: 'SNAPSHOT_CORRUPTED', message: 'Cloud backup snapshot is corrupted' };
    if (message.includes('already running')) return { code: 'CONFLICT', message };
    return { code: 'INTERNAL_ERROR', message };
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

export async function handleCloudBackupRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('cloudBackup:')) return null;
    const payload = 'payload' in request ? request.payload as { provider?: string; snapshotId?: string; strategy?: 'previewOnly' | 'safeMerge' | 'replaceLocal' } : null;
    if (payload?.provider !== 'googleDrive') {
        return { response: err(request.id, request.type, 'PROVIDER_UNAVAILABLE', 'Only Google Drive cloud backup is enabled for this validation build') };
    }

    try {
        switch (request.type) {
            case 'cloudBackup:status':
                return { response: ok(request.id, request.type, await readCloudBackupStatus()) };
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
            case 'cloudBackup:deleteSnapshot':
                await cloudBackupQueue.run(() => providerFactory().deleteSnapshot(payload.snapshotId ?? ''));
                return { response: ok(request.id, request.type, { deleted: true }) };
            default:
                return null;
        }
    } catch (error) {
        const mapped = mapError(error);
        await writeStatus({ ...(await readStatus()), lastError: mapped.message });
        return { response: err(request.id, request.type, mapped.code, mapped.message) };
    }
}
