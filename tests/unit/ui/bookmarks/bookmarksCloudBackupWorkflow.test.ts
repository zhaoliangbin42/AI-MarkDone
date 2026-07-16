import { describe, expect, it, vi } from 'vitest';
import { BookmarksCloudBackupWorkflow } from '@/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow';

describe('BookmarksCloudBackupWorkflow', () => {
    it('concentrates Settings cloud status and connection behavior behind one workflow interface', async () => {
        const client = {
            status: vi.fn(async () => ({ ok: true, data: { connected: true } })),
            connect: vi.fn(async () => ({ ok: true, data: { connected: true } })),
            disconnect: vi.fn(async () => ({ ok: true, data: { connected: false } })),
        };
        const modal = {
            confirm: vi.fn(async () => true),
            alert: vi.fn(async () => undefined),
        };
        const workflow = new BookmarksCloudBackupWorkflow({
            getModalHost: () => modal as any,
            client: client as any,
        });
        const actions = workflow.createSettingsActions();

        await expect(actions.status('googleDrive')).resolves.toEqual({ connected: true });
        await expect(actions.connect('googleDrive')).resolves.toEqual({ connected: true });
        await expect(actions.disconnect('googleDrive')).resolves.toEqual({ connected: false });
        expect(modal.confirm).toHaveBeenCalledTimes(1);
        expect(client.connect).toHaveBeenCalledWith('googleDrive');
        expect(client.disconnect).toHaveBeenCalledWith('googleDrive');
    });

    it('keeps restore as one safe-merge workflow from snapshot choice through explicit confirmation', async () => {
        const client = {
            listSnapshots: vi.fn(async () => ({
                ok: true,
                data: {
                    snapshots: [{ snapshotId: 'snapshot-1', name: 'backup.json', createdAt: '2026-07-15T00:00:00.000Z', size: 256 }],
                },
            })),
            previewRestore: vi.fn(async () => ({
                ok: true,
                data: { plan: { bookmarksToUpsert: [], duplicateCount: 0, localOnlyCount: 0, conflictCount: 0 } },
            })),
            applyRestore: vi.fn(async () => ({
                ok: true,
                data: { restored: 0, localOnly: 0, skippedDuplicates: 0, conflicts: 0 },
            })),
        };
        const modal = {
            showCustom: vi.fn(async (options: any) => {
                if (!options.footer) return;
                const footer = document.createElement('footer');
                options.footer(footer, vi.fn());
                footer.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
            }),
            alert: vi.fn(async () => undefined),
        };
        const workflow = new BookmarksCloudBackupWorkflow({
            getModalHost: () => modal as any,
            client: client as any,
        });

        await workflow.createSettingsActions().restore?.('googleDrive');

        expect(client.previewRestore).toHaveBeenCalledWith({
            provider: 'googleDrive',
            snapshotId: 'snapshot-1',
            strategy: 'safeMerge',
        });
        expect(client.applyRestore).toHaveBeenCalledWith({
            provider: 'googleDrive',
            snapshotId: 'snapshot-1',
            strategy: 'safeMerge',
        });
        expect(modal.alert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
    });
});
