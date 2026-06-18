import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/export/renderFormulaPng', () => ({
    rasterizeFormulaSvgToPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

vi.mock('@/drivers/content/export/renderFormulaDomAsset', () => ({
    renderFormulaDomPngBlob: vi.fn(async () => new Blob(['dom-png'], { type: 'image/png' })),
    renderFormulaDomSvgBlob: vi.fn(async () => new Blob(['dom-svg'], { type: 'image/svg+xml' })),
}));

vi.mock('@/drivers/content/clipboard/copyImageToClipboard', () => ({
    copyImageBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/drivers/content/clipboard/copySvgToClipboard', () => ({
    copySvgBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/drivers/content/clipboard/copyMathmlToClipboard', () => ({
    copyMathmlToClipboard: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));

import { copyImageBlobToClipboard } from '@/drivers/content/clipboard/copyImageToClipboard';
import { copyMathmlToClipboard } from '@/drivers/content/clipboard/copyMathmlToClipboard';
import { copySvgBlobToClipboard } from '@/drivers/content/clipboard/copySvgToClipboard';
import { downloadBlob } from '@/drivers/content/export/downloadBlob';
import { renderFormulaDomPngBlob, renderFormulaDomSvgBlob } from '@/drivers/content/export/renderFormulaDomAsset';
import { rasterizeFormulaSvgToPngBlob } from '@/drivers/content/export/renderFormulaPng';
import {
    __resetFormulaAssetRendererForTests,
    __setFormulaMathmlRendererTransportForTests,
    __setFormulaRendererTransportForTests,
} from '@/services/math/formulaAssetRenderer';
import { runFormulaAssetAction } from '@/services/math/formulaAssetActions';

function blobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

describe('formulaAssetActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __setFormulaRendererTransportForTests(async (request) => ({
            source: request.source,
            displayMode: request.displayMode,
            fontSizePx: request.fontSizePx,
            width: 72,
            height: 36,
            viewBox: '0 0 72 36',
            svg: `<svg xmlns="http://www.w3.org/2000/svg" data-source="${request.source}" viewBox="0 0 72 36" width="72" height="36"></svg>`,
        }));
        __setFormulaMathmlRendererTransportForTests(async (request) => ({
            source: request.source,
            displayMode: request.displayMode,
            mathml: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${request.displayMode ? 'block' : 'inline'}"><mi>${request.source}</mi></math>`,
        }));
    });

    afterEach(() => {
        __resetFormulaAssetRendererForTests();
    });

    it('uses the same extracted LaTeX source for PNG and SVG copy/save actions', async () => {
        const source = String.raw`\alpha_1+\beta`;

        await runFormulaAssetAction({ action: 'copy_png', source, displayMode: true });
        await runFormulaAssetAction({ action: 'copy_svg', source, displayMode: true });
        await runFormulaAssetAction({ action: 'save_png', source, displayMode: true });
        await runFormulaAssetAction({ action: 'save_svg', source, displayMode: true });

        expect(vi.mocked(rasterizeFormulaSvgToPngBlob).mock.calls.map((call) => call[0].source)).toEqual([source, source]);
        expect(rasterizeFormulaSvgToPngBlob).toHaveBeenCalledTimes(2);
        expect(copyImageBlobToClipboard).toHaveBeenCalledTimes(1);
        expect(copySvgBlobToClipboard).toHaveBeenCalledTimes(1);
        expect(downloadBlob).toHaveBeenCalledWith({
            filename: 'AI-MarkDone-formula.png',
            blob: expect.any(Blob),
        });
        expect(downloadBlob).toHaveBeenCalledWith({
            filename: 'AI-MarkDone-formula.svg',
            blob: expect.any(Blob),
        });
    });

    it('uses captured formula DOM for PNG and SVG when a source element is available', async () => {
        const source = String.raw`\underbrace{x}_{中文}`;
        const sourceElement = document.createElement('span');

        await runFormulaAssetAction({ action: 'copy_png', source, displayMode: true, sourceElement, fontSizePx: 42 });
        await runFormulaAssetAction({ action: 'copy_svg', source, displayMode: true, sourceElement, fontSizePx: 42 });
        await runFormulaAssetAction({ action: 'save_png', source, displayMode: true, sourceElement, fontSizePx: 42 });
        await runFormulaAssetAction({ action: 'save_svg', source, displayMode: true, sourceElement, fontSizePx: 42 });

        expect(renderFormulaDomPngBlob).toHaveBeenCalledTimes(2);
        expect(renderFormulaDomPngBlob).toHaveBeenCalledWith({ sourceElement, fontSizePx: 42, pixelRatio: undefined });
        expect(renderFormulaDomSvgBlob).toHaveBeenCalledTimes(2);
        expect(renderFormulaDomSvgBlob).toHaveBeenCalledWith({ sourceElement, fontSizePx: 42 });
        expect(rasterizeFormulaSvgToPngBlob).not.toHaveBeenCalled();
        expect(copyImageBlobToClipboard).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/png' }));
        const copiedSvg = vi.mocked(copySvgBlobToClipboard).mock.calls.at(-1)?.[0];
        expect(copiedSvg ? await blobText(copiedSvg) : '').toBe('dom-svg');
    });

    it('falls back to the MathJax renderer when SVG formula DOM capture fails', async () => {
        const source = String.raw`\mathcal{A}`;
        const sourceElement = document.createElement('span');
        vi.mocked(renderFormulaDomSvgBlob).mockRejectedValueOnce(new Error('capture failed'));

        const result = await runFormulaAssetAction({ action: 'copy_svg', source, displayMode: false, sourceElement, fontSizePx: 38 });

        expect(result).toEqual({ ok: true, status: 'copied' });
        expect(renderFormulaDomSvgBlob).toHaveBeenCalledWith({ sourceElement, fontSizePx: 38 });
        const copiedSvg = vi.mocked(copySvgBlobToClipboard).mock.calls.at(-1)?.[0];
        expect(copiedSvg ? await blobText(copiedSvg) : '').toContain(`data-source="${source}"`);
    });

    it('falls back to the MathJax renderer when PNG formula DOM capture fails', async () => {
        const source = String.raw`\mathcal{A}`;
        const sourceElement = document.createElement('span');
        vi.mocked(renderFormulaDomPngBlob).mockRejectedValueOnce(new Error('capture failed'));

        const result = await runFormulaAssetAction({ action: 'copy_png', source, displayMode: false, sourceElement, fontSizePx: 38 });

        expect(result).toEqual({ ok: true, status: 'copied' });
        expect(renderFormulaDomPngBlob).toHaveBeenCalledWith({ sourceElement, fontSizePx: 38, pixelRatio: undefined });
        expect(rasterizeFormulaSvgToPngBlob).toHaveBeenCalledWith(
            expect.objectContaining({ source, fontSizePx: 38 }),
            { pixelRatio: undefined },
        );
    });

    it('copies MathML without rasterizing or changing the LaTeX source', async () => {
        const source = String.raw`\frac{x_1}{2}`;

        const result = await runFormulaAssetAction({ action: 'copy_mathml', source, displayMode: true });

        expect(result).toEqual({ ok: true, status: 'copied' });
        expect(copyMathmlToClipboard).toHaveBeenCalledWith(
            `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>${source}</mi></math>`,
        );
        expect(rasterizeFormulaSvgToPngBlob).not.toHaveBeenCalled();
        expect(copyImageBlobToClipboard).not.toHaveBeenCalled();
        expect(copySvgBlobToClipboard).not.toHaveBeenCalled();
    });
});
