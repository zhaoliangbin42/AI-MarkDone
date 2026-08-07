import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ParserOptions } from '../markdown-parser/core/types';
import { RenderedContentCompiler } from '../content/RenderedContentCompiler';

export type CopyMarkdownResult =
    | { ok: true; markdown: string }
    | { ok: false; error: { code: 'NO_MESSAGE' | 'UNSUPPORTED_SITE' | 'INTERNAL_ERROR'; message: string } };

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

    const result = new RenderedContentCompiler({
        parserAdapter,
        normalizeDOM: (clone) => adapter.normalizeDOM(clone),
        isNoiseNode: (node, context) => adapter.isNoiseNode(node, context),
        getArtifactPlaceholder: (node) => adapter.getArtifactPlaceholder(node),
        enhanceUnrenderedMath: adapter.shouldEnhanceUnrenderedMath(),
        cleanMarkdown: (markdown) => adapter.cleanMarkdown(markdown),
    }).compile(root, options);
    if (result.kind === 'ready') return { ok: true, markdown: result.markdown };
    return {
        ok: false,
        error: {
            code: result.reason === 'unsupported-parser' ? 'UNSUPPORTED_SITE' : 'INTERNAL_ERROR',
            message: result.message,
        },
    };
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
