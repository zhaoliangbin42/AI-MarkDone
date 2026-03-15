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
};

type HastNode = {
    type?: string;
    tagName?: string;
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

    return processor
        .use(remarkRehype)
        .use(rehypeSanitize, markdownSanitizeSchema)
        .use(rehypeKatex, {
            strict: 'ignore',
        })
        .use(rehypeHighlight, {
            detect: false,
            ignoreMissing: true,
        })
        .use(annotateCodeBlocks)
        .use(rehypeStringify);
}

let defaultProcessor: ReturnType<typeof createProcessor> | null = null;
let softBreaksProcessor: ReturnType<typeof createProcessor> | null = null;

function getProcessor(options?: MarkdownRenderOptions) {
    if (options?.softBreaks) {
        softBreaksProcessor ??= createProcessor({ softBreaks: true });
        return softBreaksProcessor;
    }

    defaultProcessor ??= createProcessor();
    return defaultProcessor;
}

export function renderMarkdownToSanitizedHtml(markdown: string, options?: MarkdownRenderOptions): string {
    return String(getProcessor(options).processSync(markdown || ''));
}
