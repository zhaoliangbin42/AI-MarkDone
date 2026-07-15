import { describe, expect, it } from 'vitest';
import {
    detectMarkdownListTypeAt,
    planMarkdownBackspaceEdit,
    planMarkdownBoldEdit,
    planMarkdownEnterEdit,
    planMarkdownOrderedListDeletionEdit,
} from '@/core/sending/markdownAuthoring';

describe('markdown authoring', () => {
    it('wraps the selected text in visible bold markers', () => {
        expect(planMarkdownBoldEdit('hello world', { start: 6, end: 11 })).toEqual({
            start: 6,
            end: 11,
            replacement: '**world**',
            selectionStart: 8,
            selectionEnd: 13,
        });
    });

    it('inserts an empty bold pair with the caret between the markers', () => {
        expect(planMarkdownBoldEdit('hello ', { start: 6, end: 6 })).toEqual({
            start: 6,
            end: 6,
            replacement: '****',
            selectionStart: 8,
            selectionEnd: 8,
        });
    });

    it('removes bold markers that already surround the selection', () => {
        expect(planMarkdownBoldEdit('hello **world**', { start: 8, end: 13 })).toEqual({
            start: 6,
            end: 15,
            replacement: 'world',
            selectionStart: 6,
            selectionEnd: 11,
        });
    });

    it('removes bold markers when the markers themselves are selected', () => {
        expect(planMarkdownBoldEdit('hello **world**', { start: 6, end: 15 })).toEqual({
            start: 6,
            end: 15,
            replacement: 'world',
            selectionStart: 6,
            selectionEnd: 11,
        });
    });

    it('continues an unordered list with the same marker and indentation', () => {
        expect(planMarkdownEnterEdit('  - first', { start: 9, end: 9 })).toEqual({
            start: 9,
            end: 9,
            replacement: '\n  - ',
            selectionStart: 14,
            selectionEnd: 14,
        });
    });

    it.each(['+', '*'])('continues an unordered list that uses the %s marker', (marker) => {
        expect(planMarkdownEnterEdit(`${marker} item`, { start: 6, end: 6 })?.replacement).toBe(`\n${marker} `);
    });

    it('splits an item at the caret and leaves the trailing text in the next item', () => {
        const edit = planMarkdownEnterEdit('- first second', { start: 8, end: 8 });
        expect(edit).toEqual({
            start: 7,
            end: 8,
            replacement: '\n- ',
            selectionStart: 10,
            selectionEnd: 10,
        });
        expect('- first second'.slice(0, edit!.start) + edit!.replacement + '- first second'.slice(edit!.end))
            .toBe('- first\n- second');
    });

    it('does not continue a list while the caret is inside its marker prefix', () => {
        expect(planMarkdownEnterEdit('- first', { start: 1, end: 1 })).toBeNull();
    });

    it('increments an ordered list and preserves its delimiter', () => {
        expect(planMarkdownEnterEdit('9) ninth', { start: 8, end: 8 })).toEqual({
            start: 8,
            end: 8,
            replacement: '\n10) ',
            selectionStart: 13,
            selectionEnd: 13,
        });
    });

    it('gates authoring rules by ordered and unordered list type', () => {
        const ordered = '1. first';
        const unordered = '- first';

        expect(planMarkdownEnterEdit(
            ordered,
            { start: ordered.length, end: ordered.length },
            { ordered: false, unordered: true },
        )).toBeNull();
        expect(planMarkdownEnterEdit(
            unordered,
            { start: unordered.length, end: unordered.length },
            { ordered: false, unordered: true },
        )?.replacement).toBe('\n- ');
        expect(planMarkdownBackspaceEdit(
            '2. item',
            { start: 3, end: 3 },
            { ordered: false, unordered: true },
        )).toBeNull();
        expect(detectMarkdownListTypeAt(ordered, ordered.length)).toBe('ordered');
        expect(detectMarkdownListTypeAt(unordered, unordered.length)).toBe('unordered');
    });

    it('inserts an ordered item in the middle and renumbers following siblings', () => {
        const text = '1. first\n2. second';
        const edit = planMarkdownEnterEdit(text, { start: 8, end: 8 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. first\n2. \n3. second');
    });

    it('splits an ordered item in the middle and renumbers following siblings', () => {
        const text = '1. first second\n2. next';
        const edit = planMarkdownEnterEdit(text, { start: 8, end: 8 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. first\n2. second\n3. next');
    });

    it('moves ordered body text into the inserted item when Enter is pressed at body start', () => {
        const text = '1. first\n2. second';
        const edit = planMarkdownEnterEdit(text, { start: 3, end: 3 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1.\n2. first\n3. second');
    });

    it('renumbers across a digit-width transition and preserves the parenthesis delimiter', () => {
        const text = '9) nine\n10) ten\n11) eleven';
        const edit = planMarkdownEnterEdit(text, { start: 7, end: 7 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('9) nine\n10) \n11) ten\n12) eleven');
    });

    it('preserves ordered-list indentation and post-marker spacing while renumbering', () => {
        const text = '  1.   one\n  2.   two';
        const edit = planMarkdownEnterEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('  1.   one\n  2.   \n  3.   two');
    });

    it('stops ordered Enter renumbering at the first intentional numbering jump', () => {
        const text = '1. one\n2. two\n8. eight\n9. nine';
        const edit = planMarkdownEnterEdit(text, { start: 6, end: 6 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. \n3. two\n8. eight\n9. nine');
    });

    it('renumbers across blank lines when Lezer keeps the items in one loose list', () => {
        const text = '1. one\n\n2. two';
        const edit = planMarkdownEnterEdit(text, { start: 6, end: 6 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. \n\n3. two');
    });

    it('does not renumber into a list that uses a different ordered delimiter', () => {
        const text = '1. one\n2) two';
        const edit = planMarkdownEnterEdit(text, { start: 6, end: 6 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. \n2) two');
    });

    it('renumbers only the active nested list level on ordered Enter', () => {
        const text = '1. outer\n   1. nested one\n   2. nested two\n2. after';
        const caret = text.indexOf('\n', text.indexOf('nested one'));
        const edit = planMarkdownEnterEdit(text, { start: caret, end: caret });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. outer\n   1. nested one\n   2. \n   3. nested two\n2. after');
    });

    it('keeps a nested subtree unchanged while renumbering later outer siblings', () => {
        const text = '1. one\n   1. nested\n2. two\n3. three';
        const edit = planMarkdownEnterEdit(text, { start: 6, end: 6 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. \n   1. nested\n3. two\n4. three');
    });

    it('continues and renumbers an ordered list inside a blockquote', () => {
        const text = '> 1. one\n> 2. two';
        const edit = planMarkdownEnterEdit(text, { start: 8, end: 8 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('> 1. one\n> 2. \n> 3. two');
    });

    it('continues an unordered list inside nested blockquotes', () => {
        const text = '> > - item';
        const edit = planMarkdownEnterEdit(text, { start: text.length, end: text.length });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('> > - item\n> > - ');
    });

    it('exits an empty ordered item while preserving its blockquote container', () => {
        const text = '> 1. one\n> 2. \n> 3. three';
        const edit = planMarkdownEnterEdit(text, { start: 14, end: 14 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('> 1. one\n> \n> 2. three');
    });

    it('continues explicit indentation on a multiline list continuation', () => {
        const text = '1. item\n   continuation';
        const edit = planMarkdownEnterEdit(text, { start: text.length, end: text.length });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. item\n   continuation\n   ');
    });

    it('leaves a lazy list continuation to the host newline behavior', () => {
        const text = '1. item\ncontinuation';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('continues the blockquote container on a multiline list continuation', () => {
        const text = '> 1. item\n> continuation';
        const edit = planMarkdownEnterEdit(text, { start: text.length, end: text.length });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('> 1. item\n> continuation\n> ');
    });

    it('removes an empty list marker to exit the list', () => {
        expect(planMarkdownEnterEdit('before\n\n  -   ', { start: 14, end: 14 })).toEqual({
            start: 8,
            end: 14,
            replacement: '',
            selectionStart: 8,
            selectionEnd: 8,
        });
    });

    it('exits a CommonMark empty unordered item without trailing whitespace', () => {
        expect(planMarkdownEnterEdit('-', { start: 1, end: 1 })).toEqual({
            start: 0,
            end: 1,
            replacement: '',
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    it('does not treat marker-like text without whitespace as a list item', () => {
        const text = '-not-a-list';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not treat an empty unordered marker as a list when it interrupts a paragraph', () => {
        const text = 'before\n  -   ';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('renumbers following ordered siblings when an empty middle item exits the list', () => {
        const text = '1. one\n2. \n3. three';
        const edit = planMarkdownEnterEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n\n2. three');
    });

    it('exits a single empty ordered item without creating another item', () => {
        expect(planMarkdownEnterEdit('1. ', { start: 3, end: 3 })).toEqual({
            start: 0,
            end: 3,
            replacement: '',
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    it('exits a CommonMark empty ordered item without trailing whitespace', () => {
        expect(planMarkdownEnterEdit('1.', { start: 2, end: 2 })).toEqual({
            start: 0,
            end: 2,
            replacement: '',
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    it('exits an empty ordered sibling, preserves loose-list spacing, and closes the numbering gap', () => {
        const text = '1. one\n2.\n\n3. three';
        const edit = planMarkdownEnterEdit(text, { start: 9, end: 9 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n\n\n2. three');
    });

    it('closes the numbering gap when the first empty ordered item exits', () => {
        const text = '1. \n2. two\n3. three';
        const edit = planMarkdownEnterEdit(text, { start: 3, end: 3 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('\n1. two\n2. three');
    });

    it('does not renumber past an intentional jump when an empty item exits', () => {
        const text = '1. one\n2. \n8. eight';
        const edit = planMarkdownEnterEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n\n8. eight');
    });

    it('does not apply Markdown shortcuts inside a fenced code block', () => {
        const text = '```ts\n- code\n```';
        expect(planMarkdownEnterEdit(text, { start: 12, end: 12 })).toBeNull();
        expect(planMarkdownBoldEdit(text, { start: 8, end: 12 })).toBeNull();
    });

    it('does not continue an indented code block that looks like an ordered list', () => {
        const text = '    1. code';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not continue an indented code block that looks like an unordered list', () => {
        const text = '    - code';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not continue code content nested inside a list item', () => {
        const text = '1.     code';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not continue unordered code content nested inside a list item', () => {
        const text = '-     code';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not continue a ten-digit ordered marker rejected by CommonMark', () => {
        const text = '1234567890. text';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not continue a non-one ordered marker that cannot interrupt a paragraph', () => {
        const text = 'paragraph\n2. item';

        expect(planMarkdownEnterEdit(text, { start: text.length, end: text.length })).toBeNull();
    });

    it('does not rewrite a selected range on Enter', () => {
        expect(planMarkdownEnterEdit('- first', { start: 2, end: 7 })).toBeNull();
    });

    it('clamps an out-of-range bold caret to the end of the text', () => {
        expect(planMarkdownBoldEdit('hello', { start: 99, end: 99 })).toEqual({
            start: 5,
            end: 5,
            replacement: '****',
            selectionStart: 7,
            selectionEnd: 7,
        });
    });

    it('removes an ordered marker as one unit when Backspace is pressed at the item body', () => {
        expect(planMarkdownBackspaceEdit('  12. item', { start: 6, end: 6 })).toEqual({
            start: 2,
            end: 6,
            replacement: '',
            selectionStart: 2,
            selectionEnd: 2,
        });
    });

    it('keeps a middle ordered item aligned while renumbering following siblings', () => {
        const text = '1. one\n2. two\n3. three';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(edit).toEqual({
            start: 7,
            end: 15,
            replacement: '   two\n2',
            selectionStart: 10,
            selectionEnd: 10,
        });
        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   two\n2. three');
    });

    it('joins an ordered-list continuation directly on the second Backspace', () => {
        const text = '1. one\n   two\n2. three';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(edit).toEqual({
            start: 6,
            end: 10,
            replacement: '',
            selectionStart: 6,
            selectionEnd: 6,
        });
        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. onetwo\n2. three');
    });

    it('renumbers outer siblings beyond an unchanged nested subtree', () => {
        const text = '1. one\n2. two\n   1. nested\n3. three\n4. four';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   two\n   1. nested\n2. three\n3. four');
    });

    it('renumbers a later sibling across a blank line in the same loose list', () => {
        const text = '1. one\n2. two\n\n3. three';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   two\n\n2. three');
    });

    it('stops marker-removal renumbering at a different ordered delimiter', () => {
        const text = '1. one\n2. two\n3) three\n4. four';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   two\n3) three\n4. four');
    });

    it('stops automatic renumbering at an intentional numbering jump', () => {
        const text = '1. one\n2. two\n8. eight\n9. nine';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   two\n8. eight\n9. nine');
    });

    it.each([
        {
            name: 'a parenthesis delimiter and three post-marker spaces',
            text: '1) one\n2)   two\n3) three',
            expected: '1) one\n     two\n2) three',
        },
        {
            name: 'a tab after the marker',
            text: '1. one\n2.\ttwo\n3. three',
            expected: '1. one\n    two\n2. three',
        },
        {
            name: 'outer indentation',
            text: '  1. one\n  2. two\n  3. three',
            expected: '  1. one\n     two\n  2. three',
        },
        {
            name: 'a 9 to 10 digit-width transition',
            text: '9. nine\n10. ten\n11. eleven',
            expected: '9. nine\n    ten\n10. eleven',
        },
        {
            name: 'a 99 to 100 digit-width transition',
            text: '99. ninety-nine\n100. hundred\n101. hundred-one',
            expected: '99. ninety-nine\n     hundred\n100. hundred-one',
        },
    ])('preserves the visual body column for $name', ({ text, expected }) => {
        const caret = text.indexOf(
            text.includes('hundred\n') ? 'hundred\n' : text.includes('ten\n') ? 'ten\n' : 'two',
        );
        const edit = planMarkdownBackspaceEdit(text, { start: caret, end: caret });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end)).toBe(expected);
    });

    it.each([1, 2, 3, 4])('uses CommonMark W + N alignment with %i post-marker spaces', (spaces) => {
        const text = `1. one\n2.${' '.repeat(spaces)}two\n3. three`;
        const caret = text.indexOf('two');
        const edit = planMarkdownBackspaceEdit(text, { start: caret, end: caret });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe(`1. one\n${' '.repeat(2 + spaces)}two\n2. three`);
    });

    it('keeps an empty middle item aligned and renumbers the following sibling', () => {
        const text = '1. one\n2. \n3. three';
        const edit = planMarkdownBackspaceEdit(text, { start: 10, end: 10 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n   \n2. three');
    });

    it('does not treat more than four post-marker spaces as the editable marker prefix', () => {
        const text = '1. one\n2.     two';
        const caret = text.indexOf('two');
        expect(planMarkdownBackspaceEdit(text, { start: caret, end: caret })).toBeNull();
    });

    it.each([
        { text: '1. one', expected: 'one' },
        { text: '1. one\n2. two', expected: 'one\n1. two' },
    ])('removes the first marker at its current list level', ({ text, expected }) => {
        const edit = planMarkdownBackspaceEdit(text, { start: 3, end: 3 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end)).toBe(expected);
    });

    it('removes an unordered marker as one unit but leaves indentation intact', () => {
        expect(planMarkdownBackspaceEdit('\t- item', { start: 3, end: 3 })).toEqual({
            start: 1,
            end: 3,
            replacement: '',
            selectionStart: 1,
            selectionEnd: 1,
        });
    });

    it('leaves ordinary Backspace and fenced code behavior to the host editor', () => {
        expect(planMarkdownBackspaceEdit('1. item', { start: 4, end: 4 })).toBeNull();
        expect(planMarkdownBackspaceEdit('```\n1. item\n```', { start: 7, end: 7 })).toBeNull();
        expect(planMarkdownBackspaceEdit('1. one\n\n   two', { start: 11, end: 11 })).toBeNull();
        expect(planMarkdownBackspaceEdit('1. one\n  two', { start: 9, end: 9 })).toBeNull();
        expect(planMarkdownBackspaceEdit('1. one\n2. two', { start: 7, end: 10 })).toBeNull();
    });

    it('renumbers the following contiguous ordered items when a complete middle line is deleted', () => {
        const text = '1. one\n2. two\n3. three\n4. four';
        const edit = planMarkdownOrderedListDeletionEdit(text, { start: 7, end: 14 });
        expect(edit).toEqual({
            start: 7,
            end: 24,
            replacement: '2. three\n3',
            selectionStart: 7,
            selectionEnd: 7,
        });
        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. three\n3. four');
    });

    it('renumbers once after deleting multiple complete sibling lines', () => {
        const text = '1. one\n2. two\n3. three\n4. four';
        const start = text.indexOf('2. two');
        const end = text.indexOf('4. four');
        const edit = planMarkdownOrderedListDeletionEdit(text, { start, end });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n2. four');
    });

    it('stops whole-line deletion renumbering at an intentional numbering jump', () => {
        const text = '1. one\n2. two\n8. eight\n9. nine';
        const edit = planMarkdownOrderedListDeletionEdit(text, { start: 7, end: 14 });

        expect(edit).toEqual({
            start: 7,
            end: 14,
            replacement: '',
            selectionStart: 7,
            selectionEnd: 7,
        });
        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('1. one\n8. eight\n9. nine');
    });

    it('keeps a nested subtree unchanged while whole-line deletion renumbers outer siblings', () => {
        const text = '5) five\n6) six\n   1) nested\n7) seven';
        const edit = planMarkdownOrderedListDeletionEdit(text, { start: 8, end: 15 });

        expect(text.slice(0, edit!.start) + edit!.replacement + text.slice(edit!.end))
            .toBe('5) five\n   1) nested\n6) seven');
    });

    it('does not renumber when the selection is not exactly one or more whole lines', () => {
        expect(planMarkdownOrderedListDeletionEdit('1. one\n2. two\n3. three', { start: 9, end: 12 })).toBeNull();
    });
});
