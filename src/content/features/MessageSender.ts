/**
 * MessageSender - Core Logic for Message Sending Feature
 * 
 * Handles synchronization between FloatingInput and native platform input,
 * and programmatic triggering of the send button.
 * 
 * Key Features:
 * - Read from native input
 * - Write to native input (3-layer fallback strategy)
 * - Wait for send button ready state
 * - Trigger send button click
 */

import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';

// ========================================
// Contenteditable Serialization Utilities
// ========================================

/**
 * Parse contenteditable HTML to plain text, preserving exact newlines.
 * Uses DOM manipulation for cross-browser compatibility.
 * 
 * ProseMirror structure:
 * - Each <p> represents one line
 * - Empty lines are <p><br></p> (br is just a placeholder, not an extra newline)
 * - Other editors may use <div> or <br> directly
 * 
 * @param element - The contenteditable element
 * @returns Plain text with preserved newlines
 */
function parseToPlainText(element: HTMLElement): string {
    // Check if content uses block elements (ProseMirror style)
    const blocks = element.querySelectorAll('p, div');

    if (blocks.length > 0) {
        // ProseMirror/Block-based: each block = one line
        const lines: string[] = [];
        blocks.forEach(block => {
            // Get text content, empty block (<p><br></p>) = empty string
            const text = block.textContent || '';
            lines.push(text);
        });
        return lines.join('\n');
    }

    // Fallback: simple br-based content (Firefox style)
    // Clone to avoid mutating original DOM
    const clone = element.cloneNode(true) as HTMLElement;

    // Replace <br> with newline
    clone.querySelectorAll('br').forEach(br => {
        br.replaceWith('\n');
    });

    return clone.textContent || '';
}

/**
 * Apply plain text to contenteditable as ProseMirror-like block structure.
 * Avoids direct innerHTML assignment on high-risk paths.
 */
function applyPlainTextToContenteditable(input: HTMLElement, text: string): void {
    const lines = text.split('\n');
    const nodes: HTMLElement[] = lines.map((line) => {
        const p = document.createElement('p');
        if (line === '') {
            p.appendChild(document.createElement('br'));
        } else {
            p.textContent = line;
        }
        return p;
    });

    input.replaceChildren(...nodes);
}

export interface MessageSenderOptions {
    /** Adapter for current platform */
    adapter: SiteAdapter;
}

export class MessageSender {
    private adapter: SiteAdapter;

    constructor(options: MessageSenderOptions) {
        this.adapter = options.adapter;
    }

    /**
     * Read current content from native input
     */
    readFromNative(): string {
        const input = this.adapter.getInputElement();
        logger.debug('[MessageSender] readFromNative called', {
            hasInput: !!input,
            inputTag: input?.tagName,
            inputClass: input?.className
        });
        if (!input) {
            logger.warn('[MessageSender] Native input not found');
            return '';
        }

        // Handle different input types
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const value = input.value;
            logger.debug('[MessageSender] Read from textarea/input', { length: value.length });
            return value;
        }

        // Contenteditable element - use DOM-based serialization for accuracy
        if (input.getAttribute('contenteditable') === 'true') {
            const text = parseToPlainText(input);
            logger.debug('[MessageSender] Read from contenteditable', {
                length: text.length,
                newlineCount: (text.match(/\n/g) || []).length
            });
            return text;
        }

        logger.warn('[MessageSender] Unknown input type');
        return '';
    }

    /**
     * Sync content to native input using 3-layer fallback strategy
     * @param text - Text to write to native input
     * @param focusInput - Whether to focus the input (default: true, set false for background sync)
     * @returns true if successful
     */
    async syncToNative(text: string, focusInput: boolean = true): Promise<boolean> {
        const input = this.adapter.getInputElement();
        if (!input) {
            logger.warn('[MessageSender] Native input not found');
            return false;
        }

        // Only focus if explicitly requested (not during background debounced sync)
        if (focusInput) {
            input.focus();
        }

        // Clear existing content
        await this.clearInput(input, focusInput);

        // Try 3-layer fallback strategy
        const success =
            this.tryInputEvent(input, text) ||
            this.tryExecCommand(input, text, focusInput) ||
            this.tryDirectDOM(input, text);

        if (success) {
            logger.debug('[MessageSender] Synced to native input');
        } else {
            logger.error('[MessageSender] All sync strategies failed');
        }

        return success;
    }



    /**
     * Sync to native input using input event simulation
     * Triggers beforeinput + input events to notify framework of changes
     */
    silentSync(text: string): boolean {
        logger.debug('[MessageSender] silentSync called', {
            textLength: text.length,
            newlineCount: (text.match(/\n/g) || []).length
        });
        const input = this.adapter.getInputElement();
        if (!input) {
            logger.warn('[MessageSender] Native input not found for silentSync');
            return false;
        }

        try {
            // 1. Set content
            if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
                input.value = text;
                logger.debug('[MessageSender] Set textarea/input value');
            } else {
                // For contenteditable, use safe DOM node composition.
                applyPlainTextToContenteditable(input, text);
                logger.debug('[MessageSender] Set contenteditable content', {
                    lineCount: text.split('\n').length,
                });
            }

            // 2. Dispatch input events to trigger framework state update
            input.dispatchEvent(new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            }));
            logger.debug('[MessageSender] Dispatched beforeinput event');

            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: false,
                inputType: 'insertText',
                data: text
            }));
            logger.debug('[MessageSender] Dispatched input event');

            logger.debug('[MessageSender] silentSync completed successfully');
            return true;
        } catch (e) {
            logger.error('[MessageSender] silentSync failed:', e);
            return false;
        }
    }

    /**
     * Force sync to native input immediately (no focus stealing)
     */
    forceSyncToNative(text: string): boolean {
        return this.silentSync(text);
    }

    /**
     * Wait for send button to become ready (enabled)
     * @param timeoutMs - Maximum wait time
     * @returns true if button is ready, false if timeout
     */
    async waitForSendButtonReady(timeoutMs: number = 3000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const sendBtn = this.adapter.getSendButton();

            if (sendBtn && !sendBtn.hasAttribute('disabled')) {
                logger.debug('[MessageSender] Send button ready');
                return true;
            }

            // Wait and check again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.warn('[MessageSender] Send button ready timeout');
        return false;
    }

    /**
     * Trigger the native send button
     * @returns true if triggered successfully
     */
    async triggerSend(): Promise<boolean> {
        const sendBtn = this.adapter.getSendButton();

        if (!sendBtn) {
            logger.warn('[MessageSender] Send button not found');
            return false;
        }

        if (sendBtn.hasAttribute('disabled')) {
            logger.warn('[MessageSender] Send button is disabled');
            return false;
        }

        // Simulate click
        sendBtn.click();
        logger.debug('[MessageSender] Send button clicked');

        return true;
    }

    /**
     * Full send flow: sync content + trigger send
     */
    async send(text: string): Promise<boolean> {
        // Step 1: Force sync (with focus this time, since we're about to send)
        const synced = await this.syncToNative(text, true);
        if (!synced) {
            return false;
        }

        // Step 2: Wait for send button
        const ready = await this.waitForSendButtonReady();
        if (!ready) {
            return false;
        }

        // Step 3: Trigger send
        return this.triggerSend();
    }

    /**
     * Cleanup resources (no-op currently, placeholder for future cleanup)
     */
    destroy(): void {
        // No resources to cleanup currently
    }

    /**
     * Watch send button state changes using MutationObserver
     * @param onChange - Callback when loading state changes
     * @returns Cleanup function to disconnect observer
     */
    watchSendButtonState(onChange: (isLoading: boolean) => void): () => void {
        const sendBtn = this.adapter.getSendButton();
        logger.info('[MessageSender] watchSendButtonState called', {
            hasSendBtn: !!sendBtn,
            sendBtnTag: sendBtn?.tagName,
            sendBtnDisabled: sendBtn?.hasAttribute('disabled'),
            sendBtnAriaDisabled: sendBtn?.getAttribute('aria-disabled')
        });

        if (!sendBtn) {
            logger.warn('[MessageSender] Send button not found for watching');
            return () => { };
        }

        const checkState = () => {
            const isDisabled = sendBtn.hasAttribute('disabled');
            const ariaDisabled = sendBtn.getAttribute('aria-disabled');
            logger.info('[MessageSender] Button state changed', {
                isDisabled,
                ariaDisabled,
                className: sendBtn.className
            });
            onChange(isDisabled);
        };

        const observer = new MutationObserver((mutations) => {
            logger.info('[MessageSender] MutationObserver triggered', {
                mutationsCount: mutations.length,
                types: mutations.map(m => m.attributeName)
            });
            checkState();
        });

        observer.observe(sendBtn, {
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled']
        });

        logger.info('[MessageSender] MutationObserver started on send button');

        return () => {
            logger.info('[MessageSender] MutationObserver disconnected');
            observer.disconnect();
        };
    }

    // ========================================
    // Private: Input Strategies
    // ========================================

    /**
     * Clear input content
     */
    private async clearInput(input: HTMLElement, focusInput: boolean = true): Promise<void> {
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            this.setReactValue(input, '');
        } else if (input.getAttribute('contenteditable') === 'true') {
            // Select all and delete - only if we can focus
            if (focusInput) {
                input.focus();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(input);
                selection?.removeAllRanges();
                selection?.addRange(range);

                // Try execCommand first
                if (!document.execCommand('delete')) {
                    input.replaceChildren();
                }
            } else {
                // Direct clear without focus
                input.replaceChildren();
            }
        }
    }

    /**
     * Strategy 1: execCommand (best compatibility with React/Vue)
     */
    private tryExecCommand(input: HTMLElement, text: string, focusInput: boolean = true): boolean {
        try {
            if (focusInput) {
                input.focus();
            }

            // Use insertText command
            const success = document.execCommand('insertText', false, text);

            if (success) {
                logger.debug('[MessageSender] execCommand succeeded');
                return true;
            }
        } catch (e) {
            logger.debug('[MessageSender] execCommand failed:', e);
        }
        return false;
    }

    /**
     * Strategy 2: InputEvent dispatch (Enhanced for React)
     */
    private tryInputEvent(input: HTMLElement, text: string): boolean {
        try {
            if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
                this.setReactValue(input, text);
            } else {
                input.textContent = text;
                input.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text
                }));
            }

            logger.debug('[MessageSender] InputEvent succeeded (React-compatible)');
            return true;
        } catch (e) {
            logger.debug('[MessageSender] InputEvent failed:', e);
        }
        return false;
    }

    /**
     * Helper: Set value using React-compatible property descriptor
     * This bypasses React's controlled component wrapper to update the internal state
     */
    private setReactValue(input: HTMLTextAreaElement | HTMLInputElement, value: string): void {
        const proto = Object.getPrototypeOf(input);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        // Check if setter exists
        if (setter) {
            setter.call(input, value);
        } else {
            input.value = value;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Strategy 3: Direct DOM manipulation (last resort)
     */
    private tryDirectDOM(input: HTMLElement, text: string): boolean {
        try {
            if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
                input.value = text;
            } else {
                input.textContent = text;
            }

            // Dispatch change event as fallback
            input.dispatchEvent(new Event('change', { bubbles: true }));

            logger.debug('[MessageSender] Direct DOM succeeded');
            return true;
        } catch (e) {
            logger.debug('[MessageSender] Direct DOM failed:', e);
        }
        return false;
    }
}
