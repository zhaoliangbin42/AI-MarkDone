import { SiteAdapter, ThemeDetector } from './base';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Gemini adapter implementation
 * Based on DOM structure from Gemini-Sample.html
 */
export class GeminiAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('gemini.google.com');
    }

    getMessageSelector(): string {
        // STRICT: Only use stable custom element root
        // Avoid duplications by ensuring we target the container
        return 'model-response';
    }

    getMessageContentSelector(): string {
        // Main content area inside response
        return '.model-response-text, #extended-response-markdown-content, .markdown';
    }

    /**
     * Multi-selector strategy for action bar detection
     * Provides fallback selectors if Gemini UI changes
     */
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
     * Check if this model-response contains a Deep Research entry
     * Deep Research entries have an `immersive-entry-chip` element inside
     */
    isDeepResearchMessage(element: HTMLElement): boolean {
        return element.querySelector('immersive-entry-chip') !== null;
    }

    /**
     * Get Deep Research content from the currently open panel
     * 
     * Deep Research content is shown in a separate immersive panel,
     * not inside the model-response. When the panel is open, we should
     * extract content from there instead of the short summary message.
     * 
     * @returns The content element or null if panel is not open
     */
    getDeepResearchContent(): HTMLElement | null {
        const panel = document.querySelector('deep-research-immersive-panel');
        if (!panel) {
            logger.debug('[GeminiAdapter] Deep Research panel not found');
            return null;
        }

        const content = panel.querySelector('#extended-response-markdown-content');
        if (!content) {
            logger.debug('[GeminiAdapter] Deep Research content element not found');
            return null;
        }

        return content as HTMLElement;
    }

    /**
     * Check if Deep Research panel is currently open
     * Used to determine if content can be extracted or user needs to open the panel first
     */
    isDeepResearchPanelOpen(): boolean {
        return document.querySelector('deep-research-immersive-panel') !== null;
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

    /**
     * Extract user prompt by traversing DOM backwards from the model response
     */
    extractUserPrompt(responseElement: HTMLElement): string | null {
        try {
            // Strategy: Walk backwards to find <user-query> or [data-test-id="user-query"]

            let current: Element | null = responseElement;

            // 1. Check Previous Siblings
            while (current) {
                current = current.previousElementSibling;
                if (!current) break;

                // Check for User Query identifiers
                if (
                    current.tagName.toLowerCase() === 'user-query' ||
                    current.getAttribute('data-test-id') === 'user-query' ||
                    current.querySelector('[data-test-id="user-query"]')
                ) {
                    return this.cleanUserContent(current as HTMLElement);
                }
            }

            // 2. Fallback: Parent's Previous (if nested in some container)
            const parent = responseElement.parentElement;
            if (parent) {
                const parentPrev = parent.previousElementSibling;
                if (parentPrev && (
                    parentPrev.tagName.toLowerCase() === 'user-query' ||
                    parentPrev.getAttribute('data-test-id') === 'user-query' ||
                    parentPrev.querySelector('[data-test-id="user-query"]')
                )) {
                    return this.cleanUserContent(parentPrev as HTMLElement);
                }
            }

            return null;
        } catch (err) {
            logger.warn('[GeminiAdapter] extractUserPrompt failed:', err);
            return null;
        }
    }

    private cleanUserContent(element: HTMLElement): string {
        return element.textContent?.trim() || '';
    }

    /**
     * Gemini noise filtering - uses ONLY structural markers
     * Source: Gemini-table-code.html + previous audits
     */
    isNoiseNode(node: Node, _context?: { nextSibling?: Element | null }): boolean {
        if (!(node instanceof HTMLElement)) return false;

        // Filter 1: Thought/reasoning container
        // Source: Previous audit (model-thoughts custom element)
        // Marker: Custom element (100% unique)
        if (node.tagName.toLowerCase() === 'model-thoughts') {
            return true;
        }
        if (node.closest('.thoughts-container')) {
            return true;
        }

        // Filter 2: Code block language label header
        // Source: Gemini-table-code.html:4404-4426
        // Marker: .code-block-decoration.header-formatted (exact class combo)
        if (node.classList.contains('code-block-decoration') &&
            node.classList.contains('header-formatted')) {
            return true;
        }

        // Filter 3: Table footer action buttons
        // Source: Gemini-table-code.html:2969-3014
        // Marker: .table-footer[hide-from-message-actions] inside table-block
        if (node.classList.contains('table-footer') &&
            node.hasAttribute('hide-from-message-actions') &&
            node.closest('table-block')) {  // ← Prevent false positives
            return true;
        }

        return false;
    }

    // ========================================
    // Message Sending Support
    // ========================================

    getInputSelector(): string {
        // Gemini uses rich-textarea with Quill editor inside
        return 'rich-textarea .ql-editor[contenteditable="true"]';
    }

    getSendButtonSelector(): string {
        // Gemini send button with mat-icon-button class
        return 'button.send-button, button[aria-label*="Send"]';
    }

    getIcon(): string {
        return Icons.gemini;
    }

    /**
     * Get conversation title from Gemini UI
     * Gemini stores title in specific elements, not in <title> tag
     */
    getConversationTitle(): string | null {
        try {
            // Strategy 1: Try data-test-id selector (most stable)
            const titleEl = document.querySelector('[data-test-id="conversation-title"]');
            if (titleEl?.textContent?.trim()) {
                return titleEl.textContent.trim();
            }

            // Strategy 2: Try common title selectors
            const selectors = [
                '.conversation-title',
                '[aria-label*="Conversation"]',
                'h1.chat-title',
                '.chat-header h1',
                '.conversation-header h1'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el?.textContent?.trim()) {
                    return el.textContent.trim();
                }
            }

            logger.debug('[GeminiAdapter] No conversation title found');
            return null;
        } catch (err) {
            logger.warn('[GeminiAdapter] getConversationTitle failed:', err);
            return null;
        }
    }

    getPlatformName(): string {
        return 'Gemini';
    }

    getThemeDetector(): ThemeDetector {
        return {
            detect: () => {
                const body = document.body;
                if (body?.classList.contains('dark-theme')) return 'dark';
                if (body?.classList.contains('light-theme')) return 'light';
                return null;
            },
            getObserveTargets: () => [{
                element: 'body',
                attributes: ['class']
            }],
            hasExplicitTheme: () => {
                const body = document.body;
                return body?.classList.contains('dark-theme') ||
                    body?.classList.contains('light-theme');
            },
            detectFallback: () => {
                // Fallback: Check background luminance
                // Useful for early loading when classes might not be present
                const body = document.body;
                if (!body) return null;

                try {
                    const bg = getComputedStyle(body).backgroundColor;
                    const match = bg.match(/\d+/g);

                    if (!match || match.length < 3) return null;

                    const r = parseInt(match[0], 10);
                    const g = parseInt(match[1], 10);
                    const b = parseInt(match[2], 10);

                    // Calculate relative luminance
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

                    return luminance < 0.5 ? 'dark' : null;
                } catch {
                    return null;
                }
            }
        };
    }
}
