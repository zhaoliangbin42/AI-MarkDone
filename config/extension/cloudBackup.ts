import type { ExtensionTarget } from './targets';

export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_API_HOST_PERMISSION = 'https://www.googleapis.com/*';
export const GOOGLE_OAUTH_REVOKE_HOST_PERMISSION = 'https://oauth2.googleapis.com/*';

export type CloudBackupAuthStrategy =
    | 'chromeIdentityManifestOAuth2'
    | 'launchWebAuthFlowPkce'
    | 'nativeOrUnsupported';

export type GoogleDriveCloudBackupTarget = {
    enabled: boolean;
    authStrategy: CloudBackupAuthStrategy;
    clientId?: string;
    scopes: readonly string[];
};

export const cloudBackupTargets = {
    chrome: {
        googleDrive: {
            enabled: true,
            authStrategy: 'chromeIdentityManifestOAuth2',
            clientId: '731206378409-mbf1j0ar77manlqu5360edplddbne3kv.apps.googleusercontent.com',
            scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        },
    },
    firefox: {
        googleDrive: {
            enabled: false,
            authStrategy: 'launchWebAuthFlowPkce',
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
