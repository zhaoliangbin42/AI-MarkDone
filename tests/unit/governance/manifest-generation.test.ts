import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extensionMeta } from '../../../config/extension/meta';
import { extensionAssets } from '../../../config/extension/assets';
import { SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';
import { extensionTargets } from '../../../config/extension/targets';
import { GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID, GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID, cloudBackupTargets } from '../../../config/extension/cloudBackup';
import { CHROME_WEB_STORE_EXTENSION_ID, CHROME_WEB_STORE_PUBLIC_KEY } from '../../../config/extension/chromeWebStore';
import { buildManifest, deriveChromeExtensionIdFromManifestKey } from '../../../scripts/generate-manifest';

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8')) as T;
}

describe('extension manifest generation', () => {
    const originalGoogleClientId = process.env.AIMD_GOOGLE_CLIENT_ID;
    const originalChromeExtensionKey = process.env.AIMD_CHROME_EXTENSION_KEY;
    const mismatchChromeExtensionKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAj/u/XDdjlDyw7gHEtaaasZ9GdG8WOKAyJzXd8HFrDtz2Jcuy7er7MtWvHgNDA0bwpznbI5YdZeV4UfCEsA4SrA5b3MnWTHwA1bgbiDM+L9rrqvcadcKuOlTeN48Q0ijmhHlNFbTzvT9W0zw/GKv8LgXAHggxtmHQ/Z9PP2QNF5O8rUHHSL4AJ6hNcEKSBVSmbbjeVm4gSXDuED5r0nwxvRtupDxGYp8IZpP5KlExqNu1nbkPc+igCTIB6XsqijagzxewUHCdovmkb2JNtskx/PMIEv+TvWIx2BzqGp71gSh/dV7SJ3rClvWd2xj8dtxG8FfAWDTIIi0qZXWn2QhizQIDAQAB';

    function withGoogleClientId<T>(value: string | undefined, fn: () => T): T {
        if (value === undefined) delete process.env.AIMD_GOOGLE_CLIENT_ID;
        else process.env.AIMD_GOOGLE_CLIENT_ID = value;
        try {
            return fn();
        } finally {
            if (originalGoogleClientId === undefined) delete process.env.AIMD_GOOGLE_CLIENT_ID;
            else process.env.AIMD_GOOGLE_CLIENT_ID = originalGoogleClientId;
        }
    }

    function withChromeExtensionKey<T>(value: string | undefined, fn: () => T): T {
        if (value === undefined) delete process.env.AIMD_CHROME_EXTENSION_KEY;
        else process.env.AIMD_CHROME_EXTENSION_KEY = value;
        try {
            return fn();
        } finally {
            if (originalChromeExtensionKey === undefined) delete process.env.AIMD_CHROME_EXTENSION_KEY;
            else process.env.AIMD_CHROME_EXTENSION_KEY = originalChromeExtensionKey;
        }
    }

    it('keeps package metadata and generated target manifests aligned', () => {
        const pkg = readJson<{ version: string }>('package.json');

        expect(extensionMeta.version).toBe(pkg.version);
        expect(Object.keys(extensionTargets).sort()).toEqual(['chrome', 'firefox', 'safari']);

        for (const target of Object.keys(extensionTargets) as Array<keyof typeof extensionTargets>) {
            const manifest = buildManifest(target) as any;
            expect(manifest.version).toBe(pkg.version);
            expect(manifest.name).toBe(`__MSG_${extensionMeta.displayNameMessageKey}__`);
            expect(manifest.description).toBe(`__MSG_${extensionMeta.descriptionMessageKey}__`);
            expect(manifest.default_locale).toBe(extensionMeta.defaultLocale);
        }
    });

    it('preserves current chrome and firefox manifest semantics', () => {
        withGoogleClientId(undefined, () => {
            expect(buildManifest('chrome')).toEqual(readJson('manifest.chrome.json'));
            expect(buildManifest('firefox')).toEqual(readJson('manifest.firefox.json'));
            expect(buildManifest('safari')).toEqual(readJson('manifest.safari.json'));
        });
    });

    it('uses browser-managed Chrome OAuth and WebExtension Firefox OAuth permissions', () => {
        withGoogleClientId(undefined, () => {
            const chrome = buildManifest('chrome') as any;
            const firefox = buildManifest('firefox') as any;
            const safari = buildManifest('safari') as any;

            expect(chrome.key).toBe(CHROME_WEB_STORE_PUBLIC_KEY);
            expect(deriveChromeExtensionIdFromManifestKey(chrome.key)).toBe(CHROME_WEB_STORE_EXTENSION_ID);
            expect(chrome.oauth2).toEqual({
                client_id: GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID,
                scopes: ['https://www.googleapis.com/auth/drive.file'],
            });
            expect(cloudBackupTargets.chrome.googleDrive.chromeExtensionClientId).toBe(GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID);
            expect(cloudBackupTargets.chrome.googleDrive.webAuthClientId).toBe(GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID);
            expect(chrome.permissions).toContain('identity');
            expect(chrome.permissions).not.toContain('identity.email');
            expect(chrome.host_permissions).toContain('https://www.googleapis.com/*');
            expect(chrome.host_permissions).toContain('https://oauth2.googleapis.com/*');
            expect(firefox.oauth2).toBeUndefined();
            expect(firefox.permissions).toContain('identity');
            expect(firefox.permissions).toContain('https://www.googleapis.com/*');
            expect(firefox.permissions).toContain('https://oauth2.googleapis.com/*');
            expect(safari.oauth2).toBeUndefined();
            expect(safari.permissions).not.toContain('identity');
            expect(safari.permissions).not.toContain('https://www.googleapis.com/*');
            expect(safari.permissions).not.toContain('https://oauth2.googleapis.com/*');
        });
    });

    it('enables Firefox Google Drive support only when a Web OAuth client id is configured', () => {
        const originalEnabled = cloudBackupTargets.firefox.googleDrive.enabled;
        const originalWebClientId = cloudBackupTargets.firefox.googleDrive.webAuthClientId;
        (cloudBackupTargets.firefox.googleDrive as any).enabled = true;
        (cloudBackupTargets.firefox.googleDrive as any).webAuthClientId = '1234567890-webext.apps.googleusercontent.com';
        try {
            const firefox = buildManifest('firefox') as any;

            expect(firefox.oauth2).toBeUndefined();
            expect(firefox.permissions).toContain('identity');
            expect(firefox.permissions).toContain('https://www.googleapis.com/*');
            expect(firefox.permissions).toContain('https://oauth2.googleapis.com/*');
            expect(firefox.browser_specific_settings?.gecko?.id).toBe('ai-markdone@zhaoliangbin.com');
        } finally {
            (cloudBackupTargets.firefox.googleDrive as any).enabled = originalEnabled;
            (cloudBackupTargets.firefox.googleDrive as any).webAuthClientId = originalWebClientId;
        }
    });

    it('tracks the public Chrome Web Store item id used by the Google OAuth client binding', () => {
        expect(CHROME_WEB_STORE_EXTENSION_ID).toBe('bmdhdihdbhjbkfaaainidcjbgidkbeoh');
    });

    it('derives a Chrome extension id from a manifest key before enabling stable local OAuth builds', () => {
        expect(deriveChromeExtensionIdFromManifestKey(CHROME_WEB_STORE_PUBLIC_KEY)).toBe(CHROME_WEB_STORE_EXTENSION_ID);
    });

    it('uses the public Chrome Web Store manifest key by default for local OAuth builds', () => {
        withChromeExtensionKey(undefined, () => {
            const chrome = buildManifest('chrome') as any;

            expect(chrome.key).toBe(CHROME_WEB_STORE_PUBLIC_KEY);
            expect(deriveChromeExtensionIdFromManifestKey(chrome.key)).toBe(CHROME_WEB_STORE_EXTENSION_ID);
        });
    });

    it('accepts an explicit local development manifest key only when it resolves to the expected extension id', () => {
        withChromeExtensionKey(CHROME_WEB_STORE_PUBLIC_KEY, () => {
            const chrome = buildManifest('chrome') as any;

            expect(chrome.key).toBe(CHROME_WEB_STORE_PUBLIC_KEY);
        });
    });

    it('rejects a local development manifest key that does not match the public Chrome Web Store item id', () => {
        withChromeExtensionKey(mismatchChromeExtensionKey, () => {
            expect(() => buildManifest('chrome')).toThrow(CHROME_WEB_STORE_EXTENSION_ID);
        });
    });

    it('ignores Google OAuth client id environment overrides because OAuth client ids are repo-owned', () => {
        withGoogleClientId('1234567890-example.apps.googleusercontent.com', () => {
            const chrome = buildManifest('chrome') as any;

            expect(chrome.oauth2?.client_id).toBe(GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID);
            expect(cloudBackupTargets.chrome.googleDrive.webAuthClientId).toBe(GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID);
        });
    });

    it('fails Chrome manifest generation when the repo Chrome Extension OAuth client id is invalid', () => {
        withGoogleClientId('not-a-google-oauth-client-id', () => {
            const original = cloudBackupTargets.chrome.googleDrive.chromeExtensionClientId;
            (cloudBackupTargets.chrome.googleDrive as any).chromeExtensionClientId = 'not-a-google-oauth-client-id';
            try {
                expect(() => buildManifest('chrome')).toThrow(/Google Drive Chrome Extension OAuth client id/i);
            } finally {
                (cloudBackupTargets.chrome.googleDrive as any).chromeExtensionClientId = original;
            }
        });
    });

    it('defines safari as a generated MV2 WebExtension target', () => {
        const safari = buildManifest('safari') as any;

        expect(safari.manifest_version).toBe(2);
        expect(safari.permissions).toEqual([
            'clipboardWrite',
            'storage',
            ...SUPPORTED_HOST_PATTERNS,
        ]);
        expect(safari.background).toEqual({ scripts: [extensionAssets.backgroundEntry] });
        expect(safari.browser_action?.default_icon).toEqual(extensionAssets.icons);
        expect(safari.web_accessible_resources).toContain('icons/icon128.png');
        expect(safari.web_accessible_resources).toContain('icons/icon128_gray.png');
        expect(safari.web_accessible_resources).toContain('icons/about_avatar.png');
        expect(safari.web_accessible_resources).not.toContain('icons/*.png');
        expect(safari.web_accessible_resources).not.toContain('icons/bmc_qr.png');
        expect(safari.web_accessible_resources).not.toContain('icons/wechat_qr.png');
        expect(safari.web_accessible_resources).not.toContain('icons/xiaohongshu_card.png');
    });

    it('keeps a stable Firefox Gecko id for identity redirect URLs', () => {
        const firefox = buildManifest('firefox') as any;

        expect(firefox.browser_specific_settings?.gecko?.id).toBe('ai-markdone@zhaoliangbin.com');
        expect(firefox.browser_specific_settings?.gecko?.strict_min_version).toBe('109.0');
        expect(firefox.browser_specific_settings?.gecko?.data_collection_permissions).toEqual({
            required: ['none'],
        });
    });
});
