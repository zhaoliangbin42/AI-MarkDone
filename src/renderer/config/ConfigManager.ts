import { IStorageAdapter } from '../platform/IStorageAdapter';
import { PlatformDetector } from '../platform/PlatformDetector';
import { logger } from '../../utils/logger';

export interface RenderConfig {
    enablePagination: boolean;
    codeBlockMode: 'full' | 'placeholder';
    maxCacheSize: number;
}

const DEFAULT_CONFIG: RenderConfig = {
    enablePagination: true,         // User feedback: default ON
    codeBlockMode: 'full',
    maxCacheSize: 5,
};

/**
 * Configuration manager with platform adapter
 */
export class ConfigManager {
    private static adapter: IStorageAdapter = PlatformDetector.getStorageAdapter();
    private static readonly STORAGE_KEY = 'aicopy_render_config';
    private static readonly MAX_SIZE = 8000;

    /**
     * Load config (with fallback)
     */
    static async loadConfig(): Promise<RenderConfig> {
        try {
            const data = await this.adapter.get(this.STORAGE_KEY);
            if (data?.data) {
                return this.mergeWithDefault(data.data);
            }
        } catch (error) {
            logger.error('[AI-MarkDone][Config] Load failed:', error);
        }

        return DEFAULT_CONFIG;
    }

    /**
     * Save config (with validation)
     */
    static async saveConfig(config: Partial<RenderConfig>): Promise<boolean> {
        try {
            const current = await this.loadConfig();
            const merged = { ...current, ...config };

            const versioned = {
                version: 1,
                data: merged,
                timestamp: Date.now(),
            };

            const serialized = JSON.stringify(versioned);
            if (serialized.length > this.MAX_SIZE) {
                logger.error('[AI-MarkDone][Config] Config too large');
                return false;
            }

            await this.adapter.set(this.STORAGE_KEY, versioned);
            return true;

        } catch (error) {
            logger.error('[AI-MarkDone][Config] Save failed:', error);
            return false;
        }
    }

    /**
     * Listen to config changes
     */
    static onConfigChange(callback: (config: RenderConfig) => void): void {
        this.adapter.onChanged((changes) => {
            if (changes[this.STORAGE_KEY]) {
                const newConfig = changes[this.STORAGE_KEY].newValue?.data;
                if (newConfig) {
                    callback(this.mergeWithDefault(newConfig));
                }
            }
        });
    }

    /**
     * Set adapter (for testing)
     */
    static setAdapter(adapter: IStorageAdapter): void {
        this.adapter = adapter;
    }

    private static mergeWithDefault(config: Partial<RenderConfig>): RenderConfig {
        return { ...DEFAULT_CONFIG, ...config };
    }
}
