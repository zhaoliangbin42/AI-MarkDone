import { SiteAdapter, ThemeDetector } from './base';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * ChatGPT adapter implementation
 * Based on DOM structure from ChatGPT-Success.html, ChatGPT-Fail.html, and ChatGPT-DeepResearch.html
 */
export class ChatGPTAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('chatgpt.com') || url.includes('chat.openai.com');
    }

    getMessageSelector(): string {
        // Support both regular conversations and DeepResearch
        // Regular: [data-message-author-role="assistant"] (not inside article)
        // DeepResearch: article[data-turn="assistant"]
        // Use :not() to avoid matching the same element twice
        return 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
    }


    getMessageContentSelector(): string {
        // Main markdown content area
        return '.markdown.prose, .markdown.prose.dark\\:prose-invert';
    }

    /**
     * Multi-selector strategy for action bar detection
     * Provides fallback selectors if ChatGPT UI changes
     */
    getActionBarSelector(): string {
        // IMPORTANT:
        // We intentionally key off the official *turn action* "Copy" button as the most stable signal.
        // ChatGPT frequently changes surrounding container classes via A/B tests, but the
        // turn action copy button typically remains accessible via data-testid.
        //
        // This selector is used both as:
        // 1) "action bar exists" signal (streaming completion)
        // 2) an anchor for toolbar placement (we will walk up to the real bar container)
        //
        // Why not include `button[aria-label="Copy"]`?
        // ChatGPT often renders additional Copy buttons inside code blocks. Those would cause the
        // toolbar to be anchored to the wrong part of the DOM (e.g. near the page edge).
        return 'button[data-testid="copy-turn-action-button"]';
    }

    /**
     * ChatGPT-specific toolbar injection with robust fallbacks.
     *
     * ChatGPT DOM is frequently A/B tested; class-based action bar selectors
     * can break and cause a global "no toolbar" failure.
     *
     * Strategy:
     * 1) Preferred: insert before action bar (if found)
     * 2) Fallback: insert right after message content container
     * 3) Last resort: append to message element
     */
    injectToolbar(messageElement: HTMLElement, toolbarWrapper: HTMLElement): boolean {
        try {
            const actionBarAnchor = messageElement.querySelector(this.getActionBarSelector());
            if (actionBarAnchor) {
                // Prefer inserting before the action bar container (not inside it).
                // When selector matches the turn action Copy button, climb to the closest bar wrapper.
                const barContainer = (actionBarAnchor.closest('div.z-0.flex') as HTMLElement | null) ||
                    (actionBarAnchor.parentElement as HTMLElement | null);

                if (barContainer && barContainer.parentElement) {
                    barContainer.parentElement.insertBefore(toolbarWrapper, barContainer);
                    return true;
                }
            }

            const contentElement = messageElement.querySelector(this.getMessageContentSelector());
            if (contentElement && contentElement.parentElement) {
                contentElement.parentElement.insertBefore(toolbarWrapper, contentElement.nextSibling);
                return true;
            }

            messageElement.appendChild(toolbarWrapper);
            return true;
        } catch (err) {
            logger.warn('[ChatGPTAdapter] injectToolbar failed, falling back to append:', err);
            try {
                messageElement.appendChild(toolbarWrapper);
                return true;
            } catch {
                return false;
            }
        }
    }


    getCopyButtonSelector(): string {
        // IMPORTANT: only match the official action bar Copy button, not code-block Copy buttons.
        return 'button[data-testid="copy-turn-action-button"]';
    }

    extractMessageHTML(element: HTMLElement): string {
        // 1. Try to find specific content container FIRST
        // This avoids including "ChatGPT said" labels which are often inside the article but outside the prose
        const contentElement = element.querySelector(this.getMessageContentSelector());
        if (contentElement) {
            return contentElement.innerHTML;
        }

        // 2. If no content container, then check if it's article (DeepResearch fallback)
        // DeepResearch: article[data-turn="assistant"] - use entire article content
        if (element.tagName.toLowerCase() === 'article') {
            return element.innerHTML;
        }

        // Fallback: return own HTML
        return element.innerHTML;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        // Element-scoped detection to avoid global false positives.
        // Primary signal: official action bar exists => message is complete.
        if (element.querySelector(this.getActionBarSelector())) {
            return false;
        }

        // Secondary signal: if ChatGPT is currently generating AND this is the latest assistant message,
        // treat it as streaming. (Avoid marking older messages as streaming.)
        const stopButton = document.querySelector('button[aria-label*="Stop"]');
        if (!stopButton) return false;

        const messages = document.querySelectorAll(this.getMessageSelector());
        if (messages.length === 0) return false;
        const lastMessage = messages[messages.length - 1];

        return lastMessage === element;
    }

    getMessageId(element: HTMLElement): string | null {
        // Prefer stable attributes when available
        const dataMessageId = element.getAttribute('data-message-id');
        if (dataMessageId) return dataMessageId;

        const dataTestId = element.getAttribute('data-testid');
        if (dataTestId) return dataTestId;

        const dataTurn = element.getAttribute('data-turn');
        if (dataTurn) {
            const allMessages = document.querySelectorAll(this.getMessageSelector());
            const index = Array.from(allMessages).indexOf(element);
            return index >= 0 ? `chatgpt-${dataTurn}-${index}` : `chatgpt-${dataTurn}`;
        }

        // Fallback: position-based ID
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `chatgpt-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        // Try multiple possible containers for ChatGPT
        // ChatGPT's structure may vary
        const selectors = [
            'main',
            'main [role="presentation"]',
            'main > div',
            '#__next',
            'body'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) {
                logger.debug(`Observer container found: ${selector}`);
                return container;
            }
        }

        logger.warn('No suitable observer container found');
        return null;
    }

    /**
     * Check if message is a Deep Research result
     */
    isDeepResearchMessage(element: HTMLElement): boolean {
        return element.querySelector('.deep-research-result') !== null ||
            element.querySelector('[data-testid="conversation-turn"] article') !== null;
    }

    /**
     * Get all math elements in the message
     */
    getMathElements(element: HTMLElement): NodeListOf<Element> {
        return element.querySelectorAll('.katex.formula-interactive, .katex-display .katex');
    }

    /**
     * Get all code blocks in the message
     */
    getCodeBlocks(element: HTMLElement): NodeListOf<Element> {
        return element.querySelectorAll('pre code');
    }

    /**
     * Get all tables in the message
     */
    getTables(element: HTMLElement): NodeListOf<HTMLTableElement> {
        return element.querySelectorAll('table');
    }

    /**
     * Get user prompts for all messages
     * Extracts from [data-message-author-role="user"] elements
     */
    getUserPrompts(): string[] {
        const prompts: string[] = [];

        try {
            const userMessages = document.querySelectorAll('[data-message-author-role="user"]');

            userMessages.forEach((userEl, index) => {
                try {
                    // Try to find content in .whitespace-pre-wrap (most reliable)
                    const contentEl = userEl.querySelector('.whitespace-pre-wrap');
                    const text = contentEl?.textContent?.trim()
                        || userEl.textContent?.trim()
                        || `Message ${index + 1}`;
                    prompts.push(text);
                } catch (err) {
                    logger.warn(`[ChatGPTAdapter] Failed to extract prompt ${index}:`, err);
                    prompts.push(`Message ${index + 1}`);
                }
            });
        } catch (err) {
            logger.error('[ChatGPTAdapter] getUserPrompts failed:', err);
        }

        return prompts;
    }
    /**
     * Extract user prompt by traversing DOM backwards from the model response
     */
    extractUserPrompt(responseElement: HTMLElement): string | null {
        try {
            let current: Element | null = responseElement;

            // Traverse previous siblings
            while (current) {
                current = current.previousElementSibling;
                if (!current) break;

                // Check if this sibling is a user message
                if (
                    current.getAttribute('data-message-author-role') === 'user' ||
                    current.querySelector('[data-message-author-role="user"]')
                ) {
                    return this.cleanUserContent(current as HTMLElement);
                }
            }

            // Fallback: Check parent's previous sibling (for nested structures)
            const parent = responseElement.parentElement;
            if (parent) {
                const parentPrev = parent.previousElementSibling;
                if (parentPrev && (
                    parentPrev.getAttribute('data-message-author-role') === 'user' ||
                    parentPrev.querySelector('[data-message-author-role="user"]')
                )) {
                    return this.cleanUserContent(parentPrev as HTMLElement);
                }
            }

            return null;
        } catch (err) {
            logger.warn('[ChatGPTAdapter] extractUserPrompt failed:', err);
            return null;
        }
    }

    private cleanUserContent(element: HTMLElement): string {
        const contentDiv = element.querySelector('.whitespace-pre-wrap') || element;
        return contentDiv.textContent?.trim() || '';
    }

    /**
     * ChatGPT noise filtering - uses ONLY structural markers
     * Source: ChatGPT-Thought.html
     */
    isNoiseNode(node: Node, context?: { nextSibling?: Element | null }): boolean {
        if (!(node instanceof HTMLElement)) return false;

        // Filter 1: Screen-reader-only headers (e.g., "ChatGPT says:")
        // Source: ChatGPT-Thought.html:5
        // Marker: .sr-only class (100% reliable)
        if (node.classList.contains('sr-only')) {
            return true;
        }

        // Filter 2: "Thought for Xm Ys" container
        // Source: ChatGPT-Thought.html:15-33
        // Strategy: Position-based - appears BEFORE data-message-author-role
        if (context?.nextSibling?.hasAttribute('data-message-author-role')) {
            // This node precedes actual message, check for thought indicator
            if (node.classList.contains('min-h-6') &&
                node.querySelector('button span.truncate')) {
                return true;  // Thought container
            }
        }

        return false;
    }

    // ========================================
    // Message Sending Support
    // ========================================

    getInputSelector(): string {
        // ChatGPT uses a contenteditable div or textarea for input
        // The main prompt input has id="prompt-textarea" or is in composer
        return '#prompt-textarea, div[contenteditable="true"].ProseMirror';
    }

    getSendButtonSelector(): string {
        // ChatGPT send button - look for data-testid or aria attributes
        return 'button[data-testid="send-button"], button[aria-label="Send prompt"]';
    }

    getIcon(): string {
        return Icons.chatgpt;
    }

    getPlatformName(): string {
        return 'ChatGPT';
    }

    getThemeDetector(): ThemeDetector {
        return {
            detect: () => {
                const html = document.documentElement;
                if (html.classList.contains('dark')) return 'dark';
                if (html.classList.contains('light')) return 'light';
                return null;
            },
            getObserveTargets: () => [{
                element: 'html',
                attributes: ['class']
            }],
            hasExplicitTheme: () => {
                const html = document.documentElement;
                return html.classList.contains('dark') || html.classList.contains('light');
            }
        };
    }
}
