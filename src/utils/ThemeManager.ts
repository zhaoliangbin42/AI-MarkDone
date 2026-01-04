/**
 * ThemeManager - Unified Theme Detection and Synchronization
 * 
 * Detects host website themes (ChatGPT, Gemini) and synchronizes
 * with our design token system via data-aimd-theme attribute.
 * 
 * Detection Priority:
 * 1. ChatGPT: html.dark class
 * 2. Gemini: body.dark-theme class  
 * 3. Generic: data-theme attribute
 * 4. Background luminance heuristic
 * 5. System preference fallback
 * 
 * @example
 * // Initialize at app startup
 * ThemeManager.getInstance().init();
 * 
 * // Subscribe to theme changes
 * const unsubscribe = ThemeManager.getInstance().subscribe((theme) => {
 *   console.log('Theme changed:', theme);
 * });
 */

import { logger } from './logger';

export type Theme = 'light' | 'dark';

export class ThemeManager {
    private static instance: ThemeManager;

    private observer: MutationObserver | null = null;
    private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
    private currentTheme: Theme = 'light';
    private listeners: Set<(theme: Theme) => void> = new Set();
    private initialized: boolean = false;

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    /**
     * Initialize theme manager
     * Should be called once at application startup
     */
    init(): void {
        if (this.initialized) {
            logger.debug('[ThemeManager] Already initialized, skipping');
            return;
        }

        // 1. Initial detection
        this.currentTheme = this.detectHostTheme();
        this.applyTheme(this.currentTheme);
        logger.info(`[ThemeManager] Initialized with theme: ${this.currentTheme}`);

        // 2. Watch for DOM changes (ChatGPT/Gemini theme switches)
        this.startObserver();

        // 3. Watch for system preference changes (fallback)
        this.startMediaQueryListener();

        this.initialized = true;
    }

    /**
     * Detect current theme from host website
     */
    private detectHostTheme(): Theme {
        const html = document.documentElement;
        const body = document.body;

        // Method 1: ChatGPT - html.dark class
        if (html.classList.contains('dark')) {
            logger.debug('[ThemeManager] Detected via html.dark (ChatGPT)');
            return 'dark';
        }
        if (html.classList.contains('light')) {
            logger.debug('[ThemeManager] Detected via html.light (ChatGPT)');
            return 'light';
        }

        // Method 2: Gemini - body.dark-theme class
        if (body?.classList.contains('dark-theme')) {
            logger.debug('[ThemeManager] Detected via body.dark-theme (Gemini)');
            return 'dark';
        }
        if (body?.classList.contains('light-theme')) {
            logger.debug('[ThemeManager] Detected via body.light-theme (Gemini)');
            return 'light';
        }

        // Method 3: Generic data-theme attribute
        const htmlTheme = html.getAttribute('data-theme') || html.dataset.theme;
        if (htmlTheme === 'dark') {
            logger.debug('[ThemeManager] Detected via html[data-theme]');
            return 'dark';
        }
        if (htmlTheme === 'light') {
            logger.debug('[ThemeManager] Detected via html[data-theme]');
            return 'light';
        }

        const bodyTheme = body?.getAttribute('data-theme') || body?.dataset.theme;
        if (bodyTheme === 'dark') {
            logger.debug('[ThemeManager] Detected via body[data-theme]');
            return 'dark';
        }
        if (bodyTheme === 'light') {
            logger.debug('[ThemeManager] Detected via body[data-theme]');
            return 'light';
        }

        // Method 4: Background luminance heuristic (Gemini fallback)
        if (this.isBackgroundDark(body)) {
            logger.debug('[ThemeManager] Detected via background luminance');
            return 'dark';
        }

        // Method 5: System preference fallback
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        logger.debug(`[ThemeManager] Fallback to system preference: ${prefersDark ? 'dark' : 'light'}`);
        return prefersDark ? 'dark' : 'light';
    }

    /**
     * Check if an element has a dark background using luminance calculation
     */
    private isBackgroundDark(el: HTMLElement | null): boolean {
        if (!el) return false;

        try {
            const bg = getComputedStyle(el).backgroundColor;
            const match = bg.match(/\d+/g);

            if (!match || match.length < 3) return false;

            const r = parseInt(match[0], 10);
            const g = parseInt(match[1], 10);
            const b = parseInt(match[2], 10);

            // Calculate relative luminance
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            return luminance < 0.5;
        } catch {
            return false;
        }
    }

    /**
     * Check if host has explicit theme (not just system preference)
     */
    private hasHostTheme(): boolean {
        const html = document.documentElement;
        const body = document.body;

        return (
            html.classList.contains('dark') ||
            html.classList.contains('light') ||
            body?.classList.contains('dark-theme') ||
            body?.classList.contains('light-theme') ||
            !!html.getAttribute('data-theme') ||
            !!body?.getAttribute('data-theme')
        );
    }

    /**
     * Apply theme to document
     */
    private applyTheme(theme: Theme): void {
        document.documentElement.setAttribute('data-aimd-theme', theme);
    }

    /**
     * Start observing DOM for theme changes
     */
    private startObserver(): void {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            // Check if any mutation is theme-related
            const hasRelevantChange = mutations.some(mutation => {
                if (mutation.type !== 'attributes') return false;

                const attr = mutation.attributeName;
                return attr === 'class' || attr === 'data-theme' || attr === 'style';
            });

            if (hasRelevantChange) {
                this.checkThemeChange();
            }
        });

        // Observe html element
        this.observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'style']
        });

        // Observe body element (for Gemini)
        if (document.body) {
            this.observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'data-theme', 'style']
            });
        }
    }

    /**
     * Start listening for system preference changes
     */
    private startMediaQueryListener(): void {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        this.mediaQueryListener = () => {
            // Only respond to system preference if host doesn't have explicit theme
            if (!this.hasHostTheme()) {
                this.checkThemeChange();
            }
        };

        mediaQuery.addEventListener('change', this.mediaQueryListener);
    }

    /**
     * Check if theme has changed and notify listeners
     */
    private checkThemeChange(): void {
        const newTheme = this.detectHostTheme();

        if (newTheme !== this.currentTheme) {
            this.currentTheme = newTheme;
            this.applyTheme(newTheme);
            this.notifyListeners(newTheme);
            logger.info(`[ThemeManager] Theme changed to: ${newTheme}`);
        }
    }

    /**
     * Get current theme
     */
    getTheme(): Theme {
        return this.currentTheme;
    }

    /**
     * Check if currently in dark mode
     */
    isDarkMode(): boolean {
        return this.currentTheme === 'dark';
    }

    /**
     * Subscribe to theme changes
     * @returns Unsubscribe function
     */
    subscribe(callback: (theme: Theme) => void): () => void {
        this.listeners.add(callback);

        // Immediately call with current theme
        callback(this.currentTheme);

        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of theme change
     */
    private notifyListeners(theme: Theme): void {
        this.listeners.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                logger.error('[ThemeManager] Error in listener callback:', error);
            }
        });
    }

    /**
     * Apply theme to a Shadow DOM host element
     * Call this in Shadow DOM components to sync theme
     */
    applyToShadowHost(host: HTMLElement): () => void {
        // Set initial theme
        host.setAttribute('data-aimd-theme', this.currentTheme);

        // Subscribe to changes
        return this.subscribe((theme) => {
            host.setAttribute('data-aimd-theme', theme);
        });
    }

    /**
     * Cleanup and destroy
     */
    destroy(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.mediaQueryListener) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.removeEventListener('change', this.mediaQueryListener);
            this.mediaQueryListener = null;
        }

        this.listeners.clear();
        this.initialized = false;

        logger.info('[ThemeManager] Destroyed');
    }
}

/**
 * Convenience function for quick theme check
 */
export function isDarkMode(): boolean {
    return ThemeManager.getInstance().getTheme() === 'dark';
}
