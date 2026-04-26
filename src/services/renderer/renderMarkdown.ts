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

export type MarkdownRenderOptions = {
    softBreaks?: boolean;
    highlightCode?: boolean;
};

export type ReaderAtomicUnitKind =
    | 'inline-math'
    | 'display-math'
    | 'inline-code'
    | 'code-block'
    | 'table'
    | 'image'
    | 'heading'
    | 'list-item'
    | 'blockquote'
    | 'thematic-break';

export type ReaderAtomicUnitMode = 'atomic' | 'structural';

export type ReaderAtomicUnit = {
    id: string;
    kind: ReaderAtomicUnitKind;
    mode: ReaderAtomicUnitMode;
    start: number;
    end: number;
    source: string;
};

export type ReaderRenderedMarkdown = {
    html: string;
    markdownSource: string;
    atomicUnits: ReaderAtomicUnit[];
};

type HastNode = {
    type?: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
};

type MdastNode = {
    type?: string;
    position?: {
        start?: { offset?: number };
        end?: { offset?: number };
    };
    children?: MdastNode[];
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
    },
};

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

function visitMdast(node: MdastNode, visitor: (node: MdastNode) => void): void {
    visitor(node);
    node.children?.forEach((child) => visitMdast(child, visitor));
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
        .use(rehypeSanitize, markdownSanitizeSchema)
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

function collectReaderAtomicUnits(markdown: string): ReaderAtomicUnit[] {
    const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown || '') as MdastNode;
    const units: ReaderAtomicUnit[] = [];

    visitMdast(tree, (node) => {
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return;

        let kind: ReaderAtomicUnitKind | null = null;
        let mode: ReaderAtomicUnitMode = 'atomic';
        switch (node.type) {
            case 'inlineMath':
                kind = 'inline-math';
                break;
            case 'math':
                kind = 'display-math';
                break;
            case 'inlineCode':
                kind = 'inline-code';
                break;
            case 'code':
                kind = 'code-block';
                break;
            case 'table':
                kind = 'table';
                break;
            case 'image':
                kind = 'image';
                break;
            case 'heading':
                kind = 'heading';
                mode = 'structural';
                break;
            case 'listItem':
                kind = 'list-item';
                mode = 'structural';
                break;
            case 'blockquote':
                kind = 'blockquote';
                mode = 'structural';
                break;
            case 'thematicBreak':
                kind = 'thematic-break';
                mode = 'structural';
                break;
            default:
                break;
        }

        if (!kind) return;
        units.push({
            id: `aimd-reader-unit-${units.length + 1}`,
            kind,
            mode,
            start,
            end,
            source: markdown.slice(start, end),
        });
    });

    return units;
}

export function renderMarkdownForReader(markdown: string, options?: MarkdownRenderOptions): ReaderRenderedMarkdown {
    const markdownSource = markdown || '';
    return {
        html: renderMarkdownToSanitizedHtml(markdownSource, options),
        markdownSource,
        atomicUnits: collectReaderAtomicUnits(markdownSource),
    };
}
