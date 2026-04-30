import { describe, expect, it, vi } from 'vitest';

let actionResolver: ((value: any) => void) | null = null;
vi.mock('@/services/math/formulaAssetActions', () => ({
    runFormulaAssetAction: vi.fn(() => new Promise((resolve) => {
        actionResolver = resolve;
    })),
}));

import { FormulaAssetHoverController } from '@/ui/content/controllers/FormulaAssetHoverController';
import { runFormulaAssetAction } from '@/services/math/formulaAssetActions';

describe('FormulaAssetHoverController', () => {
    it('shows four text formula asset actions on formula hover and reuses the click source context', async () => {
        vi.useFakeTimers();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="math-inline">
            <span class="katex">
              <annotation encoding="application/x-tex">x_1 + y</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const controller = new FormulaAssetHoverController();
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const buttons = Array.from(portalHost?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-role="toolbar-hover-action"]') ?? []);
        expect(buttons.map((button) => button.textContent)).toEqual([
            'Copy as PNG',
            'Copy as SVG',
            'Save as PNG',
            'Save as SVG',
        ]);

        buttons[1]?.click();
        await Promise.resolve();
        expect(runFormulaAssetAction).toHaveBeenCalledWith({
            action: 'copy_svg',
            source: 'x_1 + y',
            displayMode: false,
        });
        actionResolver?.({ ok: true, status: 'copied' });
        await Promise.resolve();

        controller.disable();
        container.remove();
        vi.useRealTimers();
    });

    it('guards formula asset actions while a render request is already pending', async () => {
        vi.useFakeTimers();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="math-inline">
            <span class="katex">
              <annotation encoding="application/x-tex">x_1 + y</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const controller = new FormulaAssetHoverController();
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const button = portalHost?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy_formula_png"]');
        button?.click();
        button?.click();
        await Promise.resolve();

        expect(runFormulaAssetAction).toHaveBeenCalledTimes(1);

        actionResolver?.({ ok: true, status: 'copied' });
        await Promise.resolve();
        controller.disable();
        container.remove();
        vi.useRealTimers();
    });
});
