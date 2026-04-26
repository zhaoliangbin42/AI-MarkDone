import type { Browser } from 'webextension-polyfill';
import polyfill from 'webextension-polyfill';
import { resolveActionApi } from './browserApi/action';
import { detectBrowserTarget, resolveBrowserCapabilities } from './browserApi/capabilities';
import { resolveRuntimeApi } from './browserApi/runtime';

declare const chrome: any;

const hasNativeBrowser = typeof globalThis !== 'undefined'
    && 'browser' in globalThis
    && typeof (globalThis as any).browser?.runtime !== 'undefined';

export const browser: Browser = hasNativeBrowser ? (globalThis as any).browser : polyfill;

export const browserInfo = {
    get target() {
        return detectBrowserTarget({
            userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
            hasChrome: typeof chrome !== 'undefined',
        });
    },
    get isChrome(): boolean {
        return this.target === 'chrome';
    },
    get isFirefox(): boolean {
        return this.target === 'firefox';
    },
    get isSafari(): boolean {
        return this.target === 'safari';
    },
    get manifestVersion(): number {
        return browser.runtime.getManifest().manifest_version;
    }
};

export const browserCompat = {
    get action() {
        return resolveActionApi(browser);
    },
    get runtime() {
        return resolveRuntimeApi(browser);
    },
    get tabs() {
        return (browser as any).tabs || null;
    }
};

export const browserCapabilities = {
    get hasStorageSync(): boolean {
        return resolveBrowserCapabilities(browser, { hasClipboardItem: typeof ClipboardItem !== 'undefined' }).hasStorageSync;
    },
    get hasImageClipboardWrite(): boolean {
        return resolveBrowserCapabilities(browser, { hasClipboardItem: typeof ClipboardItem !== 'undefined' }).hasImageClipboardWrite;
    },
    get manifestVersion(): number {
        return resolveBrowserCapabilities(browser, { hasClipboardItem: typeof ClipboardItem !== 'undefined' }).manifestVersion;
    },
};
