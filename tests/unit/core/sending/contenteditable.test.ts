import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyPlainTextToContenteditable,
    getContenteditableCaretClientRect,
    getContenteditablePlainTextOffsetFromPoint,
    parseContenteditableToPlainText,
    setContenteditablePlainTextSelection,
} from '../../../../src/core/sending/contenteditable';

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

function installRangeLayoutMock(clientRects: DOMRect[] = [], boundingRect = rect(0, 0, 0, 0)): () => void {
    const originalGetClientRects = Range.prototype.getClientRects;
    const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
    Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        value: vi.fn(() => clientRects),
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: vi.fn(() => boundingRect),
    });
    return () => {
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: originalGetClientRects,
        });
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: originalGetBoundingClientRect,
        });
    };
}

describe('sending/contenteditable', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.getSelection()?.removeAllRanges();
        vi.restoreAllMocks();
    });

    it('parses ProseMirror-like blocks with exact newlines', () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        el.innerHTML = '<p>hello</p><p><br></p><p>world</p>';
        expect(parseContenteditableToPlainText(el)).toBe('hello\n\nworld');
    });

    it('applies plain text as <p>/<br> blocks and roundtrips', () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'a\n\nb');

        const blocks = el.querySelectorAll('p');
        expect(blocks.length).toBe(3);
        expect(blocks[0].textContent).toBe('a');
        expect(blocks[1].querySelector('br')).toBeTruthy();
        expect(blocks[2].textContent).toBe('b');

        expect(parseContenteditableToPlainText(el)).toBe('a\n\nb');
    });

    it('returns the viewport rect for a collapsed caret inside the contenteditable root', () => {
        const restore = installRangeLayoutMock([rect(120, 240, 0, 18)]);
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'hello');
        document.body.appendChild(el);
        setContenteditablePlainTextSelection(el, 5);

        expect(getContenteditableCaretClientRect(el)).toMatchObject({
            left: 120,
            top: 240,
            bottom: 258,
        });
        restore();
    });

    it('returns null when the selection is outside the contenteditable root', () => {
        const restore = installRangeLayoutMock([rect(120, 240, 0, 18)]);
        const el = document.createElement('div');
        const outside = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        outside.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'inside');
        applyPlainTextToContenteditable(outside, 'outside');
        document.body.append(el, outside);
        setContenteditablePlainTextSelection(outside, 3);

        expect(getContenteditableCaretClientRect(el)).toBeNull();
        restore();
    });

    it('returns null for non-collapsed contenteditable selections', () => {
        const restore = installRangeLayoutMock([rect(120, 240, 40, 18)]);
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'hello');
        document.body.appendChild(el);
        setContenteditablePlainTextSelection(el, 1, 4);

        expect(getContenteditableCaretClientRect(el)).toBeNull();
        restore();
    });

    it('maps a viewport point back to the ProseMirror plain-text offset', () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'first\nsecond');
        document.body.appendChild(el);
        const text = el.querySelectorAll('p')[1]!.firstChild!;
        Object.defineProperty(document, 'caretPositionFromPoint', {
            configurable: true,
            value: vi.fn(() => ({ offsetNode: text, offset: 3 })),
        });

        expect(getContenteditablePlainTextOffsetFromPoint(el, 100, 200)).toBe(9);
        delete (document as any).caretPositionFromPoint;
    });

    it('rejects a point whose caret boundary is outside the composer', () => {
        const el = document.createElement('div');
        const outside = document.createTextNode('outside');
        el.setAttribute('contenteditable', 'true');
        applyPlainTextToContenteditable(el, 'inside');
        document.body.append(el, outside);
        Object.defineProperty(document, 'caretPositionFromPoint', {
            configurable: true,
            value: vi.fn(() => ({ offsetNode: outside, offset: 2 })),
        });

        expect(getContenteditablePlainTextOffsetFromPoint(el, 100, 200)).toBeNull();
        delete (document as any).caretPositionFromPoint;
    });
});
