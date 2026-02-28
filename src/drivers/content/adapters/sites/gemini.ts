import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';

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

export class GeminiAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('gemini.google.com');
    }

    getPlatformId(): string {
        return 'gemini';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    getMessageSelector(): string {
        return 'model-response';
    }

    getMessageContentSelector(): string {
        return '.model-response-text, #extended-response-markdown-content, .markdown';
    }

    getActionBarSelector(): string {
        return '.response-container-footer, .response-footer';
    }

    isStreamingMessage(element: HTMLElement): boolean {
        const hasStopButton =
            document.querySelector('button[aria-label*="Stop"]') !== null ||
            document.querySelector('button[aria-label*="停止"]') !== null;

        if (!hasStopButton) return false;

        const allMessages = document.querySelectorAll(this.getMessageSelector());
        if (allMessages.length === 0) return false;
        const lastMessage = allMessages[allMessages.length - 1];
        if (lastMessage !== element) return false;

        const footer = element.querySelector('.response-footer, .response-container-footer');
        if (!footer) return true;
        return !(footer as HTMLElement).classList.contains('complete');
    }

    getMessageId(element: HTMLElement): string | null {
        const draftElement = element.querySelector('[data-test-draft-id]');
        if (draftElement) return draftElement.getAttribute('data-test-draft-id');

        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `gemini-message-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['main', '[data-test-id="chat-history-container"]', '.chat-history', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) return container;
        }
        return document.body;
    }

    isDeepResearchMessage(element: HTMLElement): boolean {
        return element.querySelector('immersive-entry-chip') !== null;
    }

    getDeepResearchContent(): HTMLElement | null {
        const panel = document.querySelector('deep-research-immersive-panel');
        if (!panel) return null;
        const content = panel.querySelector('#extended-response-markdown-content');
        return content instanceof HTMLElement ? content : null;
    }

    isNoiseNode(node: Node, _context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;

        if (node.tagName.toLowerCase() === 'model-thoughts') return true;
        if (node.closest('.thoughts-container')) return true;

        if (node.classList.contains('code-block-decoration') && node.classList.contains('header-formatted')) {
            return true;
        }

        if (node.classList.contains('table-footer') && node.hasAttribute('hide-from-message-actions') && node.closest('table-block')) {
            return true;
        }

        return false;
    }
}
