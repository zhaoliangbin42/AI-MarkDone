import type { ExtensionTarget } from './targets';

export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_API_HOST_PERMISSION = 'https://www.googleapis.com/*';
export const GOOGLE_OAUTH_REVOKE_HOST_PERMISSION = 'https://oauth2.googleapis.com/*';

export type CloudBackupAuthStrategy =
    | 'browserManagedGoogleIdentity'
    | 'webExtensionAccessToken'
    | 'nativeOrUnsupported';

export type GoogleDriveCloudBackupTarget = {
    enabled: boolean;
    authStrategy: CloudBackupAuthStrategy;
    chromeExtensionClientId?: string;
    webAuthClientId?: string;
    scopes: readonly string[];
};

export const GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID = '731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com';
export const GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID = '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com';

export const cloudBackupTargets = {
    chrome: {
        googleDrive: {
            enabled: true,
            authStrategy: 'browserManagedGoogleIdentity',
            chromeExtensionClientId: GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID,
            webAuthClientId: GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID,
            scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        },
    },
    firefox: {
        googleDrive: {
            enabled: Boolean(GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID),
            authStrategy: 'webExtensionAccessToken',
            webAuthClientId: GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID || undefined,
            scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        },
    },
    safari: {
        googleDrive: {
            enabled: false,
            authStrategy: 'nativeOrUnsupported',
            scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        },
    },
} as const satisfies Record<ExtensionTarget, { googleDrive: GoogleDriveCloudBackupTarget }>;

export function isValidGoogleOAuthClientId(value: string): boolean {
    return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(value.trim());
}
