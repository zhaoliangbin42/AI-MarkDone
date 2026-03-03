import { describe, expect, it } from 'vitest';
import { applyPlainTextToContenteditable, parseContenteditableToPlainText } from '../../../../src/core/sending/contenteditable';

describe('sending/contenteditable', () => {
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
});

