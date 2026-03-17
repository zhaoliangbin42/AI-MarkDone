import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type NoiseContext, type ThemeDetector } from '../base';
import { deepseekMarkdownParserAdapter } from '../parser/deepseek';
import type { MarkdownParserAdapter } from '../parser/MarkdownParserAdapter';

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
    private findHeaderBar(): HTMLElement | null {
        const firstMessage = document.querySelector(this.getMessageSelector());
        if (!(firstMessage instanceof HTMLElement)) return null;

        let cursor: HTMLElement | null = firstMessage.closest('.ds-scroll-area');
        while (cursor) {
            const parent = cursor.parentElement;
            if (!(parent instanceof HTMLElement)) break;

            const siblings = Array.from(parent.children);
            const cursorIndex = siblings.indexOf(cursor);
            for (let i = cursorIndex - 1; i >= 0; i -= 1) {
                const candidate = siblings[i];
                if (candidate instanceof HTMLElement && this.looksLikeHeaderBar(candidate)) {
                    return candidate;
                }
            }

            cursor = parent;
        }

        return null;
    }

    private looksLikeHeaderBar(candidate: HTMLElement): boolean {
        return Array.from(candidate.children).some(
            (child) =>
                child instanceof HTMLElement &&
                (child.querySelector('.ds-icon-button') !== null || this.findHeaderTitleAnchor(child) !== null)
        );
    }

    private findHeaderTitleAnchor(headerBar: HTMLElement | null): HTMLElement | null {
        if (!(headerBar instanceof HTMLElement)) return null;

        for (const child of Array.from(headerBar.children)) {
            if (!(child instanceof HTMLElement)) continue;
            const directAnchor = this.isHeaderTitleAnchor(child) ? child : null;
            if (directAnchor) return directAnchor;

            for (const grandChild of Array.from(child.children)) {
                if (this.isHeaderTitleAnchor(grandChild)) {
                    return grandChild as HTMLElement;
                }
            }
        }

        return null;
    }

    private isHeaderTitleAnchor(element: Element): element is HTMLElement {
        return (
            element instanceof HTMLElement &&
            /flex:\s*1\s+1\s+0%/.test(element.getAttribute('style') || '') &&
            /display:\s*flex/.test(element.getAttribute('style') || '') &&
            Boolean(element.textContent?.trim())
        );
    }

    private getActionRow(messageElement: HTMLElement): HTMLElement | null {
        const message = messageElement.closest('div.ds-message') || messageElement;
        const wrapper = message.parentElement;
        if (!(wrapper instanceof HTMLElement)) return null;

        for (const child of Array.from(wrapper.children)) {
            if (child === message || !(child instanceof HTMLElement)) continue;
            if (!child.matches('.ds-flex')) continue;
            if (!child.querySelector('.ds-icon-button')) continue;
            return child;
        }

        return null;
    }

    matches(url: string): boolean {
        return url.includes('chat.deepseek.com');
    }

    getPlatformId(): string {
        return 'deepseek';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return deepseekMarkdownParserAdapter;
    }

    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        const normalize = (text: string): string =>
            text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const extractUserText = (candidate: HTMLElement): string | null => {
            if (candidate.querySelector('.ds-markdown')) return null;
            const text = (candidate.textContent || '').trim();
            const normalized = normalize(text);
            return normalized || null;
        };

        const message = assistantMessageElement.closest('div.ds-message') || assistantMessageElement;
        const parent = message.parentElement;

        if (parent) {
            const messages = Array.from(parent.querySelectorAll('div.ds-message')).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            const idx = messages.indexOf(message as HTMLElement);
            if (idx >= 0) {
                for (let i = idx - 1; i >= 0; i -= 1) {
                    const prev = messages[i];
                    const prompt = extractUserText(prev);
                    if (prompt) return prompt;
                }
            }
        }

        // Fallback: walk previous siblings across wrapper layers until a non-markdown ds-message is found.
        let cursor: Element | null = message;
        while (cursor) {
            let prev: Element | null = cursor.previousElementSibling;
            while (prev) {
                if (prev instanceof HTMLElement) {
                    const directMessage = prev.classList.contains('ds-message') ? prev : null;
                    const nestedMessage = prev.querySelector('.ds-message') as HTMLElement | null;
                    const prompt = (directMessage && extractUserText(directMessage)) || (nestedMessage && extractUserText(nestedMessage));
                    if (prompt) return prompt;
                }
                prev = prev.previousElementSibling;
            }
            cursor = cursor.parentElement;
        }

        return null;
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

    getToolbarAnchorElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        return this.getActionRow(assistantMessageElement);
    }

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const turn = assistantMessageElement.closest('div.ds-message');
        return turn instanceof HTMLElement ? turn : null;
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionRow = this.getActionRow(messageElement);
        if (actionRow) {
            const spacer = Array.from(actionRow.children).find(
                (child): child is HTMLElement => child instanceof HTMLElement && /flex:\s*1\s+1\s+0%/.test(child.getAttribute('style') || '')
            );

            if (spacer?.nextSibling) {
                actionRow.insertBefore(toolbarHost, spacer.nextSibling);
            } else {
                actionRow.appendChild(toolbarHost);
            }

            return true;
        }

        const content = messageElement.querySelector(this.getMessageContentSelector());
        if (content?.parentElement) {
            content.parentElement.insertBefore(toolbarHost, content.nextSibling);
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
        const firstMessage = document.querySelector(this.getMessageSelector());
        if (firstMessage instanceof HTMLElement) {
            let cursor: HTMLElement | null = firstMessage.parentElement;
            while (cursor) {
                if (cursor.matches('.ds-scroll-area, main')) {
                    return cursor;
                }
                cursor = cursor.parentElement;
            }
        }

        const selectors = ['main', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement && container.querySelector(this.getMessageSelector())) {
                return container;
            }
        }

        const body = document.body;
        if (body.querySelector(this.getMessageSelector())) {
            return body;
        }
        return null;
    }

    getHeaderIconAnchorElement(): HTMLElement | null {
        return this.findHeaderTitleAnchor(this.findHeaderBar());
    }

    injectHeaderIcon(iconHost: HTMLElement): boolean {
        const anchor = this.getHeaderIconAnchorElement();
        if (!anchor) return false;

        if (iconHost instanceof HTMLElement) {
            iconHost.className = 'ds-icon-button ds-icon-button--l';
            iconHost.setAttribute('role', 'button');
            iconHost.setAttribute('tabindex', '0');
            iconHost.setAttribute('aria-disabled', 'false');
            iconHost.style.marginLeft = '12px';
            iconHost.style.height = '40px';

            if (iconHost.dataset.aimdDecorated !== 'deepseek') {
                const icon = iconHost.querySelector('img');
                const hoverBg = document.createElement('div');
                hoverBg.className = 'ds-icon-button__hover-bg';

                const iconWrap = document.createElement('div');
                iconWrap.className = 'ds-icon';
                iconWrap.style.width = '22px';
                iconWrap.style.height = '22px';

                if (icon instanceof HTMLImageElement) {
                    icon.style.width = '22px';
                    icon.style.height = '22px';
                    iconWrap.appendChild(icon);
                }

                const focusRing = document.createElement('div');
                focusRing.className = 'ds-focus-ring';

                iconHost.replaceChildren(hoverBg, iconWrap, focusRing);
                iconHost.dataset.aimdDecorated = 'deepseek';
            }
        }

        anchor.appendChild(iconHost);
        return true;
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

    getComposerKind(): 'textarea' | 'contenteditable' | 'unknown' {
        return 'textarea';
    }

    getComposerInputElement(): HTMLElement | HTMLTextAreaElement | HTMLInputElement | null {
        const selectors = [
            'textarea[placeholder="Message DeepSeek"]',
            'textarea.d96f2d2a',
            'textarea._27c9245',
            'textarea',
        ];
        for (const selector of selectors) {
            const input = document.querySelector(selector);
            if (input instanceof HTMLTextAreaElement) return input;
        }
        return null;
    }

    getComposerSendButtonElement(): HTMLElement | null {
        const selectors = [
            '.ds-floating-button[role="button"]',
            '.ds-send-button[role="button"]',
            '.ec4f5d61 [role="button"]:last-child',
            '[role="button"][aria-disabled]',
        ];
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button instanceof HTMLElement) return button;
        }
        return null;
    }

    isComposerStreaming(): boolean {
        const stopButton = document.querySelector('[role="button"][aria-label*="Stop"], [role="button"][aria-label*="停止"]');
        return stopButton instanceof HTMLElement;
    }
}
