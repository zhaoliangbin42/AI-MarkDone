import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';

export const FORMULA_SOURCE_FORMATS = [
    'markdown-dollar',
    'latex-brackets',
    'raw',
    'equation',
    'equation-star',
] as const;

export type FormulaSourceFormat = typeof FORMULA_SOURCE_FORMATS[number];

export const DEFAULT_FORMULA_SOURCE_FORMAT: FormulaSourceFormat = 'markdown-dollar';

type MarkdownAstNode = {
    type?: string;
    value?: string;
    position?: {
        start?: { offset?: number };
        end?: { offset?: number };
    };
    children?: MarkdownAstNode[];
};

type FormulaFormatOptions = {
    forceInline?: boolean;
};

export function normalizeFormulaSourceFormat(value: unknown): FormulaSourceFormat {
    return FORMULA_SOURCE_FORMATS.includes(value as FormulaSourceFormat)
        ? value as FormulaSourceFormat
        : DEFAULT_FORMULA_SOURCE_FORMAT;
}

function normalizeInlineMathContent(value: string): string {
    return value.replace(/\r\n?/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDisplayMathContent(value: string): string {
    return value.replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n').trim();
}

export function formatFormulaSource(
    source: string,
    displayMode: boolean,
    format: FormulaSourceFormat,
    options: FormulaFormatOptions = {},
): string {
    const normalizedFormat = normalizeFormulaSourceFormat(format);
    const shouldUseInline = options.forceInline || !displayMode;
    const content = shouldUseInline
        ? normalizeInlineMathContent(source)
        : normalizeDisplayMathContent(source);

    if (!content) return '';

    if (shouldUseInline) {
        if (normalizedFormat === 'raw') return content;
        if (normalizedFormat === 'markdown-dollar') return `$${content}$`;
        return `\\(${content}\\)`;
    }

    switch (normalizedFormat) {
        case 'latex-brackets':
            return `\\[\n${content}\n\\]`;
        case 'raw':
            return content;
        case 'equation':
            return `\\begin{equation}\n${content}\n\\end{equation}`;
        case 'equation-star':
            return `\\begin{equation*}\n${content}\n\\end{equation*}`;
        case 'markdown-dollar':
        default:
            return `$$\n${content}\n$$`;
    }
}

function visitMarkdownAst(
    node: MarkdownAstNode,
    ancestors: MarkdownAstNode[],
    visitor: (node: MarkdownAstNode, ancestors: MarkdownAstNode[]) => void,
): void {
    visitor(node, ancestors);
    node.children?.forEach((child) => visitMarkdownAst(child, [...ancestors, node], visitor));
}

function isInsideTable(ancestors: MarkdownAstNode[]): boolean {
    return ancestors.some((ancestor) => (
        ancestor.type === 'table'
        || ancestor.type === 'tableRow'
        || ancestor.type === 'tableCell'
    ));
}

export function rewriteMarkdownFormulaSources(markdown: string, format: FormulaSourceFormat): string {
    try {
        const normalizedFormat = normalizeFormulaSourceFormat(format);
        const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown || '') as MarkdownAstNode;
        const replacements: Array<{ start: number; end: number; value: string }> = [];

        visitMarkdownAst(tree, [], (node, ancestors) => {
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return;
            if (typeof node.value !== 'string') return;

            if (node.type === 'inlineMath') {
                replacements.push({
                    start,
                    end,
                    value: formatFormulaSource(node.value, false, normalizedFormat, {
                        forceInline: isInsideTable(ancestors),
                    }),
                });
                return;
            }

            if (node.type === 'math') {
                replacements.push({
                    start,
                    end,
                    value: formatFormulaSource(node.value, true, normalizedFormat, {
                        forceInline: isInsideTable(ancestors),
                    }),
                });
            }
        });

        let result = markdown;
        replacements
            .sort((a, b) => b.start - a.start)
            .forEach((replacement) => {
                result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
            });
        return result;
    } catch {
        return markdown;
    }
}
