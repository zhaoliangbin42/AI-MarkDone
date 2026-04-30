import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_FORMULA_FONT_SIZE_PX,
    __resetFormulaAssetRendererForTests,
    __setFormulaRendererTransportForTests,
    renderFormulaSvgAsset,
} from '@/services/math/formulaAssetRenderer';

describe('formulaAssetRenderer', () => {
    beforeEach(() => {
        __setFormulaRendererTransportForTests(async (request) => ({
            source: request.source,
            displayMode: request.displayMode,
            fontSizePx: request.fontSizePx,
            width: 72,
            height: 36,
            viewBox: '0 0 1000 500',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36" viewBox="0 0 1000 500"><g data-mml-node="math"></g></svg>',
        }));
    });

    afterEach(() => {
        __resetFormulaAssetRendererForTests();
    });

    it('renders LaTeX through MathJax SVG using a fixed 36px font size by default', async () => {
        const asset = await renderFormulaSvgAsset({
            source: String.raw`\frac{1}{2}`,
            displayMode: true,
        });

        expect(asset.source).toBe(String.raw`\frac{1}{2}`);
        expect(asset.displayMode).toBe(true);
        expect(asset.fontSizePx).toBe(DEFAULT_FORMULA_FONT_SIZE_PX);
        expect(asset.width).toBe(72);
        expect(asset.height).toBe(36);
        expect(asset.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(asset.svg).toContain('width="72"');
        expect(asset.svg).toContain('height="36"');
        expect(asset.svg).toContain('viewBox="0 0 1000 500"');
    });

    it('passes inline formulas to MathJax without display mode', async () => {
        const asset = await renderFormulaSvgAsset({
            source: 'x+y',
            displayMode: false,
            fontSizePx: 40,
        });

        expect(asset.displayMode).toBe(false);
        expect(asset.fontSizePx).toBe(40);
        expect(asset.svg).toContain('viewBox="0 0 1000 500"');
    });

    it('caches equal requests and reuses a single in-flight renderer request', async () => {
        const transport = vi.fn(async (request: any) => ({
            source: request.source,
            displayMode: request.displayMode,
            fontSizePx: request.fontSizePx,
            width: 72,
            height: 36,
            viewBox: '0 0 72 36',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36" viewBox="0 0 72 36"></svg>',
        }));
        __setFormulaRendererTransportForTests(transport);

        const first = renderFormulaSvgAsset({ source: 'x+y', displayMode: false });
        const second = renderFormulaSvgAsset({ source: 'x+y', displayMode: false });
        const [firstAsset, secondAsset] = await Promise.all([first, second]);
        const cachedAsset = await renderFormulaSvgAsset({ source: 'x+y', displayMode: false });

        expect(firstAsset).toEqual(secondAsset);
        expect(cachedAsset).toEqual(firstAsset);
        expect(transport).toHaveBeenCalledTimes(1);
    });

    it('reports renderer timeouts as render failures without caching them', async () => {
        vi.useFakeTimers();
        const transport = vi.fn(() => new Promise<any>(() => undefined));
        __setFormulaRendererTransportForTests(transport);

        const pending = expect(renderFormulaSvgAsset({ source: 'slow', displayMode: true, timeoutMs: 50 }))
            .rejects.toThrow('Formula renderer timed out.');
        await vi.advanceTimersByTimeAsync(50);
        await pending;

        expect(transport).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
