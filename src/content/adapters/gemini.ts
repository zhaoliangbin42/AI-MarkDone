import { SiteAdapter } from './base';
import { logger } from '../../utils/logger';

/**
 * Gemini adapter implementation
 * Based on DOM structure from Gemini-Sample.html
 */
export class GeminiAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('gemini.google.com');
    }

    getMessageSelector(): string {
        // P2: Simplified - only use stable custom element
        return 'model-response';
    }

    getMessageContentSelector(): string {
        // Main content area inside response
        return '.model-response-text, #extended-response-markdown-content, .markdown';
    }

    getActionBarSelector(): string {
        // Action buttons are in the footer
        // IMPORTANT: This is INSIDE the model-response element
        return '.response-container-footer, .response-footer';
    }

    getCopyButtonSelector(): string {
        // P0: Gemini uses broader matching for copy buttons
        // Support both aria-label and data-tooltip attributes
        return 'button[aria-label*="Copy"], button[data-tooltip*="Copy"]';
    }

    extractMessageHTML(element: HTMLElement): string {
        // Try to get content from .model-response-text
        const contentElement = element.querySelector(this.getMessageContentSelector());
        if (contentElement) {
            return contentElement.innerHTML;
        }

        // Fallback: use entire element
        return element.innerHTML;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        // P1: Enhanced streaming detection with 3-step check

        // Step 1: Global check - Is there any streaming in progress?
        const hasStopButton = document.querySelector('button[aria-label*="Stop"]') !== null ||
            document.querySelector('button[aria-label*="停止"]') !== null;

        if (!hasStopButton) {
            // No Stop button = no streaming anywhere
            return false;
        }

        // Step 2: Position check - Is this the last message?
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        if (allMessages.length === 0) return false;

        const lastMessage = allMessages[allMessages.length - 1];
        if (lastMessage !== element) {
            // Not the last message → definitely not streaming
            return false;
        }

        // Step 3: Footer status check
        const footer = element.querySelector('.response-footer, .response-container-footer');
        if (!footer) {
            // Last message and no footer → likely streaming
            return true;
        }

        // Check if footer is marked as complete
        return !footer.classList.contains('complete');
    }

    getMessageId(element: HTMLElement): string | null {
        // Gemini uses data-test-draft-id for response identification
        const draftElement = element.querySelector('[data-test-draft-id]');
        if (draftElement) {
            return draftElement.getAttribute('data-test-draft-id');
        }

        // Fallback: try to generate ID from element position
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `gemini-message-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        // Try multiple possible containers for Gemini
        const selectors = [
            'main',
            '[data-test-id="chat-history-container"]',
            '.chat-history',
            'body'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) {
                logger.debug(`Observer container found: ${selector}`);
                return container;
            }
        }

        logger.warn('No observer container found for Gemini, falling back to body');
        return document.body;
    }

    /**
     * Get all math elements in the message
     * Gemini uses KaTeX just like ChatGPT
     */
    getMathElements(element: HTMLElement): NodeListOf<Element> {
        return element.querySelectorAll('.math-inline, .math-block, .katex');
    }

    /**
     * Get all code blocks in the message
     * Gemini uses custom <code-block> element
     */
    getCodeBlocks(element: HTMLElement): NodeListOf<Element> {
        return element.querySelectorAll('code-block code, pre code');
    }

    /**
     * Get all tables in the message
     */
    getTables(element: HTMLElement): NodeListOf<HTMLTableElement> {
        return element.querySelectorAll('table');
    }

    /**
     * Gemini-specific: Check if this is a Gemini page
     * Used to apply platform-specific styling
     */
    isGemini(): boolean {
        return true;
    }

    /**
     * Get user prompts for all messages
     * Extracts from [data-test-id="user-query"] or fallback selectors
     */
    getUserPrompts(): string[] {
        const prompts: string[] = [];

        try {
            // Try primary selector first
            let userQueries = document.querySelectorAll('[data-test-id="user-query"]');

            // Fallback to alternative selectors if primary fails
            if (userQueries.length === 0) {
                logger.debug('[GeminiAdapter] Primary selector failed, trying fallbacks');
                userQueries = document.querySelectorAll('user-query, .user-query');
            }

            userQueries.forEach((queryEl, index) => {
                try {
                    const text = queryEl.textContent?.trim() || `Message ${index + 1}`;
                    prompts.push(text);
                } catch (err) {
                    logger.warn(`[GeminiAdapter] Failed to extract prompt ${index}:`, err);
                    prompts.push(`Message ${index + 1}`);
                }
            });
        } catch (err) {
            logger.error('[GeminiAdapter] getUserPrompts failed:', err);
        }

        return prompts;
    }
}
