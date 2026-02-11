/**
 * Settings Manager
 * 
 * Singleton class for managing application settings with:
 * - chrome.storage.sync persistence (syncs across devices)
 * - In-memory caching for performance
 * - Event-driven updates (subscribe pattern)
 * - Type-safe settings access
 * 
 * @module SettingsManager
 */

import { logger } from '../utils/logger';
import { browser } from '../utils/browser';

/**
 * Application settings schema
 */
export interface AppSettings {
    version: 2;
    platforms: {
        chatgpt: boolean;   // default: true
        gemini: boolean;    // default: true
        claude: boolean;    // default: true
        deepseek: boolean;  // default: true
    };
    behavior: {
        showViewSource: boolean;     // default: true
        showSaveMessages: boolean;   // default: true
        showWordCount: boolean;      // default: true
        enableClickToCopy: boolean;  // default: true
        saveContextOnly: boolean;    // default: false
        _contextOnlyConfirmed: boolean; // internal flag for destructive action confirmation
    };
    reader: {
        renderCodeInReader: boolean;  // default: true
    };
    bookmarks: {
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';  // default: 'alpha-asc'
    };
    /**
     * Legacy compatibility bucket.
     * Why: some historical modules (e.g. chatgpt folding prototype) may still read
     * old performance keys. Keep optional to avoid forcing new writes.
     */
    performance?: {
        chatgptFoldingMode?: 'off' | 'all' | 'keep_last_n';
        chatgptDefaultExpandedCount?: number;
    };
    language: 'auto' | 'en' | 'zh_CN';  // default: 'auto'
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
    version: 2,
    platforms: {
        chatgpt: true,
        gemini: true,
        claude: true,
        deepseek: true,
    },
    behavior: {
        showViewSource: true,
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: false,
        _contextOnlyConfirmed: false,
    },
    reader: {
        renderCodeInReader: true,
    },
    bookmarks: {
        sortMode: 'alpha-asc',
    },
    performance: undefined,
    language: 'auto',
};

/**
 * Storage key for settings
 */
const STORAGE_KEY = 'app_settings';

/**
 * Settings change listener callback
 */
type SettingsListener = (settings: AppSettings) => void;

/**
 * Settings categories (excludes 'version')
 */
export type SettingsCategory = Exclude<keyof AppSettings, 'version'>;

/**
 * SettingsManager - Singleton class for managing application settings
 * 
 * @example
 * ```typescript
 * const manager = SettingsManager.getInstance();
 * 
 * // Get settings
 * const behavior = await manager.get('behavior');
 * // use behavior.renderCodeInReader
 * 
 * // Update settings
 * await manager.set('behavior', {
 *     ...behavior,
 *     renderCodeInReader: false
 * });
 * 
 * // Subscribe to changes
 * const unsubscribe = manager.subscribe((settings) => {
 *     // react to updated settings
 * });
 * ```
 */
export class SettingsManager {
    private static instance: SettingsManager;
    private cache: AppSettings | null = null;
    private listeners: Set<SettingsListener> = new Set();
    private initPromise: Promise<void> | null = null;

    /**
     * Private constructor (Singleton pattern)
     */
    private constructor() {
        // Listen for storage changes from other tabs/windows
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes[STORAGE_KEY]) {
                const newSettings = changes[STORAGE_KEY].newValue as AppSettings;
                if (newSettings) {
                    this.cache = newSettings;
                    this.notifyListeners();
                    logger.info('[SettingsManager] Settings updated from external source');
                }
            }
        });
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    /**
     * Initialize settings (load from storage)
     * This is called automatically on first access
     */
    private async init(): Promise<void> {
        if (this.cache !== null) {
            return; // Already initialized
        }

        if (this.initPromise) {
            return this.initPromise; // Initialization in progress
        }

        this.initPromise = (async () => {
            try {
                const result = await browser.storage.sync.get(STORAGE_KEY);
                const stored = (result && typeof result === 'object'
                    ? (result as Record<string, unknown>)[STORAGE_KEY]
                    : undefined) as any; // Use 'any' for migration compatibility

                if (stored && stored.version === 2) {
                    // Same version - merge with defaults to handle new settings
                    this.cache = this.mergeWithDefaults(stored as AppSettings);
                } else if (stored && stored.version === 1) {
                    // Migrate from v1 to v2
                    this.cache = this.migrateFromV1(stored);
                    await this.persist();
                    logger.info('[SettingsManager] Migrated from v1 to v2');
                } else {
                    // No settings or unknown version - use defaults
                    this.cache = { ...DEFAULT_SETTINGS };
                    await this.persist();
                }

                logger.info('[SettingsManager] Initialized', this.cache);
            } catch (error) {
                logger.error('[SettingsManager] Failed to initialize', error);
                this.cache = { ...DEFAULT_SETTINGS };
            }
        })();

        await this.initPromise;
        this.initPromise = null;
    }

    /**
     * Migrate settings from v1 to v2
     * v1 had 'behavior', v2 renamed it to 'reader' and added 'platforms' + 'toolbar'
     */
    private migrateFromV1(v1Settings: any): AppSettings {
        return {
            version: 2,
            platforms: {
                ...DEFAULT_SETTINGS.platforms,
            },
            behavior: {
                ...DEFAULT_SETTINGS.behavior,
                // Migrate old behavior.enableClickToCopy
                enableClickToCopy: v1Settings.behavior?.enableClickToCopy ?? true,
                // Migrate old storage.saveContextOnly
                saveContextOnly: v1Settings.storage?.saveContextOnly ?? false,
                _contextOnlyConfirmed: v1Settings.storage?._contextOnlyConfirmed ?? false,
            },
            reader: {
                ...DEFAULT_SETTINGS.reader,
                // Migrate old behavior.renderCodeInReader
                renderCodeInReader: v1Settings.behavior?.renderCodeInReader ?? true,
            },
            bookmarks: {
                ...DEFAULT_SETTINGS.bookmarks,
            },
            language: 'auto',
        };
    }

    /**
     * Migrate old sortMode values to new 4-state format
     * 'alphabetical' -> 'alpha-asc'
     * 'time' -> 'time-desc'
     */
    private migrateSortMode(oldMode: string | undefined): AppSettings['bookmarks']['sortMode'] {
        if (oldMode === 'alphabetical') return 'alpha-asc';
        if (oldMode === 'time') return 'time-desc';
        // Already new format or undefined
        if (['time-desc', 'time-asc', 'alpha-asc', 'alpha-desc'].includes(oldMode || '')) {
            return oldMode as AppSettings['bookmarks']['sortMode'];
        }
        return DEFAULT_SETTINGS.bookmarks.sortMode;
    }

    /**
     * Merge stored settings with defaults (handles new settings)
     */
    private mergeWithDefaults(stored: AppSettings): AppSettings {
        return {
            version: DEFAULT_SETTINGS.version,
            platforms: {
                ...DEFAULT_SETTINGS.platforms,
                ...stored.platforms,
            },
            behavior: {
                ...DEFAULT_SETTINGS.behavior,
                ...stored.behavior,
            },
            reader: {
                ...DEFAULT_SETTINGS.reader,
                ...stored.reader,
            },
            bookmarks: {
                ...DEFAULT_SETTINGS.bookmarks,
                ...stored.bookmarks,
                // Migrate old sortMode values
                sortMode: this.migrateSortMode(stored.bookmarks?.sortMode),
            },
            performance: stored.performance,
            language: stored.language || 'auto',
        };
    }

    /**
     * Persist settings to chrome.storage.sync
     */
    private async persist(): Promise<void> {
        if (!this.cache) return;

        try {
            await browser.storage.sync.set({ [STORAGE_KEY]: this.cache });
            logger.debug('[SettingsManager] Persisted to storage');
        } catch (error) {
            logger.error('[SettingsManager] Failed to persist', error);
            throw error;
        }
    }

    /**
     * Notify all listeners of settings change
     */
    private notifyListeners(): void {
        if (!this.cache) return;

        this.listeners.forEach(listener => {
            try {
                listener(this.cache!);
            } catch (error) {
                logger.error('[SettingsManager] Listener error', error);
            }
        });
    }

    /**
     * Get a settings category
     * 
     * @param key - Settings category key
     * @returns Settings category value
     */
    public async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
        await this.init();
        return this.cache![key];
    }

    /**
     * Get all settings
     * 
     * @returns Complete settings object
     */
    public async getAll(): Promise<AppSettings> {
        await this.init();
        return { ...this.cache! };
    }

    /**
     * Update a settings category
     * 
     * @param key - Settings category key
     * @param value - New value for the category
     */
    public async set<K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ): Promise<void> {
        await this.init();

        this.cache = {
            ...this.cache!,
            [key]: value,
        };

        await this.persist();
        this.notifyListeners();

        logger.info(`[SettingsManager] Updated ${key}`, value);
    }

    /**
     * Reset all settings to defaults
     */
    public async reset(): Promise<void> {
        this.cache = { ...DEFAULT_SETTINGS };
        await this.persist();
        this.notifyListeners();
        logger.info('[SettingsManager] Reset to defaults');
    }

    /**
     * Subscribe to settings changes
     * 
     * @param listener - Callback function to be called when settings change
     * @returns Unsubscribe function
     */
    public subscribe(listener: SettingsListener): () => void {
        this.listeners.add(listener);

        // Immediately call with current settings if available
        if (this.cache) {
            try {
                listener(this.cache);
            } catch (error) {
                logger.error('[SettingsManager] Initial listener call error', error);
            }
        }

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Get number of active listeners (for debugging)
     */
    public getListenerCount(): number {
        return this.listeners.size;
    }
}
