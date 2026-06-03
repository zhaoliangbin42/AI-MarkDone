import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendExtRequestMock = vi.fn(async (req: any) => {
    return { v: 1, id: req.id, ok: true, type: req.type, data: {} };
});

vi.mock('../../../../src/drivers/shared/rpc', () => {
    return { sendExtRequest: (req: any, options?: any) => sendExtRequestMock(req, options) };
});

describe('drivers/shared cloudBackupClient', () => {
    beforeEach(() => {
        sendExtRequestMock.mockClear();
    });

    it('keeps status and diagnostics on the quick RPC timeout', async () => {
        const { cloudBackupClient } = await import('../../../../src/drivers/shared/clients/cloudBackupClient');

        await cloudBackupClient.status('googleDrive');
        await cloudBackupClient.diagnostics('googleDrive');

        expect(sendExtRequestMock.mock.calls.map(([, options]) => options)).toEqual([
            { timeoutMs: 8_000 },
            { timeoutMs: 8_000 },
        ]);
    });

    it('uses operation-specific RPC timeouts for Google Drive backup work', async () => {
        const { cloudBackupClient } = await import('../../../../src/drivers/shared/clients/cloudBackupClient');

        await cloudBackupClient.connect('googleDrive');
        await cloudBackupClient.disconnect('googleDrive');
        await cloudBackupClient.backupNow('googleDrive');
        await cloudBackupClient.listSnapshots('googleDrive');
        await cloudBackupClient.previewRestore({ provider: 'googleDrive', snapshotId: 's1', strategy: 'safeMerge' });
        await cloudBackupClient.applyRestore({ provider: 'googleDrive', snapshotId: 's1', strategy: 'safeMerge' });
        await cloudBackupClient.deleteSnapshot({ provider: 'googleDrive', snapshotId: 's1' });

        expect(sendExtRequestMock.mock.calls.map(([req, options]) => [req.type, options?.timeoutMs])).toEqual([
            ['cloudBackup:connect', 300_000],
            ['cloudBackup:disconnect', 60_000],
            ['cloudBackup:backupNow', 180_000],
            ['cloudBackup:listSnapshots', 60_000],
            ['cloudBackup:previewRestore', 120_000],
            ['cloudBackup:applyRestore', 180_000],
            ['cloudBackup:deleteSnapshot', 60_000],
        ]);
    });
});
