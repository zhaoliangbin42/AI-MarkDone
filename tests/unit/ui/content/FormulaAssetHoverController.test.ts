import { afterEach, describe, expect, it, vi } from 'vitest';

let actionResolver: ((value: any) => void) | null = null;
vi.mock('@/services/math/formulaAssetActions', () => ({
    runFormulaAssetAction: vi.fn(() => new Promise((resolve) => {
        actionResolver = resolve;
    })),
}));

import { FormulaAssetHoverController } from '@/ui/content/controllers/FormulaAssetHoverController';
import { runFormulaAssetAction } from '@/services/math/formulaAssetActions';

const createController = () => new FormulaAssetHoverController({ runFormulaAssetAction });

describe('FormulaAssetHoverController', () => {
    afterEach(() => {
        document.querySelector('.aimd-toolbar-hover-action-host')?.remove();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('does not open formula asset actions by default', async () => {
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

        const controller = createController();
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();

        controller.disable();
        container.remove();
        vi.useRealTimers();
    });

    it('shows icon and compact format labels on formula hover and reuses the click source context', async () => {
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

        const controller = createController();
        controller.setFormulaSettings({
            clickCopyMarkdown: true,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 44,
            assetActions: {
                copyPng: true,
                copySvg: true,
                copyMathml: true,
                savePng: true,
                saveSvg: true,
            },
        });
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const buttons = Array.from(portalHost?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-role="toolbar-hover-action"]') ?? []);
        expect(buttons.map((button) => button.querySelector('.toolbar-hover-action__label')?.textContent)).toEqual([
            'PNG',
            'SVG',
            'MathML',
            'PNG',
            'SVG',
        ]);
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
            'Copy as PNG',
            'Copy as SVG',
            'Copy as MathML',
            'Save as PNG',
            'Save as SVG',
        ]);
        expect(buttons.map((button) => button.dataset.tooltip)).toEqual([
            'Copy as PNG',
            'Copy as SVG',
            'Copy as MathML',
            'Save as PNG',
            'Save as SVG',
        ]);
        expect(buttons.every((button) => button.querySelector('.aimd-icon'))).toBe(true);
        expect(buttons[0]?.classList.contains('toolbar-hover-action--icon-text')).toBe(true);

        buttons[1]?.click();
        await Promise.resolve();
        expect(runFormulaAssetAction).toHaveBeenCalledWith({
            action: 'copy_svg',
            source: {
                kind: 'tex',
                value: 'x_1 + y',
                confidence: 'authoritative',
            },
            displayMode: false,
            fontSizePx: 44,
            foregroundColor: expect.any(String),
        });
        actionResolver?.({ ok: true, status: 'copied' });
        await Promise.resolve();

        controller.disable();
        container.remove();
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

        const controller = createController();
        controller.setFormulaSettings({
            clickCopyMarkdown: true,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 36,
            assetActions: {
                copyPng: true,
                copySvg: true,
                copyMathml: true,
                savePng: true,
                saveSvg: true,
            },
        });
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
    });

    it('passes heuristic formula text to the DOM-only compatibility path', async () => {
        vi.useFakeTimers();
        const container = document.createElement('div');
        container.innerHTML = '<span class="katex-error">\\unknown{x}</span>';
        document.body.appendChild(container);
        const controller = createController();
        controller.setFormulaSettings({
            clickCopyMarkdown: true,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 36,
            assetActions: {
                copyPng: false,
                copySvg: true,
                copyMathml: false,
                savePng: false,
                saveSvg: false,
            },
        });
        controller.enable(container);

        const target = container.querySelector('.katex-error') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);
        document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')
            ?.shadowRoot
            ?.querySelector<HTMLButtonElement>('[data-action="copy_formula_svg"]')
            ?.click();
        await Promise.resolve();

        expect(runFormulaAssetAction).toHaveBeenCalledWith(expect.objectContaining({
            action: 'copy_svg',
            source: { kind: 'dom-only', sourceElement: target },
        }));
        actionResolver?.({ ok: false, code: 'SOURCE_UNAVAILABLE', message: 'Unavailable' });
        await Promise.resolve();
        controller.disable();
        container.remove();
    });

    it('filters hover actions through formula asset settings', async () => {
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

        const controller = createController();
        controller.setFormulaSettings({
            clickCopyMarkdown: true,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 36,
            assetActions: {
                copyPng: false,
                copySvg: true,
                copyMathml: false,
                savePng: false,
                saveSvg: true,
            },
        });
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const buttons = Array.from(portalHost?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-role="toolbar-hover-action"]') ?? []);
        expect(buttons.map((button) => button.querySelector('.toolbar-hover-action__label')?.textContent)).toEqual([
            'SVG',
            'SVG',
        ]);

        controller.disable();
        container.remove();
    });

    it('does not open the hover portal when all formula asset actions are disabled', async () => {
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

        const controller = createController();
        controller.setFormulaSettings({
            clickCopyMarkdown: true,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 36,
            assetActions: {
                copyPng: false,
                copySvg: false,
                copyMathml: false,
                savePng: false,
                saveSvg: false,
            },
        });
        controller.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);

        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();

        controller.disable();
        container.remove();
    });
});
