import { describe, test, expect } from 'vitest';
import { ConfigManager } from '../ConfigManager';
import { MockStorageAdapter } from '../../platform/MockStorageAdapter';

describe('ConfigManager', () => {
    test('loads default config', async () => {
        ConfigManager.setAdapter(new MockStorageAdapter());
        const config = await ConfigManager.loadConfig();

        expect(config.enablePagination).toBe(true);
        expect(config.codeBlockMode).toBe('full');
        expect(config.maxCacheSize).toBe(5);
    });

    test('saves config', async () => {
        const adapter = new MockStorageAdapter();
        ConfigManager.setAdapter(adapter);

        const success = await ConfigManager.saveConfig({
            enablePagination: false,
            codeBlockMode: 'placeholder',
        });

        expect(success).toBe(true);

        const config = await ConfigManager.loadConfig();
        expect(config.enablePagination).toBe(false);
        expect(config.codeBlockMode).toBe('placeholder');
    });

    test('listens to config changes', async () => {
        const adapter = new MockStorageAdapter();
        ConfigManager.setAdapter(adapter);

        let received: any = null;
        ConfigManager.onConfigChange((config) => {
            received = config;
        });

        await ConfigManager.saveConfig({ enablePagination: false });

        expect(received).toBeDefined();
        expect(received.enablePagination).toBe(false);
    });

    test('validates config size', async () => {
        const adapter = new MockStorageAdapter();
        ConfigManager.setAdapter(adapter);

        // Create an oversized config (should fail)
        const huge = 'x'.repeat(10000);
        const success = await ConfigManager.saveConfig({
            enablePagination: true,
            codeBlockMode: huge as any,
        });

        expect(success).toBe(false);
    });
});
