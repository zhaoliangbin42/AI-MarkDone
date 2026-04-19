import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentPromptPickerPopover } from '@/ui/content/components/CommentPromptPickerPopover';

describe('CommentPromptPickerPopover', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('positions relative to the local container when opened as an anchored picker', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        container.appendChild(anchor);
        shadow.appendChild(container);

        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
            if (this.classList.contains('comment-prompt-picker')) {
                return { left: 0, top: 0, width: 420, height: 280, right: 420, bottom: 280, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
            }
            if (this === anchor) {
                return { left: 300, top: 100, width: 32, height: 32, right: 332, bottom: 132, x: 300, y: 100, toJSON: () => ({}) } as DOMRect;
            }
            if (this === container) {
                return { left: 220, top: 40, width: 500, height: 360, right: 720, bottom: 400, x: 220, y: 40, toJSON: () => ({}) } as DOMRect;
            }
            return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        });

        const picker = new CommentPromptPickerPopover();
        picker.open({
            shadow,
            container,
            anchorEl: anchor,
            theme: 'light',
            prompts: [{ id: 'p1', title: 'Prompt', content: 'Please revise.' }],
            labels: {
                title: 'Choose prompt',
                close: 'Close',
                empty: 'No prompts available.',
            },
            onSelect: vi.fn(),
        });

        const popover = container.querySelector<HTMLElement>('.comment-prompt-picker');
        const layer = container.querySelector<HTMLElement>('.comment-prompt-picker-layer');
        expect(popover).toBeTruthy();
        expect(layer).toBeTruthy();
        expect(layer?.dataset.placement).toBe('anchor');
        expect(Number.parseFloat(popover!.style.left)).toBe(12);
        expect(Number.parseFloat(popover!.style.top)).toBe(12);
    });

    it('can center itself in the viewport for dialog-like flows', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        container.appendChild(anchor);
        shadow.appendChild(container);

        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });

        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
            if (this.classList.contains('comment-prompt-picker')) {
                return { left: 0, top: 0, width: 420, height: 280, right: 420, bottom: 280, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
            }
            if (this === anchor) {
                return { left: 900, top: 40, width: 32, height: 32, right: 932, bottom: 72, x: 900, y: 40, toJSON: () => ({}) } as DOMRect;
            }
            return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        });

        const picker = new CommentPromptPickerPopover();
        picker.open({
            shadow,
            container,
            anchorEl: anchor,
            theme: 'light',
            prompts: [{ id: 'p1', title: 'Prompt', content: 'Please revise.' }],
            labels: {
                title: 'Choose prompt',
                close: 'Close',
                empty: 'No prompts available.',
            },
            placement: 'center',
            onSelect: vi.fn(),
        });

        const popover = container.querySelector<HTMLElement>('.comment-prompt-picker');
        const layer = container.querySelector<HTMLElement>('.comment-prompt-picker-layer');
        expect(popover).toBeTruthy();
        expect(layer?.dataset.placement).toBe('center');
        expect(Number.parseFloat(popover!.style.left)).toBe(430);
        expect(Number.parseFloat(popover!.style.top)).toBe(220);
    });
});
