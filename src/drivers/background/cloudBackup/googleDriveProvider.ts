import { validateCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import type { CloudBackupSnapshotV1 } from '../../../core/cloudBackup/types';
import { CloudBackupProviderError, type CloudBackupProvider } from './provider';
import type { CloudBackupAccountSummary, CloudBackupAuthStrategy, CloudBackupBrowserFamily, CloudBackupDiagnostics } from '../../../contracts/protocol';
import {
    GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID,
    GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID,
    isValidGoogleOAuthClientId as isValidConfiguredGoogleOAuthClientId,
} from '../../../../config/extension/cloudBackup';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_OAUTH_REVOKE_API = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_OAUTH_AUTH_API = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_API_HOST_PERMISSION = 'https://www.googleapis.com/*';
const EXPECTED_CHROME_EXTENSION_ID = 'bmdhdihdbhjbkfaaainidcjbgidkbeoh';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const IDENTITY_TOKEN_TTL_SECONDS = 55 * 60;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const ACCESS_TOKEN_STORAGE_KEYS = {
    token: 'aimd:cloud_backup:googleDrive:accessToken:v1',
    expiresAt: 'aimd:cloud_backup:googleDrive:accessTokenExpiresAt:v1',
    cacheKey: 'aimd:cloud_backup:googleDrive:accessTokenCacheKey:v1',
    authStrategy: 'aimd:cloud_backup:googleDrive:accessTokenAuthStrategy:v1',
} as const;
const LEGACY_WEB_AUTH_TOKEN_STORAGE_KEYS = [
    'aimd:cloud_backup:googleDrive:webAuthToken:v1',
    'aimd:cloud_backup:googleDrive:webAuthExpiresAt:v1',
    'aimd:cloud_backup:googleDrive:webAuthCacheKey:v1',
] as const;

type ChromeManifest = {
    permissions?: unknown;
    host_permissions?: unknown;
    oauth2?: {
        client_id?: unknown;
        scopes?: unknown;
    };
};

type GoogleDriveProviderOptions = {
    chromeExtensionClientId?: string | null;
    webAuthClientId?: string | null;
};

type CachedAccessToken = {
    token: string;
    expiresAt: number;
    cacheKey: string;
    authStrategy: CloudBackupAuthStrategy;
};

type TokenResult = {
    token: string;
    authStrategy: CloudBackupAuthStrategy;
};

let cachedAccessToken: CachedAccessToken | null = null;

export function clearGoogleDriveProviderAuthCache(): void {
    cachedAccessToken = null;
}

function getExtensionIdentity(): any {
    return (globalThis as any).chrome?.identity ?? (globalThis as any).browser?.identity;
}

function getExtensionRuntime(): any {
    return (globalThis as any).chrome?.runtime ?? (globalThis as any).browser?.runtime;
}

function getExtensionStorageLocal(): any {
    return (globalThis as any).chrome?.storage?.local ?? (globalThis as any).browser?.storage?.local;
}

function getRuntimeLastError(): unknown {
    return getExtensionRuntime()?.lastError ?? null;
}

function getChromeManifest(): ChromeManifest | null {
    try {
        return getExtensionRuntime()?.getManifest?.() ?? null;
    } catch {
        return null;
    }
}

async function storageGet(keys: string[]): Promise<Record<string, unknown>> {
    const storage = getExtensionStorageLocal();
    if (!storage?.get) return {};
    return new Promise((resolve) => {
        try {
            const finish = (value?: unknown) => resolve((value && typeof value === 'object') ? value as Record<string, unknown> : {});
            const maybePromise = storage.get(keys, finish);
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(finish).catch(() => resolve({}));
            }
        } catch {
            resolve({});
        }
    });
}

async function storageSet(values: Record<string, unknown>): Promise<void> {
    const storage = getExtensionStorageLocal();
    if (!storage?.set) return;
    await new Promise<void>((resolve) => {
        try {
            const maybePromise = storage.set(values, () => resolve());
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(() => resolve()).catch(() => resolve());
            }
        } catch {
            resolve();
        }
    });
}

async function storageRemove(keys: string[]): Promise<void> {
    const storage = getExtensionStorageLocal();
    if (!storage?.remove) return;
    await new Promise<void>((resolve) => {
        try {
            const maybePromise = storage.remove(keys, () => resolve());
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(() => resolve()).catch(() => resolve());
            }
        } catch {
            resolve();
        }
    });
}

function manifestStrings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isValidGoogleOAuthClientId(value: string | null | undefined): value is string {
    return typeof value === 'string' && isValidConfiguredGoogleOAuthClientId(value.trim());
}

function getNavigatorUserAgent(): string {
    return String((globalThis as any).navigator?.userAgent ?? '');
}

function getNavigatorBrands(): string[] {
    const brands = (globalThis as any).navigator?.userAgentData?.brands;
    if (!Array.isArray(brands)) return [];
    return brands
        .map((entry) => typeof entry?.brand === 'string' ? entry.brand.toLowerCase() : '')
        .filter(Boolean);
}

function detectBrowserFamily(identity: any): CloudBackupBrowserFamily {
    if (!identity) return 'unsupported';
    const userAgent = getNavigatorUserAgent().toLowerCase();
    const brands = getNavigatorBrands();
    const hasBrand = (name: string) => brands.some((brand) => brand === name.toLowerCase());
    if (userAgent.includes('firefox')) return 'firefox';
    if (hasBrand('Google Chrome')) return 'googleChrome';
    if (typeof identity.launchWebAuthFlow === 'function' && typeof identity.getRedirectURL === 'function') return 'webAuthCompatible';
    return 'unsupported';
}

function resolveGoogleCompatibleWebAuthRedirectUrl(redirectUrl: string | null | undefined): string | null {
    if (!redirectUrl) return null;
    try {
        const url = new URL(redirectUrl);
        const suffix = '.extensions.allizom.org';
        if (url.hostname.endsWith(suffix)) {
            const subdomain = url.hostname.slice(0, -suffix.length);
            if (subdomain) return `http://127.0.0.1/mozoauth2/${subdomain}`;
        }
    } catch {
        return redirectUrl;
    }
    return redirectUrl;
}

function getManifestDiagnostics(options: GoogleDriveProviderOptions = {}): CloudBackupDiagnostics {
    const manifest = getChromeManifest();
    const permissions = manifestStrings(manifest?.permissions);
    const hostPermissions = manifestStrings(manifest?.host_permissions);
    const manifestScopes = manifestStrings(manifest?.oauth2?.scopes);
    const manifestOAuthClientId = typeof manifest?.oauth2?.client_id === 'string' ? manifest.oauth2.client_id.trim() : '';
    const identity = getExtensionIdentity();
    const browserFamily = detectBrowserFamily(identity);
    const hasIdentityPermission = permissions.includes('identity');
    const hasGoogleApiHostPermission = hostPermissions.includes(GOOGLE_DRIVE_API_HOST_PERMISSION)
        || permissions.includes(GOOGLE_DRIVE_API_HOST_PERMISSION);
    const supportsGetAuthToken = typeof identity?.getAuthToken === 'function';
    const supportsLaunchWebAuthFlow = typeof identity?.launchWebAuthFlow === 'function'
        && typeof identity?.getRedirectURL === 'function';
    const configuredChromeExtensionClientId = options.chromeExtensionClientId?.trim()
        || manifestOAuthClientId
        || GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID.trim()
        || null;
    const webAuthClientId = options.webAuthClientId?.trim()
        || GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID.trim()
        || null;
    let redirectUrl: string | null = null;
    if (supportsLaunchWebAuthFlow) {
        try {
            redirectUrl = resolveGoogleCompatibleWebAuthRedirectUrl(identity.getRedirectURL());
        } catch {
            redirectUrl = null;
        }
    }
    const extensionId = getExtensionRuntime()?.id ?? null;
    const extensionIdMatchesExpected = extensionId === EXPECTED_CHROME_EXTENSION_ID;
    const hasManifestOAuthClient = isValidGoogleOAuthClientId(manifestOAuthClientId)
        && (!configuredChromeExtensionClientId || manifestOAuthClientId === configuredChromeExtensionClientId);
    const hasDriveFileScope = manifestScopes.includes(DRIVE_SCOPE);
    const canUseBrowserManagedIdentity = browserFamily === 'googleChrome';
    const browserIdentityReady = canUseBrowserManagedIdentity
        && hasIdentityPermission
        && hasGoogleApiHostPermission
        && supportsGetAuthToken
        && hasManifestOAuthClient
        && hasDriveFileScope
        && extensionIdMatchesExpected;
    const webAuthReady = hasIdentityPermission
        && hasGoogleApiHostPermission
        && supportsLaunchWebAuthFlow
        && isValidGoogleOAuthClientId(webAuthClientId)
        && typeof redirectUrl === 'string'
        && redirectUrl.length > 0;
    const oauthRequestPreview = isValidGoogleOAuthClientId(webAuthClientId) && redirectUrl
        ? {
            clientId: webAuthClientId,
            redirectUri: redirectUrl,
            scope: DRIVE_SCOPE,
            responseType: 'token' as const,
        }
        : null;
    const canUseWebAuth = webAuthReady;
    const authStrategy: CloudBackupAuthStrategy = browserIdentityReady
        ? 'browserManagedGoogleIdentity'
        : canUseWebAuth
            ? 'webExtensionAccessToken'
            : 'unsupported';
    return {
        extensionId,
        expectedExtensionId: EXPECTED_CHROME_EXTENSION_ID,
        extensionIdMatchesExpected,
        chromeExtensionClientId: configuredChromeExtensionClientId,
        webAuthClientId,
        browserFamily,
        hasIdentityPermission,
        hasGoogleApiHostPermission,
        hasManifestOAuthClient,
        hasDriveFileScope,
        supportsGetAuthToken,
        supportsLaunchWebAuthFlow,
        redirectUrl,
        oauthRequestPreview,
        authStrategy,
        usesManifestOAuthClient: authStrategy === 'browserManagedGoogleIdentity',
        usesWebOAuthClient: authStrategy === 'webExtensionAccessToken',
        ready: browserIdentityReady || canUseWebAuth,
    };
}

function assertAuthReady(options: GoogleDriveProviderOptions = {}): CloudBackupDiagnostics {
    const diagnostics = getManifestDiagnostics(options);
    const identity = getExtensionIdentity();
    if (diagnostics.ready) return diagnostics;
    if (!diagnostics.hasIdentityPermission) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires the WebExtension identity permission in this build.',
        );
    }
    if (!diagnostics.hasGoogleApiHostPermission) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires the https://www.googleapis.com/* host permission in the extension manifest.',
        );
    }
    if (!isValidGoogleOAuthClientId(diagnostics.chromeExtensionClientId) && !isValidGoogleOAuthClientId(diagnostics.webAuthClientId)) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires a configured Google Cloud OAuth client ID.',
        );
    }
    if (!diagnostics.supportsGetAuthToken && (!diagnostics.supportsLaunchWebAuthFlow || !identity?.launchWebAuthFlow)) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires browser identity.getAuthToken or WebExtension identity.launchWebAuthFlow in this browser.',
        );
    }
    if (diagnostics.browserFamily === 'googleChrome' && diagnostics.supportsGetAuthToken && (!diagnostics.hasManifestOAuthClient || !diagnostics.hasDriveFileScope || !diagnostics.extensionIdMatchesExpected)) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires a Chrome Extension OAuth client in manifest.oauth2 bound to this extension ID.',
        );
    }
    if (diagnostics.supportsLaunchWebAuthFlow && !diagnostics.redirectUrl) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup Web OAuth redirect URL is unavailable in this build.',
        );
    }
    if (diagnostics.supportsLaunchWebAuthFlow && !isValidGoogleOAuthClientId(diagnostics.webAuthClientId)) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires a Web application OAuth client ID for launchWebAuthFlow.',
        );
    }
    throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive backup is not configured in this browser.');
}

function getGoogleDriveConfigurationStatus(options: GoogleDriveProviderOptions = {}): { configured: boolean; message?: string } {
    try {
        assertAuthReady(options);
        return { configured: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive backup is not configured in this build';
        return { configured: false, message };
    }
}

function getDriveErrorMessage(details?: string): string {
    if (!details) return '';
    try {
        const parsed = JSON.parse(details) as { error?: { message?: unknown; status?: unknown } };
        const message = typeof parsed.error?.message === 'string' ? parsed.error.message : '';
        if (message.includes('has not been used') || message.includes('is disabled')) {
            return 'Google Drive API is not enabled for this OAuth project';
        }
        if (message.includes('insufficient authentication scopes')) {
            return 'Google Drive authorization scope is insufficient';
        }
        if (typeof parsed.error?.status === 'string') return parsed.error.status;
    } catch {
        return '';
    }
    return '';
}

function mapIdentityError(message: string, interactive: boolean): CloudBackupProviderError {
    const normalized = message.toLowerCase();
    if (
        normalized.includes('invalid oauth2 client id') ||
        normalized.includes('bad client id') ||
        normalized.includes('invalid_request') ||
        normalized.includes('redirect_uri') ||
        normalized.includes('origin_mismatch') ||
        normalized.includes('client_id') && normalized.includes('registered')
    ) {
        return new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is configured with an invalid Google OAuth request. Check that the Web application OAuth client allows the exact identity.getRedirectURL() redirect URI, and that manifest.oauth2 uses the Chrome Extension OAuth client bound to this extension ID.',
        );
    }
    return new CloudBackupProviderError(
        'AUTH_REQUIRED',
        interactive
            ? (message || 'Google Drive authorization failed')
            : 'Google Drive authorization is required. Sign in to Google Drive before using backup or restore.',
    );
}

function mapDriveError(status: number, fallback: string, details?: string): CloudBackupProviderError {
    const driveMessage = getDriveErrorMessage(details);
    const suffix = driveMessage ? `: ${driveMessage}` : '';
    if (status === 401) return new CloudBackupProviderError('AUTH_REQUIRED', `Google Drive authorization is required${suffix}`);
    if (status === 403) return new CloudBackupProviderError('PERMISSION_DENIED', `Google Drive denied this operation${suffix}`);
    if (status === 429) return new CloudBackupProviderError('RATE_LIMITED', `Google Drive rate limit reached${suffix}`);
    if (status >= 500) return new CloudBackupProviderError('PROVIDER_UNAVAILABLE', `Google Drive is temporarily unavailable${suffix}`);
    return new CloudBackupProviderError('PROVIDER_UNAVAILABLE', `${fallback}${suffix}`);
}

function buildWebAuthUrl(clientId: string, redirectUrl: string, scope: string): string {
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'token',
        redirect_uri: redirectUrl,
        scope,
    });
    return `${GOOGLE_OAUTH_AUTH_API}?${params.toString()}`;
}

function parseAccessTokenFromRedirect(responseUrl: string, cacheKey: string, interactive: boolean): CachedAccessToken {
    const url = new URL(responseUrl);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(url.search.replace(/^\?/, ''));
    const error = hashParams.get('error') ?? queryParams.get('error');
    if (error) {
        throw mapIdentityError(error, interactive);
    }
    const token = hashParams.get('access_token') ?? queryParams.get('access_token');
    if (!token) {
        throw new CloudBackupProviderError('AUTH_REQUIRED', 'Google Drive authorization did not return an access token');
    }
    const expiresInRaw = hashParams.get('expires_in') ?? queryParams.get('expires_in');
    const expiresInSeconds = Number(expiresInRaw);
    const safeExpiresInSeconds = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600;
    return {
        token,
        cacheKey,
        expiresAt: Date.now() + safeExpiresInSeconds * 1000 - TOKEN_EXPIRY_SAFETY_MS,
        authStrategy: 'webExtensionAccessToken',
    };
}

async function launchWebAuthFlow(identity: any, details: { url: string; interactive: boolean; cacheKey: string }): Promise<CachedAccessToken> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const flowDetails = { url: details.url, interactive: details.interactive };
        const finish = (responseUrl?: string) => {
            if (settled) return;
            settled = true;
            const runtimeError = getRuntimeLastError() as { message?: string } | null;
            if (runtimeError || !responseUrl) {
                reject(mapIdentityError(runtimeError?.message || 'Google Drive authorization failed', details.interactive));
                return;
            }
            try {
                resolve(parseAccessTokenFromRedirect(responseUrl, details.cacheKey, details.interactive));
            } catch (error) {
                reject(error);
            }
        };
        try {
            const maybePromise = identity.launchWebAuthFlow(flowDetails, finish);
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then((responseUrl: string) => finish(responseUrl)).catch((error: unknown) => {
                    if (settled) return;
                    settled = true;
                    const message = error instanceof Error ? error.message : String(error);
                    reject(mapIdentityError(message, details.interactive));
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reject(mapIdentityError(message, details.interactive));
        }
    });
}

function extractIdentityToken(result: unknown): string | null {
    if (typeof result === 'string' && result.trim()) return result;
    if (typeof result === 'object' && result !== null) {
        const token = (result as { token?: unknown }).token;
        if (typeof token === 'string' && token.trim()) return token;
    }
    return null;
}

async function requestBrowserManagedTokenRaw(interactive: boolean): Promise<string> {
    const identity = getExtensionIdentity();
    if (!identity?.getAuthToken) {
        throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive browser identity.getAuthToken is unavailable');
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (result?: unknown) => {
            if (settled) return;
            settled = true;
            const runtimeError = getRuntimeLastError() as { message?: string } | null;
            if (runtimeError) {
                reject(mapIdentityError(runtimeError.message || 'Google Drive authorization failed', interactive));
                return;
            }
            const token = extractIdentityToken(result);
            if (!token) {
                reject(new CloudBackupProviderError('AUTH_REQUIRED', 'Google Drive authorization did not return an access token'));
                return;
            }
            resolve(token);
        };
        try {
            const maybePromise = identity.getAuthToken({ interactive }, finish);
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then((result: unknown) => finish(result)).catch((error: unknown) => {
                    if (settled) return;
                    settled = true;
                    const message = error instanceof Error ? error.message : String(error);
                    reject(mapIdentityError(message, interactive));
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reject(mapIdentityError(message, interactive));
        }
    });
}

function createAccessTokenCacheKey(diagnostics: CloudBackupDiagnostics, authStrategy: CloudBackupAuthStrategy = diagnostics.authStrategy): string {
    if (authStrategy === 'browserManagedGoogleIdentity') {
        return `${authStrategy}\n${diagnostics.chromeExtensionClientId ?? ''}\n${diagnostics.extensionId ?? ''}`;
    }
    return `${authStrategy}\n${diagnostics.webAuthClientId ?? diagnostics.chromeExtensionClientId ?? ''}\n${diagnostics.redirectUrl ?? ''}`;
}

function canUseBrowserManagedToken(diagnostics: CloudBackupDiagnostics): boolean {
    return diagnostics.authStrategy === 'browserManagedGoogleIdentity'
        && diagnostics.supportsGetAuthToken
        && diagnostics.hasManifestOAuthClient
        && diagnostics.hasDriveFileScope;
}

function isValidCachedAccessToken(token: CachedAccessToken | null, diagnostics: CloudBackupDiagnostics): token is CachedAccessToken {
    const browserCacheKey = createAccessTokenCacheKey(diagnostics, 'browserManagedGoogleIdentity');
    const webAuthCacheKey = createAccessTokenCacheKey(diagnostics, 'webExtensionAccessToken');
    return Boolean(token)
        && (token?.cacheKey === browserCacheKey || token?.cacheKey === webAuthCacheKey)
        && token.expiresAt > Date.now() + TOKEN_EXPIRY_SAFETY_MS;
}

async function persistAccessToken(token: CachedAccessToken): Promise<void> {
    cachedAccessToken = token;
    await storageSet({
        [ACCESS_TOKEN_STORAGE_KEYS.token]: token.token,
        [ACCESS_TOKEN_STORAGE_KEYS.expiresAt]: token.expiresAt,
        [ACCESS_TOKEN_STORAGE_KEYS.cacheKey]: token.cacheKey,
        [ACCESS_TOKEN_STORAGE_KEYS.authStrategy]: token.authStrategy,
    });
}

async function clearPersistedAccessToken(): Promise<void> {
    cachedAccessToken = null;
    await storageRemove([
        ACCESS_TOKEN_STORAGE_KEYS.token,
        ACCESS_TOKEN_STORAGE_KEYS.expiresAt,
        ACCESS_TOKEN_STORAGE_KEYS.cacheKey,
        ACCESS_TOKEN_STORAGE_KEYS.authStrategy,
        ...LEGACY_WEB_AUTH_TOKEN_STORAGE_KEYS,
    ]);
}

async function getValidCachedAccessToken(diagnostics: CloudBackupDiagnostics): Promise<TokenResult | null> {
    if (isValidCachedAccessToken(cachedAccessToken, diagnostics)) {
        return {
            token: cachedAccessToken.token,
            authStrategy: cachedAccessToken.authStrategy,
        };
    }
    if (cachedAccessToken) {
        cachedAccessToken = null;
    }
    const stored = await storageGet([
        ACCESS_TOKEN_STORAGE_KEYS.token,
        ACCESS_TOKEN_STORAGE_KEYS.expiresAt,
        ACCESS_TOKEN_STORAGE_KEYS.cacheKey,
        ACCESS_TOKEN_STORAGE_KEYS.authStrategy,
    ]);
    const token: CachedAccessToken | null = typeof stored[ACCESS_TOKEN_STORAGE_KEYS.token] === 'string'
        && typeof stored[ACCESS_TOKEN_STORAGE_KEYS.cacheKey] === 'string'
        && typeof stored[ACCESS_TOKEN_STORAGE_KEYS.expiresAt] === 'number'
        && (
            stored[ACCESS_TOKEN_STORAGE_KEYS.authStrategy] === 'browserManagedGoogleIdentity'
            || stored[ACCESS_TOKEN_STORAGE_KEYS.authStrategy] === 'webExtensionAccessToken'
        )
        ? {
            token: stored[ACCESS_TOKEN_STORAGE_KEYS.token] as string,
            cacheKey: stored[ACCESS_TOKEN_STORAGE_KEYS.cacheKey] as string,
            expiresAt: stored[ACCESS_TOKEN_STORAGE_KEYS.expiresAt] as number,
            authStrategy: stored[ACCESS_TOKEN_STORAGE_KEYS.authStrategy] as CloudBackupAuthStrategy,
        }
        : null;
    if (!isValidCachedAccessToken(token, diagnostics)) {
        if (token) await clearPersistedAccessToken();
        return null;
    }
    cachedAccessToken = token;
    return {
        token: token.token,
        authStrategy: token.authStrategy,
    };
}

function getValidCachedAccessTokenSync(diagnostics: CloudBackupDiagnostics): string | null {
    if (isValidCachedAccessToken(cachedAccessToken, diagnostics)) return cachedAccessToken.token;
    return null;
}

async function requestWebAuthToken(interactive: boolean, diagnostics: CloudBackupDiagnostics): Promise<TokenResult> {
    const identity = getExtensionIdentity();
    const clientId = diagnostics.webAuthClientId?.trim() ?? '';
    const redirectUrl = diagnostics.redirectUrl?.trim() ?? '';
    const scope = DRIVE_SCOPE;
    if (!identity?.launchWebAuthFlow || !isValidGoogleOAuthClientId(clientId) || !redirectUrl) {
        throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive Web OAuth requires a Web application OAuth client ID and identity.getRedirectURL');
    }
    const token = await launchWebAuthFlow(identity, {
        url: buildWebAuthUrl(clientId, redirectUrl, scope),
        interactive,
        cacheKey: createAccessTokenCacheKey(diagnostics, 'webExtensionAccessToken'),
    });
    await persistAccessToken(token);
    return {
        token: token.token,
        authStrategy: 'webExtensionAccessToken',
    };
}

async function requestBrowserManagedToken(interactive: boolean, diagnostics: CloudBackupDiagnostics): Promise<TokenResult> {
    const token = await requestBrowserManagedTokenRaw(interactive);
    await persistAccessToken({
        token,
        authStrategy: 'browserManagedGoogleIdentity',
        cacheKey: createAccessTokenCacheKey(diagnostics, 'browserManagedGoogleIdentity'),
        expiresAt: Date.now() + IDENTITY_TOKEN_TTL_SECONDS * 1000 - TOKEN_EXPIRY_SAFETY_MS,
    });
    return {
        token,
        authStrategy: 'browserManagedGoogleIdentity',
    };
}

async function requestToken(interactive: boolean, options: GoogleDriveProviderOptions = {}): Promise<TokenResult> {
    const diagnostics = assertAuthReady(options);
    const cached = await getValidCachedAccessToken(diagnostics);
    if (cached) return cached;
    if (canUseBrowserManagedToken(diagnostics)) {
        try {
            return await requestBrowserManagedToken(false, diagnostics);
        } catch (error) {
            if (!interactive) throw error;
            try {
                return await requestBrowserManagedToken(true, diagnostics);
            } catch {
                // Voyager-style fallback: a failed browser identity attempt should not
                // prevent WebAuth from trying the extension redirect URI with its Web OAuth client.
            }
        }
    }
    if (diagnostics.supportsLaunchWebAuthFlow) return requestWebAuthToken(interactive, diagnostics);
    throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive backup is not configured in this build');
}

async function resolveOperationAccessToken(options: GoogleDriveProviderOptions = {}): Promise<TokenResult> {
    const diagnostics = assertAuthReady(options);
    const cached = await getValidCachedAccessToken(diagnostics);
    if (cached) return cached;
    if (canUseBrowserManagedToken(diagnostics)) {
        try {
            return await requestBrowserManagedToken(false, diagnostics);
        } catch {
            try {
                return await requestBrowserManagedToken(true, diagnostics);
            } catch {
                // Continue to WebAuth fallback below.
            }
        }
    }
    if (diagnostics.supportsLaunchWebAuthFlow) return requestWebAuthToken(true, diagnostics);
    throw new CloudBackupProviderError('AUTH_REQUIRED', 'Google Drive authorization is required. Sign in to Google Drive before using backup or restore.');
}

async function getCachedTokenIfAny(options: GoogleDriveProviderOptions = {}): Promise<string | null> {
    const diagnostics = getManifestDiagnostics(options);
    const cached = await getValidCachedAccessToken(diagnostics);
    if (cached) return cached.token;
    if (canUseBrowserManagedToken(diagnostics)) {
        try {
            return (await requestBrowserManagedToken(false, diagnostics)).token;
        } catch {
            return null;
        }
    }
    return null;
}

async function revokeGoogleGrant(token: string): Promise<void> {
    await fetch(`${GOOGLE_OAUTH_REVOKE_API}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
}

async function removeBrowserCachedAuthToken(token: string): Promise<void> {
    const identity = getExtensionIdentity();
    if (!token || !identity?.removeCachedAuthToken) return;
    await new Promise<void>((resolve) => identity.removeCachedAuthToken({ token }, () => resolve()));
}

async function revokeTokenIfAny(options: GoogleDriveProviderOptions = {}): Promise<void> {
    const identity = getExtensionIdentity();
    const token = await getCachedTokenIfAny(options);
    await clearPersistedAccessToken();
    if (token) {
        await revokeGoogleGrant(token);
    }
    if (identity?.clearAllCachedAuthTokens) {
        await identity.clearAllCachedAuthTokens();
        return;
    }
    if (token) await removeBrowserCachedAuthToken(token);
}

async function driveFetch(path: string, init: RequestInit, token: string): Promise<Response> {
    const response = await fetch(path, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
        },
    });
    if (!response.ok) {
        let details = '';
        try {
            details = await response.text();
        } catch {
            details = '';
        }
        throw mapDriveError(response.status, `Google Drive request failed (${response.status})`, details);
    }
    return response;
}

async function fetchDriveAccount(token: string): Promise<CloudBackupAccountSummary> {
    const fields = encodeURIComponent('user(displayName,emailAddress,photoLink)');
    const json = await (await driveFetch(`${DRIVE_API}/about?fields=${fields}`, { method: 'GET' }, token)).json();
    const user = json?.user && typeof json.user === 'object' ? json.user as Record<string, unknown> : {};
    return {
        accountEmail: typeof user.emailAddress === 'string' ? user.emailAddress : null,
        accountDisplayName: typeof user.displayName === 'string' ? user.displayName : null,
        accountPhotoUrl: typeof user.photoLink === 'string' ? user.photoLink : null,
    };
}

function escapeDriveQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function snapshotFileName(snapshot: CloudBackupSnapshotV1): string {
    const safeTime = snapshot.createdAt.replace(/[:.]/g, '-');
    return `aimd-bookmarks-${safeTime}-${snapshot.snapshotId}.json`;
}

export function idFromGoogleDriveSnapshotFileName(name: string): string {
    const match = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i);
    return match?.[1] ?? name;
}

export function createGoogleDriveProvider(options: GoogleDriveProviderOptions = {}): CloudBackupProvider {
    const fileBySnapshotId = new Map<string, string>();

    async function runDriveOperation<T>(operation: (token: string) => Promise<T>): Promise<T> {
        const auth = await resolveOperationAccessToken(options);
        try {
            return await operation(auth.token);
        } catch (error) {
            if (!(error instanceof CloudBackupProviderError) || error.code !== 'AUTH_REQUIRED' || auth.authStrategy !== 'browserManagedGoogleIdentity') {
                throw error;
            }
            await removeBrowserCachedAuthToken(auth.token);
            await clearPersistedAccessToken();
            const retryAuth = await resolveOperationAccessToken(options);
            return operation(retryAuth.token);
        }
    }

    async function findFolder(name: string, parentId: string | null, token: string): Promise<string | null> {
        const parent = parentId ? ` and '${escapeDriveQuery(parentId)}' in parents` : '';
        const q = `name='${escapeDriveQuery(name)}' and mimeType='${FOLDER_MIME}' and trashed=false${parent}`;
        const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
        const json = await (await driveFetch(url, { method: 'GET' }, token)).json();
        return json.files?.[0]?.id ?? null;
    }

    async function createFolder(name: string, parentId: string | null, token: string): Promise<string> {
        const metadata: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
        if (parentId) metadata.parents = [parentId];
        const json = await (await driveFetch(`${DRIVE_API}/files?fields=id,name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata),
        }, token)).json();
        return json.id;
    }

    async function ensureFolder(name: string, parentId: string | null, token: string): Promise<string> {
        return await findFolder(name, parentId, token) ?? await createFolder(name, parentId, token);
    }

    async function ensureBackupFolder(token: string): Promise<string> {
        const root = await ensureFolder('AI-MarkDone', null, token);
        const backups = await ensureFolder('Backups', root, token);
        return ensureFolder('bookmarks', backups, token);
    }

    async function findBackupFolder(token: string): Promise<string | null> {
        const root = await findFolder('AI-MarkDone', null, token);
        if (!root) return null;
        const backups = await findFolder('Backups', root, token);
        if (!backups) return null;
        return findFolder('bookmarks', backups, token);
    }

    async function downloadByFileId(fileId: string, token: string): Promise<CloudBackupSnapshotV1> {
        const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { method: 'GET' }, token);
        return validateCloudBackupSnapshot(await response.json());
    }

    async function deleteUploadedFile(fileId: string, token: string): Promise<void> {
        await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }, token);
    }

    async function throwUploadIntegrityMismatch(createdFileId: string, token: string): Promise<never> {
        let message = 'Uploaded Google Drive snapshot did not match local snapshot';
        try {
            await deleteUploadedFile(createdFileId, token);
        } catch {
            message += '. Remote cleanup failed; delete the mismatched JSON file from AI-MarkDone/Backups/bookmarks in Google Drive if it appears there.';
        }
        throw new CloudBackupProviderError('INTEGRITY_MISMATCH', message);
    }

    async function uploadSnapshotViaResumableSession(snapshotJson: string, metadata: Record<string, unknown>, token: string): Promise<any> {
        const snapshotBytes = new TextEncoder().encode(snapshotJson).byteLength;
        const sessionResponse = await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,createdTime`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': 'application/json',
                'X-Upload-Content-Length': String(snapshotBytes),
            },
            body: JSON.stringify(metadata),
        }, token);
        const uploadUrl = sessionResponse.headers.get('Location');
        if (!uploadUrl) {
            throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive did not return a resumable upload session URL');
        }
        return (await driveFetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: snapshotJson,
        }, token)).json();
    }

    return {
        getConfigurationStatus: () => getGoogleDriveConfigurationStatus(options),
        getDiagnostics: () => getManifestDiagnostics(options),
        getSessionState: () => {
            const diagnostics = getManifestDiagnostics(options);
            if (!diagnostics.ready) return 'error';
            if (diagnostics.authStrategy === 'browserManagedGoogleIdentity') return 'readyInThisSession';
            return getValidCachedAccessTokenSync(diagnostics) ? 'readyInThisSession' : 'unknown';
        },
        async connect() {
            const { token, authStrategy } = await requestToken(true, options);
            return {
                ...(await fetchDriveAccount(token)),
                authStrategy,
            };
        },
        async disconnect() {
            await revokeTokenIfAny(options);
        },
        async uploadSnapshot(snapshot) {
            return runDriveOperation(async (token) => {
                const snapshotJson = JSON.stringify(snapshot, null, 2);
                const folderId = await ensureBackupFolder(token);
                const metadata = {
                    name: snapshotFileName(snapshot),
                    mimeType: 'application/json',
                    parents: [folderId],
                };
                const created = await uploadSnapshotViaResumableSession(snapshotJson, metadata, token);
                let downloaded: CloudBackupSnapshotV1 | null = null;
                try {
                    downloaded = await downloadByFileId(created.id, token);
                } catch {
                    await throwUploadIntegrityMismatch(created.id, token);
                }
                if (!downloaded || downloaded.payloadHash !== snapshot.payloadHash || downloaded.snapshotId !== snapshot.snapshotId) {
                    await throwUploadIntegrityMismatch(created.id, token);
                }
                fileBySnapshotId.set(snapshot.snapshotId, created.id);
                return {
                    snapshotId: snapshot.snapshotId,
                    name: created.name,
                    createdAt: created.createdTime ?? snapshot.createdAt,
                    size: Number(created.size ?? 0),
                };
            });
        },
        async listSnapshots() {
            return runDriveOperation(async (token) => {
                const folderId = await findBackupFolder(token);
                if (!folderId) return [];
                const q = `'${escapeDriveQuery(folderId)}' in parents and trashed=false and name contains 'aimd-bookmarks-'`;
                const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=50`;
                const json = await (await driveFetch(url, { method: 'GET' }, token)).json();
                return (json.files ?? []).map((file: any) => {
                    const snapshotId = idFromGoogleDriveSnapshotFileName(String(file.name ?? ''));
                    fileBySnapshotId.set(snapshotId, file.id);
                    return {
                        snapshotId,
                        name: String(file.name ?? ''),
                        createdAt: String(file.createdTime ?? ''),
                        size: Number(file.size ?? 0),
                    };
                });
            });
        },
        async downloadSnapshot(snapshotId) {
            return runDriveOperation(async (token) => {
                let fileId = fileBySnapshotId.get(snapshotId);
                if (!fileId) {
                    await this.listSnapshots();
                    fileId = fileBySnapshotId.get(snapshotId);
                }
                if (!fileId) throw new CloudBackupProviderError('NOT_FOUND', 'Google Drive backup snapshot was not found');
                return downloadByFileId(fileId, token);
            });
        },
        async deleteSnapshot(snapshotId) {
            return runDriveOperation(async (token) => {
                let fileId = fileBySnapshotId.get(snapshotId);
                if (!fileId) {
                    await this.listSnapshots();
                    fileId = fileBySnapshotId.get(snapshotId);
                }
                if (!fileId) return;
                await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trashed: true }),
                }, token);
                fileBySnapshotId.delete(snapshotId);
            });
        },
    };
}
