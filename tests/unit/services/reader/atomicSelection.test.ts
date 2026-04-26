import { describe, expect, it } from 'vitest';

import { annotateRenderedAtomicUnits, resolveReaderSelectionRange, resolveSelectedAtomicUnits } from '@/services/reader/atomicSelection';

function buildSelectionStub(range: Range, composedRange?: StaticRange): Selection {
    return {
        rangeCount: 1,
        getRangeAt: () => range,
        getComposedRanges: composedRange ? (() => [composedRange]) : undefined,
        toString: () => range.toString(),
    } as unknown as Selection;
}

describe('atomicSelection', () => {
    it('prefers composed ranges inside the reader shadow root', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <p>Alpha <span data-aimd-unit-id="u1" data-aimd-unit-kind="inline-math">math</span> beta</p>
          </div>
        `;
        shadow.appendChild(root);

        const textNode = root.querySelector('p')!.firstChild as Text;
        const fallback = document.createRange();
        fallback.selectNodeContents(document.body);

        const composed = {
            startContainer: textNode,
            startOffset: 0,
            endContainer: textNode,
            endOffset: 5,
        } as StaticRange;

        const selection = buildSelectionStub(fallback, composed);
        const resolved = resolveReaderSelectionRange(selection, shadow, root);

        expect(resolved).toBeTruthy();
        expect(resolved?.toString()).toBe('Alpha');
    });

    it('collects every atomic unit intersected by a range', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <p>Before <span data-aimd-unit-id="u1" data-aimd-unit-kind="inline-code" data-aimd-md-start="1" data-aimd-md-end="7">code</span> after</p>
            <p><span data-aimd-unit-id="u2" data-aimd-unit-kind="inline-math" data-aimd-md-start="8" data-aimd-md-end="14">math</span></p>
          </div>
        `;

        const firstText = root.querySelector('p')!.firstChild as Text;
        const secondText = root.querySelectorAll('p')[1]!.firstChild!.firstChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(secondText, 4);

        const selected = resolveSelectedAtomicUnits(range, root);

        expect(selected.map((unit) => unit.kind)).toEqual(['inline-code', 'inline-math']);
        expect(selected.map((unit) => unit.id)).toEqual(['u1', 'u2']);
    });

    it('treats rendered unit annotation as best-effort when DOM and metadata diverge', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <h2>DOM-only heading</h2>
            <p><span class="katex">x+y</span></p>
          </div>
        `;

        const annotated = annotateRenderedAtomicUnits(root, [{
            id: 'math-1',
            kind: 'inline-math',
            mode: 'atomic',
            start: 0,
            end: 5,
            source: '$x+y$',
        }]);

        expect(annotated.map((unit) => unit.id)).toEqual(['math-1']);
        expect(root.querySelector('h2')?.hasAttribute('data-aimd-unit-id')).toBe(false);
        expect(root.querySelector('.katex')?.getAttribute('data-aimd-unit-id')).toBe('math-1');
    });

    it('collects structural units only when their visible text is fully selected', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <h2 data-aimd-unit-id="h1" data-aimd-unit-kind="heading" data-aimd-unit-mode="structural" data-aimd-md-start="0" data-aimd-md-end="10">Heading</h2>
            <ul>
              <li data-aimd-unit-id="li1" data-aimd-unit-kind="list-item" data-aimd-unit-mode="structural" data-aimd-md-start="11" data-aimd-md-end="23">First item</li>
            </ul>
          </div>
        `;

        const headingText = root.querySelector('h2')!.firstChild as Text;
        const partial = document.createRange();
        partial.setStart(headingText, 2);
        partial.setEnd(headingText, headingText.data.length);

        expect(resolveSelectedAtomicUnits(partial, root)).toHaveLength(0);

        const full = document.createRange();
        full.setStart(headingText, 0);
        full.setEnd(headingText, headingText.data.length);

        expect(resolveSelectedAtomicUnits(full, root).map((unit) => unit.kind)).toEqual(['heading']);
    });

    it('does not collect a list item when selection starts inside the item text', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <ul>
              <li data-aimd-unit-id="li1" data-aimd-unit-kind="list-item" data-aimd-unit-mode="structural" data-aimd-md-start="0" data-aimd-md-end="12">First item</li>
            </ul>
          </div>
        `;

        const itemText = root.querySelector('li')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(itemText, 3);
        range.setEnd(itemText, itemText.data.length);

        expect(resolveSelectedAtomicUnits(range, root)).toHaveLength(0);
    });

    it('rejects selections whose endpoints are not both inside the reader markdown root', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const outside = document.createElement('div');
        outside.textContent = 'Outside';
        const root = document.createElement('div');
        root.innerHTML = '<div class="reader-markdown"><p>Inside</p></div>';
        shadow.append(outside, root);

        const outsideText = outside.firstChild as Text;
        const insideText = root.querySelector('p')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(outsideText, 0);
        range.setEnd(insideText, insideText.textContent!.length);

        const selection = buildSelectionStub(range, {
            startContainer: outsideText,
            startOffset: 0,
            endContainer: insideText,
            endOffset: insideText.textContent!.length,
        } as StaticRange);

        expect(resolveReaderSelectionRange(selection, shadow, root)).toBeNull();
    });
});
