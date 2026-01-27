/**
 * Unified Browser API Abstraction Layer
 * 
 * 自动检测运行环境：
 * - Firefox: 使用原生 browser API
 * - Chrome: 使用 webextension-polyfill (静态导入)
 * 
 * @version 2.0.0
 * @changelog
 * - 2.0.0: 移除 top-level await，兼容 Service Worker
 *          使用静态导入避免 Vite modulepreload 问题
 */

import type { Browser } from 'webextension-polyfill';
import polyfill from 'webextension-polyfill';

// 声明全局 chrome 变量
declare const chrome: any;

/**
 * 检测 Firefox 环境
 * 使用 navigator.userAgent 进行检测
 */
const isFirefoxEnv = typeof navigator !== 'undefined'
    && navigator.userAgent.includes('Firefox');

/**
 * 检测原生 browser API (Firefox)
 * 
 * 必须使用 globalThis 而非直接 typeof browser，
 * 避免与 polyfill 导入的 browser 冲突
 */
const hasNativeBrowser = typeof globalThis !== 'undefined'
    && 'browser' in globalThis
    && typeof (globalThis as any).browser?.runtime !== 'undefined';

/**
 * 浏览器 API 实例
 * 
 * Firefox: 优先使用原生 browser API
 * Chrome: 使用 webextension-polyfill
 */
export const browser: Browser = hasNativeBrowser
    ? (globalThis as any).browser
    : polyfill;

/**
 * 浏览器环境检测
 * 
 * 使用 getter 确保延迟求值，避免模块加载时机问题
 */
export const browserInfo = {
    /** 是否为 Chrome 环境 */
    get isChrome(): boolean {
        return !isFirefoxEnv && typeof chrome !== 'undefined';
    },

    /** 是否为 Firefox 环境 */
    get isFirefox(): boolean {
        return isFirefoxEnv;
    },

    /** 获取 Manifest 版本 */
    get manifestVersion(): number {
        return browser.runtime.getManifest().manifest_version;
    }
};

/**
 * 浏览器兼容性 API
 * 
 * 提供 Chrome 特有 API 的 Firefox polyfill
 */
export const browserCompat = {
    /**
     * 获取存储空间使用量
     * 
     * Chrome: 使用原生 getBytesInUse API
     * Firefox: 手动计算 JSON 序列化后的字节数
     * 
     * @param keys - 要查询的 key，null 表示所有
     * @returns 字节数
     */
    async getBytesInUse(keys: string | string[] | null = null): Promise<number> {
        // Chrome 原生支持
        if (browserInfo.isChrome && chrome.storage?.local?.getBytesInUse) {
            return new Promise<number>((resolve) => {
                chrome.storage.local.getBytesInUse(keys, resolve);
            });
        }

        // Firefox fallback: 手动计算
        const data = await browser.storage.local.get(keys);
        const jsonString = JSON.stringify(data);
        return new Blob([jsonString]).size;
    },

    /**
     * Action API 兼容层
     * 
     * - Chrome MV3: browser.action
     * - Firefox MV2: browser.browserAction
     */
    get action() {
        return browser.action || (browser as any).browserAction;
    }
};

/**
 * 日志工具（开发调试用）
 */
export const browserLog = {
    info: (...args: any[]) => {
        const prefix = browserInfo.isFirefox ? '[Firefox]' : '[Chrome]';
        console.log(prefix, ...args);
    }
};
