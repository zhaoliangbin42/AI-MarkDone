import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/targetSurface', () => ({
    TARGET_SURFACE_SPONSOR_TAB_ENABLED: false,
    TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED: false,
    TARGET_SURFACE_BINARY_CLIPBOARD_COPY_ACTIONS_ENABLED: false,
    targetSurfacePolicy: {
        sponsorTab: false,
        socialFollowCard: false,
        binaryClipboardCopyActions: false,
    },
}));

vi.mock('@/services/math/formulaAssetActions', () => ({
    runFormulaAssetAction: vi.fn(async () => ({ ok: true, status: 'copied' })),
}));

import { FormulaAssetHoverController } from '@/ui/content/controllers/FormulaAssetHoverController';

describe('FormulaAssetHoverController Safari surface policy', () => {
    it('hides binary PNG and SVG copy actions while keeping MathML copy and save actions', async () => {
        vi.useFakeTimers();
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any);
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
        const buttons = Array.from(portalHost?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-role="toolbar-hover-action"]') ?? []);

        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
            'Copy as MathML',
            'Save as PNG',
            'Save as SVG',
        ]);
        expect(buttons.map((button) => button.querySelector('.toolbar-hover-action__label')?.textContent ?? button.textContent?.trim())).toEqual([
            'MathML',
            'PNG',
            'SVG',
        ]);
        expect(portalHost?.shadowRoot?.querySelector('[data-action="copy_formula_png"]')).toBeNull();
        expect(portalHost?.shadowRoot?.querySelector('[data-action="copy_formula_svg"]')).toBeNull();

        controller.disable();
        container.remove();
        window.matchMedia = originalMatchMedia;
        vi.useRealTimers();
    });
});
