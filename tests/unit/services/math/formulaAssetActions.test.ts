import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/export/renderFormulaPng', () => ({
    rasterizeFormulaSvgToPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

vi.mock('@/drivers/content/clipboard/copyImageToClipboard', () => ({
    copyImageBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/drivers/content/clipboard/copySvgToClipboard', () => ({
    copySvgBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));

import { copyImageBlobToClipboard } from '@/drivers/content/clipboard/copyImageToClipboard';
import { copySvgBlobToClipboard } from '@/drivers/content/clipboard/copySvgToClipboard';
import { downloadBlob } from '@/drivers/content/export/downloadBlob';
import { rasterizeFormulaSvgToPngBlob } from '@/drivers/content/export/renderFormulaPng';
import { __resetFormulaAssetRendererForTests, __setFormulaRendererTransportForTests } from '@/services/math/formulaAssetRenderer';
import { runFormulaAssetAction } from '@/services/math/formulaAssetActions';

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
});
