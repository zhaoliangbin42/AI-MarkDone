import { logger } from '../../core/logger';
import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { enhanceUnrenderedMath } from './preprocess/math-extractor';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';
import type { ParserOptions } from '../markdown-parser/core/types';

export type CopyMarkdownResult =
    | { ok: true; markdown: string }
    | { ok: false; error: { code: 'NO_MESSAGE' | 'UNSUPPORTED_SITE' | 'INTERNAL_ERROR'; message: string } };

function removeNoiseNodes(root: HTMLElement, adapter: SiteAdapter): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const toProcess: Array<{ node: HTMLElement; placeholder: string | null }> = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const el = node as HTMLElement;
        const nextSibling = el.nextElementSibling;
        try {
            if (adapter.isNoiseNode(el, { nextSibling })) {
                const placeholder = adapter.getArtifactPlaceholder(el);
                toProcess.push({ node: el, placeholder });
            }
        } catch (err) {
            logger.warn('[AI-MarkDone][Copy] isNoiseNode threw; skipping node', err);
        }
    }

    toProcess.reverse().forEach(({ node: el, placeholder }) => {
        if (!el.parentNode) return;
        if (placeholder) {
            const p = document.createElement('p');
            p.textContent = placeholder;
            el.parentNode.replaceChild(p, el);
        } else {
            el.parentNode.removeChild(el);
        }
    });
}

function resolveContentRoot(adapter: SiteAdapter, messageElement: HTMLElement): HTMLElement | null {
    if (messageElement.tagName.toLowerCase() === 'article') {
        return messageElement;
    }

    const contentSelector = adapter.getMessageContentSelector();
    if (!contentSelector) return messageElement;

    const contentElement = messageElement.querySelector(contentSelector);
    return contentElement instanceof HTMLElement ? contentElement : messageElement;
}

function copyMarkdownFromElementInternal(
    adapter: SiteAdapter,
    root: HTMLElement,
    options: ParserOptions = {},
): CopyMarkdownResult {
    const parserAdapter = adapter.getMarkdownParserAdapter();
    if (!parserAdapter) {
        return { ok: false, error: { code: 'UNSUPPORTED_SITE', message: 'Unsupported platform.' } };
    }

    try {
        const clone = root.cloneNode(true) as HTMLElement;
        adapter.normalizeDOM(clone);
        removeNoiseNodes(clone, adapter);
        normalizeRenderedWhitespace(clone);

        if (adapter.shouldEnhanceUnrenderedMath()) {
            enhanceUnrenderedMath(clone);
        }

        const parser = createMarkdownParser(parserAdapter, { enablePerformanceLogging: false, ...options });
        const parsed = parser.parse(clone);
        if (parsed.startsWith('<!-- Parser Max nodes') || parsed.startsWith('<!-- Parser Time budget')) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Markdown fragment budget exceeded.' } };
        }
        const markdown = adapter.cleanMarkdown(parsed);
        return { ok: true, markdown };
    } catch (err) {
        logger.error('[AI-MarkDone][Copy] copyMarkdownFromMessage failed', err);
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to build markdown.' } };
    }
}

function normalizeRenderedWhitespace(root: HTMLElement): void {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
        if (current instanceof Text) textNodes.push(current);
    }

    for (const textNode of textNodes) {
        if (textNode.parentElement?.closest('pre, code, textarea, .katex, .katex-display, math')) continue;
        const normalized = textNode.data.replace(/\u00a0/g, ' ');
        if (!normalized.trim()) {
            if (shouldPreserveCollapsedSpace(textNode)) {
                textNode.data = ' ';
            } else {
                textNode.remove();
            }
            continue;
        }
        textNode.data = normalized.replace(/\s+/g, ' ');
    }
}

function shouldPreserveCollapsedSpace(textNode: Text): boolean {
    const parent = textNode.parentElement;
    if (!parent) return false;
    const previous = textNode.previousSibling;
    const next = textNode.nextSibling;
    if (!previous || !next) return false;
    return !isBlockNode(previous) && !isBlockNode(next);
}

function isBlockNode(node: Node): boolean {
    if (!(node instanceof HTMLElement)) return false;
    return node.matches('address, article, aside, blockquote, div, dl, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, ul');
}

export function copyMarkdownFromElement(
    adapter: SiteAdapter,
    element: HTMLElement,
    options: ParserOptions = {},
): CopyMarkdownResult {
    return copyMarkdownFromElementInternal(adapter, element, options);
}

export function copyMarkdownFromMessage(adapter: SiteAdapter, messageElement: HTMLElement): CopyMarkdownResult {
    const root = resolveContentRoot(adapter, messageElement);
    if (!root) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No message content found.' } };
    }
    return copyMarkdownFromElementInternal(adapter, root);
}

export function copyMarkdownFromPage(adapter: SiteAdapter): CopyMarkdownResult {
    const message = adapter.getLastMessageElement();
    if (!message) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No assistant message found.' } };
    }
    return copyMarkdownFromMessage(adapter, message);
}
