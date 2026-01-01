import { IStorageAdapter } from './IStorageAdapter';

/**
 * Chrome Extension storage adapter
 * Implements sync → local fallback strategy
 */
export class ChromeStorageAdapter implements IStorageAdapter {
    async get(key: string): Promise<any> {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            // Fallback to local storage
            console.warn('[ChromeStorage] Sync get failed, using local:', error);
            const local = await chrome.storage.local.get(key);
            return local[key];
        }
    }

    async set(key: string, value: any): Promise<void> {
        try {
            await chrome.storage.sync.set({ [key]: value });
        } catch (error) {
            // Fallback to local storage
            console.warn('[ChromeStorage] Sync set failed, using local:', error);
            await chrome.storage.local.set({ [key]: value });
        }
    }

    onChanged(callback: (changes: any) => void): void {
        chrome.storage.onChanged.addListener(callback);
    }
}
