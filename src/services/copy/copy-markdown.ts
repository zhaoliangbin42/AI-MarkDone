import { logger } from '../../core/logger';
import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { enhanceUnrenderedMath } from './preprocess/math-extractor';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';

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

export function copyMarkdownFromMessage(adapter: SiteAdapter, messageElement: HTMLElement): CopyMarkdownResult {
    const parserAdapter = adapter.getMarkdownParserAdapter();
    if (!parserAdapter) {
        return { ok: false, error: { code: 'UNSUPPORTED_SITE', message: 'Unsupported platform.' } };
    }

    const root = resolveContentRoot(adapter, messageElement);
    if (!root) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No message content found.' } };
    }

    try {
        const clone = root.cloneNode(true) as HTMLElement;
        adapter.normalizeDOM(clone);
        removeNoiseNodes(clone, adapter);

        if (adapter.shouldEnhanceUnrenderedMath()) {
            enhanceUnrenderedMath(clone);
        }

        const parser = createMarkdownParser(parserAdapter, { enablePerformanceLogging: false });
        const markdown = parser.parse(clone);
        return { ok: true, markdown };
    } catch (err) {
        logger.error('[AI-MarkDone][Copy] copyMarkdownFromMessage failed', err);
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to build markdown.' } };
    }
}

export function copyMarkdownFromPage(adapter: SiteAdapter): CopyMarkdownResult {
    const message = adapter.getLastMessageElement();
    if (!message) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No assistant message found.' } };
    }
    return copyMarkdownFromMessage(adapter, message);
}
