import { describe, expect, it } from 'vitest';
import { resolveActionApi } from '../../../../src/drivers/shared/browserApi/action';
import { detectBrowserTarget, resolveBrowserCapabilities } from '../../../../src/drivers/shared/browserApi/capabilities';
import { resolveRuntimeApi } from '../../../../src/drivers/shared/browserApi/runtime';
import { resolveStorageApi } from '../../../../src/drivers/shared/browserApi/storage';

describe('shared browser api adapters', () => {
    it('prefers action and falls back to browserAction for MV2-style targets', () => {
        const action = { setIcon: async () => undefined };
        const browserAction = { setPopup: async () => undefined };

        expect(resolveActionApi({ action, browserAction })).toBe(action);
        expect(resolveActionApi({ browserAction })).toBe(browserAction);
        expect(resolveActionApi({})).toBeNull();
    });

    it('detects Safari separately from Chrome and Firefox', () => {
        expect(detectBrowserTarget({ userAgent: 'Mozilla/5.0 Firefox/125.0', hasChrome: false })).toBe('firefox');
        expect(detectBrowserTarget({ userAgent: 'Mozilla/5.0 Version/17.0 Safari/605.1.15', hasChrome: false })).toBe('safari');
        expect(detectBrowserTarget({ userAgent: 'Mozilla/5.0 Chrome/123.0 Safari/537.36', hasChrome: true })).toBe('chrome');
    });

    it('exposes runtime, storage and capability fallbacks without leaking target branches', () => {
        const runtime = { getManifest: () => ({ manifest_version: 2 }) };
        const sync = { get: async () => ({}) };
        const browserLike = {
            runtime,
            storage: { sync },
        };

        expect(resolveRuntimeApi(browserLike)).toBe(runtime);
        expect(resolveStorageApi(browserLike).sync).toBe(sync);
        expect(resolveBrowserCapabilities(browserLike, { hasClipboardItem: true })).toEqual({
            hasStorageSync: true,
            hasImageClipboardWrite: true,
            manifestVersion: 2,
        });
    });
});
