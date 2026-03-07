import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';
import { claudeMarkdownParserAdapter } from '../parser/claude';
import type { MarkdownParserAdapter } from '../parser/MarkdownParserAdapter';

const detector: ThemeDetector = {
    detect(): Theme | null {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
        return null;
    },
    getObserveTargets() {
        return [{ element: 'html', attributes: ['class', 'data-theme', 'style'] }];
    },
    hasExplicitTheme(): boolean {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        return htmlTheme === 'dark' || htmlTheme === 'light';
    },
};

export class ClaudeAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('claude.ai');
    }

    getPlatformId(): string {
        return 'claude';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return claudeMarkdownParserAdapter;
    }

    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        const normalize = (text: string): string =>
            text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const group = assistantMessageElement.closest('div.group') || assistantMessageElement;

        // Claude renders user messages with [data-testid="user-message"].
        let cursor: Element | null = group;
        while (cursor) {
            let prev: Element | null = cursor.previousElementSibling;
            while (prev) {
                const user = prev.querySelector('[data-testid="user-message"]') as HTMLElement | null;
                if (user) {
                    const textEl = (user.querySelector('.whitespace-pre-wrap') as HTMLElement | null) || user;
                    const text = (textEl.textContent || '').trim();
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
        return 'div.group[style*="height: auto"]';
    }

    getMessageContentSelector(): string {
        return '.font-claude-response';
    }

    getActionBarSelector(): string {
        return 'div[role="group"][aria-label="Message actions"]';
    }

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const turn = assistantMessageElement.closest('div.group[style*="height: auto"]');
        return turn instanceof HTMLElement ? turn : null;
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionBar = messageElement.querySelector(this.getActionBarSelector());
        if (actionBar && actionBar.parentElement) {
            actionBar.parentElement.insertBefore(toolbarHost, actionBar);
            return true;
        }

        const content = messageElement.querySelector(this.getMessageContentSelector());
        if (content && content.parentElement) {
            content.parentElement.insertBefore(toolbarHost, content.nextSibling);
            return true;
        }

        messageElement.appendChild(toolbarHost);
        return true;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        const stopButton = document.querySelector('button[aria-label*="Stop"]');
        if (!stopButton) return false;

        const messages = document.querySelectorAll(this.getMessageSelector());
        if (messages.length === 0) return false;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage !== element) return false;

        const copyButton = element.querySelector('button[data-testid="action-bar-copy"]');
        return !copyButton;
    }

    getMessageId(element: HTMLElement): string | null {
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `claude-message-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['main', '[data-testid="page-header"]', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) return container;
        }
        return null;
    }

    isNoiseNode(node: Node, _context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;
        const isArtifactButton =
            node.getAttribute('role') === 'button' &&
            node.getAttribute('aria-label') === 'Preview contents' &&
            node.classList.contains('flex') &&
            node.classList.contains('cursor-pointer');
        return isArtifactButton;
    }

    getArtifactPlaceholder(node: HTMLElement): string | null {
        if (node.getAttribute('role') === 'button' && node.getAttribute('aria-label') === 'Preview contents') {
            const titleEl = node.querySelector('.leading-tight');
            const title = titleEl?.textContent?.trim() || 'Untitled';
            return `[Artifact: [${title}]]`;
        }
        return null;
    }
}
