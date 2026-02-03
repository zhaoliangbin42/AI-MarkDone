/**
 * ThemeManager - Unified Theme Detection and Synchronization
 * 
 * Uses platform adapters to detect host website themes and synchronizes
 * with our design token system via data-aimd-theme attribute.
 * 
 * Architecture:
 * - ThemeDetector interface defined in adapters/base.ts
 * - Each adapter (ChatGPT, Gemini, Claude) implements getThemeDetector()
 * - ThemeManager uses the current adapter's detector for theme detection
 * 
 * @example
 * // Initialize at app startup
 * ThemeManager.getInstance().init();
 * 
 * // Subscribe to theme changes
 * const unsubscribe = ThemeManager.getInstance().subscribe((theme) => {
 *   // react to theme changes
 * });
 */

import { logger } from './logger';
import type { SiteAdapter } from '../content/adapters/base';
import { adapterRegistry } from '../content/adapters/registry';

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

        // 2. Watch for DOM changes
        this.startObserver();

        // 3. Watch for system preference changes (fallback)
        this.startMediaQueryListener();

        this.initialized = true;
    }

    /**
     * Helper to get current site adapter
     */
    private getAdapter(): SiteAdapter | null {
        return adapterRegistry.getAdapter();
    }

    /**
     * Detect current theme from host website
     * 1. Check Adapter (Primary Detect)
     * 2. Check Generic data-theme
     * 3. Check Adapter (Fallback Detect - e.g. luminance)
     * 4. Check System Preference (Final Fallback)
     */
    private detectHostTheme(): Theme {
        const adapter = this.getAdapter();

        // 1. Adapter Primary Detection
        if (adapter) {
            const detector = adapter.getThemeDetector();
            const detected = detector.detect();
            if (detected) {
                logger.debug(`[ThemeManager] Detected via adapter (${adapter.constructor.name}): ${detected}`);
                return detected;
            }
        }

        // 2. Generic fallback: data-theme attribute
        // This is checked BEFORE adapter fallback (luminance) because explicit attribute > heuristic
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') {
            logger.debug(`[ThemeManager] Detected via data-theme: ${htmlTheme}`);
            return htmlTheme;
        }

        // 3. Adapter Fallback Detection (e.g. background luminance)
        if (adapter) {
            const detector = adapter.getThemeDetector();
            if (detector.detectFallback) {
                const fallback = detector.detectFallback();
                if (fallback) {
                    logger.debug(`[ThemeManager] Detected via adapter fallback: ${fallback}`);
                    return fallback;
                }
            }
        }

        // 4. System preference fallback
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        logger.debug(`[ThemeManager] Fallback to system preference: ${prefersDark ? 'dark' : 'light'}`);
        return prefersDark ? 'dark' : 'light';
    }

    /**
     * Check if host has explicit theme (not just system preference)
     */
    private hasHostTheme(): boolean {
        const adapter = this.getAdapter();
        if (adapter) {
            return adapter.getThemeDetector().hasExplicitTheme();
        }

        // Generic fallback check
        const html = document.documentElement;
        return !!html.getAttribute('data-theme');
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

        this.observer = new MutationObserver(() => {
            this.checkThemeChange();
        });

        const adapter = this.getAdapter();

        if (adapter) {
            // Use adapter's specific observation targets
            const targets = adapter.getThemeDetector().getObserveTargets();
            targets.forEach(({ element, attributes }) => {
                const el = element === 'html' ? document.documentElement : document.body;
                if (el) {
                    this.observer!.observe(el, {
                        attributes: true,
                        attributeFilter: attributes
                    });
                    logger.debug(`[ThemeManager] Observing ${element} for: ${attributes.join(', ')}`);
                }
            });
        } else {
            // Generic fallback observation
            this.observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'data-theme', 'style']
            });
            logger.debug('[ThemeManager] Using generic fallback observation');
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
        const oldTheme = this.currentTheme;
        const newTheme = this.detectHostTheme();

        logger.debug(`[ThemeManager] checkThemeChange: ${oldTheme} -> ${newTheme}`);

        if (newTheme !== this.currentTheme) {
            this.currentTheme = newTheme;
            this.applyTheme(newTheme);
            this.notifyListeners(newTheme);
            logger.info(`[ThemeManager] 🎨 Theme changed: ${oldTheme} -> ${newTheme}`);
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
