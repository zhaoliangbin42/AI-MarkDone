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

    it('preserves the connected account summary when backup succeeds', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(async (snapshot) => ({
                snapshotId: snapshot.snapshotId,
                name: 'remote-1.json',
                size: 1,
                createdAt: snapshot.createdAt,
            })),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: true,
            accountEmail: 'zhaoliangbin42@gmail.com',
            accountDisplayName: 'Liangbin Zhao',
            accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
            authStrategy: 'webExtensionAccessToken',
            sessionState: 'readyInThisSession',
            lastVerifiedAt: expect.any(String),
            lastSnapshotId: expect.any(String),
            lastError: null,
        });
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

    it('applies a safe-merge restore by adding remote-only bookmarks and preserving local conflicts', async () => {
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

        const res = await mod.handleCloudBackupRequest({
            v: 1,
            id: 't_cloudBackup:applyRestore',
            type: 'cloudBackup:applyRestore',
            payload: {
                provider: 'googleDrive',
                snapshotId: snapshot.snapshotId,
                strategy: 'safeMerge',
            },
        } as any);

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            restored: 1,
            skippedDuplicates: 0,
            conflicts: 1,
            localOnly: 0,
        });
        expect(store['bookmark:chatgpt.com/c/2:2']).toMatchObject({ title: 'Remote Only' });
        expect(store['bookmark:chatgpt.com/c/1:1']).toMatchObject({ title: 'Local' });
        expect(store['aimd:bookmarks:index:v1']).toEqual([
            'bookmark:chatgpt.com/c/1:1',
            'bookmark:chatgpt.com/c/2:2',
        ]);
        expect(Object.keys(store).some((key) => key.startsWith('aimd:cloud_backup:emergency_restore:googleDrive:v1:'))).toBe(true);
    });

    it('moves the selected Google Drive snapshot to trash through the provider', async () => {
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
        expect((res as any).response.data).toEqual({ trashed: true });
        expect(provider.deleteSnapshot).toHaveBeenCalledWith('snap-1');
    });

    it('surfaces provider configuration status without starting authorization', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({
                configured: false,
                message: 'Google Drive backup requires manifest.oauth2 client_id/scopes.',
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
            lastError: expect.stringContaining('manifest.oauth2'),
        });
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it('returns Google Drive build diagnostics without starting authorization', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const diagnostics = {
            extensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            expectedExtensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            extensionIdMatchesExpected: true,
            chromeExtensionClientId: '731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com',
            webAuthClientId: '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com',
            browserFamily: 'webAuthCompatible',
            hasIdentityPermission: true,
            hasGoogleApiHostPermission: true,
            hasManifestOAuthClient: true,
            hasDriveFileScope: true,
            supportsGetAuthToken: true,
            supportsLaunchWebAuthFlow: true,
            redirectUrl: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
            oauthRequestPreview: {
                clientId: '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com',
                redirectUri: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
                scope: 'https://www.googleapis.com/auth/drive.file',
                responseType: 'token',
            },
            authStrategy: 'browserManagedGoogleIdentity',
            usesManifestOAuthClient: true,
            usesWebOAuthClient: false,
            ready: true,
        };
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getDiagnostics: vi.fn(() => diagnostics),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest({
            v: 1,
            id: 't_cloudBackup:diagnostics',
            type: 'cloudBackup:diagnostics',
            payload: { provider: 'googleDrive' },
        } as any);

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toEqual(diagnostics);
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it('stores the connected Google Drive account summary returned by the provider', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getSessionState: vi.fn(() => 'readyInThisSession'),
            connect: vi.fn(async () => ({
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                authStrategy: 'webExtensionAccessToken',
            })),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:connect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: true,
            accountEmail: 'zhaoliangbin42@gmail.com',
            accountDisplayName: 'Liangbin Zhao',
            accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
            authStrategy: 'webExtensionAccessToken',
            connectedAccount: {
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: expect.any(String),
            },
            sessionState: 'readyInThisSession',
            lastVerifiedAt: expect.any(String),
            lastError: null,
        });
    });

    it('reports a connected account as needing confirmation without starting authorization', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: '2026-06-04T00:00:00.000Z',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getSessionState: vi.fn(() => 'unknown'),
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
            connected: true,
            connectedAccount: {
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: '2026-06-04T00:00:00.000Z',
            },
            sessionState: 'needsConfirmation',
        });
        expect(provider.connect).not.toHaveBeenCalled();
        expect(provider.listSnapshots).not.toHaveBeenCalled();
    });

    it('clears stale launchWebAuthFlow schema errors before starting a new Google Drive connect', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: "Error in invocation of identity.launchWebAuthFlow(identity.WebAuthFlowDetails details, function callback): Error at parameter 'details': Unexpected property: 'state'.",
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(async () => {
                expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
                    connected: false,
                    lastError: null,
                });
                return {
                    accountEmail: 'zhaoliangbin42@gmail.com',
                    accountDisplayName: 'Liangbin Zhao',
                    authStrategy: 'webExtensionAccessToken',
                };
            }),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:connect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: true,
            lastError: null,
            accountEmail: 'zhaoliangbin42@gmail.com',
        });
    });

    it('clears stored Google Drive account details when disconnecting', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'old@example.com',
                accountDisplayName: 'Old Account',
                accountPhotoUrl: 'https://example.com/photo',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(async () => undefined),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:disconnect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: false,
            connectedAccount: null,
            sessionState: 'unknown',
            accountEmail: null,
            accountDisplayName: null,
            accountPhotoUrl: null,
            lastError: null,
        });
    });

    it('clears a stale build configuration error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup requires manifest.oauth2 client_id/scopes.',
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
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale missing identity permission error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup is only available in a Chrome build with the identity permission',
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
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale launchWebAuthFlow state schema error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: "Error in invocation of identity.launchWebAuthFlow(identity.WebAuthFlowDetails details, function callback): Error at parameter 'details': Unexpected property: 'state'.",
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
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale Chrome Extension OAuth client error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup is configured with an invalid OAuth client. Use a Google Cloud Chrome Extension OAuth client ID and make sure it is bound to the current Chrome extension ID.',
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
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });
});
