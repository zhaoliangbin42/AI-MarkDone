import { describe, expect, it } from 'vitest';

import { resolveReaderSelectionRange, resolveSelectedAtomicUnits } from '@/services/reader/atomicSelection';

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
});
