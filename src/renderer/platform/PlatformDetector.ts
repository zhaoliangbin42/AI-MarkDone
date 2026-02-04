import { IStorageAdapter } from './IStorageAdapter';
import { ChromeStorageAdapter } from './ChromeStorageAdapter';
import { MockStorageAdapter } from './MockStorageAdapter';
import { logger } from '../../utils/logger';

// Declare global `chrome` for extension environments.
declare const chrome: any;

/**
 * Platform detector - determines which storage adapter to use
 */
export class PlatformDetector {
    static getStorageAdapter(): IStorageAdapter {
        // Check if running in Chrome extension environment
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new ChromeStorageAdapter();
        }

        // Fallback to mock (for tests or other environments)
        logger.warn('[AI-MarkDone][PlatformDetector] Chrome API not available, using MockStorageAdapter');
        return new MockStorageAdapter();
    }
}
