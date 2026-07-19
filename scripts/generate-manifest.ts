import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionAssets, getWebAccessibleResourcesForTarget } from '../config/extension/assets';
import {
    GOOGLE_DRIVE_API_HOST_PERMISSION,
    cloudBackupTargets,
    GOOGLE_OAUTH_REVOKE_HOST_PERMISSION,
    GOOGLE_DRIVE_FILE_SCOPE,
    isValidGoogleOAuthClientId,
} from '../config/extension/cloudBackup';
import { CHROME_WEB_STORE_EXTENSION_ID, CHROME_WEB_STORE_PUBLIC_KEY } from '../config/extension/chromeWebStore';
import { CHATGPT_HOST_PATTERNS, SUPPORTED_HOST_PATTERNS } from '../config/extension/hosts';
import { extensionMeta } from '../config/extension/meta';
import { type ExtensionTarget, extensionTargets } from '../config/extension/targets';

type Manifest = Record<string, unknown>;
type BuildManifestOptions = {
    expectedChromeExtensionId?: string;
};

export function isExtensionTarget(value: string): value is ExtensionTarget {
    return value === 'chrome' || value === 'firefox' || value === 'safari';
}

export function deriveChromeExtensionIdFromManifestKey(publicKey: string): string {
    const keyBytes = Buffer.from(publicKey.replace(/\s+/g, ''), 'base64');
    const digest = createHash('sha256').update(keyBytes).digest();
    const alphabet = 'abcdefghijklmnop';
    let id = '';
    for (const byte of digest.subarray(0, 16)) {
        id += alphabet[byte >> 4] + alphabet[byte & 0xf];
    }
    return id;
}

export function buildManifest(target: ExtensionTarget, options: BuildManifestOptions = {}): Manifest {
    const targetConfig = extensionTargets[target] as any;
    const googleDriveCloudBackup = cloudBackupTargets[target].googleDrive;
    const manifest: Manifest = {
        manifest_version: targetConfig.manifestVersion,
        name: `__MSG_${extensionMeta.displayNameMessageKey}__`,
        version: extensionMeta.version,
        description: `__MSG_${extensionMeta.descriptionMessageKey}__`,
        default_locale: extensionMeta.defaultLocale,
        homepage_url: extensionMeta.homepageUrl,
        permissions: [
            'clipboardWrite',
            'storage',
        ],
    };

    if (target === 'chrome') {
        manifest.minimum_chrome_version = targetConfig.minimumChromeVersion;
    }

    if (target === 'chrome' && googleDriveCloudBackup.enabled) {
        const chromeExtensionClientId = googleDriveCloudBackup.chromeExtensionClientId?.trim() || '';
        if (!isValidGoogleOAuthClientId(chromeExtensionClientId)) {
            throw new Error('Google Drive Chrome Extension OAuth client id is missing or invalid for the Chrome manifest.');
        }
        manifest.permissions = [
            ...(manifest.permissions as string[]),
            'identity',
        ];
        manifest.oauth2 = {
            client_id: chromeExtensionClientId,
            scopes: [GOOGLE_DRIVE_FILE_SCOPE],
        };

        const chromeExtensionKey = process.env.AIMD_CHROME_EXTENSION_KEY?.trim() || CHROME_WEB_STORE_PUBLIC_KEY;
        if (chromeExtensionKey) {
            const expectedId = options.expectedChromeExtensionId ?? CHROME_WEB_STORE_EXTENSION_ID;
            const actualId = deriveChromeExtensionIdFromManifestKey(chromeExtensionKey);
            if (actualId !== expectedId) {
                throw new Error(`Chrome extension key resolves to ${actualId}, but the Google OAuth client must be bound to ${expectedId}. Use the public key from the Chrome Web Store item.`);
            }
            manifest.key = chromeExtensionKey;
        }
    }

    if (target === 'firefox' && googleDriveCloudBackup.enabled) {
        const webAuthClientId = googleDriveCloudBackup.webAuthClientId?.trim() || '';
        if (!isValidGoogleOAuthClientId(webAuthClientId)) {
            throw new Error('Google Drive Web OAuth client id is missing or invalid for the Firefox manifest.');
        }
        manifest.permissions = [
            ...(manifest.permissions as string[]),
            'identity',
        ];
    }

    if (targetConfig.hostPermissionPlacement === 'host_permissions') {
        manifest.host_permissions = googleDriveCloudBackup.enabled
            ? [...SUPPORTED_HOST_PATTERNS, GOOGLE_DRIVE_API_HOST_PERMISSION, GOOGLE_OAUTH_REVOKE_HOST_PERMISSION]
            : [...SUPPORTED_HOST_PATTERNS];
    } else {
        manifest.permissions = [
            ...(manifest.permissions as string[]),
            ...SUPPORTED_HOST_PATTERNS,
            ...(googleDriveCloudBackup.enabled ? [GOOGLE_DRIVE_API_HOST_PERMISSION, GOOGLE_OAUTH_REVOKE_HOST_PERMISSION] : []),
        ];
    }

    const chatGptCaptureScript = target !== 'safari'
        ? {
            matches: [...CHATGPT_HOST_PATTERNS],
            js: [extensionAssets.chatGptConversationBridge],
            run_at: 'document_start',
            world: 'MAIN',
        }
        : {
            matches: [...CHATGPT_HOST_PATTERNS],
            js: [extensionAssets.chatGptConversationBootstrap],
            run_at: 'document_start',
        };

    manifest.content_scripts = [
        chatGptCaptureScript,
        {
            matches: [...SUPPORTED_HOST_PATTERNS],
            js: [extensionAssets.contentEntry],
            run_at: 'document_idle',
        },
    ];

    manifest.background = targetConfig.backgroundKind === 'service_worker'
        ? { service_worker: extensionAssets.backgroundEntry }
        : { scripts: [extensionAssets.backgroundEntry] };

    manifest[targetConfig.actionKey] = {
        default_icon: extensionAssets.icons,
    };
    manifest.icons = extensionAssets.icons;

    const webAccessibleResources = getWebAccessibleResourcesForTarget(target);
    manifest.web_accessible_resources = targetConfig.webAccessibleResourcesStyle === 'mv3'
        ? [
            {
                resources: [...webAccessibleResources],
                matches: [...SUPPORTED_HOST_PATTERNS],
            },
        ]
        : [...webAccessibleResources];

    if (target === 'firefox') {
        const firefoxConfig = extensionTargets.firefox;
        manifest.browser_specific_settings = {
            gecko: {
                id: firefoxConfig.gecko.id,
                strict_min_version: firefoxConfig.gecko.strictMinVersion,
                data_collection_permissions: {
                    required: [...firefoxConfig.gecko.dataCollectionPermissions.required],
                },
            },
        };
    }

    return manifest;
}

export function writeManifest(target: ExtensionTarget, outputPath: string): void {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(buildManifest(target), null, 4)}\n`);
}

function defaultOutputPath(target: ExtensionTarget): string {
    return resolve(process.cwd(), `manifest.${target}.json`);
}

function runCli(): void {
    const target = process.argv[2] ?? '';
    if (!isExtensionTarget(target)) {
        console.error('Usage: tsx scripts/generate-manifest.ts <chrome|firefox|safari> [output]');
        process.exit(1);
    }
    writeManifest(target, resolve(process.cwd(), process.argv[3] ?? defaultOutputPath(target)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    runCli();
}
