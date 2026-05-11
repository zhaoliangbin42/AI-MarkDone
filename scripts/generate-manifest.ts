import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionAssets } from '../config/extension/assets';
import {
    GOOGLE_DRIVE_API_HOST_PERMISSION,
    cloudBackupTargets,
    GOOGLE_OAUTH_REVOKE_HOST_PERMISSION,
    isValidGoogleOAuthClientId,
} from '../config/extension/cloudBackup';
import { SUPPORTED_HOST_PATTERNS } from '../config/extension/hosts';
import { extensionMeta } from '../config/extension/meta';
import { type ExtensionTarget, extensionTargets } from '../config/extension/targets';

type Manifest = Record<string, unknown>;

export function isExtensionTarget(value: string): value is ExtensionTarget {
    return value === 'chrome' || value === 'firefox' || value === 'safari';
}

export function buildManifest(target: ExtensionTarget): Manifest {
    const targetConfig = extensionTargets[target] as any;
    const googleDriveCloudBackup = cloudBackupTargets[target].googleDrive;
    const manifest: Manifest = {
        manifest_version: targetConfig.manifestVersion,
        name: `__MSG_${extensionMeta.displayNameMessageKey}__`,
        version: extensionMeta.version,
        description: `__MSG_${extensionMeta.descriptionMessageKey}__`,
        default_locale: extensionMeta.defaultLocale,
        permissions: [
            'clipboardWrite',
            'storage',
        ],
    };

    if (target === 'chrome' && googleDriveCloudBackup.enabled) {
        manifest.permissions = [
            ...(manifest.permissions as string[]),
            'identity',
        ];
        const googleClientId = process.env.AIMD_GOOGLE_CLIENT_ID?.trim() || googleDriveCloudBackup.clientId?.trim() || '';
        if (!isValidGoogleOAuthClientId(googleClientId)) {
            throw new Error('Google Drive OAuth client id is missing or invalid for the Chrome manifest.');
        }
        manifest.oauth2 = {
            client_id: googleClientId,
            scopes: [...googleDriveCloudBackup.scopes],
        };
    }

    if (targetConfig.hostPermissionPlacement === 'host_permissions') {
        manifest.host_permissions = googleDriveCloudBackup.enabled
            ? [...SUPPORTED_HOST_PATTERNS, GOOGLE_DRIVE_API_HOST_PERMISSION, GOOGLE_OAUTH_REVOKE_HOST_PERMISSION]
            : [...SUPPORTED_HOST_PATTERNS];
    } else {
        manifest.permissions = [
            ...(manifest.permissions as string[]),
            ...SUPPORTED_HOST_PATTERNS,
        ];
    }

    manifest.content_scripts = [
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

    manifest.web_accessible_resources = targetConfig.webAccessibleResourcesStyle === 'mv3'
        ? [
            {
                resources: [...extensionAssets.webAccessibleResources],
                matches: [...SUPPORTED_HOST_PATTERNS],
            },
        ]
        : [...extensionAssets.webAccessibleResources];

    if (target === 'firefox') {
        const firefoxConfig = extensionTargets.firefox;
        manifest.browser_specific_settings = {
            gecko: {
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
