import { validateCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import type { CloudBackupSnapshotV1 } from '../../../core/cloudBackup/types';
import { CloudBackupProviderError, type CloudBackupProvider } from './provider';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_OAUTH_REVOKE_API = 'https://oauth2.googleapis.com/revoke';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

type ChromeManifest = {
    permissions?: unknown;
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

function hasPermission(manifest: ChromeManifest, permission: string): boolean {
    return Array.isArray(manifest.permissions) && manifest.permissions.includes(permission);
}

function getConfiguredGoogleClientId(): string {
    const manifest = getChromeManifest();
    if (!manifest || !hasPermission(manifest, 'identity')) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is only available in a Chrome build with the identity permission',
        );
    }

    const clientId = typeof manifest.oauth2?.client_id === 'string' ? manifest.oauth2.client_id.trim() : '';
    if (!clientId) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is missing the Chrome manifest OAuth client ID. Regenerate Chrome from config/extension/cloudBackup.ts with the public Chrome Extension OAuth client ID.',
        );
    }
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
        throw new CloudBackupProviderError(
            'PROVIDER_UNAVAILABLE',
            'Google Drive backup is configured with an invalid Google OAuth client ID. Use the Chrome Extension OAuth client ID from Google Cloud.',
        );
    }
    return clientId;
}

function getGoogleDriveConfigurationStatus(): { configured: boolean; message?: string } {
    try {
        getConfiguredGoogleClientId();
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
        interactive ? 'AUTH_REQUIRED' : 'PROVIDER_UNAVAILABLE',
        message || 'Google Drive authorization failed',
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
    getConfiguredGoogleClientId();
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

    async function downloadByFileId(fileId: string, token: string): Promise<CloudBackupSnapshotV1> {
        const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { method: 'GET' }, token);
        return validateCloudBackupSnapshot(await response.json());
    }

    return {
        getConfigurationStatus: getGoogleDriveConfigurationStatus,
        async connect() {
            await requestToken(true);
            return {};
        },
        async disconnect() {
            await revokeTokenIfAny();
        },
        async uploadSnapshot(snapshot) {
            const token = await requestToken(false);
            const folderId = await ensureBackupFolder(token);
            const metadata = {
                name: snapshotFileName(snapshot),
                mimeType: 'application/json',
                parents: [folderId],
            };
            const body = new FormData();
            body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            body.append('file', new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
            const created = await (await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,createdTime`, {
                method: 'POST',
                body,
            }, token)).json();
            const downloaded = await downloadByFileId(created.id, token);
            if (downloaded.payloadHash !== snapshot.payloadHash || downloaded.snapshotId !== snapshot.snapshotId) {
                throw new CloudBackupProviderError('INTEGRITY_MISMATCH', 'Uploaded Google Drive snapshot did not match local snapshot');
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
            const folderId = await ensureBackupFolder(token);
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
            if (!fileId) throw new CloudBackupProviderError('NOT_FOUND', 'Cloud backup snapshot was not found');
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
            await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }, token);
            fileBySnapshotId.delete(snapshotId);
        },
    };
}
