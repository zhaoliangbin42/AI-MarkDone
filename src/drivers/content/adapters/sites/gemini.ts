import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';
import { geminiMarkdownParserAdapter } from '../parser/gemini';
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

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return geminiMarkdownParserAdapter;
    }

    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        const normalize = (text: string): string =>
            text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        // Gemini alternates conversation containers; user prompts live under <user-query>.
        const container =
            (assistantMessageElement.closest('.conversation-container') as HTMLElement | null) ||
            (assistantMessageElement.parentElement as HTMLElement | null);

        if (container) {
            let cursor: Element | null = container;
            while (cursor) {
                let prev: Element | null = cursor.previousElementSibling;
                while (prev) {
                    const userQuery = prev.querySelector('user-query');
                    if (userQuery) {
                        const textEl =
                            (userQuery.querySelector('.query-text') as HTMLElement | null) ||
                            (userQuery.querySelector('.user-query-bubble-with-background') as HTMLElement | null) ||
                            (userQuery as HTMLElement);
                        const text = (textEl.textContent || '').trim();
                        const normalized = normalize(text);
                        return normalized || null;
                    }
                    prev = prev.previousElementSibling;
                }
                cursor = cursor.parentElement;
            }
        }

        // Fallback: query the previous user-query in document order.
        const allUserQueries = Array.from(document.querySelectorAll('user-query')).filter(
            (n): n is HTMLElement => n instanceof HTMLElement
        );
        if (allUserQueries.length === 0) return null;

        const nodePos = (a: Node, b: Node) => a.compareDocumentPosition(b);
        for (let i = allUserQueries.length - 1; i >= 0; i -= 1) {
            const uq = allUserQueries[i];
            const isBefore = (nodePos(uq, assistantMessageElement) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
            if (!isBefore) continue;
            const textEl =
                (uq.querySelector('.query-text') as HTMLElement | null) ||
                (uq.querySelector('.user-query-bubble-with-background') as HTMLElement | null) ||
                uq;
            const text = (textEl.textContent || '').trim();
            const normalized = normalize(text);
            return normalized || null;
        }

        return null;
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

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const turn = assistantMessageElement.closest('.conversation-container');
        return turn instanceof HTMLElement ? turn : null;
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
