import { validateCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import type { CloudBackupSnapshotV1 } from '../../../core/cloudBackup/types';
import { CloudBackupProviderError, type CloudBackupProvider } from './provider';
import type { CloudBackupDiagnostics } from '../../../contracts/protocol';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_OAUTH_REVOKE_API = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_DRIVE_API_HOST_PERMISSION = 'https://www.googleapis.com/*';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

type ChromeManifest = {
    permissions?: unknown;
    host_permissions?: unknown;
    oauth2?: {
        client_id?: unknown;
        scopes?: unknown;
    };
};

function getChromeIdentity(): any {
    return (globalThis as any).chrome?.identity;
}

function getChromeManifest(): ChromeManifest | null {
    try {
        return (globalThis as any).chrome?.runtime?.getManifest?.() ?? null;
    } catch {
        return null;
    }
}

function manifestStrings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isValidGoogleOAuthClientId(value: string | null): value is string {
    return typeof value === 'string' && /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(value.trim());
}

function getManifestDiagnostics(): CloudBackupDiagnostics {
    const manifest = getChromeManifest();
    const permissions = manifestStrings(manifest?.permissions);
    const hostPermissions = manifestStrings(manifest?.host_permissions);
    const scopes = manifestStrings(manifest?.oauth2?.scopes);
    const clientId = typeof manifest?.oauth2?.client_id === 'string' ? manifest.oauth2.client_id.trim() : null;
    const identity = getChromeIdentity();
    const hasIdentityPermission = permissions.includes('identity');
    const hasManifestOauth2 = Boolean(clientId);
    const hasDriveFileScope = scopes.includes(DRIVE_SCOPE);
    const hasGoogleApiHostPermission = hostPermissions.includes(GOOGLE_DRIVE_API_HOST_PERMISSION)
        || permissions.includes(GOOGLE_DRIVE_API_HOST_PERMISSION);
    const hasGetAuthToken = typeof identity?.getAuthToken === 'function';
    return {
        extensionId: (globalThis as any).chrome?.runtime?.id ?? null,
        clientId,
        hasIdentityPermission,
        hasManifestOauth2,
        hasDriveFileScope,
        hasGoogleApiHostPermission,
        hasGetAuthToken,
        ready: hasIdentityPermission
            && hasManifestOauth2
            && isValidGoogleOAuthClientId(clientId)
            && hasDriveFileScope
            && hasGoogleApiHostPermission
            && hasGetAuthToken,
    };
}

function assertManifestReady(): CloudBackupDiagnostics {
    const diagnostics = getManifestDiagnostics();
    const identity = getChromeIdentity();
    if (!diagnostics.hasIdentityPermission) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is only available in a Chrome build whose manifest includes the identity permission. Rebuild and reload the Chrome extension from dist-chrome.',
        );
    }
    if (!diagnostics.hasManifestOauth2) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires manifest oauth2.client_id and oauth2.scopes. Rebuild Chrome from the repo-owned Google Drive OAuth configuration and reload dist-chrome.',
        );
    }
    if (!isValidGoogleOAuthClientId(diagnostics.clientId)) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup manifest oauth2.client_id is not a valid Google OAuth client ID.',
        );
    }
    if (!diagnostics.hasDriveFileScope) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires the https://www.googleapis.com/auth/drive.file scope in manifest oauth2.scopes.',
        );
    }
    if (!diagnostics.hasGoogleApiHostPermission) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup requires the https://www.googleapis.com/* host permission in the Chrome manifest.',
        );
    }
    if (!identity?.getAuthToken) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is only available in a Chrome build with the identity permission and Chrome identity API.',
        );
    }
    return diagnostics;
}

function getGoogleDriveConfigurationStatus(): { configured: boolean; message?: string } {
    try {
        assertManifestReady();
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
        normalized.includes('client_id') && normalized.includes('registered')
    ) {
        return new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is configured with an invalid OAuth client. Use a Google Cloud Chrome Extension OAuth client ID and make sure it is bound to the current Chrome extension ID.',
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

async function requestToken(interactive: boolean): Promise<string> {
    assertManifestReady();
    const identity = getChromeIdentity();
    if (!identity?.getAuthToken) {
        throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Chrome identity API is unavailable');
    }
    return new Promise((resolve, reject) => {
        identity.getAuthToken({ interactive, scopes: [DRIVE_SCOPE] }, (token: string | undefined) => {
            const runtimeError = (globalThis as any).chrome?.runtime?.lastError;
            if (runtimeError || !token) {
                reject(mapIdentityError(runtimeError?.message || 'Google Drive authorization failed', interactive));
                return;
            }
            resolve(token);
        });
    });
}

async function getCachedTokenIfAny(): Promise<string | null> {
    const identity = getChromeIdentity();
    if (!identity?.getAuthToken) return null;
    return new Promise<string | null>((resolve) => {
        identity.getAuthToken({ interactive: false, scopes: [DRIVE_SCOPE] }, (value: string | undefined) => {
            resolve(value ?? null);
        });
    });
}

async function revokeGoogleGrant(token: string): Promise<void> {
    await fetch(`${GOOGLE_OAUTH_REVOKE_API}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
}

async function revokeTokenIfAny(): Promise<void> {
    const identity = getChromeIdentity();
    const token = await getCachedTokenIfAny();
    if (token) {
        await revokeGoogleGrant(token);
    }
    if (identity?.clearAllCachedAuthTokens) {
        await identity.clearAllCachedAuthTokens();
        return;
    }
    if (!token || !identity?.removeCachedAuthToken) return;
    await new Promise<void>((resolve) => identity.removeCachedAuthToken({ token }, () => resolve()));
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

export function createGoogleDriveProvider(): CloudBackupProvider {
    const fileBySnapshotId = new Map<string, string>();

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
        getConfigurationStatus: getGoogleDriveConfigurationStatus,
        getDiagnostics: getManifestDiagnostics,
        async connect() {
            await requestToken(true);
            return {};
        },
        async disconnect() {
            await revokeTokenIfAny();
        },
        async uploadSnapshot(snapshot) {
            const snapshotJson = JSON.stringify(snapshot, null, 2);
            const token = await requestToken(false);
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
        },
        async listSnapshots() {
            const token = await requestToken(false);
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
        },
        async downloadSnapshot(snapshotId) {
            const token = await requestToken(false);
            let fileId = fileBySnapshotId.get(snapshotId);
            if (!fileId) {
                await this.listSnapshots();
                fileId = fileBySnapshotId.get(snapshotId);
            }
            if (!fileId) throw new CloudBackupProviderError('NOT_FOUND', 'Google Drive backup snapshot was not found');
            return downloadByFileId(fileId, token);
        },
        async deleteSnapshot(snapshotId) {
            const token = await requestToken(false);
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
        },
    };
}
