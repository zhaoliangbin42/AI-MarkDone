import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';

const detector: ThemeDetector = {
    detect(): Theme | null {
        const body = document.body;
        if (body.classList.contains('dark')) return 'dark';
        if (body.classList.contains('light')) return 'light';
        if ((body as any).dataset?.dsDarkTheme === 'dark') return 'dark';
        return 'light';
    },
    getObserveTargets() {
        return [{ element: 'body', attributes: ['class', 'data-ds-dark-theme'] }];
    },
    hasExplicitTheme(): boolean {
        const body = document.body;
        return body.classList.contains('dark') || body.classList.contains('light') || !!(body as any).dataset?.dsDarkTheme;
    },
};

export class DeepseekAdapter extends SiteAdapter {
    matches(url: string): boolean {
        return url.includes('chat.deepseek.com');
    }

    getPlatformId(): string {
        return 'deepseek';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    getMessageSelector(): string {
        return 'div.ds-message:has(.ds-markdown)';
    }

    getMessageContentSelector(): string {
        return '.ds-markdown:not(.ds-think-content .ds-markdown)';
    }

    getActionBarSelector(): string {
        return '.ds-flex > .ds-icon-button';
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionBar = messageElement.querySelector(this.getActionBarSelector());
        if (actionBar && actionBar.parentElement) {
            actionBar.parentElement.insertBefore(toolbarHost, actionBar);
            return true;
        }

        const allMarkdowns = Array.from(messageElement.querySelectorAll('.ds-markdown'));
        const hasMainMarkdown = allMarkdowns.some((md) => !md.closest('.ds-think-content'));
        if (!hasMainMarkdown) return false;

        messageElement.appendChild(toolbarHost);
        return true;
    }

    isStreamingMessage(element: HTMLElement): boolean {
        const parent = element.parentElement;
        if (!parent) return true;
        const actionArea = parent.querySelector('.ds-icon-button');
        return !actionArea;
    }

    getMessageId(element: HTMLElement): string | null {
        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `deepseek-message-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['.ds-scroll-area', 'main', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) return container;
        }
        return null;
    }

    normalizeDOM(element: HTMLElement): void {
        const codeBlocks = element.querySelectorAll('.md-code-block');
        codeBlocks.forEach((block) => {
            const banner = block.querySelector('.md-code-block-banner-wrap');
            const pre = block.querySelector('pre');
            if (!pre) return;

            let language = '';
            if (banner) {
                const langSpan = banner.querySelector('.d813de27');
                if (langSpan?.textContent) language = langSpan.textContent.trim();
                banner.remove();
            }

            if (pre.querySelector('code')) return;

            const code = document.createElement('code');
            if (language) code.className = `language-${language}`;

            while (pre.firstChild) {
                code.appendChild(pre.firstChild);
            }
            pre.appendChild(code);
        });
    }

    isNoiseNode(node: Node, _context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;

        if (node.classList.contains('ds-think-content')) return true;
        if (node.closest('.ds-think-content')) return true;

        if (node.classList.contains('md-code-block-banner-wrap')) return true;
        if (node.closest('.md-code-block-banner-wrap')) return true;

        if (node.tagName === 'SVG' && node.closest('.md-code-block')) return true;

        return false;
    }
}
