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
     * 1. html.classList contains 'dark' or 'light'
     * 2. html[data-theme] attribute
     * 3. prefers-color-scheme media query
     */
    private detectDarkMode(): boolean {
        const html = document.documentElement;

        // Method 1: Check class attribute (ChatGPT uses this)
        if (html.classList.contains('dark')) {
            return true;
        }
        if (html.classList.contains('light')) {
            return false;
        }

        // Method 2: Check data-theme attribute (Gemini might use this)
        const theme = html.getAttribute('data-theme');
        if (theme === 'dark') {
            return true;
        }
        if (theme === 'light') {
            return false;
        }

        // Method 3: Fallback to prefers-color-scheme
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
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
