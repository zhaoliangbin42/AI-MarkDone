import { describe, expect, it, vi } from 'vitest';

import { TooltipDelegate, showEphemeralTooltip } from '@/utils/tooltip';

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
    it('does not allocate a mutation observer when title upgrading is disabled', () => {
        const OriginalMutationObserver = globalThis.MutationObserver;
        const constructors = vi.fn();
        class FakeMutationObserver {
            constructor() {
                constructors();
            }
            observe(): void {}
            disconnect(): void {}
        }
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        document.body.appendChild(host);

        try {
            const delegate = new TooltipDelegate(shadow, { upgradeTitles: false });
            expect(constructors).not.toHaveBeenCalled();
            delegate.disconnect();
        } finally {
            host.remove();
            vi.stubGlobal('MutationObserver', OriginalMutationObserver);
        }
    });

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

    it('resolves tooltip targets when hover starts from an inline svg child', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const target = createTarget({ left: 200, top: 200, width: 40, height: 40 });
        target.innerHTML = '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"></path></svg>';
        const path = target.querySelector('path')!;
        const delegate = new TooltipDelegate(document, { delayMs: 0 });

        path.dispatchEvent(new Event('pointerover', { bubbles: true }));
        vi.runAllTimers();
        await Promise.resolve();

        const tooltip = document.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip?.textContent).toContain('Sort by time');

        delegate.disconnect();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('renders label tooltips from shadow roots into the document feedback layer', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const target = document.createElement('button');
        target.dataset.tooltip = 'Copy markdown';
        shadow.appendChild(target);
        document.body.appendChild(host);
        vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
            x: 400,
            y: 220,
            left: 400,
            top: 220,
            width: 40,
            height: 32,
            right: 440,
            bottom: 252,
            toJSON: () => ({}),
        } as DOMRect);
        const delegate = new TooltipDelegate(shadow, { delayMs: 0, upgradeTitles: false });

        target.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        vi.runAllTimers();
        await Promise.resolve();

        expect(document.body.querySelector<HTMLElement>('.aimd-tooltip')?.textContent).toContain('Copy markdown');
        expect(shadow.querySelector('.aimd-tooltip')).toBeNull();
        const style = document.getElementById('aimd-shared-tooltip-style');
        expect(style?.textContent).toContain('background: var(--aimd-tooltip-bg);');
        expect(style?.textContent).not.toContain('--aimd-tooltip-bg:');
        expect(style?.textContent).not.toContain(':root[data-aimd-theme="light"]');

        delegate.disconnect();
        host.remove();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('honors explicit bottom placement for controls that open an upper hover surface', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const target = createTarget({ left: 320, top: 240, width: 40, height: 40 });
        target.dataset.tooltipPlacement = 'bottom';
        const delegate = new TooltipDelegate(document, { delayMs: 0 });

        target.dispatchEvent(new Event('pointerover', { bubbles: true }));
        vi.runAllTimers();
        await Promise.resolve();

        const tooltip = document.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip?.dataset.placement).toBe('bottom');
        expect(Number.parseFloat(tooltip?.style.top || '0')).toBeGreaterThanOrEqual(280);

        delegate.disconnect();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('keeps preview tooltips inside their shadow root', async () => {
        vi.useFakeTimers();
        window.innerWidth = 1440;
        window.innerHeight = 900;

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const target = document.createElement('button');
        target.dataset.tooltip = 'Long prompt preview';
        target.dataset.tooltipTitle = '2';
        target.dataset.tooltipVariant = 'preview';
        shadow.appendChild(target);
        document.body.appendChild(host);
        vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
            x: 500,
            y: 320,
            left: 500,
            top: 320,
            width: 40,
            height: 32,
            right: 540,
            bottom: 352,
            toJSON: () => ({}),
        } as DOMRect);
        const delegate = new TooltipDelegate(shadow, { delayMs: 0, upgradeTitles: false });

        target.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        vi.runAllTimers();
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.aimd-tooltip[data-variant="preview"]')?.textContent).toContain('Long prompt preview');
        expect(document.body.querySelector('.aimd-tooltip')).toBeNull();

        delegate.disconnect();
        host.remove();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('routes legacy ephemeral tooltip calls to top-level toast feedback', async () => {
        vi.useFakeTimers();
        const target = createTarget({ left: 200, top: 200, width: 40, height: 40 });

        showEphemeralTooltip({ anchor: target, text: 'Copied', durationMs: 3000 });

        expect(document.body.querySelector<HTMLElement>('.aimd-toast')?.textContent).toContain('Copied');
        expect(document.body.querySelector('.aimd-tooltip[data-variant="ephemeral"]')).toBeNull();

        vi.advanceTimersByTime(3000);
        await Promise.resolve();
        expect(document.body.querySelector('.aimd-toast')).toBeNull();

        document.body.innerHTML = '';
        vi.useRealTimers();
    });
});
