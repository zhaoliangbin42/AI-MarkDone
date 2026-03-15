import { describe, expect, it, vi } from 'vitest';

import { TooltipDelegate } from '@/utils/tooltip';

function createTarget(rect: Partial<DOMRect>): HTMLButtonElement {
    const root = document.createElement('div');
    const target = document.createElement('button');
    target.dataset.tooltip = 'Sort by time';
    root.appendChild(target);
    document.body.appendChild(root);

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        width: rect.width ?? 32,
        height: rect.height ?? 32,
        right: rect.right ?? ((rect.left ?? 0) + (rect.width ?? 32)),
        bottom: rect.bottom ?? ((rect.top ?? 0) + (rect.height ?? 32)),
        toJSON: () => ({}),
    } as DOMRect);

    return target;
}

describe('TooltipDelegate', () => {
    it('anchors tooltips above the target instead of pinning them to the pointer position', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const target = createTarget({ left: 320, top: 240, width: 40, height: 40 });
        const delegate = new TooltipDelegate(document, { delayMs: 0 });

        target.dispatchEvent(new Event('pointerover', { bubbles: true }));
        vi.runAllTimers();
        await Promise.resolve();

        const tooltip = document.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip?.style.left).toBe('340px');
        expect(Number.parseFloat(tooltip?.style.top || '0')).toBeLessThan(240);

        delegate.disconnect();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('flips tooltips below the target when there is not enough room above it', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const target = createTarget({ left: 120, top: 8, width: 40, height: 40 });
        const delegate = new TooltipDelegate(document, { delayMs: 0 });

        target.dispatchEvent(new Event('pointerover', { bubbles: true }));
        vi.runAllTimers();
        await Promise.resolve();

        const tooltip = document.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip).toBeTruthy();
        expect(Number.parseFloat(tooltip?.style.top || '0')).toBeGreaterThanOrEqual(48);

        delegate.disconnect();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });
});
