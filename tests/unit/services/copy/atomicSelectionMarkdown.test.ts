import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { buildPageAtomicSelectionMarkdown } from '@/services/copy/atomicSelectionMarkdown';
import { setCanonicalMarkdownCopyFormulaFormat } from '@/services/copy/canonicalMarkdownCopy';
import { copyMarkdownFromElement } from '@/services/copy/copy-markdown';

afterEach(() => {
    setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
});

describe('buildPageAtomicSelectionMarkdown', () => {
    it('keeps visible text slices and replaces a complete inline atom with Markdown source', () => {
        const root = document.createElement('div');
        root.innerHTML = '<p>Before <code>answer</code> after</p>';
        const paragraph = root.querySelector('p')!;
        const first = paragraph.firstChild as Text;
        const last = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.data.length);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('Before `answer` after');
    });

    it('normalizes the selected DOM only once before canonical Markdown parsing', () => {
        const root = document.createElement('div');
        root.innerHTML = '<p>Before <code>answer</code> after</p>';
        const range = document.createRange();
        range.selectNodeContents(root);
        const adapter = new ChatGPTAdapter();
        const normalizeSpy = vi.spyOn(adapter, 'normalizeDOM');

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter,
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('Before `answer` after');
        expect(normalizeSpy).toHaveBeenCalledTimes(1);
    });

    it('preserves closed inline Markdown around a complete formula like the Reader source path', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <p>
                Prefix
                <strong>bold <span class="katex" data-latex-source="x+y"><span class="katex-html" aria-hidden="true">x+y</span></span> tail</strong>
                suffix
            </p>
        `;
        const strong = root.querySelector('strong')!;
        const first = strong.firstChild as Text;
        const last = strong.lastChild as Text;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.data.length);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('**bold $x+y$ tail**');
    });

    it('does not add an unselected emphasis ancestor around a formula-only selection', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <p><strong>Prefix <span class="katex" data-latex-source="x+y"><span class="katex-html">x+y</span></span> suffix</strong></p>
        `;
        const formula = root.querySelector<HTMLElement>('.katex')!;
        const visualText = formula.querySelector('.katex-html')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(visualText, 0);
        range.setEnd(visualText, visualText.data.length);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('$x+y$');
    });

    it.each([
        ['$x+y$', '$x+y$'],
        ['$$x+y$$', '$x+y$'],
        ['\\(x+y\\)', '$x+y$'],
        ['\\[x+y\\]', '$x+y$'],
    ])('normalizes an already-delimited inline formula source %s', (source, expected) => {
        const root = document.createElement('div');
        const formula = document.createElement('span');
        formula.className = 'katex';
        formula.setAttribute('data-latex-source', source);
        formula.innerHTML = '<span class="katex-html" aria-hidden="true">x+y</span>';
        root.appendChild(formula);
        const range = document.createRange();
        range.selectNodeContents(formula);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe(expected);
    });

    it('preserves the actual ordered-list position for a selected list item', () => {
        const root = document.createElement('div');
        root.innerHTML = '<ol start="3"><li>First</li><li>Second <code>value</code></li></ol>';
        const item = root.querySelectorAll('li')[1]!;
        const first = item.firstChild as Text;
        const last = item.querySelector('code')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.data.length);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('4. Second `value`');
    });

    it('fails open when the synchronous fragment budget is exceeded', () => {
        const root = document.createElement('div');
        root.innerHTML = '<table><tbody><tr><td>Alpha</td><td>Beta</td></tr></tbody></table>';
        const first = root.querySelector('td')!.firstChild as Text;
        const last = root.querySelectorAll('td')[1]!.firstChild as Text;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.data.length);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxNodeCount: 1,
        });

        expect(markdown).toBeNull();
    });

    it.each([
        {
            label: 'heading',
            html: '<h2>Heading</h2>',
            selector: 'h2',
            expected: '## Heading',
        },
        {
            label: 'blockquote',
            html: '<blockquote><p>Quoted answer</p></blockquote>',
            selector: 'blockquote',
            expected: '> Quoted answer',
        },
        {
            label: 'code block',
            html: '<pre><code class="language-ts">const answer = 42;</code></pre>',
            selector: 'pre',
            expected: '```ts\nconst answer = 42;\n```',
        },
        {
            label: 'table',
            html: '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Alpha</td><td>Beta</td></tr></tbody></table>',
            selector: 'table',
            expected: '| Alpha | Beta |',
        },
        {
            label: 'inline formula',
            html: '<p><span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></math></span><span class="katex-html" aria-hidden="true">x/y</span></span></p>',
            selector: '.katex',
            expected: '$\\frac{x}{y}$',
        },
    ])('serializes a complete $label from the selected DOM fragment', ({ html, selector, expected }) => {
        const root = document.createElement('div');
        root.innerHTML = html;
        const element = root.querySelector(selector)!;
        const range = document.createRange();
        range.selectNodeContents(element);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toContain(expected);
    });

    it('fails open instead of guessing formula source from rendered visual text', () => {
        const root = document.createElement('div');
        root.innerHTML = '<p><span class="katex"><span class="katex-html" aria-hidden="true">x+y</span></span></p>';
        const formula = root.querySelector('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBeNull();
    });

    it.each([
        {
            label: 'image',
            html: '<p><img src="https://example.com/image.png" alt="Example"></p>',
            selector: 'img',
            expected: 'Example',
        },
        {
            label: 'divider',
            html: '<div><hr></div>',
            selector: 'hr',
            expected: '---',
        },
    ])('serializes a complete non-text $label', ({ html, selector, expected }) => {
        const root = document.createElement('div');
        root.innerHTML = html;
        const element = root.querySelector(selector)!;
        const range = document.createRange();
        range.selectNode(element);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
        });

        expect(markdown).toBe(expected);
    });

    it('applies the shared Markdown copy formula format at the clipboard-output boundary', () => {
        setCanonicalMarkdownCopyFormulaFormat('latex-brackets');
        const root = document.createElement('div');
        root.innerHTML = '<p><span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">x+y</annotation></math></span><span class="katex-html" aria-hidden="true">x+y</span></span></p>';
        const formula = root.querySelector('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('\\(x+y\\)');
    });

    it('uses the Reader ChatGPT cleanup chain for direct selection Markdown', () => {
        const root = document.createElement('div');
        root.innerHTML = '<p>Answer [paper](https://example.com/paper.pdf) citeturn0search0 <code>value</code> and \\(x+y\\).</p>';
        const range = document.createRange();
        range.selectNodeContents(root);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('Answer paper  `value` and $x+y$.');
    });

    it('matches the Reader DOM-to-Markdown chain for the same semantic selection', () => {
        const root = document.createElement('div');
        root.className = 'markdown prose';
        root.innerHTML = `
            <h2>Heading</h2>
            <p>
                Clean <strong>bold</strong> and <em>italic</em> with
                <span class="katex" data-latex-source="\\frac{x}{y}">
                    <span class="katex-html" aria-hidden="true">x / y</span>
                </span>.
            </p>
            <ol start="2"><li>Item <code>value</code></li></ol>
            <button type="button">Copy source</button>
        `;
        const range = document.createRange();
        range.selectNodeContents(root);
        const adapter = new ChatGPTAdapter();

        const selectionMarkdown = buildPageAtomicSelectionMarkdown({
            adapter,
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });
        const readerMarkdown = copyMarkdownFromElement(adapter, root, {
            maxProcessingTimeMs: 1_000,
        });

        expect(readerMarkdown.ok).toBe(true);
        if (!readerMarkdown.ok) return;
        expect(selectionMarkdown).toBe(readerMarkdown.markdown);
        expect(selectionMarkdown).toBe([
            '## Heading',
            '',
            'Clean **bold** and *italic* with $\\frac{x}{y}$.',
            '',
            '2. Item `value`',
        ].join('\n'));
    });

    it('keeps every inline and display formula delimiter closed in a mixed selection', () => {
        const root = document.createElement('div');
        root.className = 'markdown prose';
        root.innerHTML = `
            <p>
                First <span class="katex" data-latex-source="x_1"><span class="katex-html">x₁</span></span>
                and <span class="katex" data-latex-source="y^2"><span class="katex-html">y²</span></span>.
            </p>
            <span class="katex-display" data-latex-source="\\sum_{n=0}^{\\infty} a_n">
                <span class="katex"><span class="katex-html">visual sum</span></span>
            </span>
        `;
        const range = document.createRange();
        range.selectNodeContents(root);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe([
            'First $x_1$ and $y^2$.',
            '',
            '$$',
            '\\sum_{n=0}^{\\infty} a_n',
            '$$',
        ].join('\n'));
    });

    it('normalizes duplicate ChatGPT component blocks before building the shared selection snapshot', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared <code>value</code>.</p></div>
            </div>
            <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit again</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared <code>value</code>.</p></div>
            </div>
        `;
        const range = document.createRange();
        range.selectNodeContents(root);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('Shared `value`.');
    });
});
