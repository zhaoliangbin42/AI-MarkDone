import { IStorageAdapter } from './IStorageAdapter';
import { ChromeStorageAdapter } from './ChromeStorageAdapter';
import { MockStorageAdapter } from './MockStorageAdapter';

/**
 * Platform detector - auto-selects appropriate storage adapter
 */
export class PlatformDetector {
    static getStorageAdapter(): IStorageAdapter {
        // Check if running in Chrome extension environment
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new ChromeStorageAdapter();
        }

        // Fallback to mock (for tests or other environments)
        console.warn('[PlatformDetector] Chrome API not available, using MockStorageAdapter');
        return new MockStorageAdapter();
    }
}
