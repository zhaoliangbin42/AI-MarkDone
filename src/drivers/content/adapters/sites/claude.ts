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
    private findMessageRoot(messageElement: HTMLElement): HTMLElement | null {
        if (messageElement.matches('div.group[style*="height: auto"]')) return messageElement;

        const root = messageElement.closest('div.group[style*="height: auto"]');
        return root instanceof HTMLElement ? root : null;
    }

    private findActionBar(messageElement: HTMLElement): HTMLElement | null {
        const root = this.findMessageRoot(messageElement) ?? messageElement;
        const nested = root.querySelector(this.getActionBarSelector());
        if (nested instanceof HTMLElement) return nested;

        let cursor: HTMLElement | null = root;
        for (let depth = 0; cursor && depth < 3; depth += 1) {
            const sibling = cursor.nextElementSibling;
            if (
                sibling instanceof HTMLElement
                && sibling.getAttribute('role') === 'group'
                && sibling.getAttribute('aria-label') === 'Message actions'
            ) {
                return sibling;
            }
            cursor = cursor.parentElement;
        }

        return null;
    }

    private findActionRowTarget(messageElement: HTMLElement): HTMLElement | null {
        const actionBar = this.findActionBar(messageElement);
        if (!actionBar) return null;

        const innerRow = actionBar.querySelector('.flex.items-stretch.justify-between');
        if (innerRow instanceof HTMLElement) return innerRow;

        const firstChild = actionBar.firstElementChild;
        if (firstChild instanceof HTMLElement) return firstChild;

        return actionBar;
    }

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

    getToolbarAnchorElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        return this.findActionRowTarget(assistantMessageElement);
    }

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        return this.findMessageRoot(assistantMessageElement);
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionRowTarget = this.findActionRowTarget(messageElement);
        if (actionRowTarget) {
            toolbarHost.dataset.aimdPlacement = 'actionbar';
            toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
            toolbarHost.style.pointerEvents = 'auto';
            toolbarHost.style.marginLeft = 'auto';
            toolbarHost.style.flex = '0 0 auto';
            toolbarHost.style.alignSelf = 'center';
            actionRowTarget.appendChild(toolbarHost);
            return true;
        }

        const root = this.findMessageRoot(messageElement) ?? messageElement;
        const content = root.querySelector(this.getMessageContentSelector());
        if (content && content.parentElement) {
            toolbarHost.dataset.aimdPlacement = 'content';
            toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
            content.parentElement.insertBefore(toolbarHost, content.nextSibling);
            return true;
        }

        toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
        root.appendChild(toolbarHost);
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
            if (container instanceof HTMLElement) {
                const messageCount = container.querySelectorAll(this.getMessageSelector()).length;
                if (messageCount > 0) return container;
            }
        }
        const body = document.body;
        if (body instanceof HTMLElement) {
            const messageCount = body.querySelectorAll(this.getMessageSelector()).length;
            return messageCount > 0 ? body : null;
        }
        return null;
    }

    getHeaderIconAnchorElement(): HTMLElement | null {
        const shareButton = document.querySelector('button[data-testid="wiggle-controls-actions-share"]');
        if (shareButton instanceof HTMLElement && shareButton.parentElement instanceof HTMLElement) {
            return shareButton.parentElement;
        }

        const selectors = ['[data-testid="wiggle-controls-actions"]', '[data-testid="chat-actions"]'];
        for (const selector of selectors) {
            const anchor = document.querySelector(selector);
            if (anchor instanceof HTMLElement) return anchor;
        }

        return null;
    }

    injectHeaderIcon(iconHost: HTMLElement): boolean {
        const anchor = this.getHeaderIconAnchorElement();
        if (!anchor) return false;

        iconHost.className =
            'inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-transparent transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 w-8 rounded-md active:scale-95 group/btn Button_ghost__BUAoh';
        iconHost.style.marginRight = '0';

        if (iconHost.dataset.aimdDecorated !== 'claude') {
            const icon = iconHost.querySelector('img');
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'flex items-center justify-center text-text-500 group-hover/btn:text-text-100';

            if (icon instanceof HTMLElement) {
                icon.style.width = '22px';
                icon.style.height = '22px';
                icon.style.objectFit = 'contain';
                iconWrapper.appendChild(icon);
            }

            iconHost.replaceChildren(iconWrapper);
            iconHost.dataset.aimdDecorated = 'claude';
        }

        const shareButton = anchor.querySelector('[data-testid="wiggle-controls-actions-share"]');
        anchor.insertBefore(iconHost, shareButton || anchor.firstChild);
        return true;
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
