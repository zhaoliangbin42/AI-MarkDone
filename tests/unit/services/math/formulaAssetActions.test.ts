import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/export/renderFormulaDomAsset', () => ({
    renderFormulaDomPngAsset: vi.fn(async () => ({
        blob: new Blob(['dom-png'], { type: 'image/png' }),
        widthPx: 20,
        heightPx: 10,
        effectivePixelRatio: 2,
    })),
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

vi.mock('@/services/export/exportRenderer', () => ({
    renderExportHostJob: vi.fn(async (job: any) => {
        const mimeType = job.output === 'png'
            ? 'image/png'
            : job.output === 'svg'
                ? 'image/svg+xml'
                : 'application/mathml+xml';
        const text = job.output === 'png'
            ? 'host-png'
            : job.output === 'svg'
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36" viewBox="0 0 72 36"></svg>'
                : '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
        return {
            artifacts: [{
                metadata: job.output === 'png'
                    ? {
                        mimeType,
                        widthPx: 144,
                        heightPx: 72,
                        effectivePixelRatio: 2,
                        partNumber: 1,
                        partCount: 1,
                    }
                    : { mimeType, widthPx: 72, heightPx: 36, partNumber: 1, partCount: 1 },
                chunks: [new TextEncoder().encode(text).buffer],
            }],
        };
    }),
}));

import { copyImageBlobToClipboard } from '@/drivers/content/clipboard/copyImageToClipboard';
import { copyMathmlToClipboard } from '@/drivers/content/clipboard/copyMathmlToClipboard';
import { copySvgBlobToClipboard } from '@/drivers/content/clipboard/copySvgToClipboard';
import { downloadBlob } from '@/drivers/content/export/downloadBlob';
import { renderFormulaDomPngAsset } from '@/drivers/content/export/renderFormulaDomAsset';
import { renderExportHostJob } from '@/services/export/exportRenderer';
import { runFormulaAssetAction } from '@/services/math/formulaAssetActions';

describe('formulaAssetActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes authoritative TeX PNG through the unified render host even when formula DOM is available', async () => {
        const result = await runFormulaAssetAction({
            action: 'copy_png',
            source: { kind: 'tex', value: String.raw`\frac{1}{2}`, confidence: 'authoritative' },
            displayMode: true,
            fontSizePx: 42,
        });

        expect(result).toEqual({ ok: true, status: 'copied' });
        expect(renderExportHostJob).toHaveBeenCalledWith({
            kind: 'formula-asset',
            spec: {
                source: String.raw`\frac{1}{2}`,
                displayMode: true,
                fontSizePx: 42,
                foregroundColor: '#000000',
            },
            output: 'png',
        }, expect.any(Object));
        expect(renderFormulaDomPngAsset).not.toHaveBeenCalled();
    });

    it('uses the DOM compatibility adapter only for dom-only PNG sources', async () => {
        const sourceElement = document.createElement('span');
        const result = await runFormulaAssetAction({
            action: 'save_png',
            source: { kind: 'dom-only', sourceElement },
            displayMode: false,
            fontSizePx: 38,
        });

        expect(result).toEqual({ ok: true, status: 'saved' });
        expect(renderFormulaDomPngAsset).toHaveBeenCalledWith({
            sourceElement,
            fontSizePx: 38,
            pixelRatio: undefined,
        });
        expect(renderExportHostJob).not.toHaveBeenCalled();
    });

    it('does not reinterpret a failed dom-only PNG capture as TeX', async () => {
        vi.mocked(renderFormulaDomPngAsset).mockRejectedValueOnce(new Error('DOM capture failed.'));
        const result = await runFormulaAssetAction({
            action: 'copy_png',
            source: { kind: 'dom-only', sourceElement: document.createElement('span') },
            displayMode: false,
        });

        expect(result).toEqual({
            ok: false,
            code: 'RENDER_FAILED',
            message: 'DOM capture failed.',
        });
        expect(renderExportHostJob).not.toHaveBeenCalled();
        expect(copyImageBlobToClipboard).not.toHaveBeenCalled();
    });

    it('returns stable SOURCE_UNAVAILABLE for dom-only SVG and MathML actions', async () => {
        const sourceElement = document.createElement('span');
        for (const action of ['copy_svg', 'save_svg', 'copy_mathml'] as const) {
            const result = await runFormulaAssetAction({
                action,
                source: { kind: 'dom-only', sourceElement },
                displayMode: false,
            });
            expect(result).toEqual({
                ok: false,
                code: 'SOURCE_UNAVAILABLE',
                message: 'Authoritative TeX source is unavailable for this formula.',
            });
        }

        expect(renderExportHostJob).not.toHaveBeenCalled();
        expect(copySvgBlobToClipboard).not.toHaveBeenCalled();
        expect(copyMathmlToClipboard).not.toHaveBeenCalled();
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('routes authoritative TeX SVG and MathML through the same unified render host', async () => {
        const source = { kind: 'tex', value: String.raw`\alpha+\beta`, confidence: 'authoritative' } as const;

        await runFormulaAssetAction({ action: 'copy_svg', source, displayMode: true, fontSizePx: 40 });
        await runFormulaAssetAction({ action: 'copy_mathml', source, displayMode: true, fontSizePx: 40 });
        await runFormulaAssetAction({ action: 'save_svg', source, displayMode: true, fontSizePx: 40 });

        expect(vi.mocked(renderExportHostJob).mock.calls.map((call) => call[0])).toEqual([
            expect.objectContaining({ kind: 'formula-asset', output: 'svg' }),
            expect.objectContaining({ kind: 'formula-asset', output: 'mathml' }),
            expect.objectContaining({ kind: 'formula-asset', output: 'svg' }),
        ]);
        expect(vi.mocked(renderExportHostJob).mock.calls.every(([job]: any[]) => (
            job.spec.source === source.value
            && job.spec.displayMode === true
            && job.spec.fontSizePx === 40
        ))).toBe(true);
        expect(copySvgBlobToClipboard).toHaveBeenCalledTimes(1);
        expect(copyMathmlToClipboard).toHaveBeenCalledTimes(1);
        expect(downloadBlob).toHaveBeenCalledWith({
            filename: 'AI-MarkDone-formula.svg',
            blob: expect.objectContaining({ type: 'image/svg+xml' }),
        });
    });

});
