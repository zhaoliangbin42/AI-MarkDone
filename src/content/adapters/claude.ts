import { SiteAdapter } from './base';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Claude.ai adapter implementation
 * Based on DOM structure analysis of claude.ai
 */
export class ClaudeAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('claude.ai');
    }

    getMessageSelector(): string {
        // Claude.ai: Select the parent container that includes both message and action bar
        // The action bar is a sibling, not a child, so we select the common parent
        return 'div.group[data-is-streaming="false"], div.group[style*="height: auto"]';
    }

    getMessageContentSelector(): string {
        // Return the entire response container to capture all content
        // including content after Artifacts (which are filtered by isNoiseNode)
        return '.font-claude-response';
    }

    /**
     * Action bar selector for Claude.ai
     *
     * Returns the actual official action bar element.
     * We'll inject our toolbar BEFORE this element (but after message content).
     */
    getActionBarSelector(): string {
        // Official action bar with copy button
        return 'div[role="group"][aria-label="Message actions"]';
    }

    getCopyButtonSelector(): string {
        // Claude.ai uses data-testid="action-bar-copy" for the copy button
        return 'button[data-testid="action-bar-copy"]';
    }

    extractMessageHTML(element: HTMLElement): string {
        // Try to find specific content container first
        const contentElement = element.querySelector(this.getMessageContentSelector());
        if (contentElement) {
            return contentElement.innerHTML;
        }

        // Try to find .font-claude-response directly
        const claudeResponse = element.querySelector('.font-claude-response');
        if (claudeResponse) {
            return claudeResponse.innerHTML;
        }

        // Fallback: use entire element
        return element.innerHTML;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        // Check if the LAST message is currently streaming
        // Step 1: Check for Stop generating button
        const stopButton = document.querySelector('button[aria-label*="Stop"]');
        if (!stopButton) {
            return false; // No streaming if no Stop button
        }

        // Step 2: Find the last assistant message
        const messages = document.querySelectorAll(this.getMessageSelector());
        if (messages.length === 0) {
            return false;
        }

        const lastMessage = messages[messages.length - 1];

        // Step 3: Check if this is the last message
        if (lastMessage !== element) {
            return false;
        }

        // Step 4: Check if copy button exists (appears after streaming completes)
        const copyButton = element.querySelector(this.getCopyButtonSelector());
        return !copyButton; // No copy button = still streaming
    }

    getMessageId(element: HTMLElement): string | null {
        // Claude.ai doesn't seem to have stable IDs in the initial HTML
        // Use position-based ID as fallback
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `claude-message-${index}` : null;
    }

    /**
     * Claude-specific noise filtering
     *
     * Filters out Claude.ai specific elements that should not be included in Markdown:
     * - Artifact preview cards (collapsible content blocks)
     * - Other UI elements that are not part of the actual response content
     *
     * IMPORTANT: Only filter the exact Artifact elements, not their containers,
     * to avoid filtering out legitimate content that comes after.
     *
     * @param node - DOM node to check
     * @param context - Optional context for position-based detection
     * @returns true if node should be filtered out
     */
    isNoiseNode(node: Node, _context?: { nextSibling?: Element | null }): boolean {
        if (!(node instanceof HTMLElement)) return false;

        // Filter: Artifact preview button container (exact match)
        const isArtifactButton =
            node.getAttribute('role') === 'button' &&
            node.getAttribute('aria-label') === 'Preview contents' &&
            node.classList.contains('flex') &&
            node.classList.contains('cursor-pointer');

        return isArtifactButton;
    }

    /**
     * Get placeholder text for Artifact elements
     * Returns a formatted placeholder like "Artifact: 【标题】"
     */
    getArtifactPlaceholder(node: HTMLElement): string | undefined {
        if (node.getAttribute('role') === 'button' &&
            node.getAttribute('aria-label') === 'Preview contents') {
            const titleEl = node.querySelector('.leading-tight');
            const title = titleEl?.textContent?.trim() || 'Untitled';
            return `[Artifact: [${title}]]`;
        }
        return undefined;
    }

    getObserverContainer(): HTMLElement | null {
        // Try multiple possible containers for Claude.ai
        const selectors = [
            'main',
            '[data-testid="page-header"]',
            'body'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) {
                logger.debug(`[ClaudeAdapter] Observer container found: ${selector}`);
                return container;
            }
        }

        logger.warn('[ClaudeAdapter] No suitable observer container found');
        return null;
    }

    /**
     * Get user prompts for all messages
     * Extracts from [data-testid="user-message"] elements
     */
    getUserPrompts(): string[] {
        const prompts: string[] = [];

        try {
            const userMessages = document.querySelectorAll('[data-testid="user-message"]');

            userMessages.forEach((userEl, index) => {
                try {
                    const text = userEl.textContent?.trim() || `Message ${index + 1}`;
                    prompts.push(text);
                } catch (err) {
                    logger.warn(`[ClaudeAdapter] Failed to extract prompt ${index}:`, err);
                    prompts.push(`Message ${index + 1}`);
                }
            });
        } catch (err) {
            logger.error('[ClaudeAdapter] getUserPrompts failed:', err);
        }

        return prompts;
    }

    /**
     * Extract user prompt by traversing DOM backwards from the model response
     *
     * Claude.ai DOM structure:
     * <div data-test-render-count="2">
     *   <div class="mb-1 mt-6 group">
     *     <div data-testid="user-message">...</div>  ← User message (we need this)
     *   </div>
     * </div>
     * <div data-test-render-count="2">
     *   <div class="group">
     *     <div data-is-streaming="false">...</div>  ← responseElement (start here)
     *   </div>
     * </div>
     */
    extractUserPrompt(responseElement: HTMLElement): string | null {
        try {
            // Strategy 1: Check previous siblings of responseElement
            let current: Element | null = responseElement;
            while (current) {
                current = current.previousElementSibling;
                if (!current) break;

                const userMessage = current.querySelector('[data-testid="user-message"]');
                if (userMessage) {
                    return this.cleanUserContent(userMessage as HTMLElement);
                }
            }

            // Strategy 2: Check parent's previous sibling and its descendants
            const parent = responseElement.parentElement;
            if (parent) {
                const parentPrev = parent.previousElementSibling;
                if (parentPrev) {
                    const userMessage = parentPrev.querySelector('[data-testid="user-message"]');
                    if (userMessage) {
                        return this.cleanUserContent(userMessage as HTMLElement);
                    }
                }
            }

            // Strategy 3: Check grandparent's previous sibling
            const grandparent = parent?.parentElement;
            if (grandparent) {
                const grandparentPrev = grandparent.previousElementSibling;
                if (grandparentPrev) {
                    const userMessage = grandparentPrev.querySelector('[data-testid="user-message"]');
                    if (userMessage) {
                        return this.cleanUserContent(userMessage as HTMLElement);
                    }
                }
            }

            // Strategy 4: Search all previous data-test-render-count elements
            // This handles cases where the user message is in a separate render count container
            const container = responseElement.closest('[data-test-render-count]');
            if (container) {
                let prevContainer = container.previousElementSibling;
                while (prevContainer) {
                    const userMessage = prevContainer.querySelector('[data-testid="user-message"]');
                    if (userMessage) {
                        return this.cleanUserContent(userMessage as HTMLElement);
                    }
                    prevContainer = prevContainer.previousElementSibling;
                }
            }

            return null;
        } catch (err) {
            logger.warn('[ClaudeAdapter] extractUserPrompt failed:', err);
            return null;
        }
    }

    private cleanUserContent(element: HTMLElement): string {
        return element.textContent?.trim() || '';
    }

    // ========================================
    // Message Sending Support
    // ========================================

    getInputSelector(): string {
        // Claude.ai uses contenteditable div with data-testid="chat-input"
        return 'div[contenteditable="true"][data-testid="chat-input"]';
    }

    getSendButtonSelector(): string {
        // Claude.ai send button - look for button near the input
        return 'button[type="submit"], button[aria-label*="Send"]';
    }

    getIcon(): string {
        return Icons.claude;
    }

    /**
     * Claude-specific toolbar injection
     *
     * Use default implementation from base class which injects BEFORE the action bar.
     * This is perfect for Claude.ai since:
     * - Message content comes first
     * - Then our toolbar (injected before action bar)
     * - Then official action bar (last)
     *
     * No custom logic needed - delegate to base class.
     */
    injectToolbar(messageElement: HTMLElement, toolbarWrapper: HTMLElement): boolean {
        // Use default base class implementation
        // This will insert toolbar before the action bar (returned by getActionBarSelector())
        const actionBar = messageElement.querySelector(this.getActionBarSelector());
        if (!actionBar || !actionBar.parentElement) {
            return false;
        }
        actionBar.parentElement.insertBefore(toolbarWrapper, actionBar);
        return true;
    }
}
