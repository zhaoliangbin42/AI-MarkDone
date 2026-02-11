/**
 * Internationalization Service
 * 
 * User-switchable language support.
 * Always loads messages.json directly (chrome.i18n.getMessage unreliable in content scripts).
 */

import { logger } from './logger';
import { browser } from './browser';
import { SettingsManager } from '../settings/SettingsManager';

type Locale = 'auto' | 'en' | 'zh_CN';
type Messages = Record<string, { message: string; description?: string }>;

class I18nService {
    private locale: Locale = 'auto';
    private messages: Messages = {};
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize i18n service
     * Call ONCE during content script initialization
     * Safe to call multiple times - will return cached promise
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._doInit();
        return this.initPromise;
    }

    private async _doInit(): Promise<void> {
        try {
            logger.debug('[AI-MarkDone][i18n] Starting initialization');

            // Read canonical setting first. If still `auto`, perform one-time legacy migration
            // from local `userLocale` to `app_settings.language`.
            const settingsLanguage = await SettingsManager.getInstance().get('language');
            if (settingsLanguage && settingsLanguage !== 'auto') {
                this.locale = settingsLanguage;
            } else {
                const result = await browser.storage.local.get('userLocale');
                const userLocale = (result as { userLocale?: Locale } | undefined)?.userLocale;

                if (userLocale && userLocale !== 'auto') {
                    this.locale = userLocale;
                    try {
                        await SettingsManager.getInstance().set('language', userLocale);
                        await browser.storage.local.remove('userLocale');
                        logger.info('[AI-MarkDone][i18n] Migrated legacy userLocale to app_settings.language');
                    } catch (migrationError) {
                        logger.warn('[AI-MarkDone][i18n] Failed to migrate legacy userLocale:', migrationError);
                    }
                } else {
                    this.locale = 'auto';
                }
            }
            logger.debug('[AI-MarkDone][i18n] User locale:', this.locale);

            // Determine actual locale to load
            let localeToLoad: string;
            if (this.locale === 'auto') {
                // Use browser's language, fallback to 'en'
                const browserLang = navigator.language || 'en';
                localeToLoad = browserLang.startsWith('zh') ? 'zh_CN' : 'en';
            } else {
                localeToLoad = this.locale;
            }
            logger.debug('[AI-MarkDone][i18n] Will load locale:', localeToLoad);

            // Always load messages directly from file
            await this.loadMessages(localeToLoad);

            this.initialized = true;
            logger.debug(`[AI-MarkDone][i18n] Initialized with locale: ${localeToLoad} (${Object.keys(this.messages).length} keys)`);
        } catch (error) {
            logger.error('[AI-MarkDone][i18n] Failed to initialize:', error);
            this.initialized = true; // Mark as initialized to prevent infinite loops
        }
    }

    /**
     * Load messages.json for a specific locale
     */
    private async loadMessages(locale: string): Promise<void> {
        try {
            const url = browser.runtime.getURL(`_locales/${locale}/messages.json`);
            logger.debug('[AI-MarkDone][i18n] Loading locale messages:', locale);

            const response = await fetch(url);
            logger.debug('[AI-MarkDone][i18n] Fetch status:', response.status, response.ok);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.messages = await response.json();
            logger.debug('[AI-MarkDone][i18n] Loaded keys:', Object.keys(this.messages).length);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const cause = (error as { cause?: unknown } | null)?.cause;
            const causeMessage = cause
                ? String(cause)
                : '';
            if (errorMessage.includes('unknown scheme') || causeMessage.includes('unknown scheme')) {
                logger.debug('[AI-MarkDone][i18n] Skipping locale fetch in unsupported scheme environment');
                this.messages = {};
                return;
            }
            logger.warn(`[AI-MarkDone][i18n] Failed to load locale: ${locale}`, error);
            // Fallback to English if specified locale fails
            if (locale !== 'en') {
                try {
                    logger.debug('[AI-MarkDone][i18n] Trying English fallback');
                    const fallbackUrl = browser.runtime.getURL('_locales/en/messages.json');
                    const fallbackResponse = await fetch(fallbackUrl);
                    this.messages = await fallbackResponse.json();
                    logger.debug('[AI-MarkDone][i18n] English fallback loaded keys:', Object.keys(this.messages).length);
                } catch {
                    logger.error('[AI-MarkDone][i18n] English fallback also failed');
                    this.messages = {};
                }
            } else {
                this.messages = {};
            }
        }
    }

    /**
     * Get translated string
     * 
     * IMPORTANT: If called before init() completes, will return key as fallback.
     * This is intentional - components using i18n should be re-rendered after init.
     * 
     * @param key - Message key from messages.json
     * @param substitutions - Optional substitution values
     */
    t(key: string, substitutions?: string | string[]): string {
        // If not initialized, trigger async init but return key immediately
        // This prevents blocking but means early calls return keys
        // Components must be re-rendered after i18n is ready
        if (!this.initialized && !this.initPromise) {
            this.init(); // Fire and forget
        }

        // Return from loaded messages
        const message = this.messages[key]?.message;
        if (!message) {
            // Secondary fallback to extension i18n runtime dictionary.
            // This avoids leaking raw keys (e.g. "btnDelete") during init races.
            try {
                const runtimeMessage = browser.i18n?.getMessage(
                    key,
                    substitutions as string | string[] | undefined
                );
                if (runtimeMessage) {
                    return runtimeMessage;
                }
            } catch {
                // Ignore runtime i18n failures and keep key fallback.
            }
            return key; // Last fallback
        }

        // Simple substitution (for $1, $2, etc.)
        if (!substitutions) return message;

        const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
        return message.replace(/\$(\d+)/g, (_, index) => subs[parseInt(index) - 1] || '');
    }

    /**
     * Get current locale
     */
    getCurrentLocale(): Locale {
        return this.locale;
    }

    /**
     * Check if initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Wait for initialization to complete
     * Useful for components that need to ensure i18n is ready
     */
    async waitForInit(): Promise<void> {
        if (this.initialized) return;
        if (!this.initPromise) {
            await this.init();
        } else {
            await this.initPromise;
        }
    }
}

// Singleton instance
export const i18n = new I18nService();
