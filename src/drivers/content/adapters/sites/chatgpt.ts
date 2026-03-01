import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';
import { logger } from '../../../../core/logger';

const detector: ThemeDetector = {
    detect(): Theme | null {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
        if (document.documentElement.classList.contains('dark')) return 'dark';
        if (document.documentElement.classList.contains('light')) return 'light';
        return null;
    },
    getObserveTargets() {
        return [{ element: 'html', attributes: ['class', 'data-theme', 'style'] }];
    },
    hasExplicitTheme(): boolean {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        return htmlTheme === 'dark' || htmlTheme === 'light' || document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('light');
    },
};

export class ChatGPTAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('chatgpt.com') || url.includes('chat.openai.com');
    }

    getPlatformId(): string {
        return 'chatgpt';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    shouldEnhanceUnrenderedMath(): boolean {
        return true;
    }

    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        const normalize = (text: string): string =>
            text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const assistantArticle = assistantMessageElement.closest('article') || assistantMessageElement;
        const scope = assistantArticle.parentElement;
        if (scope) {
            const turns = Array.from(scope.querySelectorAll('article[data-turn]')).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            const idx = turns.indexOf(assistantArticle as HTMLElement);
            if (idx >= 0) {
                for (let i = idx - 1; i >= 0; i -= 1) {
                    const turn = turns[i];
                    if (turn.getAttribute('data-turn') !== 'user') continue;

                    const bubble =
                        (turn.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap') as HTMLElement | null) ||
                        (turn.querySelector('[data-message-author-role="user"]') as HTMLElement | null) ||
                        (turn.querySelector('.whitespace-pre-wrap') as HTMLElement | null);

                    const text = (bubble?.textContent || turn.textContent || '').trim();
                    const normalized = normalize(text);
                    return normalized || null;
                }
            }
        }

        // Fallback: walk backwards to find the nearest user-role node.
        let cursor: HTMLElement | null = assistantArticle as HTMLElement;
        while (cursor) {
            let prev: Element | null = cursor.previousElementSibling;
            while (prev) {
                const user =
                    (prev.matches?.('article[data-turn="user"]') ? (prev as HTMLElement) : null) ||
                    (prev.querySelector?.('[data-message-author-role="user"]') as HTMLElement | null);
                if (user) {
                    const text = (user.textContent || '').trim();
                    const normalized = normalize(text);
                    return normalized || null;
                }
                prev = prev.previousElementSibling;
            }
            cursor = cursor.parentElement;
        }

        return null;
    }

    getMessageSelector(): string {
        // Prefer the stable assistant message node; `article[data-turn]` has proven to be unstable across ChatGPT UI iterations.
        // Using the role+id container keeps Copy/Reader/toolbars resilient even if the surrounding turn wrapper changes.
        return '[data-message-author-role="assistant"][data-message-id]';
    }

    getMessageContentSelector(): string {
        return '.markdown.prose, .markdown.prose.dark\\:prose-invert';
    }

    getActionBarSelector(): string {
        return 'button[data-testid="copy-turn-action-button"]';
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        try {
            const contentElement = messageElement.querySelector(this.getMessageContentSelector());
            const turnWrapper = messageElement.closest('article') as HTMLElement | null;
            if (turnWrapper) {
                const actionBarAnchor = turnWrapper.querySelector(this.getActionBarSelector());
                if (actionBarAnchor) {
                    // Prefer injecting into the action bar row so we don't push the official toolbar down.
                    // We must avoid containers that toggle `pointer-events: none` on idle.
                    const inner = actionBarAnchor.parentElement as HTMLElement | null;
                    const outer = (inner?.parentElement as HTMLElement | null) || null;
                    const target = outer || inner;
                    if (target) {
                        toolbarHost.dataset.aimdPlacement = 'actionbar';
                        toolbarHost.style.marginLeft = 'auto';
                        toolbarHost.style.pointerEvents = 'auto';
                        target.appendChild(toolbarHost);
                        return true;
                    }
                }
            }

            // Fallback: place after message content root (stable, always visible).
            if (contentElement && contentElement.parentElement) {
                toolbarHost.dataset.aimdPlacement = 'content';
                contentElement.parentElement.insertBefore(toolbarHost, contentElement.nextSibling);
                return true;
            }

            messageElement.appendChild(toolbarHost);
            return true;
        } catch (err) {
            logger.warn('[AI-MarkDone][ChatGPTAdapter] injectToolbar failed, falling back to append', err);
            try {
                messageElement.appendChild(toolbarHost);
                return true;
            } catch {
                return false;
            }
        }
    }

    isStreamingMessage(element: HTMLElement): boolean {
        if (element.querySelector(this.getActionBarSelector())) {
            return false;
        }

        const stopButton = document.querySelector('button[aria-label*="Stop"]');
        if (!stopButton) return false;

        const messages = document.querySelectorAll(this.getMessageSelector());
        if (messages.length === 0) return false;
        const lastMessage = messages[messages.length - 1];
        return lastMessage === element;
    }

    getMessageId(element: HTMLElement): string | null {
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

        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `chatgpt-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['main', 'main [role="presentation"]', 'main > div', '#__next', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) return container;
        }
        return null;
    }

    isNoiseNode(node: Node, context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;

        if (node.classList.contains('sr-only')) {
            return true;
        }

        if (context?.nextSibling?.hasAttribute('data-message-author-role')) {
            if (node.classList.contains('min-h-6') && node.querySelector('button span.truncate')) {
                return true;
            }
        }

        return false;
    }
}
