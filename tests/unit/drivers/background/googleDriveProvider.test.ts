import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGoogleDriveProvider, idFromGoogleDriveSnapshotFileName } from '../../../../src/drivers/background/cloudBackup/googleDriveProvider';
import { CloudBackupProviderError } from '../../../../src/drivers/background/cloudBackup/provider';

describe('Google Drive cloud backup provider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
            message: expect.stringContaining('AIMD_GOOGLE_CLIENT_ID'),
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
});
