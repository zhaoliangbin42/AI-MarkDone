import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtRequest } from '../../../../src/contracts/protocol';
import type { CloudBackupProvider } from '../../../../src/drivers/background/cloudBackup/provider';
import type { CloudBackupSnapshotV1 } from '../../../../src/core/cloudBackup/types';

type StorageMap = Record<string, any>;

function createInMemoryBrowser(store: StorageMap) {
    const local = {
        get: vi.fn(async (keys?: null | string | string[] | Record<string, any>) => {
            if (keys === null || keys === undefined) return { ...store };
            if (typeof keys === 'string') return { [keys]: store[keys] };
            if (Array.isArray(keys)) {
                const result: Record<string, any> = {};
                for (const k of keys) if (Object.prototype.hasOwnProperty.call(store, k)) result[k] = store[k];
                return result;
            }
            const result: Record<string, any> = {};
            for (const [k, fallback] of Object.entries(keys)) {
                result[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : fallback;
            }
            return result;
        }),
        set: vi.fn(async (patch: Record<string, any>) => {
            Object.assign(store, patch);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) delete store[k];
        }),
        getBytesInUse: vi.fn(async () => JSON.stringify(store).length),
    };

    return {
        runtime: { getManifest: () => ({ version: '4.3.1', manifest_version: 3 }) },
        storage: { local, sync: local },
    };
}

function req<T extends ExtRequest['type']>(type: T, payload?: any): Extract<ExtRequest, { type: T }> {
    return { v: 1, id: `t_${type}`, type, payload } as any;
}

function bookmark(position: number, title = `T${position}`) {
    return {
        url: `https://chatgpt.com/c/${position}`,
        urlWithoutProtocol: `chatgpt.com/c/${position}`,
        position,
        messageId: null,
        userMessage: `u${position}`,
        aiResponse: `a${position}`,
        timestamp: position,
        title,
        platform: 'ChatGPT',
        folderPath: 'Import',
    };
}

describe('background cloud backup handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('backs up a consistent bookmarks snapshot through the selected provider', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const uploads: CloudBackupSnapshotV1[] = [];
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(async (snapshot) => {
                uploads.push(snapshot);
                return { snapshotId: snapshot.snapshotId, name: 'remote-1.json', size: 1, createdAt: snapshot.createdAt };
            }),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect(uploads).toHaveLength(1);
        expect(uploads[0]!.payload.bookmarks).toHaveLength(1);
        expect(uploads[0]!.payloadHash).toMatch(/^sha256:/);
    });

    it('previews a restore without mutating local bookmarks', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1, 'Local'),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(1, 'Remote'), bookmark(2, 'Remote Only')], true), new Date(0));
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(async () => snapshot),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:previewRestore', {
            provider: 'googleDrive',
            snapshotId: snapshot.snapshotId,
            strategy: 'safeMerge',
        }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data.plan).toMatchObject({ conflictCount: 1, localOnlyCount: 0 });
        expect((res as any).response.data.plan.bookmarksToUpsert).toHaveLength(1);
        expect(store['bookmark:chatgpt.com/c/2:2']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/1:1'].title).toBe('Local');
    });

    it('deletes the selected Google Drive snapshot through the provider', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:deleteSnapshot', {
            provider: 'googleDrive',
            snapshotId: 'snap-1',
        }));

        expect(res?.response.ok).toBe(true);
        expect(provider.deleteSnapshot).toHaveBeenCalledWith('snap-1');
    });

    it('surfaces provider configuration status without starting authorization', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({
                configured: false,
                message: 'Google Drive backup is not configured in this build. Rebuild Chrome with AIMD_GOOGLE_CLIENT_ID set to the Google OAuth Chrome Extension client ID.',
            })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: false,
            connected: false,
            lastError: expect.stringContaining('AIMD_GOOGLE_CLIENT_ID'),
        });
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it('clears a stale build configuration error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup is not configured in this build. Rebuild Chrome with AIMD_GOOGLE_CLIENT_ID set to the Google OAuth Chrome Extension client ID.',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: false,
            lastError: null,
        });
    });
});
