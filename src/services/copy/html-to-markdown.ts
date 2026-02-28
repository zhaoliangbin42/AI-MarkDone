type ListContext =
    | { type: 'ul'; depth: number }
    | { type: 'ol'; depth: number; index: number };

type RenderContext = {
    inPre: boolean;
    listStack: ListContext[];
};

const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CANVAS', 'DD', 'DIV', 'DL', 'DT',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL'
]);

function normalizeNewlines(md: string): string {
    return md.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function fenceInlineCode(code: string): string {
    const normalized = code.replace(/\r\n?/g, '\n');
    const maxRun = Math.max(0, ...Array.from(normalized.matchAll(/`+/g)).map((m) => m[0].length));
    const fence = '`'.repeat(maxRun + 1);
    return `${fence}${normalized}${fence}`;
}

function normalizeCodeBlockText(raw: string): string {
    let code = raw.replace(/\r\n?/g, '\n');
    code = code.replace(/^\n/, '').replace(/\n$/, '');

    const lines = code.split('\n');
    const nonEmpty = lines.filter((line) => line.trim().length > 0);
    if (nonEmpty.length === 0) return code;

    const indents = nonEmpty.map((line) => (line.match(/^[ \t]*/)?.[0].length ?? 0));
    const commonIndent = Math.min(...indents);
    if (commonIndent > 0) return lines.map((line) => line.slice(commonIndent)).join('\n');
    return code;
}

function detectCodeLanguage(codeEl: HTMLElement): string {
    const className = codeEl.getAttribute('class') || '';
    const classMatch = className.match(/language-([a-zA-Z0-9_+-]+)/);
    if (classMatch?.[1]) return classMatch[1].toLowerCase();

    const dataLang = codeEl.getAttribute('data-language') || codeEl.getAttribute('data-lang');
    if (dataLang) return dataLang.toLowerCase();

    return '';
}

function renderChildren(node: Node, ctx: RenderContext): string {
    return Array.from(node.childNodes).map((child) => renderNode(child, ctx)).join('');
}

function isLikelyBlockElement(el: Element): boolean {
    return BLOCK_TAGS.has(el.tagName);
}

function renderNode(node: Node, ctx: RenderContext): string {
    if (node.nodeType === Node.TEXT_NODE) {
        if (ctx.inPre) return node.textContent || '';
        return (node.textContent || '').replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === 'BR') return '\n';
    if (tag === 'HR') return '\n\n---\n\n';

    if (/^H[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1));
        const content = normalizeNewlines(renderChildren(el, ctx));
        return `\n\n${'#'.repeat(level)} ${content}\n\n`;
    }

    if (tag === 'PRE') {
        const codeEl = el.querySelector('code') as HTMLElement | null;
        const raw = codeEl ? codeEl.textContent || '' : el.textContent || '';
        const language = codeEl ? detectCodeLanguage(codeEl) : '';
        const code = normalizeCodeBlockText(raw);
        return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    if (tag === 'CODE') {
        // Inline code only; <pre><code> handled above.
        if (el.closest('pre')) return el.textContent || '';
        const text = (el.textContent || '').trim();
        return fenceInlineCode(text);
    }

    if (tag === 'P') {
        const content = normalizeNewlines(renderChildren(el, ctx));
        if (!content) return '';
        return `\n\n${content}\n\n`;
    }

    if (tag === 'BLOCKQUOTE') {
        const content = normalizeNewlines(renderChildren(el, ctx));
        const lines = content.split('\n').map((line) => (line.trim() ? `> ${line}` : '>'));
        return `\n\n${lines.join('\n')}\n\n`;
    }

    if (tag === 'UL') {
        ctx.listStack.push({ type: 'ul', depth: ctx.listStack.length });
        const out = `\n${renderChildren(el, ctx)}\n`;
        ctx.listStack.pop();
        return out;
    }

    if (tag === 'OL') {
        ctx.listStack.push({ type: 'ol', depth: ctx.listStack.length, index: 1 });
        const out = `\n${renderChildren(el, ctx)}\n`;
        ctx.listStack.pop();
        return out;
    }

    if (tag === 'LI') {
        const current = ctx.listStack[ctx.listStack.length - 1];
        const indent = '  '.repeat(Math.max(0, ctx.listStack.length - 1));
        let prefix = '- ';
        if (current?.type === 'ol') {
            prefix = `${current.index}. `;
            current.index += 1;
        }

        const content = normalizeNewlines(renderChildren(el, ctx));
        const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) return '';
        const first = `${indent}${prefix}${lines[0]}`;
        const rest = lines.slice(1).map((l) => `${indent}  ${l}`);
        return `${first}${rest.length ? '\n' + rest.join('\n') : ''}\n`;
    }

    if (tag === 'A') {
        const href = el.getAttribute('href') || '';
        const text = normalizeNewlines(renderChildren(el, ctx)) || href;
        if (!href) return text;
        return `[${text}](${href})`;
    }

    if (tag === 'IMG') {
        const alt = el.getAttribute('alt') || '';
        const src = el.getAttribute('src') || '';
        if (!src) return '';
        return `![${alt}](${src})`;
    }

    if (tag === 'STRONG' || tag === 'B') {
        const content = renderChildren(el, ctx);
        return `**${content}**`;
    }

    if (tag === 'EM' || tag === 'I') {
        const content = renderChildren(el, ctx);
        return `*${content}*`;
    }

    if (tag === 'TABLE') {
        // Prefer preprocessing via TableExtractor.
        return normalizeNewlines(el.textContent || '');
    }

    // Default: keep content; add paragraph breaks if this looks like a block wrapper.
    const content = renderChildren(el, ctx);
    if (!content) return '';
    if (isLikelyBlockElement(el)) return `\n\n${content}\n\n`;
    return content;
}

export function htmlToMarkdown(root: HTMLElement): string {
    const ctx: RenderContext = { inPre: false, listStack: [] };
    const md = renderNode(root, ctx);
    return normalizeNewlines(md);
}

