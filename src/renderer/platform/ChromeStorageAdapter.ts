import { IStorageAdapter } from './IStorageAdapter';
import { browser } from '../../utils/browser';

/**
 * Chrome Extension storage adapter
 * Implements sync → local fallback strategy
 */
export class ChromeStorageAdapter implements IStorageAdapter {
    async get(key: string): Promise<any> {
        try {
            const result = await browser.storage.sync.get(key);
            return result[key];
        } catch (error) {
            // Fallback to local storage
            console.warn('[ChromeStorage] Sync get failed, using local:', error);
            const local = await browser.storage.local.get(key);
            return local[key];
        }
    }

    async set(key: string, value: any): Promise<void> {
        try {
            await browser.storage.sync.set({ [key]: value });
        } catch (error) {
            // Fallback to local storage
            console.warn('[ChromeStorage] Sync set failed, using local:', error);
            await browser.storage.local.set({ [key]: value });
        }
    }

    onChanged(callback: (changes: any) => void): void {
        browser.storage.onChanged.addListener(callback);
    }
}
