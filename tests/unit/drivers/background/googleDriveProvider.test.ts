import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGoogleDriveProvider, idFromGoogleDriveSnapshotFileName } from '../../../../src/drivers/background/cloudBackup/googleDriveProvider';
import { CloudBackupProviderError } from '../../../../src/drivers/background/cloudBackup/provider';

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

    it('reports a missing manifest oauth client before requesting a Chrome token', async () => {
        const getAuthToken = vi.fn();
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    permissions: ['identity'],
                }),
            },
            identity: { getAuthToken },
        };

        await expect(createGoogleDriveProvider().connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('Chrome manifest OAuth client ID'),
        } satisfies Partial<CloudBackupProviderError>);
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
});
