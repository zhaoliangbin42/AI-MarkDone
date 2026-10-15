import { describe, expect, it } from 'vitest';
import {
    capturePageCommentSelectors,
    createPageCommentRecord,
    createReaderCommentRecord,
    resolveReaderCommentAnchor,
    resolveSelectionLayout,
} from '@/services/reader/commentAnchoring';
import type { SelectedAtomicUnit } from '@/services/reader/atomicSelection';
import { captureHighlightTextFragments, readHighlightSelection } from '@/services/reader/highlightSelection';

describe('commentAnchoring', () => {
    it('paints mixed formula fragments as whole units without painting skipped graphics or glyph descendants', () => {
        const root = document.createElement('div'); document.body.append(root);
        root.innerHTML = '<p>Before</p><span class="katex" data-latex-source="x+y"><span class="katex-html">x+y</span></span><canvas>plot</canvas><p>After</p>';
        const range = document.createRange(); range.selectNodeContents(root);
        const record = createPageCommentRecord({ id: 'formula-mixed', itemId: 'reply', comment: '', range, root, sourceMarkdown: 'Before $x+y$ After' });
        record.highlightFragments = captureHighlightTextFragments(root, readHighlightSelection(range, root)!.ranges)!;
        const formula = root.querySelector<HTMLElement>('.katex')!;
        Object.assign(formula, { getBoundingClientRect: () => ({ left: 100, top: 30, width: 80, height: 25, right: 180, bottom: 55 }) });
        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        const measured: string[] = [];
        Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: function(this: Range) {
            measured.push(this.toString());
            return [{ left: 0, top: this.toString() === 'After' ? 80 : 0, width: 40, height: 20, right: 40, bottom: this.toString() === 'After' ? 100 : 20 }];
        } });
        try {
            const resolved = resolveReaderCommentAnchor(root, record);
            expect(measured).toEqual(['Before', 'After']);
            expect(resolved.units.map(unit => unit.element)).toEqual([formula]);
            expect(resolved.rects).toContainEqual({ left: 100, top: 30, width: 80, height: 25 });
            expect(resolved.rects).toHaveLength(3);
        } finally {
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original); else delete (Range.prototype as any).getClientRects;
        }
    });
    it('does not bridge a small omitted icon gap between independent highlight ranges', () => {
        const root = document.createElement('div'); root.innerHTML = '<span>before</span><svg></svg><span>after</span>'; document.body.append(root);
        const ranges = Array.from(root.querySelectorAll('span')).map((span, index) => {
            const range = document.createRange(); range.selectNodeContents(span);
            Object.assign(range, { getClientRects: () => [{ left: index * 15, top: 0, width: 10, height: 10, right: index * 15 + 10, bottom: 10 }] });
            return range;
        });
        expect(resolveSelectionLayout({ root, range: ranges[0]!, ranges, selectedUnits: [] }).rects).toHaveLength(2);
    });
    it.each(['page-to-reader', 'reader-to-page'])('keeps a unique exact passage through layout whitespace changes (%s)', (direction) => {
        const paragraphs = ['<p>Earlier context.</p>', '<p>Chosen passage.</p>', '<p>Following context.</p>'];
        document.body.innerHTML = '<div id="root"></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        root.innerHTML = paragraphs.join(direction === 'page-to-reader' ? '' : '\n');
        const range = document.createRange(); range.selectNodeContents(root.querySelectorAll('p')[1]!);
        const record = createPageCommentRecord({ id: 'cross-surface', itemId: 'reply', comment: '', range, root, sourceMarkdown: 'Chosen passage.' });
        root.innerHTML = paragraphs.join(direction === 'page-to-reader' ? '\n' : '');
        const resolved = resolveReaderCommentAnchor(root, record);
        expect(resolved.range?.toString()).toBe('Chosen passage.');
        expect(resolved.range?.endContainer.parentElement).toBe(root.querySelectorAll('p')[1]);
    });

    it('does not guess between repeated quotes whose normalized context is ambiguous', () => {
        document.body.innerHTML = '<div id="root"><p>A Chosen B</p><p>A Chosen B</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!);
        const record = createPageCommentRecord({ id: 'ambiguous-context', itemId: 'reply', comment: '', range, root, sourceMarkdown: 'Chosen' });
        record.quoteText = 'Chosen';
        record.selectors = { textQuote: { exact: 'Chosen', prefix: 'A\n', suffix: '\nB' }, textPosition: { start: null, end: null }, domRange: null, atomicRefs: [] };
        expect(resolveReaderCommentAnchor(root, record).range).toBeNull();
    });

    it.each(['dom-path', 'text-position'])('rejects a stale %s that now points to a different occurrence of the same quote', (shortcut) => {
        document.body.innerHTML = '<div id="root"><p>ALPHA Same tailA</p><p>BRAVO Same tailB</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const target = root.querySelectorAll('p')[1]!.firstChild!;
        const range = document.createRange();
        range.setStart(target, 6);
        range.setEnd(target, 10);
        const record = createPageCommentRecord({ id: 'same-quote', itemId: 'reply', comment: 'note', range, root, sourceMarkdown: 'Same' });
        if (shortcut === 'text-position') record.selectors.domRange = null;
        root.insertAdjacentHTML('afterbegin', '<p>OMEGA Same tail0</p>');

        const resolved = resolveReaderCommentAnchor(root, record);
        expect(resolved.range?.toString()).toBe('Same');
        expect(resolved.range?.startContainer.parentElement?.textContent).toBe('BRAVO Same tailB');
    });

    it('captures and resolves a mixed text + atomic-unit anchor', () => {
        document.body.innerHTML = `
          <div id="root">
            <p>Before <span data-aimd-unit-id="u1" data-aimd-unit-kind="inline-code" data-aimd-md-start="8" data-aimd-md-end="20">code</span> after</p>
          </div>
        `;

        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraph = root.querySelector('p')!;
        const beforeNode = paragraph.firstChild as Text;
        const afterNode = paragraph.lastChild as Text;
        const unitEl = paragraph.querySelector<HTMLElement>('[data-aimd-unit-id="u1"]')!;

        const range = document.createRange();
        range.setStart(beforeNode, 1);
        range.setEnd(afterNode, 3);

        const selectedUnits: SelectedAtomicUnit[] = [{
            id: 'u1',
            kind: 'inline-code',
            mode: 'atomic',
            start: 8,
            end: 20,
            source: '`inline code`',
            element: unitEl,
        }];

        const record = createReaderCommentRecord({
            id: 'c1',
            itemId: 'item-1',
            comment: 'note',
            range,
            root,
            selectedUnits,
        });

        expect(record.quoteText).toContain('efore');
        expect(record.sourceMarkdown).toContain('`inline code`');
        expect(record.selectors.atomicRefs).toHaveLength(1);
        expect(record.selectors.domRange).not.toBeNull();

        const resolved = resolveReaderCommentAnchor(root, record);
        expect(resolved.range).not.toBeNull();
        expect(resolved.units.map((unit) => unit.kind)).toEqual(['inline-code']);
    });

    it('captures text selectors for partial code selections without atomic refs', () => {
        document.body.innerHTML = `
          <div id="root">
            <pre data-aimd-unit-id="u1"><code>const answer = 42;</code></pre>
          </div>
        `;

        const root = document.querySelector<HTMLElement>('#root')!;
        const codeText = root.querySelector('code')!.firstChild as Text;
        const start = codeText.data.indexOf('answer');
        const range = document.createRange();
        range.setStart(codeText, start);
        range.setEnd(codeText, start + 'answer'.length);

        const record = createReaderCommentRecord({
            id: 'c1',
            itemId: 'item-1',
            comment: 'note',
            range,
            root,
            selectedUnits: [],
        });

        expect(record.quoteText).toBe('answer');
        expect(record.sourceMarkdown).toBe('answer');
        expect(record.selectors.atomicRefs).toHaveLength(0);
        expect(record.selectors.textQuote.exact).toBe('answer');
        expect(record.selectors.textPosition.start).not.toBeNull();
        expect(record.selectors.textPosition.end).not.toBeNull();
    });

    it('does not trust an atomic ref after its original quote changes', () => {
        document.body.innerHTML = `
          <div id="root">
            <p>Before <span data-aimd-unit-id="u1" data-aimd-unit-kind="inline-code" data-aimd-md-start="8" data-aimd-md-end="20">code</span> after</p>
          </div>
        `;
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraph = root.querySelector('p')!;
        const beforeNode = paragraph.firstChild as Text;
        const afterNode = paragraph.lastChild as Text;
        const unitEl = paragraph.querySelector<HTMLElement>('[data-aimd-unit-id="u1"]')!;
        const range = document.createRange();
        range.setStart(beforeNode, 1);
        range.setEnd(afterNode, 3);
        const record = createReaderCommentRecord({
            id: 'c-stale-atomic',
            itemId: 'item-1',
            comment: 'note',
            range,
            root,
            selectedUnits: [{
                id: 'u1',
                kind: 'inline-code',
                mode: 'atomic',
                start: 8,
                end: 20,
                source: '`inline code`',
                element: unitEl,
            }],
        });

        unitEl.textContent = 'changed';
        const resolved = resolveReaderCommentAnchor(root, record);
        expect(resolved.range).toBeNull();
        expect(resolved.units).toEqual([]);
        expect(resolved.unionRect).toBeNull();
    });

    it('keeps the selected occurrence when the same quote appears more than once', () => {
        document.body.innerHTML = '<div id="root"><p>Repeat here.</p><p>Repeat here.</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const secondText = root.querySelectorAll('p')[1].firstChild as Text;
        const start = secondText.data.indexOf('Repeat');
        const range = document.createRange();
        range.setStart(secondText, start);
        range.setEnd(secondText, start + 'Repeat'.length);

        const record = createReaderCommentRecord({
            id: 'c-repeat',
            itemId: 'item-1',
            comment: 'second',
            range,
            root,
            selectedUnits: [],
        });

        expect(record.selectors.textQuote.prefix).toContain('Repeat here.');
        expect(record.selectors.textPosition.start).toBe(12);
        const resolved = resolveReaderCommentAnchor(root, record);
        expect(resolved.range?.startContainer).toBe(secondText);
        expect(resolved.range?.startOffset).toBe(start);
    });

    it('captures zero text position when the selection starts at the first element boundary', () => {
        document.body.innerHTML = '<div id="root"><h2 data-aimd-unit-id="h1" data-aimd-unit-kind="heading" data-aimd-md-start="0" data-aimd-md-end="32">Response and latest decision</h2><p>Later content.</p></div>';

        const root = document.querySelector<HTMLElement>('#root')!;
        const heading = root.querySelector('h2')!;
        const range = document.createRange();
        range.setStart(heading, 0);
        range.setEnd(heading, heading.childNodes.length);

        const record = createReaderCommentRecord({
            id: 'c1',
            itemId: 'item-1',
            comment: 'note',
            range,
            root,
            selectedUnits: [],
        });

        expect(record.quoteText).toBe('Response and latest decision');
        expect(record.selectors.textPosition).toEqual({
            start: 0,
            end: 'Response and latest decision'.length,
        });
    });

    it('computes overlay rectangles from a selection layout', () => {
        document.body.innerHTML = `<div id="root"><p>Alpha beta gamma</p></div>`;
        const root = document.querySelector<HTMLElement>('#root')!;
        const textNode = root.querySelector('p')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        Object.assign(range, {
            getBoundingClientRect: () => ({
                left: 10,
                top: 12,
                width: 30,
                height: 14,
                right: 40,
                bottom: 26,
                x: 10,
                y: 12,
                toJSON: () => ({}),
            }),
        });

        const resolved = resolveSelectionLayout({
            root,
            range,
            selectedUnits: [],
        });

        expect(resolved.range).not.toBeNull();
        expect(resolved.unionRect).not.toBeNull();
    });

    it('keeps wrapped selection lines as separate highlight rectangles', () => {
        document.body.innerHTML = '<div id="root"><p>First line</p><p>Second line</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 6);
        Object.assign(range, {
            getClientRects: () => [
                { left: 10, top: 10, width: 80, height: 18, right: 90, bottom: 28 },
                { left: 10, top: 40, width: 54, height: 18, right: 64, bottom: 58 },
            ],
        });
        Object.assign(root, { getBoundingClientRect: () => ({ left: 0, top: 0 }) });

        const resolved = resolveSelectionLayout({ root, range, selectedUnits: [] });
        expect(resolved.rects).toHaveLength(2);
        expect(resolved.rects.map((rect) => rect.top)).toEqual([10, 40]);
    });

    it('merges text and atomic-unit rects into a continuous highlight', () => {
        document.body.innerHTML = `
          <div id="root">
            <p>Before <span data-aimd-unit-id="u1" data-aimd-unit-kind="inline-code" data-aimd-md-start="8" data-aimd-md-end="20">code</span> after</p>
          </div>
        `;

        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraph = root.querySelector('p')!;
        const beforeNode = paragraph.firstChild as Text;
        const afterNode = paragraph.lastChild as Text;
        const unitEl = paragraph.querySelector<HTMLElement>('[data-aimd-unit-id="u1"]')!;

        const range = document.createRange();
        range.setStart(beforeNode, 0);
        range.setEnd(afterNode, afterNode.textContent!.length);
        Object.assign(range, {
            getClientRects: () => ([
                { left: 10, top: 10, width: 42, height: 16, right: 52, bottom: 26, x: 10, y: 10, toJSON: () => ({}) },
                { left: 54, top: 10, width: 32, height: 16, right: 86, bottom: 26, x: 54, y: 10, toJSON: () => ({}) },
                { left: 88, top: 10, width: 36, height: 16, right: 124, bottom: 26, x: 88, y: 10, toJSON: () => ({}) },
            ]),
        });
        Object.assign(root, {
            getBoundingClientRect: () => ({
                left: 0, top: 0, width: 300, height: 120, right: 300, bottom: 120, x: 0, y: 0, toJSON: () => ({}),
            }),
        });
        Object.assign(unitEl, {
            getBoundingClientRect: () => ({
                left: 54, top: 10, width: 32, height: 16, right: 86, bottom: 26, x: 54, y: 10, toJSON: () => ({}),
            }),
        });

        const selectedUnits: SelectedAtomicUnit[] = [{
            id: 'u1',
            kind: 'inline-code',
            mode: 'atomic',
            start: 8,
            end: 20,
            source: '`inline code`',
            element: unitEl,
        }];

        const resolved = resolveSelectionLayout({ root, range, selectedUnits });
        expect(resolved.rects).toHaveLength(1);
        expect(resolved.rects[0]).toMatchObject({ left: 10, top: 10, width: 114, height: 16 });
    });
});

describe('commentAnchoring page helpers', () => {
    it('does not paint a selected citation control as another line of page text', () => {
        document.body.innerHTML = '<div id="root"><p><span>Answer text</span><a data-testid="chatgpt-citation">Source</a></p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const citation = root.querySelector('a')!;
        const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!);
        const rect = (left: number, top: number, width: number, height: number) => ({left, top, width, height, right:left+width, bottom:top+height, x:left, y:top, toJSON:()=>({})});
        Object.assign(root, {getBoundingClientRect: () => rect(0, 0, 300, 100)});
        Object.assign(citation, {getBoundingClientRect: () => rect(10, 40, 80, 12)});
        Object.assign(range, {getClientRects: () => [rect(10, 10, 100, 16), rect(10, 40, 80, 12)]});
        const layout = resolveSelectionLayout({root, range, selectedUnits: []});
        expect(layout.rects).toHaveLength(1);
        expect(layout.rects[0]).toMatchObject({left:10, top:10, width:100, height:16});
    });

    it('capturePageCommentSelectors captures textQuote/textPosition/domRange with empty atomicRefs', () => {
        document.body.innerHTML = `<div id="root"><p>Hello <strong>world</strong> again</p></div>`;
        const root = document.querySelector<HTMLElement>('#root')!;
        const text = root.querySelector('strong')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 1);
        range.setEnd(text, 4);

        const selectors = capturePageCommentSelectors({ range, root });

        expect(selectors.atomicRefs).toEqual([]);
        expect(selectors.textQuote.exact).toBe('orl');
        expect(selectors.textPosition.start).not.toBeNull();
        expect(selectors.textPosition.end).not.toBeNull();
        expect(selectors.domRange).not.toBeNull();
    });

    it('createPageCommentRecord uses the provided canonical sourceMarkdown instead of DOM reconstruction', () => {
        document.body.innerHTML = `<div id="root"><p>Some **markdown** here</p></div>`;
        const root = document.querySelector<HTMLElement>('#root')!;
        const text = root.querySelector('p')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 5);

        const record = createPageCommentRecord({
            id: 'c1',
            itemId: 'chatgpt-assistant-1',
            comment: 'note',
            range,
            root,
            sourceMarkdown: '**canonical** projection',
        });

        expect(record.sourceMarkdown).toBe('**canonical** projection');
        expect(record.quoteText).toBe('Some');
        expect(record.selectors.atomicRefs).toEqual([]);
    });
});
