import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extensionMeta } from '../../../config/extension/meta';
import { extensionAssets } from '../../../config/extension/assets';
import { SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';
import { extensionTargets } from '../../../config/extension/targets';
import { buildManifest } from '../../../scripts/generate-manifest';

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8')) as T;
}

describe('extension manifest generation', () => {
    const originalGoogleClientId = process.env.AIMD_GOOGLE_CLIENT_ID;

    function withoutGoogleClientId<T>(fn: () => T): T {
        delete process.env.AIMD_GOOGLE_CLIENT_ID;
        try {
            return fn();
        } finally {
            if (originalGoogleClientId === undefined) delete process.env.AIMD_GOOGLE_CLIENT_ID;
            else process.env.AIMD_GOOGLE_CLIENT_ID = originalGoogleClientId;
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
        withoutGoogleClientId(() => {
            expect(buildManifest('chrome')).toEqual(readJson('manifest.chrome.json'));
            expect(buildManifest('firefox')).toEqual(readJson('manifest.firefox.json'));
            expect(buildManifest('safari')).toEqual(readJson('manifest.safari.json'));
        });
    });

    it('injects Google Drive OAuth only into Chrome manifests when configured by the build environment', () => {
        process.env.AIMD_GOOGLE_CLIENT_ID = '1234567890-example.apps.googleusercontent.com';
        try {
            const chrome = buildManifest('chrome') as any;
            const firefox = buildManifest('firefox') as any;
            const safari = buildManifest('safari') as any;

            expect(chrome.oauth2).toEqual({
                client_id: '1234567890-example.apps.googleusercontent.com',
                scopes: ['https://www.googleapis.com/auth/drive.file'],
            });
            expect(chrome.permissions).toContain('identity');
            expect(firefox.oauth2).toBeUndefined();
            expect(safari.oauth2).toBeUndefined();
        } finally {
            if (originalGoogleClientId === undefined) delete process.env.AIMD_GOOGLE_CLIENT_ID;
            else process.env.AIMD_GOOGLE_CLIENT_ID = originalGoogleClientId;
        }
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
        expect(safari.web_accessible_resources).toEqual(extensionAssets.webAccessibleResources);
    });

    it('lets AMO assign the Firefox MV2 add-on id while keeping required Gecko metadata', () => {
        const firefox = buildManifest('firefox') as any;

        expect(firefox.browser_specific_settings?.gecko?.id).toBeUndefined();
        expect(firefox.browser_specific_settings?.gecko?.strict_min_version).toBe('109.0');
        expect(firefox.browser_specific_settings?.gecko?.data_collection_permissions).toEqual({
            required: ['none'],
        });
    });
});
