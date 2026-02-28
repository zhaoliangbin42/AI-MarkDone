import type { Browser } from 'webextension-polyfill';
import polyfill from 'webextension-polyfill';

declare const chrome: any;

const isFirefoxEnv = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
const hasNativeBrowser = typeof globalThis !== 'undefined'
    && 'browser' in globalThis
    && typeof (globalThis as any).browser?.runtime !== 'undefined';

export const browser: Browser = hasNativeBrowser ? (globalThis as any).browser : polyfill;

export const browserInfo = {
    get isChrome(): boolean {
        return !isFirefoxEnv && typeof chrome !== 'undefined';
    },
    get isFirefox(): boolean {
        return isFirefoxEnv;
    },
    get manifestVersion(): number {
        return browser.runtime.getManifest().manifest_version;
    }
};

export const browserCompat = {
    get action() {
        return browser.action || (browser as any).browserAction;
    }
};

