import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderCommentPopover } from '@/ui/content/reader/ReaderCommentPopover';
import { createAppearanceSnapshot } from '@/style/appearance';

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
            appearance: createAppearanceSnapshot('light'),
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
        expect(shadow.querySelector('[data-action="cancel"]')?.className).toContain('secondary-btn');
        expect(shadow.querySelector('[data-action="save"]')?.className).toContain('secondary-btn--primary');
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Before `code` and $x+y$ after');
    });

    it('submits on Enter, keeps Shift+Enter as newline, and ignores composing Enter', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onSave = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
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

    it('uses Delete in edit mode and routes it through onDelete instead of cancel', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onDelete = vi.fn();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'edit',
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
            onSave: vi.fn(),
            onDelete,
            onCancel,
        } as any);

        const secondaryAction = shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]');
        expect(secondaryAction?.textContent).toBe('Delete');

        secondaryAction?.click();

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('uses an anchored Surface session for browser-like outside dismissal and focus return', () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
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
            onSave: vi.fn(),
            onCancel,
        } as any);

        const surface = shadow.querySelector<HTMLElement>('.reader-comment-popover');
        expect(surface?.dataset.aimdSurfaceProfile).toBe('anchored');
        expect(surface?.dataset.aimdRole).toBe('reader-comment-popover');

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(popover.isOpen()).toBe(true);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(popover.isOpen()).toBe(false);
        expect(surface?.dataset.motionState).toBe('closing');

        surface?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.activeElement).toBe(opener);
        expect(shadow.querySelector('.reader-comment-popover')).toBeNull();
    });

    it('keeps Escape inside an active IME composition and closes after composition ends', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
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
            onSave: vi.fn(),
            onCancel,
        });

        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        const composingEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        Object.defineProperty(composingEscape, 'isComposing', { value: false });
        input.dispatchEvent(composingEscape);
        expect(popover.isOpen()).toBe(true);
        expect(onCancel).not.toHaveBeenCalled();

        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        Object.defineProperty(escape, 'isComposing', { value: false });
        input.dispatchEvent(escape);
        expect(popover.isOpen()).toBe(false);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('resets IME state between annotation sessions', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const open = (onCancel: () => void) => popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
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
            onSave: vi.fn(),
            onCancel,
        });

        open(vi.fn());
        shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!
            .dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        popover.close(shadow, false);

        const onCancel = vi.fn();
        open(onCancel);
        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

        expect(popover.isOpen()).toBe(false);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('updates active appearance and destroys all lifecycle work synchronously', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
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
            onSave: vi.fn(),
            onCancel,
        });

        popover.setAppearance(createAppearanceSnapshot('dark', { accentColor: '#2563eb' }));
        expect(shadow.querySelector('.reader-comment-popover')?.getAttribute('data-aimd-theme')).toBe('dark');

        popover.destroy();
        expect(popover.isOpen()).toBe(false);
        expect(shadow.querySelector('.reader-comment-popover')).toBeNull();

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(onCancel).not.toHaveBeenCalled();
    });
});
