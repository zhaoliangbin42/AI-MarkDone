import { unified } from 'unified';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { getRichBlockIdFromUrl, type RichBlockV1 } from '../../contracts/richContent';
import type {
    SemanticOutlineItemV1,
    SemanticReaderUnitKindV1,
    SemanticReaderUnitModeV1,
    SemanticReaderUnitV1,
} from '../../contracts/semanticContent';
import {
    createCanonicalMarkdownSource,
    semanticContent,
} from '../semantic-content/SemanticContent';

export type MarkdownRenderOptions = {
    softBreaks?: boolean;
    highlightCode?: boolean;
    includeImages?: boolean;
    richContent?: {
        blocks: readonly RichBlockV1[];
        assets?: readonly { blockId: string; url: string; mimeType: string }[];
    };
};

export type ReaderAtomicUnitKind = SemanticReaderUnitKindV1;

export type ReaderAtomicUnitMode = SemanticReaderUnitModeV1;

export type ReaderAtomicUnit = SemanticReaderUnitV1;

export type ReaderOutlineItem = SemanticOutlineItemV1;

export type ReaderRenderedMarkdown = {
    html: string;
    markdownSource: string;
    atomicUnits: ReaderAtomicUnit[];
    outlineItems: ReaderOutlineItem[];
};

type HastNode = {
    type?: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
};

const markdownSanitizeSchema: any = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        code: [
            ...((defaultSchema.attributes?.code as any[]) || []),
            ['className', /^language-./, 'math-inline', 'math-display', 'language-math'],
        ],
        ul: [
            ...((defaultSchema.attributes?.ul as any[]) || []),
            ['className', 'contains-task-list'],
        ],
        li: [
            ...((defaultSchema.attributes?.li as any[]) || []),
            ['className', 'task-list-item'],
        ],
        input: [
            ...((defaultSchema.attributes?.input as any[]) || []),
            ['type', 'checkbox'],
            ['disabled', true],
            ['checked', true, false],
        ],
        img: [...((defaultSchema.attributes?.img as any[]) || []), 'dataAimdRichBlock'],
        span: [...((defaultSchema.attributes?.span as any[]) || []), 'dataAimdRichBlock'],
    },
};

function isLocalRichImage(url: string, mimeType: string): boolean {
    if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(mimeType)) return false;
    if (!url.startsWith('blob:') || typeof location === 'undefined') return false;
    try {
        const resource = new URL(url.slice(5));
        const owner = new URL(location.href);
        return ['http:', 'https:', 'chrome-extension:', 'moz-extension:'].includes(owner.protocol)
            && resource.protocol === owner.protocol && resource.host === owner.host
            && !resource.username && !resource.password;
    } catch {
        return false;
    }
}

function prepareRichImages(options?: MarkdownRenderOptions) {
    const blocks = options?.richContent?.blocks ?? [];
    return () => (tree: HastNode) => {
        visitTree(tree, node => {
            if (node.tagName !== 'img') return;
            if (options?.includeImages === false) {
                const id = getRichBlockIdFromUrl(String(node.properties?.src ?? ''));
                const block = blocks.find(candidate => candidate.id === id);
                const text = block?.fallbackMarkdown || String(node.properties?.alt || '');
                node.tagName = 'span';
                node.properties = {};
                node.children = [{ type: 'text', value: text.replace(/^>\s*/gm, '') }];
                return;
            }
            const source = node.properties?.src;
            if (typeof source !== 'string' || !source.startsWith('aimd-rich:')) return;
            const id = getRichBlockIdFromUrl(source);
            const matches = id ? blocks.filter(block => block.id === id) : [];
            const block = matches.length === 1 ? matches[0] : undefined;
            const asset = block && options?.richContent?.assets?.find(candidate => (
                candidate.blockId === block.id && isLocalRichImage(candidate.url, candidate.mimeType)
            ));
            if (block && asset) {
                // Internal references have no URL permission. A matching local
                // asset capability is applied only after normal sanitization.
                node.properties = { alt: block.label, dataAimdRichBlock: block.id };
                return;
            }
            const fallback = block?.fallbackMarkdown || String(node.properties?.alt || 'Visual content unavailable');
            node.tagName = 'span';
            node.properties = block ? { dataAimdRichBlock: block.id } : {};
            node.children = [{ type: 'text', value: fallback.replace(/^>\s*/gm, '') }];
        });
    };
}

function attachRichImages(options?: MarkdownRenderOptions) {
    return () => (tree: HastNode) => {
        visitTree(tree, node => {
            if (node.tagName !== 'img') return;
            const id = node.properties?.dataAimdRichBlock;
            if (typeof id !== 'string') return;
            const asset = options?.richContent?.assets?.find(candidate => (
                candidate.blockId === id && isLocalRichImage(candidate.url, candidate.mimeType)
            ));
            if (asset) node.properties = { ...node.properties, src: asset.url };
        });
    };
}

function annotateCodeBlocks() {
    return (tree: HastNode) => {
        visitTree(tree, (node) => {
            if (node.tagName !== 'pre' || !node.children?.length) return;
            const code = node.children.find((child) => child.tagName === 'code');
            if (!code) return;

            const classList = Array.isArray(code.properties?.className)
                ? (code.properties?.className as string[])
                : [];
            const languageClass = classList.find((token) => token.startsWith('language-'));
            const language = languageClass?.replace(/^language-/, '').trim();
            if (!language) return;

            node.properties = {
                ...(node.properties || {}),
                'data-code-language': language,
            };
        });
    };
}

function annotateLinks() {
    return (tree: HastNode) => {
        visitTree(tree, (node) => {
            if (node.tagName !== 'a') return;
            const href = typeof node.properties?.href === 'string' ? node.properties.href.trim() : '';
            if (!href) return;

            node.properties = {
                ...(node.properties || {}),
                target: '_blank',
                rel: 'noopener noreferrer',
            };
        });
    };
}

function visitTree(node: HastNode, visitor: (node: HastNode) => void): void {
    visitor(node);
    node.children?.forEach((child) => visitTree(child, visitor));
}

function createProcessor(options?: MarkdownRenderOptions) {
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMath);

    if (options?.softBreaks) {
        processor.use(remarkBreaks);
    }

    const pipeline = processor
        .use(remarkRehype)
        .use(prepareRichImages(options))
        .use(rehypeSanitize, markdownSanitizeSchema)
        .use(attachRichImages(options))
        .use(rehypeKatex, {
            strict: 'ignore',
        });

    if (options?.highlightCode !== false) {
        pipeline.use(rehypeHighlight, {
            detect: false,
            ignoreMissing: true,
        });
    }

    return pipeline
        .use(annotateCodeBlocks)
        .use(annotateLinks)
        .use(rehypeStringify);
}

let defaultProcessor: ReturnType<typeof createProcessor> | null = null;
let softBreaksProcessor: ReturnType<typeof createProcessor> | null = null;
let noHighlightProcessor: ReturnType<typeof createProcessor> | null = null;
let softBreaksNoHighlightProcessor: ReturnType<typeof createProcessor> | null = null;

function getProcessor(options?: MarkdownRenderOptions) {
    // Resource capabilities are scoped to one message/revision, never cached
    // in a processor shared with another Reader item or export document.
    if (options?.richContent || options?.includeImages === false) return createProcessor(options);
    const highlightCode = options?.highlightCode !== false;
    if (options?.softBreaks) {
        if (highlightCode) {
            softBreaksProcessor ??= createProcessor({ softBreaks: true, highlightCode: true });
            return softBreaksProcessor;
        }
        softBreaksNoHighlightProcessor ??= createProcessor({ softBreaks: true, highlightCode: false });
        return softBreaksNoHighlightProcessor;
    }

    if (highlightCode) {
        defaultProcessor ??= createProcessor({ highlightCode: true });
        return defaultProcessor;
    }

    noHighlightProcessor ??= createProcessor({ highlightCode: false });
    return noHighlightProcessor;
}

export function renderMarkdownToSanitizedHtml(markdown: string, options?: MarkdownRenderOptions): string {
    return String(getProcessor(options).processSync(markdown || ''));
}

export function renderMarkdownForReader(markdown: string, options?: MarkdownRenderOptions): ReaderRenderedMarkdown {
    const markdownSource = markdown || '';
    const compiled = semanticContent.compile(createCanonicalMarkdownSource(markdownSource, {
        producer: 'reader-renderer',
    }));
    const structure = compiled.status === 'ready'
        ? semanticContent.project(compiled.document, { kind: 'reader-structure' })
        : null;
    return {
        html: renderMarkdownToSanitizedHtml(markdownSource, options),
        markdownSource,
        atomicUnits: structure?.status === 'ready' && structure.kind === 'reader-structure'
            ? [...structure.units]
            : [],
        outlineItems: structure?.status === 'ready' && structure.kind === 'reader-structure'
            ? [...structure.outline]
            : [],
    };
}
