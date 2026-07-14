import { afterEach, describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { buildPageAtomicSelectionMarkdown } from '@/services/copy/atomicSelectionMarkdown';
import { resolveStrictRenderedAtomicUnits } from '@/services/reader/atomicSelection';
import { setReaderMarkdownCopyFormulaFormat } from '@/services/reader/readerMarkdownCopy';

afterEach(() => {
    setReaderMarkdownCopyFormulaFormat('markdown-dollar');
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('Before `answer` after');
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBeNull();
    });

    it.each([
        {
            label: 'image',
            html: '<p><img src="https://example.com/image.png" alt="Example"></p>',
            selector: 'img',
            expected: '![Example](https://example.com/image.png)',
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
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
        });

        expect(markdown).toBe(expected);
    });

    it('applies the shared Markdown copy formula format at the clipboard-output boundary', () => {
        setReaderMarkdownCopyFormulaFormat('latex-brackets');
        const root = document.createElement('div');
        root.innerHTML = '<p><span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">x+y</annotation></math></span><span class="katex-html" aria-hidden="true">x+y</span></span></p>';
        const formula = root.querySelector('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: new ChatGPTAdapter(),
            range,
            root,
            selectedUnits: resolveStrictRenderedAtomicUnits(range, root),
            maxProcessingTimeMs: 1_000,
        });

        expect(markdown).toBe('\\(x+y\\)');
    });
});
