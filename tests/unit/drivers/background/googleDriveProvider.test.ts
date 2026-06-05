import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCloudBackupSnapshot } from '../../../../src/core/cloudBackup/snapshot';
import {
    clearGoogleDriveProviderAuthCache,
    createGoogleDriveProvider,
    idFromGoogleDriveSnapshotFileName,
} from '../../../../src/drivers/background/cloudBackup/googleDriveProvider';
import { CloudBackupProviderError } from '../../../../src/drivers/background/cloudBackup/provider';
import type { CloudBackupSnapshotV1 } from '../../../../src/core/cloudBackup/types';

const CHROME_EXTENSION_CLIENT_ID = '731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com';
const WEB_AUTH_CLIENT_ID = '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com';

function stubNavigator(userAgent: string, brands: Array<{ brand: string; version: string }> = []): void {
    vi.stubGlobal('navigator', {
        userAgent,
        userAgentData: { brands },
    });
}

function installChromeIdentity(getAuthToken: ReturnType<typeof vi.fn>, manifestPatch: Record<string, unknown> = {}): ReturnType<typeof vi.fn> {
    stubNavigator('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36', [
        { brand: 'Google Chrome', version: '125' },
        { brand: 'Chromium', version: '125' },
    ]);
    const launchWebAuthFlow = vi.fn((details, callback) => {
        callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
    });
    (globalThis as any).chrome = {
        runtime: {
            getManifest: () => ({
                manifest_version: 3,
                host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                permissions: ['identity'],
                oauth2: {
                    client_id: CHROME_EXTENSION_CLIENT_ID,
                    scopes: ['https://www.googleapis.com/auth/drive.file'],
                },
                ...manifestPatch,
            }),
            lastError: null,
            id: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
        },
        identity: {
            getAuthToken,
            getRedirectURL: vi.fn(() => 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/'),
            launchWebAuthFlow,
        },
    };
    return launchWebAuthFlow;
}

function installWebAuthIdentity(
    launchWebAuthFlow: ReturnType<typeof vi.fn>,
    redirectUrl = 'https://ai-markdone.chromiumapp.org/',
    browser: 'chromium' | 'firefox' = 'chromium',
): void {
    if (browser === 'firefox') {
        stubNavigator('Mozilla/5.0 Firefox/126.0');
    } else {
        stubNavigator('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36', [
            { brand: 'Chromium', version: '125' },
        ]);
    }
    (globalThis as any).chrome = {
        runtime: {
            getManifest: () => ({
                manifest_version: 3,
                host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                permissions: ['identity'],
            }),
            lastError: null,
            id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
        identity: {
            getRedirectURL: vi.fn(() => redirectUrl),
            launchWebAuthFlow,
        },
    };
}

function installLocalStorage(store: Record<string, unknown>): void {
    (globalThis as any).chrome.storage = {
        local: {
            get: vi.fn(async (keys: string[]) => {
                const result: Record<string, unknown> = {};
                for (const key of keys) {
                    if (Object.prototype.hasOwnProperty.call(store, key)) result[key] = store[key];
                }
                return result;
            }),
            set: vi.fn(async (patch: Record<string, unknown>) => {
                Object.assign(store, patch);
            }),
            remove: vi.fn(async (keys: string[]) => {
                for (const key of keys) delete store[key];
            }),
        },
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
        clearGoogleDriveProviderAuthCache();
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

    it('requires a Chrome manifest oauth2 client before using browser-managed identity', async () => {
        const getAuthToken = vi.fn();
        stubNavigator('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36', [
            { brand: 'Google Chrome', version: '125' },
            { brand: 'Chromium', version: '125' },
        ]);
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    permissions: ['clipboardWrite', 'storage', 'identity'],
                    host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                }),
                id: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            },
            identity: { getAuthToken },
        };

        expect(createGoogleDriveProvider().getConfigurationStatus?.()).toMatchObject({
            configured: false,
            message: expect.stringContaining('manifest.oauth2'),
        });
        await expect(createGoogleDriveProvider().connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('manifest.oauth2'),
        } satisfies Partial<CloudBackupProviderError>);
        expect(getAuthToken).not.toHaveBeenCalled();
    });

    it('reports manifest diagnostics without requesting authorization', () => {
        const getAuthToken = vi.fn();
        const launchWebAuthFlow = installChromeIdentity(getAuthToken);

        expect(createGoogleDriveProvider().getDiagnostics?.()).toMatchObject({
            extensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            expectedExtensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            extensionIdMatchesExpected: true,
            chromeExtensionClientId: CHROME_EXTENSION_CLIENT_ID,
            webAuthClientId: WEB_AUTH_CLIENT_ID,
            hasIdentityPermission: true,
            hasGoogleApiHostPermission: true,
            hasManifestOAuthClient: true,
            hasDriveFileScope: true,
            supportsGetAuthToken: true,
            supportsLaunchWebAuthFlow: true,
            redirectUrl: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
            oauthRequestPreview: {
                clientId: WEB_AUTH_CLIENT_ID,
                redirectUri: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
                scope: 'https://www.googleapis.com/auth/drive.file',
                responseType: 'token',
            },
            authStrategy: 'browserManagedGoogleIdentity',
            ready: true,
        });
        expect(getAuthToken).not.toHaveBeenCalled();
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it('connects through browser-managed identity when Chrome getAuthToken exists and returns the Drive account', async () => {
        const getAuthToken = vi.fn((details, callback) => {
            callback(details.interactive ? 'chrome-token' : undefined);
        });
        const launchWebAuthFlow = installChromeIdentity(getAuthToken);
        const fetch = vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({
                    user: {
                        displayName: 'Liangbin Zhao',
                        emailAddress: 'zhaoliangbin42@gmail.com',
                        photoLink: 'https://lh3.googleusercontent.com/avatar',
                    },
                });
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        const result = await createGoogleDriveProvider().connect();

        expect(getAuthToken).toHaveBeenNthCalledWith(1, { interactive: false }, expect.any(Function));
        expect(getAuthToken).toHaveBeenNthCalledWith(2, { interactive: true }, expect.any(Function));
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/drive/v3/about?'),
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer chrome-token' }),
            }),
        );
        expect(result).toEqual({
            accountEmail: 'zhaoliangbin42@gmail.com',
            accountDisplayName: 'Liangbin Zhao',
            accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
            authStrategy: 'browserManagedGoogleIdentity',
        });
    });

    it('uses WebAuth in a WebAuth-compatible environment even when getAuthToken exists', async () => {
        const getAuthToken = vi.fn((details, callback) => {
            callback(details.interactive ? 'browser-token' : undefined);
        });
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installChromeIdentity(getAuthToken);
        (globalThis as any).chrome.identity.launchWebAuthFlow = launchWebAuthFlow;
        stubNavigator('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36', [
            { brand: 'Chromium', version: '125' },
        ]);
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'Chromium User', emailAddress: 'chromium@example.com' } });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        expect(createGoogleDriveProvider().getDiagnostics?.()).toMatchObject({
            extensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            expectedExtensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            extensionIdMatchesExpected: true,
            browserFamily: 'webAuthCompatible',
            authStrategy: 'webExtensionAccessToken',
            usesManifestOAuthClient: false,
            usesWebOAuthClient: true,
            ready: true,
        });
        await expect(createGoogleDriveProvider().connect()).resolves.toMatchObject({
            accountEmail: 'chromium@example.com',
            authStrategy: 'webExtensionAccessToken',
        });
        expect(getAuthToken).not.toHaveBeenCalled();
        expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
        const authUrl = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url);
        expect(authUrl.searchParams.get('client_id')).toBe(WEB_AUTH_CLIENT_ID);
        expect(authUrl.searchParams.get('redirect_uri')).toBe('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/');
    });

    it('uses launchWebAuthFlow with the Firefox Web OAuth client when manifest OAuth is unavailable', async () => {
        const launchWebAuthFlow = vi.fn((details, callback) => {
            callback('https://ai-markdone.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://ai-markdone.chromiumapp.org/', 'firefox');
        const fetch = vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({
                    user: {
                        displayName: 'Test User',
                        emailAddress: 'test@example.com',
                    },
                });
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        const result = await createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect();

        expect(launchWebAuthFlow).toHaveBeenCalledWith(
            expect.objectContaining({ interactive: true, url: expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth?') }),
            expect.any(Function),
        );
        expect(launchWebAuthFlow.mock.calls[0]?.[0]).not.toHaveProperty('state');
        const authUrl = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url);
        expect(authUrl.searchParams.get('client_id')).toBe('1234567890-webext.apps.googleusercontent.com');
        expect(authUrl.searchParams.get('redirect_uri')).toBe('https://ai-markdone.chromiumapp.org/');
        expect(authUrl.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
        expect(authUrl.searchParams.get('response_type')).toBe('token');
        expect(authUrl.searchParams.get('prompt')).toBeNull();
        expect(authUrl.searchParams.get('state')).toBeNull();
        expect(result).toMatchObject({
            accountEmail: 'test@example.com',
            accountDisplayName: 'Test User',
            authStrategy: 'webExtensionAccessToken',
        });
    });

    it('accepts launchWebAuthFlow redirects without custom state parameters', async () => {
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://ai-markdone.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://ai-markdone.chromiumapp.org/', 'firefox');
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'No State', emailAddress: 'nostate@example.com' } });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        await expect(createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect()).resolves.toMatchObject({
            accountEmail: 'nostate@example.com',
            authStrategy: 'webExtensionAccessToken',
        });
    });

    it('uses Firefox loopback redirect URLs when getRedirectURL returns the Mozilla allizom domain', async () => {
        const launchWebAuthFlow = vi.fn((details, callback) => {
            callback('http://127.0.0.1/mozoauth2/dd3c7b5b5536775e8e183f8d0cfb5dca338abc36#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installWebAuthIdentity(
            launchWebAuthFlow,
            'https://dd3c7b5b5536775e8e183f8d0cfb5dca338abc36.extensions.allizom.org/',
            'firefox',
        );
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'Firefox User', emailAddress: 'firefox@example.com' } });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        const result = await createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect();

        const authUrl = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url);
        expect(authUrl.searchParams.get('redirect_uri')).toBe('http://127.0.0.1/mozoauth2/dd3c7b5b5536775e8e183f8d0cfb5dca338abc36');
        expect(result).toMatchObject({
            accountEmail: 'firefox@example.com',
            accountDisplayName: 'Firefox User',
            authStrategy: 'webExtensionAccessToken',
        });
    });

    it('uses interactive launchWebAuthFlow for user-triggered Drive operations when browser identity is unavailable', async () => {
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://ai-markdone.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://ai-markdone.chromiumapp.org/', 'firefox');
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/files?')) {
                return driveJson({ files: [] });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        await expect(createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).listSnapshots()).resolves.toEqual([]);

        expect(launchWebAuthFlow).toHaveBeenCalledWith(
            expect.objectContaining({ interactive: true, url: expect.not.stringContaining('prompt=') }),
            expect.any(Function),
        );
    });

    it('persists unexpired WebAuth tokens so a restarted service worker can finish later operations', async () => {
        const tokenStore: Record<string, unknown> = {};
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://ai-markdone.chromiumapp.org/#access_token=persisted-web-token&expires_in=3600&token_type=Bearer');
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://ai-markdone.chromiumapp.org/', 'firefox');
        installLocalStorage(tokenStore);
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'Persisted User', emailAddress: 'persisted@example.com' } });
            }
            if (String(url).includes('/drive/v3/files?')) {
                expect(init?.headers).toMatchObject({ Authorization: 'Bearer persisted-web-token' });
                return driveJson({ files: [] });
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        await createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect();
        clearGoogleDriveProviderAuthCache();
        const snapshots = await createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).listSnapshots();

        expect(snapshots).toEqual([]);
        expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
        expect(tokenStore).toMatchObject({
            'aimd:cloud_backup:googleDrive:accessToken:v1': 'persisted-web-token',
            'aimd:cloud_backup:googleDrive:accessTokenCacheKey:v1': 'webExtensionAccessToken\n1234567890-webext.apps.googleusercontent.com\nhttps://ai-markdone.chromiumapp.org/',
            'aimd:cloud_backup:googleDrive:accessTokenAuthStrategy:v1': 'webExtensionAccessToken',
        });
        expect(typeof tokenStore['aimd:cloud_backup:googleDrive:accessTokenExpiresAt:v1']).toBe('number');
    });

    it('uses browser-managed identity for later Drive operations without opening WebAuth', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('browser-token'));
        const launchWebAuthFlow = installChromeIdentity(getAuthToken);
        const fetch = vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'Connected User', emailAddress: 'connected@example.com' } });
            }
            if (String(url).includes('/drive/v3/files?')) {
                return driveJson({ files: [] });
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        await createGoogleDriveProvider().connect();
        expect(createGoogleDriveProvider().getSessionState?.()).toBe('readyInThisSession');
        const snapshots = await createGoogleDriveProvider().listSnapshots();

        expect(snapshots).toEqual([]);
        expect(getAuthToken).toHaveBeenCalledTimes(1);
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenLastCalledWith(
            expect.stringContaining('/drive/v3/files?'),
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer browser-token' }),
            }),
        );
    });

    it('reports ready session state for browser-managed identity without opening OAuth', () => {
        const getAuthToken = vi.fn();
        const launchWebAuthFlow = installChromeIdentity(getAuthToken);

        expect(createGoogleDriveProvider().getSessionState?.()).toBe('readyInThisSession');
        expect(getAuthToken).not.toHaveBeenCalled();
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it('falls back to an interactive WebAuth flow when browser identity fails during a user-triggered operation', async () => {
        const getAuthToken = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = { message: 'OAuth2 service failure' };
            callback(undefined);
            (globalThis as any).chrome.runtime.lastError = null;
        });
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#access_token=interactive-token&expires_in=3600&token_type=Bearer');
        });
        installChromeIdentity(getAuthToken);
        (globalThis as any).chrome.identity.launchWebAuthFlow = launchWebAuthFlow;
        const fetch = vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/files?')) {
                return driveJson({ files: [] });
            }
            throw new Error(`unexpected fetch ${url}`);
        });
        vi.stubGlobal('fetch', fetch);

        const snapshots = await createGoogleDriveProvider().listSnapshots();

        expect(snapshots).toEqual([]);
        expect(getAuthToken).toHaveBeenNthCalledWith(1, { interactive: false }, expect.any(Function));
        expect(getAuthToken).toHaveBeenNthCalledWith(2, { interactive: true }, expect.any(Function));
        expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
        expect(launchWebAuthFlow.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            interactive: true,
            url: expect.not.stringContaining('prompt='),
        }));
        const authUrl = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url);
        expect(authUrl.searchParams.get('client_id')).toBe(WEB_AUTH_CLIENT_ID);
        expect(authUrl.searchParams.get('redirect_uri')).toBe('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/drive/v3/files?'),
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer interactive-token' }),
            }),
        );
    });

    it('maps WebAuth invalid request errors to an actionable Web OAuth configuration failure', async () => {
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = { message: 'Error 400: invalid_request' };
            callback(undefined);
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/', 'firefox');

        await expect(createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('Web application OAuth client'),
        } satisfies Partial<CloudBackupProviderError>);
    });

    it('maps Google redirect invalid_request errors to an actionable Web OAuth configuration failure', async () => {
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#error=invalid_request');
        });
        installWebAuthIdentity(launchWebAuthFlow, 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/', 'firefox');

        await expect(createGoogleDriveProvider({ webAuthClientId: '1234567890-webext.apps.googleusercontent.com' }).connect()).rejects.toMatchObject({
            code: 'PROVIDER_UNAVAILABLE',
            message: expect.stringContaining('Web application OAuth client'),
        } satisfies Partial<CloudBackupProviderError>);
    });

    it('falls back to WebAuth when browser-managed identity fails interactively', async () => {
        const getAuthToken = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = { message: 'Invalid OAuth2 Client ID.' };
            callback(undefined);
        });
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = null;
            callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installChromeIdentity(getAuthToken);
        (globalThis as any).chrome.identity.launchWebAuthFlow = launchWebAuthFlow;
        (globalThis as any).chrome.identity.getRedirectURL = vi.fn(() => 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/');
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'WebAuth User', emailAddress: 'webauth@example.com' } });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        await expect(createGoogleDriveProvider().connect()).resolves.toMatchObject({
            accountEmail: 'webauth@example.com',
            authStrategy: 'webExtensionAccessToken',
        });

        expect(getAuthToken).toHaveBeenCalledWith({ interactive: false }, expect.any(Function));
        expect(getAuthToken).toHaveBeenCalledWith({ interactive: true }, expect.any(Function));
        expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
        const authUrl = new URL(launchWebAuthFlow.mock.calls[0]?.[0].url);
        expect(authUrl.searchParams.get('client_id')).toBe(WEB_AUTH_CLIENT_ID);
    });

    it('prefers browser-managed identity when both identity methods are available', async () => {
        const getAuthToken = vi.fn((_details, callback) => callback('chrome-token'));
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            callback('https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/#access_token=web-token&expires_in=3600&token_type=Bearer');
        });
        installChromeIdentity(getAuthToken);
        (globalThis as any).chrome.identity.launchWebAuthFlow = launchWebAuthFlow;
        (globalThis as any).chrome.identity.getRedirectURL = vi.fn(() => 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/');
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
            expect(init?.headers).toMatchObject({ Authorization: 'Bearer chrome-token' });
            if (String(url).includes('/drive/v3/about?')) {
                return driveJson({ user: { displayName: 'Browser First', emailAddress: 'browser-first@example.com' } });
            }
            throw new Error(`unexpected fetch ${url}`);
        }));

        const result = await createGoogleDriveProvider().connect();

        expect(getAuthToken).toHaveBeenCalledWith({ interactive: false }, expect.any(Function));
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            accountEmail: 'browser-first@example.com',
            accountDisplayName: 'Browser First',
            authStrategy: 'browserManagedGoogleIdentity',
        });
    });

    it('revokes the current cached Google OAuth grant before clearing identity state when disconnecting', async () => {
        const fetch = vi.fn(async () => new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetch);
        const tokenStore: Record<string, unknown> = {
            'aimd:cloud_backup:googleDrive:accessToken:v1': 'cached-token',
            'aimd:cloud_backup:googleDrive:accessTokenExpiresAt:v1': Date.now() + 3_600_000,
            'aimd:cloud_backup:googleDrive:accessTokenCacheKey:v1': 'browserManagedGoogleIdentity\n731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com\nbmdhdihdbhjbkfaaainidcjbgidkbeoh',
            'aimd:cloud_backup:googleDrive:accessTokenAuthStrategy:v1': 'browserManagedGoogleIdentity',
        };
        const getAuthToken = vi.fn();
        const launchWebAuthFlow = vi.fn();
        const removeCachedAuthToken = vi.fn();
        const clearAllCachedAuthTokens = vi.fn(() => Promise.resolve());
        installChromeIdentity(getAuthToken);
        installLocalStorage(tokenStore);
        (globalThis as any).chrome = {
            ...(globalThis as any).chrome,
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                    permissions: ['identity'],
                    oauth2: {
                        client_id: '731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com',
                        scopes: ['https://www.googleapis.com/auth/drive.file'],
                    },
                }),
                lastError: null,
                id: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            },
            identity: {
                getAuthToken,
                getRedirectURL: vi.fn(() => 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/'),
                launchWebAuthFlow,
                removeCachedAuthToken,
                clearAllCachedAuthTokens,
            },
        };

        await createGoogleDriveProvider().disconnect();

        expect(getAuthToken).not.toHaveBeenCalled();
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
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

    it('does not block disconnect when no cached token is available', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
        const getAuthToken = vi.fn();
        const launchWebAuthFlow = vi.fn((_details, callback) => {
            (globalThis as any).chrome.runtime.lastError = { message: 'Authorization page could not be loaded.' };
            callback(undefined);
        });
        const removeCachedAuthToken = vi.fn((_details, callback) => callback());
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    host_permissions: ['https://www.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
                    permissions: ['identity'],
                }),
                lastError: null,
            },
            identity: {
                getAuthToken,
                getRedirectURL: vi.fn(() => 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/'),
                launchWebAuthFlow,
                removeCachedAuthToken,
            },
        };

        await createGoogleDriveProvider().disconnect();

        expect(getAuthToken).not.toHaveBeenCalled();
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
        expect(removeCachedAuthToken).not.toHaveBeenCalled();
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

    it('removes a stale browser-managed token and retries once when Drive returns 401', async () => {
        const getAuthToken = vi.fn()
            .mockImplementationOnce((_details, callback) => callback('stale-token'))
            .mockImplementationOnce((_details, callback) => callback('fresh-token'));
        installChromeIdentity(getAuthToken);
        const removeCachedAuthToken = vi.fn((_details, callback) => callback());
        (globalThis as any).chrome.identity.removeCachedAuthToken = removeCachedAuthToken;
        const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
            const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
            if (authorization === 'Bearer stale-token') {
                return driveJson({ error: { message: 'expired' } }, { status: 401 });
            }
            return driveJson({ files: [] });
        });
        vi.stubGlobal('fetch', fetch);

        const snapshots = await createGoogleDriveProvider().listSnapshots();

        expect(snapshots).toEqual([]);
        expect(removeCachedAuthToken).toHaveBeenCalledWith({ token: 'stale-token' }, expect.any(Function));
        expect(getAuthToken).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenLastCalledWith(
            expect.stringContaining('/drive/v3/files?'),
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
            }),
        );
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
