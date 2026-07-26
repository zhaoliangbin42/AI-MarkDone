import { describe, expect, it } from 'vitest';

import type { FormulaSourceFormat } from '@/core/math/formulaSourceFormat';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { buildPageAtomicSelectionSnapshot } from '@/services/copy/atomicSelectionMarkdown';
import { buildCanonicalMarkdownRichPayload } from '@/services/copy/atomicSelectionRichHtml';

function mountMessage(content: string): HTMLElement {
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', 'assistant');
    message.setAttribute('data-message-id', 'assistant-1');
    message.innerHTML = `<div class="markdown prose">${content}</div>`;
    document.body.appendChild(message);
    return message;
}

function selectContents(element: HTMLElement): Range {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range;
}

function buildRichPayload(
    root: HTMLElement,
    range: Range,
    formulaFormat: FormulaSourceFormat = 'markdown-dollar',
) {
    const adapter = new ChatGPTAdapter();
    const snapshot = buildPageAtomicSelectionSnapshot({ adapter, range, root });
    return snapshot
        ? buildCanonicalMarkdownRichPayload({
            canonicalMarkdown: snapshot.canonicalMarkdown,
            plainText: snapshot.markdown,
            formulaFormat,
        })
        : null;
}

describe('atomic selection rich HTML', () => {
    it('builds basic rich HTML from canonical Markdown without page DOM input', () => {
        const payload = buildCanonicalMarkdownRichPayload({
            canonicalMarkdown: '**Bold** with $x+y$',
            plainText: '**Bold** with $x+y$',
            formulaFormat: 'latex-brackets',
        });

        expect(payload?.html).toContain('<strong>Bold</strong>');
        expect(payload?.html).toContain('<span>\\(x+y\\)</span>');
        expect(payload?.plainText).toBe('**Bold** with $x+y$');
    });

    it('uses the Reader sanitizer for lists, tables, links, images, and deleted text', () => {
        const canonicalMarkdown = [
            '4. Fourth item',
            '',
            '| Name | Value |',
            '| --- | --- |',
            '| Alpha | Beta |',
            '',
            '[Safe](https://example.com) ![Example](https://example.com/image.png) ~~removed~~',
            '',
            '[Unsafe](javascript:alert(1))',
        ].join('\n');
        const payload = buildCanonicalMarkdownRichPayload({
            canonicalMarkdown,
            plainText: canonicalMarkdown,
        });
        const htmlDocument = new DOMParser().parseFromString(payload?.html ?? '', 'text/html');

        expect(htmlDocument.querySelector('ol')?.getAttribute('start')).toBe('4');
        expect(htmlDocument.querySelector('table')?.textContent).toContain('Alpha');
        expect(htmlDocument.querySelector('a[href="https://example.com"]')?.textContent).toBe('Safe');
        expect(htmlDocument.querySelector('img')?.getAttribute('alt')).toBe('Example');
        expect(htmlDocument.querySelector('del')?.textContent).toBe('removed');
        expect(htmlDocument.querySelector('a[href^="javascript:"]')).toBeNull();
    });

    it('reuses the canonical Markdown snapshot after the page DOM is no longer available', () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const range = selectContents(root);
        const adapter = new ChatGPTAdapter();

        const snapshot = buildPageAtomicSelectionSnapshot({ adapter, range, root });
        message.remove();
        const payload = snapshot
            ? buildCanonicalMarkdownRichPayload({
                canonicalMarkdown: snapshot.canonicalMarkdown,
                plainText: snapshot.markdown,
            })
            : null;

        expect(snapshot?.markdown).toBe('Before `answer` after');
        expect(payload?.plainText).toBe(snapshot?.markdown);
        expect(payload?.html).toContain('<p>Before <code>answer</code> after</p>');
    });

    it('serializes basic semantic structure without ChatGPT host attributes', () => {
        const message = mountMessage([
            '<h2>Title</h2>',
            '<p><strong>Bold</strong> <em>text</em></p>',
            '<ul><li>One</li></ul>',
            '<blockquote>Quote</blockquote>',
            '<pre><code>const x = 1;</code></pre>',
        ].join(''));
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root));

        expect(payload?.html).toContain('<h2>Title</h2>');
        expect(payload?.html).toContain('<strong>Bold</strong>');
        expect(payload?.html).toContain('<em>text</em>');
        expect(payload?.html).toMatch(/<ul>\s*<li>One<\/li>\s*<\/ul>/);
        expect(payload?.html).toMatch(/<blockquote>\s*<p>Quote<\/p>\s*<\/blockquote>/);
        expect(payload?.html).toMatch(/<pre><code>const x = 1;\s*<\/code><\/pre>/);
        expect(payload?.html).toContain('<!--StartFragment-->');
        expect(payload?.html).toContain('<!--EndFragment-->');
        expect(payload?.html).not.toContain('markdown prose');
        expect(payload?.html).not.toContain('data-message-id');
        expect(payload?.html).not.toContain('xmlns:m=');
    });

    it('serializes the same Reader-normalized clone instead of duplicate component chrome', () => {
        const message = mountMessage(`
            <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared <code>value</code>.</p></div>
            </div>
            <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit again</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared <code>value</code>.</p></div>
            </div>
        `);
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root));

        expect(payload?.plainText).toBe('Shared `value`.');
        expect(payload?.html.match(/<p>Shared <code>value<\/code>\.<\/p>/g)).toHaveLength(1);
        expect(payload?.html).not.toContain('Edit');
        expect(payload?.html).not.toContain('writing-block');
    });

    it('escapes formula source and ignores page MathML in the source-only rich path', () => {
        const message = mountMessage('<p>Result <span class="katex" data-latex="x&lt;y &amp; z"><span class="katex-mathml"><math><mrow><mi>x</mi><mo>&lt;</mo><mi>y</mi></mrow></math></span><span class="katex-html" aria-hidden="true">x &lt; y</span></span></p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root));

        expect(payload?.plainText).toBe('Result $x<y & z$');
        const htmlDocument = new DOMParser().parseFromString(payload?.html ?? '', 'text/html');
        expect(htmlDocument.querySelector('span')?.textContent).toBe('$x<y & z$');
        expect(payload?.html).not.toContain('<math');
        expect(payload?.html).not.toContain('data-aimd-formula-slot');
    });

    it.each([
        ['markdown-dollar', '<span>$x^2$</span>'],
        ['latex-brackets', '<span>\\(x^2\\)</span>'],
        ['raw', '<span>x^2</span>'],
        ['equation', '<span>\\(x^2\\)</span>'],
        ['equation-star', '<span>\\(x^2\\)</span>'],
    ] as const)('serializes inline formulas using the %s source format', (format, expectedHtml) => {
        const message = mountMessage('<p><span class="katex" data-latex="x^2">x²</span></p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root), format);

        expect(payload?.html).toContain(expectedHtml);
        expect(payload?.html).not.toContain('<math');
    });

    it.each([
        ['markdown-dollar', '<div>$$<br>x^2<br>$$</div>'],
        ['latex-brackets', '<div>\\[<br>x^2<br>\\]</div>'],
        ['raw', '<div>x^2</div>'],
        ['equation', '<div>\\begin{equation}<br>x^2<br>\\end{equation}</div>'],
        ['equation-star', '<div>\\begin{equation*}<br>x^2<br>\\end{equation*}</div>'],
    ] as const)('serializes display formulas using the %s source format', (format, expectedHtml) => {
        const message = mountMessage('<span class="katex-display" data-latex="x^2"><span class="katex">x²</span></span>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root), format);

        expect(payload?.html).toContain(expectedHtml);
        expect(payload?.html).not.toContain('<div><div>');
    });

    it('serializes multiple formulas atomically from authoritative source', () => {
        const message = mountMessage('<p><span class="katex" data-latex="x^2">x²</span> and <span class="katex" data-latex="y_1">y₁</span></p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const payload = buildRichPayload(root, selectContents(root), 'raw');

        expect(payload?.html).toContain('<span>x^2</span>');
        expect(payload?.html).toContain('<span>y_1</span>');
        expect(payload?.plainText).toBe('$x^2$ and $y_1$');
    });

    it.each([
        '<p>Result <span class="katex">x²</span></p>',
        '<h2>Result <span class="katex">x²</span></h2>',
    ])('fails closed when a formula source cannot be recovered', (content) => {
        const message = mountMessage(content);
        const root = message.querySelector('.markdown.prose') as HTMLElement;

        expect(buildRichPayload(root, selectContents(root))).toBeNull();
    });
});
