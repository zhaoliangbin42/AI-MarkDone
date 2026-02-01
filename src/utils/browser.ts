/**
 * Unified Browser API Abstraction Layer
 * 
 * Auto-detect runtime:
 * - Firefox: use native `browser` API
 * - Chrome: use `webextension-polyfill` (static import)
 * 
 * @version 2.0.0
 * @changelog
 * - 2.0.0: remove top-level await for Service Worker compatibility;
 *          use static import to avoid Vite modulepreload issues.
 */

import type { Browser } from 'webextension-polyfill';
import polyfill from 'webextension-polyfill';
import { logger } from './logger';

// Declare global `chrome` for non-polyfilled code paths.
declare const chrome: any;

/**
 * Detect Firefox via userAgent (best-effort).
 */
const isFirefoxEnv = typeof navigator !== 'undefined'
    && navigator.userAgent.includes('Firefox');

/**
 * Detect native `browser` API (Firefox).
 *
 * Why: use `globalThis` (not `typeof browser`) to avoid conflicts with the polyfill import.
 */
const hasNativeBrowser = typeof globalThis !== 'undefined'
    && 'browser' in globalThis
    && typeof (globalThis as any).browser?.runtime !== 'undefined';

/**
 * Browser API instance.
 *
 * Firefox: prefer native `browser` API
 * Chrome: use `webextension-polyfill`
 */
export const browser: Browser = hasNativeBrowser
    ? (globalThis as any).browser
    : polyfill;

/**
 * Runtime detection helpers.
 *
 * Why: use getters for lazy evaluation to avoid module init timing issues.
 */
export const browserInfo = {
    /** Whether the current environment is Chrome. */
    get isChrome(): boolean {
        return !isFirefoxEnv && typeof chrome !== 'undefined';
    },

    /** Whether the current environment is Firefox. */
    get isFirefox(): boolean {
        return isFirefoxEnv;
    },

    /** Get manifest version. */
    get manifestVersion(): number {
        return browser.runtime.getManifest().manifest_version;
    }
};

/**
 * Browser compatibility APIs.
 *
 * Provides polyfills for Chrome-specific APIs on Firefox.
 */
export const browserCompat = {
    /**
     * Get storage usage (bytes).
     *
     * Chrome: uses native `getBytesInUse`
     * Firefox: estimates by JSON serialization size
     *
     * @param keys - storage keys, or null for all
     * @returns bytes in use
     */
    async getBytesInUse(keys: string | string[] | null = null): Promise<number> {
        // Chrome: native support.
        if (browserInfo.isChrome && chrome.storage?.local?.getBytesInUse) {
            return new Promise<number>((resolve) => {
                chrome.storage.local.getBytesInUse(keys, resolve);
            });
        }

        // Firefox fallback: estimate size via JSON serialization.
        const data = await browser.storage.local.get(keys);
        const jsonString = JSON.stringify(data);
        return new Blob([jsonString]).size;
    },

    /**
     * Action API compatibility.
     *
     * - Chrome MV3: `browser.action`
     * - Firefox MV2: `browser.browserAction`
     */
    get action() {
        return browser.action || (browser as any).browserAction;
    }
};

/**
 * Browser logging helper (development).
 */
export const browserLog = {
    info: (...args: any[]) => {
        const prefix = browserInfo.isFirefox ? '[Firefox]' : '[Chrome]';
        logger.debug(prefix, ...args);
    }
};
