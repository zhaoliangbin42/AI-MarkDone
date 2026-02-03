import { SiteAdapter, ThemeDetector } from './base';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Deepseek (chat.deepseek.com) adapter implementation
 * Based on DOM structure analysis of mocks/DeepSeek/Deepseek-content.html
 */
export class DeepseekAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('chat.deepseek.com');
    }

    getMessageSelector(): string {
        // AI message container with .ds-markdown child
        // Uses :has() which is supported in Chrome 105+ (required for this extension)
        return 'div.ds-message:has(.ds-markdown)';
    }

    getMessageContentSelector(): string {
        // Main markdown content area (NOT inside .ds-think-content)
        return '.ds-markdown:not(.ds-think-content .ds-markdown)';
    }

    getActionBarSelector(): string {
        // Action bar container with icon buttons
        return '.ds-flex > .ds-icon-button';
    }

    getCopyButtonSelector(): string {
        return '.ds-icon-button';
    }

    extractMessageHTML(element: HTMLElement): string {
        // Find the main .ds-markdown content, excluding think content
        const contentElements = element.querySelectorAll(this.getMessageContentSelector());

        if (contentElements.length > 0) {
            // Get the last .ds-markdown that's not inside think content (the actual response)
            const mainContent = contentElements[contentElements.length - 1];
            return mainContent.innerHTML;
        }

        // Fallback: try to find any .ds-markdown
        const markdown = element.querySelector('.ds-markdown');
        if (markdown) {
            return markdown.innerHTML;
        }

        return element.innerHTML;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        // Find action bar in parent's siblings
        const parent = element.parentElement;
        if (!parent) return true;

        // Check siblings for action buttons
        const actionArea = parent.querySelector('.ds-icon-button');
        return !actionArea; // No action buttons = still streaming
    }

    getMessageId(element: HTMLElement): string | null {
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `deepseek-message-${index}` : null;
    }

    /**
     * Deepseek-specific noise filtering
     * 
     * Filters out:
     * - Think content (.ds-think-content) - "Deep thinking" section
     * - Code block banner (.md-code-block-banner-wrap) - language label + copy/download buttons
     * - SVG decorations in code blocks
     */
    isNoiseNode(node: Node, _context?: { nextSibling?: Element | null }): boolean {
        if (!(node instanceof HTMLElement)) return false;

        // Think content filter
        if (node.classList.contains('ds-think-content')) return true;
        if (node.closest('.ds-think-content')) return true;

        // Code block banner filter (the banner itself and ALL children)
        if (node.classList.contains('md-code-block-banner-wrap')) return true;
        if (node.closest('.md-code-block-banner-wrap')) return true;

        // SVG decorations in code blocks
        if (node.tagName === 'SVG' && node.closest('.md-code-block')) return true;

        return false;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['.ds-scroll-area', 'main', 'body'];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) {
                logger.debug(`[DeepseekAdapter] Observer container found: ${selector}`);
                return container;
            }
        }

        logger.warn('[DeepseekAdapter] No suitable observer container found');
        return null;
    }

    getUserPrompts(): string[] {
        const prompts: string[] = [];
        try {
            // User messages are ds-message elements that don't contain ds-markdown
            const allMessages = document.querySelectorAll('div.ds-message');

            allMessages.forEach((msg, index) => {
                if (!msg.querySelector('.ds-markdown')) {
                    const text = msg.textContent?.trim() || `Message ${index + 1}`;
                    prompts.push(text);
                }
            });
        } catch (err) {
            logger.error('[DeepseekAdapter] getUserPrompts failed:', err);
        }
        return prompts;
    }

    /**
     * Extract user prompt by traversing DOM backwards from the model response
     * 
     * Deepseek DOM structure:
     * - User messages: div.ds-message without .ds-markdown child
     * - AI messages: div.ds-message with .ds-markdown child
     * Both are wrapped in parent containers
     */
    extractUserPrompt(responseElement: HTMLElement): string | null {
        try {
            // Find the ds-message container
            const messageContainer = responseElement.classList.contains('ds-message')
                ? responseElement
                : responseElement.closest('.ds-message');
            if (!messageContainer) return null;

            // The message container's parent is the block wrapper
            const blockWrapper = messageContainer.parentElement;
            if (!blockWrapper) return null;

            // Traverse previous siblings of the block wrapper
            let prev = blockWrapper.previousElementSibling;
            while (prev) {
                // Look for ds-message that doesn't have ds-markdown (user message)
                const dsMessage = prev.querySelector('.ds-message');
                if (dsMessage && !dsMessage.querySelector('.ds-markdown')) {
                    return dsMessage.textContent?.trim() || null;
                }
                prev = prev.previousElementSibling;
            }

            return null;
        } catch (err) {
            logger.warn('[DeepseekAdapter] extractUserPrompt failed:', err);
            return null;
        }
    }

    getInputSelector(): string {
        // Deepseek uses a textarea for input
        return 'textarea.d96f2d2a, textarea._27c9245';
    }

    getSendButtonSelector(): string {
        return '.ds-floating-button';
    }

    getSendButton(): HTMLElement | null {
        // Strategy 1: Semantic Topology Search (Hash-Free)
        // Deepseek input area structure: [Upload Button] [File Input] [Send Button]
        // We use input[type="file"] as a stable anchor since hash class names (e.g. .bf38813a) are unstable.
        const fileInput = document.querySelector('input[type="file"]');

        if (fileInput && fileInput.parentElement) {
            // The container holds both Upload and Send buttons
            const container = fileInput.parentElement;
            const buttons = container.querySelectorAll('.ds-icon-button');

            if (buttons.length > 0) {
                // The Send/Stop button is structurally the last interaction element in this container
                return buttons[buttons.length - 1] as HTMLElement;
            }
        }

        // Strategy 2: Fallback for Desktop/Old Layouts
        // .ds-floating-button was observed in some desktop versions
        return document.querySelector('.ds-floating-button');
    }

    getIcon(): string {
        return Icons.deepseek;
    }

    getPlatformName(): string {
        return 'Deepseek';
    }

    /**
     * Normalize Deepseek DOM structure
     * 
     * Transforms:
     * <div class="md-code-block">
     *   <div class="md-code-block-banner-wrap">...python...</div>
     *   <pre>print('hello')</pre>
     * </div>
     * 
     * Into:
     * <div class="md-code-block">
     *   <pre><code class="language-python">print('hello')</code></pre>
     * </div>
     */
    normalizeDOM(element: HTMLElement): void {
        const codeBlocks = element.querySelectorAll('.md-code-block');

        codeBlocks.forEach(block => {
            const banner = block.querySelector('.md-code-block-banner-wrap');
            const pre = block.querySelector('pre');

            if (!pre) return;

            // Extract language
            let language = '';
            if (banner) {
                const langSpan = banner.querySelector('.d813de27');
                if (langSpan?.textContent) {
                    language = langSpan.textContent.trim();
                }
                // Remove banner (it's noise)
                banner.remove();
            }

            // If pre already has code, skip
            if (pre.querySelector('code')) return;

            // Wrap content in code tag
            const code = document.createElement('code');
            if (language) {
                code.className = `language-${language}`;
            }

            // Move all child nodes of pre to code
            while (pre.firstChild) {
                code.appendChild(pre.firstChild);
            }

            pre.appendChild(code);
        });
    }

    /**
     * Deepseek-specific toolbar injection
     * 
     * Inject toolbar before the action bar (after message content)
     */
    injectToolbar(messageElement: HTMLElement, toolbarWrapper: HTMLElement): boolean {
        const actionBar = messageElement.querySelector(this.getActionBarSelector());
        if (actionBar && actionBar.parentElement) {
            actionBar.parentElement.insertBefore(toolbarWrapper, actionBar);
            return true;
        }

        // Fallback logic


        // Check if there is any MAIN markdown content (exclude thinking)
        const allMarkdowns = Array.from(messageElement.querySelectorAll('.ds-markdown'));
        const hasMainMarkdown = allMarkdowns.some(md => !md.closest('.ds-think-content'));

        if (!hasMainMarkdown) {
            return false;
        }

        messageElement.appendChild(toolbarWrapper);
        return true;
    }

    /**
     * Deepseek theme detection
     * 
     * Dark mode: body.dark or body[data-ds-dark-theme="dark"]
     * Light mode: body.light (no data-ds-dark-theme attribute)
     */
    getThemeDetector(): ThemeDetector {
        return {
            detect: () => {
                const body = document.body;
                if (body.classList.contains('dark')) return 'dark';
                if (body.classList.contains('light')) return 'light';
                if (body.dataset.dsDarkTheme === 'dark') return 'dark';
                return 'light';
            },
            getObserveTargets: () => [{
                element: 'body',
                attributes: ['class', 'data-ds-dark-theme']
            }],
            hasExplicitTheme: () => {
                const body = document.body;
                return body.classList.contains('dark') ||
                    body.classList.contains('light') ||
                    !!body.dataset.dsDarkTheme;
            }
        };
    }
}
