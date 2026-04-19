import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommentTemplateSegment } from '@/services/reader/commentExport';
import { ReaderCommentTemplateEditor } from '@/ui/content/reader/ReaderCommentTemplateEditor';

function setCollapsedSelection(target: Node, offset: number): void {
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(target, offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
}

describe('ReaderCommentTemplateEditor', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.getSelection()?.removeAllRanges();
    });

    it('inserts token chips and reports stable token keys', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const onChange = vi.fn();
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [{ type: 'text', value: 'Hello ' }],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange,
        });

        const textNode = root.firstChild as Text;
        setCollapsedSelection(textNode, textNode.data.length);
        editor.insertToken('selected_source');
        editor.insertToken('user_comment');

        expect(root.querySelectorAll('[data-token-key]').length).toBe(2);
        expect(editor.getValue()).toEqual([
            { type: 'text', value: 'Hello ' },
            { type: 'token', key: 'selected_source' },
            { type: 'token', key: 'user_comment' },
        ] satisfies CommentTemplateSegment[]);
        expect(onChange).toHaveBeenCalled();
    });

    it('deletes adjacent tokens as whole chips on backspace', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const onChange = vi.fn();
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [
                { type: 'text', value: 'A ' },
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: ' B' },
            ],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange,
        });

        const trailingText = root.lastChild as Text;
        setCollapsedSelection(trailingText, 0);
        trailingText.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

        expect(root.querySelectorAll('[data-token-key]').length).toBe(0);
        expect(editor.getValue()).toEqual([
            { type: 'text', value: 'A  B' },
        ] satisfies CommentTemplateSegment[]);
        expect(onChange).toHaveBeenCalled();
    });

    it('does not rebuild the editor when update receives the same segments', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [{ type: 'text', value: 'Regarding\n' }],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange: vi.fn(),
        });

        const originalNode = root.firstChild;
        editor.update([{ type: 'text', value: 'Regarding\n' }]);

        expect(root.firstChild).toBe(originalNode);
    });

    it('serializes native contenteditable line breaks back into template text', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const onChange = vi.fn();
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [{ type: 'text', value: 'Regarding' }],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange,
        });

        root.innerHTML = 'Regarding<div>Next line</div>';
        root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }));

        expect(editor.getValue()).toEqual([
            { type: 'text', value: 'Regarding\nNext line' },
        ] satisfies CommentTemplateSegment[]);
        expect(onChange).toHaveBeenLastCalledWith([
            { type: 'text', value: 'Regarding\nNext line' },
        ] satisfies CommentTemplateSegment[]);
    });

    it('inserts a token at the remembered caret instead of jumping to the end on focus', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [{ type: 'text', value: 'Regarding' }],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange: vi.fn(),
        });

        const textNode = root.firstChild as Text;
        setCollapsedSelection(textNode, 4);
        root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));

        root.focus = () => {
            setCollapsedSelection(textNode, textNode.data.length);
        };

        editor.insertToken('selected_source');

        expect(editor.getValue()).toEqual([
            { type: 'text', value: 'Rega' },
            { type: 'token', key: 'selected_source' },
            { type: 'text', value: 'rding' },
        ] satisfies CommentTemplateSegment[]);
    });

    it('prefers composed shadow selection ranges when capturing the caret', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const root = document.createElement('div');
        shadow.appendChild(root);
        const editor = new ReaderCommentTemplateEditor({
            root,
            value: [{ type: 'text', value: 'Regarding' }],
            labels: {
                selected_source: 'Selected source',
                user_comment: 'User comment',
            },
            placeholder: 'Template',
            onChange: vi.fn(),
        });

        const textNode = root.firstChild as Text;
        const selection = {
            rangeCount: 0,
            getComposedRanges: () => [{
                startContainer: textNode,
                startOffset: 4,
                endContainer: textNode,
                endOffset: 4,
            }],
            removeAllRanges: vi.fn(),
            addRange: vi.fn(),
        } as unknown as Selection;
        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(selection);

        editor.rememberSelection();
        editor.insertToken('selected_source');

        expect(editor.getValue()).toEqual([
            { type: 'text', value: 'Rega' },
            { type: 'token', key: 'selected_source' },
            { type: 'text', value: 'rding' },
        ] satisfies CommentTemplateSegment[]);

        getSelectionSpy.mockRestore();
    });
});
