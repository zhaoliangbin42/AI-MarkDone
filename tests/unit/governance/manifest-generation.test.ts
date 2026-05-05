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
        expect(buildManifest('chrome')).toEqual(readJson('manifest.chrome.json'));
        expect(buildManifest('firefox')).toEqual(readJson('manifest.firefox.json'));
        expect(buildManifest('safari')).toEqual(readJson('manifest.safari.json'));
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
