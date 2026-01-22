/**
 * Debounce utility function
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (timeout !== null) {
            clearTimeout(timeout);
        }

        timeout = window.setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Throttle utility function
 * @param func Function to throttle
 * @param limit Time limit in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Wait for element to appear in DOM
 * @param selector CSS selector
 * @param timeout Maximum wait time in milliseconds
 */
export function waitForElement(
    selector: string,
    timeout: number = 5000
): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

/**
 * Generate unique ID
 */
export function generateId(): string {
    return `aicopy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copy text to clipboard
 * @param text Text to copy
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Fallback method
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            return false;
        }
    }
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: HTMLElement): boolean {
    return !!(
        element.offsetWidth ||
        element.offsetHeight ||
        element.getClientRects().length
    );
}

/**
 * Safe query selector that handles complex selectors
 */
export function safeQuerySelector(
    parent: Element | Document,
    selector: string
): Element | null {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        console.error('Invalid selector:', selector, error);
        return null;
    }
}
/**
 * Setup keyboard/mouse event isolation on an input element
 * 
 * Prevents host pages (Claude.ai, ChatGPT, Gemini) from intercepting keyboard events.
 * Uses element-level stopPropagation since the element is inside Shadow DOM.
 * 
 * @param element - The input or textarea element to protect
 * @param options - Configuration options
 */
export function setupKeyboardIsolation(
    element: HTMLInputElement | HTMLTextAreaElement,
    options: {
        /** Allow Tab key for accessibility navigation (default: true) */
        allowTab?: boolean;
        /** Component name for logging */
        componentName?: string;
    } = {}
): void {
    const { allowTab = true } = options;

    // Keyboard events - stop propagation to prevent host page interception
    element.addEventListener('keydown', (e) => {
        const ke = e as KeyboardEvent;
        if (allowTab && ke.key === 'Tab') return;
        e.stopPropagation();
    });

    element.addEventListener('keyup', (e) => {
        const ke = e as KeyboardEvent;
        if (allowTab && ke.key === 'Tab') return;
        e.stopPropagation();
    });

    element.addEventListener('keypress', (e) => {
        e.stopPropagation();
    });

    // Mouse/focus events - stop propagation
    element.addEventListener('mousedown', (e) => e.stopPropagation());
    element.addEventListener('click', (e) => e.stopPropagation());
    element.addEventListener('focus', (e) => e.stopPropagation());
}
