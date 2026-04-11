import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderCommentPopover } from '@/ui/content/reader/ReaderCommentPopover';

function createHost(): { host: HTMLElement; shadow: ShadowRoot; container: HTMLElement } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.className = 'panel-window--reader';
    shadow.appendChild(container);
    Object.assign(container, {
        getBoundingClientRect: () => ({
            left: 20,
            top: 20,
            right: 620,
            bottom: 420,
            width: 600,
            height: 400,
            x: 20,
            y: 20,
            toJSON: () => ({}),
        }),
    });
    return { host, shadow, container };
}

describe('ReaderCommentPopover', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('anchors above the supplied selection rect instead of centering in the reader shell', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();

        popover.open({
            shadow,
            container,
            theme: 'light',
            mode: 'create',
            initialText: '',
            selectedSource: 'Before `code` and $x+y$ after',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
        } as any);

        const root = shadow.querySelector<HTMLElement>('.reader-comment-popover');
        expect(root).toBeTruthy();
        expect(root?.style.left).not.toBe('');
        expect(root?.dataset.side).toBe('top');
        expect(shadow.querySelector('.reader-comment-popover__close')?.className).toContain('icon-btn');
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Before `code` and $x+y$ after');
    });

    it('submits on Enter, keeps Shift+Enter as newline, and ignores composing Enter', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onSave = vi.fn();

        popover.open({
            shadow,
            container,
            theme: 'light',
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave,
        } as any);

        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        expect(input).toBeTruthy();

        input!.value = 'line 1';
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();

        input!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();
        input!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(onSave).toHaveBeenCalledWith('line 1');
    });
});
