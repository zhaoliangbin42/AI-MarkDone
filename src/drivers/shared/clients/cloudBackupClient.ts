import type {
    CloudBackupBackupNowPayload,
    CloudBackupConnectPayload,
    CloudBackupDeleteSnapshotPayload,
    CloudBackupDisconnectPayload,
    CloudBackupListSnapshotsPayload,
    CloudBackupPreviewRestorePayload,
    CloudBackupProviderId,
    CloudBackupStatusPayload,
    ExtRequest,
    ProtocolErrorCode,
} from '../../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import { sendExtRequest } from '../rpc';

export type Result<T> = { ok: true; data: T } | { ok: false; errorCode: ProtocolErrorCode; message: string };

function toResult<T>(res: any): Result<T> {
    if (!res || typeof res !== 'object') return { ok: false, errorCode: 'INTERNAL_ERROR', message: 'Invalid response' };
    if (res.ok) return { ok: true, data: (res.data ?? null) as T };
    return {
        ok: false,
        errorCode: (res.error?.code as ProtocolErrorCode | undefined) ?? 'INTERNAL_ERROR',
        message: (res.error?.message as string | undefined) ?? 'Request failed',
    };
}

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest = payload === undefined
        ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
        : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    const res = await sendExtRequest(req as any);
    return toResult(res as any);
}

export const cloudBackupClient = {
    status(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupStatusPayload = { provider };
        return call('cloudBackup:status', payload);
    },
    connect(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupConnectPayload = { provider };
        return call('cloudBackup:connect', payload);
    },
    disconnect(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupDisconnectPayload = { provider };
        return call('cloudBackup:disconnect', payload);
    },
    backupNow(provider: CloudBackupProviderId): Promise<Result<any>> {
        const payload: CloudBackupBackupNowPayload = { provider };
        return call('cloudBackup:backupNow', payload);
    },
    listSnapshots(provider: CloudBackupProviderId): Promise<Result<{ snapshots: any[] }>> {
        const payload: CloudBackupListSnapshotsPayload = { provider };
        return call('cloudBackup:listSnapshots', payload);
    },
    previewRestore(payload: CloudBackupPreviewRestorePayload): Promise<Result<any>> {
        return call('cloudBackup:previewRestore', payload);
    },
    deleteSnapshot(payload: CloudBackupDeleteSnapshotPayload): Promise<Result<any>> {
        return call('cloudBackup:deleteSnapshot', payload);
    },
};
