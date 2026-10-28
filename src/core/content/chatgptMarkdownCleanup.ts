import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import type { ContentCleanupSettings } from '../settings/content';
import { normalizeMarkdownWhitespace, protectMarkdownCode } from './markdownCodeProtection';
import { isRichContentUrl } from '../../contracts/richContent';

export type ChatGPTReferenceNoiseOptions = {
    stripCitationMarkers?: boolean;
    stripMarkdownLinks?: boolean;
    stripBareUrls?: boolean;
};

const DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS: Required<ChatGPTReferenceNoiseOptions> = {
    stripCitationMarkers: true,
    stripMarkdownLinks: true,
    stripBareUrls: true,
};

const CHATGPT_COMPONENT_DIRECTIVE_RE = /^[ \t]{0,3}:::([A-Za-z][\w-]*)\{([^\n{}]*)\}[ \t]*\n([\s\S]*?)\n[ \t]{0,3}:::[ \t]*$/gm;
const CHATGPT_COMPONENT_ATTR_RE = /(?:^|\s)(?:id|variant|type|title)=["'][^"']*["']/;

export function hasConfigurableLinks(source: string): boolean {
    return /\]\(|https?:\/\//i.test(source);
}

type MarkdownAstNode = {
    type?: string;
    value?: string;
    alt?: string;
    url?: string;
    position?: {
        start?: { offset?: number };
        end?: { offset?: number };
    };
    children?: MarkdownAstNode[];
};

function visitMarkdownAst(node: MarkdownAstNode, visitor: (node: MarkdownAstNode) => void): void {
    visitor(node);
    node.children?.forEach((child) => visitMarkdownAst(child, visitor));
}

function normalizeInlineMathContent(value: string): string {
    return value.replace(/\r\n?/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDisplayMathContent(value: string): string {
    return value.replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n').trim();
}

function normalizeMarkdownMathDelimiters(markdown: string): string {
    try {
        const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown || '') as MarkdownAstNode;
        const replacements: Array<{ start: number; end: number; value: string }> = [];

        visitMarkdownAst(tree, (node) => {
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return;
            if (typeof node.value !== 'string') return;

            if (node.type === 'inlineMath') {
                replacements.push({
                    start,
                    end,
                    value: `$${normalizeInlineMathContent(node.value)}$`,
                });
                return;
            }

            if (node.type === 'math') {
                replacements.push({
                    start,
                    end,
                    value: `$$\n${normalizeDisplayMathContent(node.value)}\n$$`,
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

function normalizeLatexDelimiters(markdown: string): string {
    const protectedCode = protectMarkdownCode(markdown);
    let result = protectedCode.masked;

    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, content: string) => {
        const normalized = String(content).replace(/\r\n?/g, '\n').trim();
        return `\n\n$$\n${normalized}\n$$\n\n`;
    });

    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, content: string) => {
        const normalized = String(content).replace(/\r\n?/g, ' ').replace(/\s+/g, ' ').trim();
        return `$${normalized}$`;
    });

    return protectedCode.restore(result);
}

function parseAnnotationPayload(payload: string): unknown {
    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function readEntityAnnotationText(payload: unknown): string {
    if (Array.isArray(payload)) {
        return readString(payload[1]) || readString(payload[0]);
    }

    const record = readRecord(payload);
    if (!record) return '';

    return readString(record.name)
        || readString(record.title)
        || readString(record.text)
        || readString(record.label);
}

function readGenUiMathAnnotation(payload: unknown): { content: string; display: 'block' | 'inline' } | null {
    const record = readRecord(payload);
    if (!record) return null;

    for (const [key, value] of Object.entries(record)) {
        if (!key.toLowerCase().includes('math')) continue;
        const widget = readRecord(value);
        const content = readString(widget?.content) || readString(widget?.latex) || readString(value);
        if (!content) continue;

        const display = key.toLowerCase().includes('inline') ? 'inline' : 'block';
        return { content, display };
    }

    return null;
}

function normalizeChatGPTAnnotationToken(kind: string, payloadSource: string): string {
    const payload = parseAnnotationPayload(payloadSource);
    const normalizedKind = kind.toLowerCase();

    if (normalizedKind === 'entity') {
        return readEntityAnnotationText(payload);
    }

    if (normalizedKind === 'genui') {
        const math = readGenUiMathAnnotation(payload);
        if (!math) return '\n\n> [Dynamic content: static representation unavailable]\n\n';
        return math.display === 'inline'
            ? `$${math.content}$`
            : `\n\n$$\n${math.content}\n$$\n\n`;
    }

    return '';
}

function normalizeChatGPTInternalAnnotations(markdown: string): string {
    return markdown.replace(/([A-Za-z][\w-]*)([\s\S]*?)/g, (match: string, kind: string, payload: string) => {
        const normalizedKind = kind.toLowerCase();
        if (normalizedKind === 'cite' || normalizedKind === 'filecite') return match;
        return normalizeChatGPTAnnotationToken(kind, payload);
    });
}

function unwrapChatGPTComponentDirectives(markdown: string): string {
    return markdown.replace(CHATGPT_COMPONENT_DIRECTIVE_RE, (match: string, _name: string, attrs: string, body: string) => {
        if (!CHATGPT_COMPONENT_ATTR_RE.test(attrs.trim())) return match;
        return body.trim();
    });
}

export function cleanChatGPTReferenceNoise(
    markdown: string,
    options: ChatGPTReferenceNoiseOptions = DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS,
): string {
    const resolved = { ...DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS, ...options };
    const protectedCode = protectMarkdownCode(markdown || '');
    let result = protectedCode.masked;

    result = unwrapChatGPTComponentDirectives(result);

    if (resolved.stripCitationMarkers) {
        result = stripCitationMarkers(result);
    }

    result = normalizeChatGPTInternalAnnotations(result);

    if (resolved.stripMarkdownLinks) {
        result = stripMarkdownLinks(result);
    }

    if (resolved.stripBareUrls) {
        result = stripBareUrls(result);
    }

    const normalized = result
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return protectedCode.restore(normalized);
}

export function normalizeChatGPTReaderMarkdown(markdown: string, cleanupOptions?: ChatGPTReferenceNoiseOptions): string {
    const source = markdown || '';
    // Image-label escapes are Markdown syntax, not TeX delimiters.
    const richReferences = protectRichReferences(source);
    const cleaned = cleanChatGPTReferenceNoise(richReferences.masked, cleanupOptions);
    const withLatexDelimiters = normalizeLatexDelimiters(cleaned);
    const withMathDelimiters = normalizeMarkdownMathDelimiters(withLatexDelimiters);
    return richReferences.restore(normalizeMarkdownWhitespace(withMathDelimiters));
}

function protectRichReferences(source: string): { masked: string; restore: (value: string) => string } {
    let suffix = 0;
    while (source.includes(`\uE100AIMDRICH${suffix}X`)) suffix += 1;
    const prefix = `\uE100AIMDRICH${suffix}X`;
    const references: string[] = [];
    const masked = source.replace(/!\[((?:\\.|[^\]\\\n])*)\]\((aimd-rich:[A-Za-z0-9][A-Za-z0-9._-]{0,255})\)/g, match => {
        const index = references.push(match) - 1;
        return `${prefix}${index}\uE101`;
    });
    return {
        masked,
        restore: value => references.reduce((result, reference, index) => result.split(`${prefix}${index}\uE101`).join(reference), value),
    };
}

/** Preserve the captured source; apply reader/copy/export preferences only at output. */
export function projectChatGPTMarkdown(
    source: string,
    settings: ContentCleanupSettings,
): string {
    const normalized = normalizeChatGPTReaderMarkdown(source, {
        stripMarkdownLinks: !settings.preserveLinks,
        stripBareUrls: !settings.preserveLinks,
    });
    const withoutImages = settings.preserveLinks
        ? omitMarkdownImages(normalized, true)
        : normalized;
    return settings.includeCodeBlocks ? withoutImages : omitMarkdownCodeBlocks(withoutImages);
}

export function omitMarkdownCodeBlocks(markdown: string): string {
    try {
        const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown) as MarkdownAstNode;
        const ranges: Array<{ start: number; end: number }> = [];
        visitMarkdownAst(tree, (node) => {
            if (node.type !== 'code') return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (typeof start === 'number' && typeof end === 'number' && end > start) ranges.push({ start, end });
        });
        let result = markdown;
        for (const range of ranges.sort((left, right) => right.start - left.start)) {
            result = result.slice(0, range.start) + result.slice(range.end);
        }
        return result.replace(/\n{3,}/g, '\n\n').trim();
    } catch {
        return markdown;
    }
}

export function omitMarkdownImages(markdown: string, preserveRichReferences = false): string {
    try {
        const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown) as MarkdownAstNode;
        const replacements: Array<{ start: number; end: number; value: string }> = [];
        visitMarkdownAst(tree, (node) => {
            if (node.type !== 'image' && node.type !== 'imageReference') return;
            if (preserveRichReferences && node.type === 'image' && node.url && isRichContentUrl(node.url)) return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (typeof start === 'number' && typeof end === 'number' && end > start) {
                replacements.push({ start, end, value: node.alt?.trim() ?? '' });
            }
        });
        let result = markdown;
        for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
            result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
        }
        return result;
    } catch {
        return markdown;
    }
}

function stripCitationMarkers(markdown: string): string {
    return markdown
        .replace(/(?:file)?cite[^]*/g, '')
        .replace(/【[^】]*(?:†|source|来源|引用|文件|file)[^】]*】/gi, '')
        .replace(/\[(?:source|sources|citation|citations|引用|来源)\]/gi, '');
}

function stripMarkdownLinks(markdown: string): string {
    return markdown.replace(/!?\[((?:\\.|[^\]\\\n])*)\]\(([^)\n]+)\)/g, (match, label: string, url: string) => {
        if (match.startsWith('!') && isRichContentUrl(url)) return match;
        const text = String(label || '').trim();
        return text;
    });
}

function stripBareUrls(markdown: string): string {
    return markdown
        .replace(/https?:\/\/[^\s<>)\]]+/g, '')
        .replace(/<https?:\/\/[^>\s]+>/g, '');
}
