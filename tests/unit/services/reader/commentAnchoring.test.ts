import { describe, expect, it } from 'vitest';
import {
    createReaderCommentRecord,
    resolveReaderCommentAnchor,
    resolveSelectionLayout,
} from '@/services/reader/commentAnchoring';
import type { SelectedAtomicUnit } from '@/services/reader/atomicSelection';

describe('commentAnchoring', () => {
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
