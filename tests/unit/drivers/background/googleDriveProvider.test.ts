import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCloudBackupSnapshot } from '../../../../src/core/cloudBackup/snapshot';
import { createGoogleDriveProvider, idFromGoogleDriveSnapshotFileName } from '../../../../src/drivers/background/cloudBackup/googleDriveProvider';
import { CloudBackupProviderError } from '../../../../src/drivers/background/cloudBackup/provider';
import type { CloudBackupSnapshotV1 } from '../../../../src/core/cloudBackup/types';

function installChromeIdentity(getAuthToken: ReturnType<typeof vi.fn>, manifestPatch: Record<string, unknown> = {}): void {
    (globalThis as any).chrome = {
        runtime: {
            getManifest: () => ({
                manifest_version: 3,
                host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                permissions: ['identity'],
                oauth2: {
                    client_id: '1234567890-example.apps.googleusercontent.com',
                    scopes: ['https://www.googleapis.com/auth/drive.file'],
                },
                ...manifestPatch,
            }),
            lastError: null,
            id: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
        },
        identity: { getAuthToken },
    };
}

function driveJson(value: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(value), {
        status: init.status ?? 200,
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
}

describe('Google Drive cloud backup provider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        delete (globalThis as any).chrome;
    });

    it('extracts the full snapshot id from timestamped backup filenames', () => {
        expect(idFromGoogleDriveSnapshotFileName(
            'aimd-bookmarks-2026-05-10T12-34-56-789Z-123e4567-e89b-12d3-a456-426614174000.json',
        )).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('falls back to the Drive file name when the snapshot id cannot be parsed', () => {
        expect(idFromGoogleDriveSnapshotFileName('aimd-bookmarks-legacy.json')).toBe('aimd-bookmarks-legacy.json');
    });

    it('reports a missing Chrome identity API before requesting a token', async () => {
        const getAuthToken = vi.fn();
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                }),
            },
        };

        await expect(createGoogleDriveProvider().connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('identity permission'),
        } satisfies Partial<CloudBackupProviderError>);
        expect(getAuthToken).not.toHaveBeenCalled();
    });

    it('requires manifest oauth2 instead of falling back to build-time config', async () => {
        const getAuthToken = vi.fn();
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    permissions: ['clipboardWrite', 'storage', 'identity'],
                }),
                id: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            },
            identity: { getAuthToken },
        };

        expect(createGoogleDriveProvider().getConfigurationStatus?.()).toMatchObject({
            configured: false,
            message: expect.stringContaining('manifest oauth2'),
        });
        await expect(createGoogleDriveProvider().connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('manifest oauth2'),
        } satisfies Partial<CloudBackupProviderError>);
        expect(getAuthToken).not.toHaveBeenCalled();
    });

    it('reports manifest diagnostics without requesting authorization', () => {
        const getAuthToken = vi.fn();
        installChromeIdentity(getAuthToken);

        expect(createGoogleDriveProvider().getDiagnostics?.()).toEqual({
            extensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            clientId: '1234567890-example.apps.googleusercontent.com',
            hasIdentityPermission: true,
            hasManifestOauth2: true,
            hasDriveFileScope: true,
            hasGoogleApiHostPermission: true,
            hasGetAuthToken: true,
            ready: true,
        });
        expect(getAuthToken).not.toHaveBeenCalled();
    });

    it('maps Chrome invalid OAuth client errors to an actionable configuration failure', async () => {
        const getAuthToken = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = { message: 'Invalid OAuth2 Client ID.' };
            callback(undefined);
        });
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                    permissions: ['identity'],
                    oauth2: {
                        client_id: '1234567890-invalid.apps.googleusercontent.com',
                        scopes: ['https://www.googleapis.com/auth/drive.file'],
                    },
                }),
                lastError: null,
            },
            identity: { getAuthToken },
        };

        await expect(createGoogleDriveProvider().connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('Chrome Extension OAuth client'),
        } satisfies Partial<CloudBackupProviderError>);
    });

    it('revokes the current Google OAuth grant before clearing Chrome identity state when disconnecting', async () => {
        const fetch = vi.fn(async () => new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetch);
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        const removeCachedAuthToken = vi.fn();
        const clearAllCachedAuthTokens = vi.fn(() => Promise.resolve());
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    permissions: ['identity'],
                    oauth2: {
                        client_id: '1234567890-example.apps.googleusercontent.com',
                        scopes: ['https://www.googleapis.com/auth/drive.file'],
                    },
                }),
                lastError: null,
            },
            identity: { getAuthToken, removeCachedAuthToken, clearAllCachedAuthTokens },
        };

        await createGoogleDriveProvider().disconnect();

        expect(getAuthToken).toHaveBeenCalledWith({ interactive: false, scopes: ['https://www.googleapis.com/auth/drive.file'] }, expect.any(Function));
        expect(fetch).toHaveBeenCalledWith(
            'https://oauth2.googleapis.com/revoke?token=cached-token',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }),
        );
        expect(clearAllCachedAuthTokens).toHaveBeenCalledTimes(1);
        expect(removeCachedAuthToken).not.toHaveBeenCalled();
    });

    it('falls back to removing the current cached token when full identity clearing is unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        const removeCachedAuthToken = vi.fn((_details, callback) => callback());
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    permissions: ['identity'],
                    oauth2: {
                        client_id: '1234567890-example.apps.googleusercontent.com',
                        scopes: ['https://www.googleapis.com/auth/drive.file'],
                    },
                }),
                lastError: null,
            },
            identity: { getAuthToken, removeCachedAuthToken },
        };

        await createGoogleDriveProvider().disconnect();

        expect(getAuthToken).toHaveBeenCalledWith({ interactive: false, scopes: ['https://www.googleapis.com/auth/drive.file'] }, expect.any(Function));
        expect(removeCachedAuthToken).toHaveBeenCalledWith({ token: 'cached-token' }, expect.any(Function));
    });

    it('lists no snapshots without creating Drive folders when the backup folder is missing', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const fetch = vi.fn(async () => new Response(JSON.stringify({ files: [] }), { status: 200 }));
        vi.stubGlobal('fetch', fetch);

        const snapshots = await createGoogleDriveProvider().listSnapshots();

        expect(snapshots).toEqual([]);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
    });

    it('uploads snapshots through a resumable Drive upload session and verifies the downloaded file', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const payload = {
            version: '2.0' as const,
            exportDate: new Date(0).toISOString(),
            bookmarks: [{
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                messageId: null,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'One',
                platform: 'ChatGPT',
                folderPath: 'Import',
            }],
        };
        const snapshot = await createCloudBackupSnapshot(payload, new Date(0));
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            if (method === 'GET' && String(url).includes('/files?')) return driveJson({ files: [] });
            if (method === 'POST' && String(url).includes('/drive/v3/files?fields=id,name')) {
                const count = fetch.mock.calls.filter(([calledUrl, calledInit]) => String(calledUrl).includes('/drive/v3/files?fields=id,name') && (calledInit as RequestInit | undefined)?.method === 'POST').length;
                return driveJson({ id: `folder-${count}`, name: 'folder' });
            }
            if (method === 'POST' && String(url).includes('uploadType=resumable')) {
                return new Response(null, {
                    status: 200,
                    headers: { Location: 'https://www.googleapis.com/upload/session/aimd-test' },
                });
            }
            if (method === 'PUT' && String(url) === 'https://www.googleapis.com/upload/session/aimd-test') {
                return driveJson({
                    id: 'file-1',
                    name: 'aimd-bookmarks.json',
                    size: String(new TextEncoder().encode(JSON.stringify(snapshot, null, 2)).byteLength),
                    createdTime: snapshot.createdAt,
                });
            }
            if (method === 'GET' && String(url).includes('alt=media')) return driveJson(snapshot);
            throw new Error(`unexpected fetch ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        const summary = await createGoogleDriveProvider().uploadSnapshot(snapshot);

        expect(summary).toMatchObject({ snapshotId: snapshot.snapshotId, name: 'aimd-bookmarks.json' });
        expect(fetch.mock.calls.some(([url, init]) => String(url).includes('uploadType=resumable') && (init as RequestInit | undefined)?.method === 'POST')).toBe(true);
        expect(fetch.mock.calls.some(([url, init]) => String(url) === 'https://www.googleapis.com/upload/session/aimd-test' && (init as RequestInit | undefined)?.method === 'PUT')).toBe(true);
        expect(fetch.mock.calls.some(([url]) => String(url).includes('alt=media'))).toBe(true);
    });

    it('does not reject snapshots above the old multipart size limit before starting resumable upload', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const largeText = 'x'.repeat(5 * 1024 * 1024 + 1);
        const snapshot = await createCloudBackupSnapshot({
            version: '2.0',
            exportDate: new Date(0).toISOString(),
            bookmarks: [{
                url: 'https://chatgpt.com/c/large',
                urlWithoutProtocol: 'chatgpt.com/c/large',
                position: 1,
                messageId: null,
                userMessage: 'large',
                aiResponse: largeText,
                timestamp: 1,
                title: 'Large',
                platform: 'ChatGPT',
                folderPath: 'Import',
            }],
        }, new Date(0));
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            if ((init?.method ?? 'GET') === 'GET' && String(url).includes('/files?')) return driveJson({ files: [] });
            if (init?.method === 'POST' && String(url).includes('/drive/v3/files?fields=id,name')) return driveJson({ id: 'folder', name: 'folder' });
            if (init?.method === 'POST' && String(url).includes('uploadType=resumable')) {
                return new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/session/large' } });
            }
            if (init?.method === 'PUT') return driveJson({ id: 'large-file', name: 'large.json', size: 1, createdTime: snapshot.createdAt });
            if ((init?.method ?? 'GET') === 'GET' && String(url).includes('alt=media')) return driveJson(snapshot);
            throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        await createGoogleDriveProvider().uploadSnapshot(snapshot);

        expect(fetch.mock.calls.some(([url, init]) => String(url).includes('uploadType=resumable') && (init as RequestInit | undefined)?.method === 'POST')).toBe(true);
    });

    it('deletes the just-created Drive file when upload verification detects a mismatched snapshot', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const snapshot = await createCloudBackupSnapshot({
            version: '2.0',
            exportDate: new Date(0).toISOString(),
            bookmarks: [{
                url: 'https://chatgpt.com/c/mismatch',
                urlWithoutProtocol: 'chatgpt.com/c/mismatch',
                position: 1,
                messageId: null,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'Mismatch',
                platform: 'ChatGPT',
                folderPath: 'Import',
            }],
        }, new Date(0));
        const corrupted = { ...snapshot, payloadHash: 'sha256:wrong' };
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            if (method === 'GET' && String(url).includes('/files?')) return driveJson({ files: [] });
            if (method === 'POST' && String(url).includes('/drive/v3/files?fields=id,name')) return driveJson({ id: 'folder', name: 'folder' });
            if (method === 'POST' && String(url).includes('uploadType=resumable')) {
                return new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/session/mismatch' } });
            }
            if (method === 'PUT') return driveJson({ id: 'file-mismatch', name: 'mismatch.json', size: 1, createdTime: snapshot.createdAt });
            if (method === 'GET' && String(url).includes('alt=media')) return driveJson(corrupted);
            if (method === 'DELETE' && String(url).includes('/drive/v3/files/file-mismatch')) return new Response(null, { status: 204 });
            throw new Error(`unexpected fetch ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        await expect(createGoogleDriveProvider().uploadSnapshot(snapshot)).rejects.toMatchObject({
            code: 'INTEGRITY_MISMATCH',
            message: expect.stringContaining('did not match'),
        } satisfies Partial<CloudBackupProviderError>);
        expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/drive/v3/files/file-mismatch') && (init as RequestInit | undefined)?.method === 'DELETE')).toBe(true);
    });

    it('keeps the integrity error visible when cleanup of a mismatched upload fails', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const snapshot = await createCloudBackupSnapshot({
            version: '2.0',
            exportDate: new Date(0).toISOString(),
            bookmarks: [{
                url: 'https://chatgpt.com/c/cleanup-fails',
                urlWithoutProtocol: 'chatgpt.com/c/cleanup-fails',
                position: 1,
                messageId: null,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'Cleanup fails',
                platform: 'ChatGPT',
                folderPath: 'Import',
            }],
        }, new Date(0));
        const corrupted = { ...snapshot, snapshotId: '00000000-0000-4000-8000-000000000000' };
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            if (method === 'GET' && String(url).includes('/files?')) return driveJson({ files: [] });
            if (method === 'POST' && String(url).includes('/drive/v3/files?fields=id,name')) return driveJson({ id: 'folder', name: 'folder' });
            if (method === 'POST' && String(url).includes('uploadType=resumable')) {
                return new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/session/cleanup-fails' } });
            }
            if (method === 'PUT') return driveJson({ id: 'file-cleanup-fails', name: 'cleanup-fails.json', size: 1, createdTime: snapshot.createdAt });
            if (method === 'GET' && String(url).includes('alt=media')) return driveJson(corrupted);
            if (method === 'DELETE' && String(url).includes('/drive/v3/files/file-cleanup-fails')) {
                return driveJson({ error: { message: 'delete denied' } }, { status: 403 });
            }
            throw new Error(`unexpected fetch ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        await expect(createGoogleDriveProvider().uploadSnapshot(snapshot)).rejects.toMatchObject({
            code: 'INTEGRITY_MISMATCH',
            message: expect.stringContaining('cleanup failed'),
        } satisfies Partial<CloudBackupProviderError>);
    });

    it('moves user-managed backup snapshots to Drive trash instead of permanently deleting them', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('cached-token'));
        installChromeIdentity(getAuthToken);
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            if (method === 'GET' && String(url).includes('/files?')) {
                return driveJson({
                    files: [{
                        id: 'drive-file-1',
                        name: 'aimd-bookmarks-2026-06-01T00-00-00-000Z-123e4567-e89b-12d3-a456-426614174000.json',
                        size: '1024',
                        createdTime: new Date(0).toISOString(),
                    }],
                });
            }
            if (method === 'PATCH' && String(url).includes('/drive/v3/files/drive-file-1')) return driveJson({ id: 'drive-file-1', trashed: true });
            throw new Error(`unexpected fetch ${method} ${url}`);
        });
        vi.stubGlobal('fetch', fetch);
        const provider = createGoogleDriveProvider();

        await provider.deleteSnapshot('123e4567-e89b-12d3-a456-426614174000');

        const trashCall = fetch.mock.calls.find(([url, init]) => String(url).includes('/drive/v3/files/drive-file-1') && (init as RequestInit | undefined)?.method === 'PATCH');
        expect(trashCall).toBeTruthy();
        expect((trashCall?.[1] as RequestInit).body).toBe(JSON.stringify({ trashed: true }));
        expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/drive/v3/files/drive-file-1') && (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
    });
});
