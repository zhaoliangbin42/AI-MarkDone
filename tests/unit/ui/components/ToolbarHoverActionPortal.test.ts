import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolbarHoverActionPortal } from '@/ui/content/components/ToolbarHoverActionPortal';

function rect(input: Partial<DOMRect>): DOMRect {
    const left = input.left ?? 0;
    const top = input.top ?? 0;
    const width = input.width ?? 0;
    const height = input.height ?? 0;
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: input.right ?? left + width,
        bottom: input.bottom ?? top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

describe('ToolbarHoverActionPortal', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('clamps multi-action hover menus inside the viewport right edge', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('toolbar-hover-actions')) return rect({ width: 360, height: 40 });
            return rect({ left: 760, top: 200, width: 40, height: 24 });
        });

        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const portal = new ToolbarHoverActionPortal('light');
        portal.open({
            anchorEl: anchor,
            actions: [
                { id: 'a', label: 'Copy as PNG', onClick: () => undefined },
                { id: 'b', label: 'Copy as SVG', onClick: () => undefined },
                { id: 'c', label: 'Save as PNG', onClick: () => undefined },
                { id: 'd', label: 'Save as SVG', onClick: () => undefined },
            ],
        });

        const host = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')!;
        expect(host.style.left).toBe('432px');
        expect(host.style.getPropertyValue('--aimd-toolbar-hover-anchor-x')).toBe('348px');
        expect(host.dataset.placement).toBe('top');
        portal.dispose();
    });

    it('clamps multi-action hover menus inside the viewport left edge', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('toolbar-hover-actions')) return rect({ width: 360, height: 40 });
            return rect({ left: 0, top: 200, width: 40, height: 24 });
        });

        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const portal = new ToolbarHoverActionPortal('light');
        portal.open({
            anchorEl: anchor,
            actions: [
                { id: 'a', label: 'Copy as PNG', onClick: () => undefined },
                { id: 'b', label: 'Copy as SVG', onClick: () => undefined },
                { id: 'c', label: 'Save as PNG', onClick: () => undefined },
                { id: 'd', label: 'Save as SVG', onClick: () => undefined },
            ],
        });

        const host = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')!;
        expect(host.style.left).toBe('8px');
        expect(host.style.getPropertyValue('--aimd-toolbar-hover-anchor-x')).toBe('12px');
        expect(host.dataset.placement).toBe('top');
        portal.dispose();
    });

    it('places the hover menu below the anchor when the top edge has no room', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('toolbar-hover-actions')) return rect({ width: 260, height: 44 });
            return rect({ left: 220, top: 12, width: 40, height: 28 });
        });

        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const portal = new ToolbarHoverActionPortal('light');
        portal.open({
            anchorEl: anchor,
            actions: [
                { id: 'a', label: 'Copy as PNG', onClick: () => undefined },
                { id: 'b', label: 'Copy as SVG', onClick: () => undefined },
            ],
        });

        const host = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')!;
        expect(host.style.top).toBe('40px');
        expect(host.dataset.placement).toBe('bottom');
        portal.dispose();
    });
});
