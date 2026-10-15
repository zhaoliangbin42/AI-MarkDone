import { describe, expect, it } from 'vitest';
import { captureHighlightTextFragments, isHighlightableTextSelection, readHighlightSelection, resolveHighlightFragments, resolveHighlightTextFragments } from '@/services/reader/highlightSelection';

describe('isHighlightableTextSelection', () => {
    it('offers highlighting for prose even when the selection ends inside a formula', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Keep this <span class="katex"><span class="katex-html">x+y</span></span></p>';
        const paragraph = root.querySelector('p')!;
        const range = document.createRange(); range.setStart(paragraph.firstChild!, 0); range.setEnd(root.querySelector('.katex-html')!.firstChild!, 1);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual(['Keep this ']);
    });
    it('keeps prose selected after an unsupported partial formula', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p><span class="katex"><span class="katex-html">x+y</span></span> After</p>';
        const range = document.createRange(); range.setStart(root.querySelector('.katex-html')!.firstChild!, 1); range.setEnd(root.querySelector('p')!.lastChild!, 6);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual([' After']);
    });
    it('offers and captures a complete formula even when it is the only supported selected part', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<canvas>plot</canvas><span class="katex" data-latex-source="x+y"><span class="katex-html">x+y</span></span>';
        const range = document.createRange(); range.selectNodeContents(root);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        const fragments = captureHighlightTextFragments(root, readHighlightSelection(range, root)!.ranges)!;
        expect(fragments.map(fragment => fragment.quoteText)).toEqual(['$x+y$']);
    });
    it('does not offer a color for whitespace alone', () => {
        const root = document.createElement('div'); document.body.append(root); root.innerHTML = '<p>   </p>';
        const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
    });
    it('keeps a complete source-bearing formula eligible when an unsupported block is also selected', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before</p><span class="katex" data-latex-source="x+y"><span class="katex-html">x+y</span></span><canvas>plot</canvas><p>After</p>';
        const range = document.createRange(); range.selectNodeContents(root);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual(['Before', 'x+y', 'After']);
    });
    it('restores mixed formulas by authoritative source instead of renderer glyph text', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before</p><span class="katex" data-latex-source="x+y"><span class="katex-html">old glyphs</span></span><canvas>plot</canvas><p>After</p>';
        const range = document.createRange(); range.selectNodeContents(root);
        const fragments = captureHighlightTextFragments(root, readHighlightSelection(range, root)!.ranges)!;
        expect(fragments.map(fragment => fragment.quoteText)).toEqual(['Before', '$x+y$', 'After']);
        root.innerHTML = '<p><strong>Before</strong></p>\n<span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">x+y</annotation></math></span><span class="katex-html">new glyphs</span></span><span data-aimd-rich-block="chart">[Chart]</span><p>After</p>';
        const restored = resolveHighlightFragments(root, JSON.parse(JSON.stringify(fragments)))!;
        expect(restored.textRanges.map(part => part.toString())).toEqual(['Before', 'After']);
        expect(restored.units.map(unit => unit.element)).toEqual([root.querySelector('.katex')]);
        root.querySelector('annotation')!.textContent = 'x-y';
        expect(resolveHighlightFragments(root, fragments)).toBeNull();
    });
    it('does not guess between duplicate formulas with identical text context', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<span class="katex" data-latex-source="x"><span class="katex-html">x</span></span><span class="katex" data-latex-source="x"><span class="katex-html">x</span></span>';
        const fragment = { quoteText: '$x$', formula: { latex: 'x', display: false }, selectors: { textQuote: { exact: 'x', prefix: '', suffix: '' }, textPosition: { start: 0, end: 0 }, domRange: null, atomicRefs: [] } };
        expect(resolveHighlightFragments(root, [fragment])).toBeNull();
    });
    it('keeps existing text-only fragments compatible when formulas are present', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before</p><span class="katex" data-latex-source="x"><span class="katex-html">x</span></span><p>After</p>';
        const ranges = Array.from(root.querySelectorAll('p')).map(p => { const range = document.createRange(); range.selectNodeContents(p); return range; });
        const fragments = captureHighlightTextFragments(root, ranges)!;
        root.querySelector('.katex')!.setAttribute('data-latex-source', 'different');
        expect(resolveHighlightTextFragments(root, fragments)?.map(range => range.toString())).toEqual(['Before', 'After']);
    });
    it('offers a color before capture limits, without silently truncating an oversized save', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<table><tr>' + '<td>cell</td>'.repeat(129) + '</tr></table>';
        const range = document.createRange(); range.selectNodeContents(root);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        expect(readHighlightSelection(range, root)).toBeNull();
    });
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

    it('allows partial inline code as text but does not expand partial formula glyphs', () => {
        document.body.innerHTML = '<div id="root"><p><code>answer</code> <span class="katex"><span class="katex-html">x+y</span></span></p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange();
        const code = root.querySelector('code')!.firstChild!;
        range.setStart(code, 1); range.setEnd(code, 4);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        expect(readHighlightSelection(range, root)?.ranges.map(part => part.toString())).toEqual(['nsw']);
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
