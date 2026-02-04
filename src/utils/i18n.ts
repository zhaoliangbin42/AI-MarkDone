/**
 * Internationalization Service
 * 
 * User-switchable language support.
 * Always loads messages.json directly (chrome.i18n.getMessage unreliable in content scripts).
 */

import { logger } from './logger';

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

            // Read user preference
            const result = await chrome.storage.local.get('userLocale');
            this.locale = (result.userLocale as Locale) || 'auto';
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
            const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
            logger.debug('[AI-MarkDone][i18n] Loading locale messages:', locale);

            const response = await fetch(url);
            logger.debug('[AI-MarkDone][i18n] Fetch status:', response.status, response.ok);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.messages = await response.json();
            logger.debug('[AI-MarkDone][i18n] Loaded keys:', Object.keys(this.messages).length);
        } catch (error) {
            logger.warn(`[AI-MarkDone][i18n] Failed to load locale: ${locale}`, error);
            // Fallback to English if specified locale fails
            if (locale !== 'en') {
                try {
                    logger.debug('[AI-MarkDone][i18n] Trying English fallback');
                    const fallbackUrl = chrome.runtime.getURL('_locales/en/messages.json');
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
        if (!message) return key; // Fallback to key if not found

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
