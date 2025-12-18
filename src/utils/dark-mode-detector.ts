import { logger } from './logger';

/**
 * Dark Mode Detector
 * 
 * Detects and observes dark mode changes from host websites (ChatGPT/Gemini).
 * Follows the host website's theme, not the system preference.
 * 
 * Detection Strategy:
 * 1. Check <html> element's class attribute for 'dark' or 'light'
 * 2. Check data-theme attribute
 * 3. Fallback to prefers-color-scheme media query
 * 
 * @example
 * const detector = DarkModeDetector.getInstance();
 * const isDark = detector.isDarkMode();
 * 
 * const unsubscribe = detector.subscribe((isDark) => {
 *   console.log('Dark mode changed:', isDark);
 * });
 */

export class DarkModeDetector {
    private static instance: DarkModeDetector;
    private observers: Set<(isDark: boolean) => void> = new Set();
    private mutationObserver: MutationObserver | null = null;
    private currentState: boolean = false;

    private constructor() {
        this.currentState = this.detectDarkMode();
        this.startObserving();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): DarkModeDetector {
        if (!DarkModeDetector.instance) {
            DarkModeDetector.instance = new DarkModeDetector();
        }
        return DarkModeDetector.instance;
    }

    /**
     * Get current dark mode state
     */
    isDarkMode(): boolean {
        return this.currentState;
    }

    /**
     * Subscribe to dark mode changes
     * @param callback Function to call when dark mode changes
     * @returns Unsubscribe function
     */
    subscribe(callback: (isDark: boolean) => void): () => void {
        this.observers.add(callback);

        // Immediately call with current state
        callback(this.currentState);

        // Return unsubscribe function
        return () => {
            this.observers.delete(callback);
        };
    }

    /**
     * Detect current dark mode state
     * Priority:
     * 1. html.classList contains 'dark' or 'light' (ChatGPT)
     * 2. body.classList contains 'dark-theme' (Gemini)
     * 3. html[data-theme] attribute
     * 4. Computed background color heuristic
     * 5. prefers-color-scheme media query
     */
    private detectDarkMode(): boolean {
        const html = document.documentElement;
        const body = document.body;

        // Method 1: Check html class attribute (ChatGPT uses this)
        if (html.classList.contains('dark')) {
            logger.debug('[DarkMode] Detected via html.dark class');
            return true;
        }
        if (html.classList.contains('light')) {
            logger.debug('[DarkMode] Detected via html.light class');
            return false;
        }

        // Method 2: Check body class for Gemini (Gemini uses body.dark-theme)
        if (body && body.classList.contains('dark-theme')) {
            logger.debug('[DarkMode] Detected via body.dark-theme class (Gemini)');
            return true;
        }
        if (body && body.classList.contains('light-theme')) {
            logger.debug('[DarkMode] Detected via body.light-theme class (Gemini)');
            return false;
        }

        // Method 3: Check data-theme attribute
        const theme = html.getAttribute('data-theme') || body?.getAttribute('data-theme');
        if (theme === 'dark') {
            logger.debug('[DarkMode] Detected via data-theme="dark"');
            return true;
        }
        if (theme === 'light') {
            logger.debug('[DarkMode] Detected via data-theme="light"');
            return false;
        }

        // Method 4: Heuristic - check background color (for Gemini)
        if (body) {
            const bgColor = window.getComputedStyle(body).backgroundColor;
            // Parse RGB and check if it's dark
            const rgb = bgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]);
                const g = parseInt(rgb[1]);
                const b = parseInt(rgb[2]);
                // Calculate luminance
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                if (luminance < 0.5) {
                    logger.debug('[DarkMode] Detected via background color heuristic (dark)');
                    return true;
                }
            }
        }

        // Method 5: Fallback to prefers-color-scheme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        logger.debug(`[DarkMode] Fallback to prefers-color-scheme: ${prefersDark}`);
        return prefersDark;
    }

    /**
     * Start observing dark mode changes
     */
    private startObserving(): void {
        // Disconnect existing observer if any
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        // Create new observer
        this.mutationObserver = new MutationObserver((mutations) => {
            // Check if class or data-theme changed
            const hasRelevantChange = mutations.some(mutation => {
                if (mutation.type === 'attributes') {
                    return mutation.attributeName === 'class' ||
                        mutation.attributeName === 'data-theme';
                }
                return false;
            });

            if (hasRelevantChange) {
                const newState = this.detectDarkMode();

                // Only notify if state actually changed
                if (newState !== this.currentState) {
                    this.currentState = newState;
                    this.notifyObservers(newState);
                }
            }
        });

        // Observe <html> element for attribute changes
        this.mutationObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme'],
            childList: false,
            subtree: false
        });

        // Also observe <body> for Gemini (uses body.dark-theme)
        if (document.body) {
            this.mutationObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'data-theme']
            });
        }

        // Also listen to prefers-color-scheme changes (fallback)
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMediaChange = () => {
            const newState = this.detectDarkMode();
            if (newState !== this.currentState) {
                this.currentState = newState;
                this.notifyObservers(newState);
            }
        };

        // Modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMediaChange);
        } else {
            // Legacy browsers
            mediaQuery.addListener(handleMediaChange);
        }
    }

    /**
     * Notify all observers of state change
     */
    private notifyObservers(isDark: boolean): void {
        this.observers.forEach(callback => {
            try {
                callback(isDark);
            } catch (error) {
                console.error('Error in dark mode observer callback:', error);
            }
        });
    }

    /**
     * Stop observing (cleanup)
     */
    stopObserving(): void {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        this.observers.clear();
    }
}

/**
 * Helper function to apply dark mode class to document
 * This ensures our extension's styles can use html.dark selector
 */
export function applyDarkModeClass(): void {
    const detector = DarkModeDetector.getInstance();

    detector.subscribe((isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });
}
