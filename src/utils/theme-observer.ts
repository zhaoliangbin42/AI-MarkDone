import { logger } from './logger';

/**
 * Theme mode type
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Theme change callback function
 */
export type ThemeChangeCallback = (theme: ThemeMode) => void;

/**
 * Theme Observer
 * 
 * Monitors the host website's theme changes by observing the html.dark class.
 * Automatically notifies subscribers when the theme switches between light and dark modes.
 * 
 * Uses MutationObserver to detect changes without polling, ensuring optimal performance.
 * Implements debouncing to prevent excessive callbacks during rapid theme toggles.
 * 
 * @example
 * ```typescript
 * const observer = new ThemeObserver();
 * 
 * // Subscribe to theme changes
 * const unsubscribe = observer.subscribe((theme) => {
 *   console.log('Theme changed to:', theme);
 *   updateComponentStyles();
 * });
 * 
 * // Later, cleanup
 * unsubscribe();
 * observer.disconnect();
 * ```
 */
export class ThemeObserver {
    private observer: MutationObserver | null = null;
    private callbacks: Set<ThemeChangeCallback> = new Set();
    private debounceTimer: number | null = null;
    private debounceDelay: number = 50; // ms
    private currentTheme: ThemeMode;
    private mediaQuery: MediaQueryList | null = null;

    constructor() {
        this.currentTheme = this.detectTheme();
        this.initialize();
    }

    /**
     * Initialize the MutationObserver AND matchMedia listener
     * Supports both ChatGPT (html.dark) and Gemini (prefers-color-scheme)
     */
    private initialize(): void {
        // MutationObserver for ChatGPT (html.dark class)
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'class') {
                    this.handleThemeChange();
                }
            }
        });

        // Observe html element for class attribute changes
        this.observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        // matchMedia listener for Gemini (prefers-color-scheme)
        if (window.matchMedia) {
            this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.mediaQuery.addEventListener('change', () => {
                this.handleThemeChange();
            });
            logger.debug('[ThemeObserver] matchMedia listener added for Gemini');
        }

        logger.debug('[ThemeObserver] Initialized observers for ChatGPT and Gemini');
    }

    /**
     * Detect current theme from html element OR matchMedia
     * Supports both ChatGPT (html.dark) and Gemini (prefers-color-scheme)
     */
    private detectTheme(): ThemeMode {
        // Check1: html.dark class (ChatGPT)
        if (document.documentElement.classList.contains('dark')) {
            return 'dark';
        }

        // Check 2: prefers-color-scheme (Gemini, system)
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    /**
     * Handle theme change with debouncing
     */
    private handleThemeChange(): void {
        // Clear existing debounce timer
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
        }

        // Debounce the theme change notification
        this.debounceTimer = window.setTimeout(() => {
            const newTheme = this.detectTheme();

            // Only notify if theme actually changed
            if (newTheme !== this.currentTheme) {
                const oldTheme = this.currentTheme;
                this.currentTheme = newTheme;

                logger.info(`[ThemeObserver] Theme changed: ${oldTheme} → ${newTheme}`);
                this.notifyCallbacks(newTheme);
            }

            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    /**
     * Notify all subscribers of theme change
     */
    private notifyCallbacks(theme: ThemeMode): void {
        this.callbacks.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                logger.error('[ThemeObserver] Error in theme change callback:', error);
            }
        });
    }

    /**
     * Subscribe to theme changes
     * 
     * @param callback - Function to call when theme changes
     * @returns Unsubscribe function
     * 
     * @example
     * ```typescript
     * const unsubscribe = observer.subscribe((theme) => {
     *   console.log('New theme:', theme);
     * });
     * 
     * // Later...
     * unsubscribe();
     * ```
     */
    subscribe(callback: ThemeChangeCallback): () => void {
        this.callbacks.add(callback);
        logger.debug('[ThemeObserver] Subscriber added, total:', this.callbacks.size);

        // Return unsubscribe function
        return () => {
            this.callbacks.delete(callback);
            logger.debug('[ThemeObserver] Subscriber removed, total:', this.callbacks.size);
        };
    }

    /**
     * Get current theme mode
     */
    getCurrentTheme(): ThemeMode {
        return this.currentTheme;
    }

    /**
     * Check if currently in dark mode
     */
    isDarkMode(): boolean {
        return this.currentTheme === 'dark';
    }

    /**
     * Disconnect the observer and cleanup
     * 
     * Should be called when the observer is no longer needed
     */
    disconnect(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.mediaQuery) {
            this.mediaQuery.removeEventListener('change', () => {
                this.handleThemeChange();
            });
            this.mediaQuery = null;
        }

        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.callbacks.clear();
        logger.debug('[ThemeObserver] Disconnected and cleaned up');
    }

    /**
     * Get number of active subscribers
     */
    getSubscriberCount(): number {
        return this.callbacks.size;
    }
}
