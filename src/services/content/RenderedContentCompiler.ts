import { logger } from '../../core/logger';
import { enhanceUnrenderedMath } from '../copy/preprocess/math-extractor';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';
import type { ParserOptions } from '../markdown-parser/core/types';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';

export type RenderedContentCompilerCapabilities = Readonly<{
    parserAdapter: MarkdownParserAdapter | null;
    normalizeDOM?: (root: HTMLElement) => void;
    isNoiseNode?: (node: Node, context: { nextSibling: Element | null }) => boolean;
    getArtifactPlaceholder?: (node: HTMLElement) => string | null;
    enhanceUnrenderedMath?: boolean;
    cleanMarkdown?: (markdown: string) => string;
}>;

export type RenderedContentCompileResult =
    | Readonly<{ kind: 'ready'; markdown: string }>
    | Readonly<{
        kind: 'rejected';
        reason: 'unsupported-parser' | 'empty-content' | 'parser-budget' | 'compile-error';
        message: string;
    }>;

/**
 * Provider-neutral rendered-content compiler.
 *
 * The compiler understands only DOM semantics and injected parser
 * capabilities. Platform selectors, lifecycle identity and host ownership
 * stay in the adapter that supplies the root and capabilities.
 */
export class RenderedContentCompiler {
    constructor(private readonly capabilities: RenderedContentCompilerCapabilities) {}

    compile(root: HTMLElement, options: ParserOptions = {}): RenderedContentCompileResult {
        const parserAdapter = this.capabilities.parserAdapter;
        if (!parserAdapter) {
            return {
                kind: 'rejected',
                reason: 'unsupported-parser',
                message: 'No rendered-content parser capability is available.',
            };
        }

        try {
            const clone = root.cloneNode(true) as HTMLElement;
            this.capabilities.normalizeDOM?.(clone);
            removeNoiseNodes(clone, this.capabilities);
            normalizeRenderedWhitespace(clone);
            if (this.capabilities.enhanceUnrenderedMath) enhanceUnrenderedMath(clone);

            const parsed = createMarkdownParser(parserAdapter, { enablePerformanceLogging: false, ...options })
                .parse(clone);
            const markdown = this.capabilities.cleanMarkdown?.(parsed) ?? parsed;
            if (/^<!-- Parser (Max nodes|Time budget)/.test(markdown)) {
                return {
                    kind: 'rejected',
                    reason: 'parser-budget',
                    message: 'Markdown fragment budget exceeded.',
                };
            }
            const normalized = markdown.trim();
            if (!normalized) {
                return {
                    kind: 'rejected',
                    reason: 'empty-content',
                    message: 'Rendered content did not contain a complete semantic body.',
                };
            }
            return Object.freeze({ kind: 'ready', markdown: normalized });
        } catch (error) {
            logger.warn('[AI-MarkDone][RenderedContentCompiler] Compile failed', error);
            return {
                kind: 'rejected',
                reason: 'compile-error',
                message: error instanceof Error ? error.message : 'Rendered content compilation failed.',
            };
        }
    }
}

function removeNoiseNodes(
    root: HTMLElement,
    capabilities: RenderedContentCompilerCapabilities,
): void {
    if (!capabilities.isNoiseNode) return;
    const showElement = root.ownerDocument.defaultView?.NodeFilter.SHOW_ELEMENT ?? 1;
    const walker = root.ownerDocument.createTreeWalker(root, showElement);
    const toProcess: Array<{ node: HTMLElement; placeholder: string | null }> = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const element = node as HTMLElement;
        const nextSibling = element.nextElementSibling;
        try {
            if (capabilities.isNoiseNode(element, { nextSibling })) {
                toProcess.push({
                    node: element,
                    placeholder: capabilities.getArtifactPlaceholder?.(element) ?? null,
                });
            }
        } catch (error) {
            logger.warn('[AI-MarkDone][RenderedContentCompiler] Noise policy failed', error);
        }
    }

    toProcess.reverse().forEach(({ node: element, placeholder }) => {
        if (!element.parentNode) return;
        if (placeholder) {
            const paragraph = root.ownerDocument.createElement('p');
            paragraph.textContent = placeholder;
            element.parentNode.replaceChild(paragraph, element);
        } else {
            element.parentNode.removeChild(element);
        }
    });
}

function normalizeRenderedWhitespace(root: HTMLElement): void {
    const showText = root.ownerDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
    const walker = root.ownerDocument.createTreeWalker(root, showText);
    const textNodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
        if (current.nodeType === 3) textNodes.push(current as Text);
    }

    for (const textNode of textNodes) {
        if (textNode.parentElement?.closest('pre, code, textarea, .katex, .katex-display, math')) continue;
        const normalized = textNode.data.replace(/\u00a0/g, ' ');
        if (!normalized.trim()) {
            if (shouldPreserveCollapsedSpace(textNode)) textNode.data = ' ';
            else textNode.remove();
            continue;
        }
        textNode.data = normalized.replace(/\s+/g, ' ');
    }
}

function shouldPreserveCollapsedSpace(textNode: Text): boolean {
    const previous = textNode.previousSibling;
    const next = textNode.nextSibling;
    if (!previous || !next) return false;
    return !isBlockNode(previous) && !isBlockNode(next);
}

function isBlockNode(node: Node): boolean {
    if (node.nodeType !== 1) return false;
    return (node as HTMLElement).matches(
        'address, article, aside, div, dl, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, ul',
    );
}
