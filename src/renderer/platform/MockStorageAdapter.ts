import { IStorageAdapter } from './IStorageAdapter';

/**
 * Mock storage adapter for testing
 * Stores data in memory Map
 */
export class MockStorageAdapter implements IStorageAdapter {
    private store = new Map<string, any>();
    private listeners: Array<(changes: any) => void> = [];

    async get(key: string): Promise<any> {
        return this.store.get(key);
    }

    async set(key: string, value: any): Promise<void> {
        const oldValue = this.store.get(key);
        this.store.set(key, value);

        // Trigger listeners
        const changes = { [key]: { oldValue, newValue: value } };
        this.listeners.forEach(cb => cb(changes));
    }

    onChanged(callback: (changes: any) => void): void {
        this.listeners.push(callback);
    }

    // Test helper
    clear(): void {
        this.store.clear();
    }
}
