import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentPromptPickerPopover } from '@/ui/content/components/CommentPromptPickerPopover';

describe('CommentPromptPickerPopover', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('positions from the viewport instead of being clamped by the small host container', () => {
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
                return { left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
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
        expect(popover).toBeTruthy();
        expect(Number.parseFloat(popover!.style.left)).toBeGreaterThan(80);
        expect(Number.parseFloat(popover!.style.top)).toBe(140);
    });
});
