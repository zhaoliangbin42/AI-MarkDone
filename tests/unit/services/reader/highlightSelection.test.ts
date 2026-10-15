import { describe, expect, it } from 'vitest';
import { captureHighlightTextFragments, isHighlightableTextSelection, readHighlightSelection, resolveHighlightTextFragments } from '@/services/reader/highlightSelection';

describe('isHighlightableTextSelection', () => {
    it('keeps text eligible across decorative icons and opaque blocks', () => {
        document.body.innerHTML = '<div id="root"><h2><svg aria-hidden="true"><path/></svg>Plan</h2><p>Before</p><canvas></canvas><p>After</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange(); range.selectNodeContents(root);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });
    it('allows a partial table-cell selection', () => {
        document.body.innerHTML = '<div id="root"><table><tbody><tr><td>Chosen cell text</td></tr></tbody></table></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange(); range.setStart(root.querySelector('td')!.firstChild!, 0); range.setEnd(root.querySelector('td')!.firstChild!, 6);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });
    it('allows prose beside a code block without hiding the whole message', () => {
        document.body.innerHTML = '<div id="root"><p>ordinary text</p><div data-markdown-copy="code-block"><code>special code</code></div></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });

    it('keeps surrounding text while skipping code and editable surfaces', () => {
        document.body.innerHTML = '<div id="root"><p>before</p><div data-markdown-copy="code-block"><code>code</code></div><p>middle</p><div contenteditable="true">draft</div><p>after</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 3);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual(['before', 'mid']);
        range.setStart(paragraphs[1]!.firstChild!, 0);
        range.setEnd(paragraphs[2]!.firstChild!, 3);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual(['middle', 'aft']);
    });

    it('allows text across paragraphs, inline code and formulas, including display math', () => {
        document.body.innerHTML = '<div id="root"><p>first <code>value</code></p><p>second <span class="katex"><span class="katex-mathml"><math><annotation>x</annotation></math></span><span class="katex-html">x</span></span></p><span class="katex-display"><span class="katex"><span class="katex-html">y</span></span></span><p>last</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 3);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        range.selectNodeContents(root.querySelector('.katex-display')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        range.selectNodeContents(root.querySelector('code')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });

    it('rejects citation controls while accepting table text and adjacent prose', () => {
        document.body.innerHTML = '<div id="root"><p>sentence</p><p>with <a data-testid="chatgpt-citation">source</a></p><table><tr><td>cell</td></tr></table>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange();
        range.selectNodeContents(root.querySelector('p')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        for (const selector of ['[data-testid="chatgpt-citation"]']) {
            range.selectNodeContents(root.querySelector(selector)!);
            expect(isHighlightableTextSelection(range, root)).toBe(false);
        }
        range.selectNodeContents(root.querySelector('td')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });

    it('requires a complete inline atom so an offered swatch can produce a durable source', () => {
        document.body.innerHTML = '<div id="root"><p><code>answer</code> <span class="katex"><span class="katex-html">x+y</span></span></p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange();
        const code = root.querySelector('code')!.firstChild!;
        range.setStart(code, 1); range.setEnd(code, 4);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
        const math = root.querySelector('.katex-html')!.firstChild!;
        range.setStart(math, 0); range.setEnd(math, 1);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
    });

    it('restores table and prose fragments across whitespace, wrappers and omitted blocks', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before words</p><canvas>hidden plot</canvas><table><tr><td>Cell A</td><td>Cell B</td></tr></table><pre>excluded code</pre><p>After words</p>';
        const range = document.createRange(); range.selectNodeContents(root);
        const parts = readHighlightSelection(range, root)!;
        expect(parts.ranges.map(part => part.toString())).toEqual(['Before words', 'Cell A', 'Cell B', 'After words']);
        const fragments = captureHighlightTextFragments(root, parts.ranges)!;
        expect(fragments).toHaveLength(4);
        root.innerHTML = '<p><strong>Before words</strong></p>\n<img alt="plot"><table><tr><td>Cell A</td>\n<td>Cell B</td></tr></table><p>After words</p>';
        expect(resolveHighlightTextFragments(root, JSON.parse(JSON.stringify(fragments)))?.map(part => part.toString())).toEqual(['Before words', 'Cell A', 'Cell B', 'After words']);
        root.querySelectorAll('td')[1]!.textContent = 'Changed cell';
        expect(resolveHighlightTextFragments(root, fragments)).toBeNull();
    });

    it('does not guess repeated fragment text or trust forged text offsets', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>same</p><p>same</p>';
        const fragment = { quoteText: 'same', selectors: { textQuote: { exact: 'same', prefix: '', suffix: '' }, textPosition: { start: 0, end: 4 }, domRange: null, atomicRefs: [] } };
        expect(resolveHighlightTextFragments(root, [fragment])).toBeNull();
    });

    it('skips the Reader textual fallback just like the original opaque visual', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before</p><canvas>plot</canvas><p>After</p>';
        const range = document.createRange(); range.selectNodeContents(root);
        const fragments = captureHighlightTextFragments(root, readHighlightSelection(range, root)!.ranges)!;
        root.innerHTML = '<p>Before</p><span data-aimd-rich-block="rich-1">[Diagram] plot</span><p>After</p>';
        expect(resolveHighlightTextFragments(root, fragments)?.map(part => part.toString())).toEqual(['Before', 'After']);
    });

    it('bounds fragment count and rejects special-only and cross-root selections', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<canvas>plot</canvas><p>safe</p>';
        const range = document.createRange(); range.selectNodeContents(root.querySelector('canvas')!);
        expect(readHighlightSelection(range, root)).toBeNull();
        root.innerHTML = '<table><tr>' + '<td>cell</td>'.repeat(129) + '</tr></table>';
        range.selectNodeContents(root);
        expect(readHighlightSelection(range, root)).toBeNull();
        const outside = document.createTextNode('outside'); document.body.append(outside);
        range.setEnd(outside, 3);
        expect(readHighlightSelection(range, root)).toBeNull();
    });
});
