import type {
    CloudBackupBackupNowPayload,
    CloudBackupApplyRestorePayload,
    CloudBackupConnectPayload,
    CloudBackupDeleteSnapshotPayload,
    CloudBackupDiagnosticsPayload,
    CloudBackupDisconnectPayload,
    CloudBackupListSnapshotsPayload,
    CloudBackupPreviewRestorePayload,
    CloudBackupProviderId,
    CloudBackupStatusPayload,
    ExtRequest,
} from '../../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import { requestRuntimeClient, type RuntimeClientResult } from './clientResult';

export type Result<T> = RuntimeClientResult<T>;

export const CLOUD_BACKUP_RPC_TIMEOUT_MS = {
    quick: 8_000,
    connect: 5 * 60_000,
    disconnect: 60_000,
    backupNow: 3 * 60_000,
    listSnapshots: 60_000,
    previewRestore: 2 * 60_000,
    applyRestore: 3 * 60_000,
    deleteSnapshot: 60_000,
} as const;

async function call<T extends ExtRequest['type']>(type: T, payload?: any, timeoutMs: number = CLOUD_BACKUP_RPC_TIMEOUT_MS.quick): Promise<Result<any>> {
    const req: ExtRequest = payload === undefined
        ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
        : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    return requestRuntimeClient(req, { timeoutMs });
}

export const cloudBackupClient = {
    status(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupStatusPayload = { provider };
        return call('cloudBackup:status', payload);
    },
    diagnostics(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupDiagnosticsPayload = { provider };
        return call('cloudBackup:diagnostics', payload);
    },
    connect(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupConnectPayload = { provider };
        return call('cloudBackup:connect', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.connect);
    },
    disconnect(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupDisconnectPayload = { provider };
        return call('cloudBackup:disconnect', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.disconnect);
    },
    backupNow(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupBackupNowPayload = { provider };
        return call('cloudBackup:backupNow', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.backupNow);
    },
    listSnapshots(provider: CloudBackupProviderId): Promise<Result<{ snapshots: any[] }>> {
        const payload: CloudBackupListSnapshotsPayload = { provider };
        return call('cloudBackup:listSnapshots', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.listSnapshots);
    },
    previewRestore(payload: CloudBackupPreviewRestorePayload): Promise<Result<any>> {
        return call('cloudBackup:previewRestore', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.previewRestore);
    },
    applyRestore(payload: CloudBackupApplyRestorePayload): Promise<Result<any>> {
        return call('cloudBackup:applyRestore', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.applyRestore);
    },
    deleteSnapshot(payload: CloudBackupDeleteSnapshotPayload): Promise<Result<any>> {
        return call('cloudBackup:deleteSnapshot', payload, CLOUD_BACKUP_RPC_TIMEOUT_MS.deleteSnapshot);
    },
};
