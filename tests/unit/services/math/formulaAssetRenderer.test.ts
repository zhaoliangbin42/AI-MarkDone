import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/export/exportRenderer', () => ({
    renderExportHostJob: vi.fn(async (job: any) => {
        const text = job.output === 'svg'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36" viewBox="0 0 1000 500"><g data-mml-node="math"></g></svg>'
            : '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
        return {
            artifacts: [{
                metadata: job.output === 'svg'
                    ? { mimeType: 'image/svg+xml', widthPx: 72, heightPx: 36, partNumber: 1, partCount: 1 }
                    : { mimeType: 'application/mathml+xml', partNumber: 1, partCount: 1 },
                chunks: [new TextEncoder().encode(text).buffer],
            }],
        };
    }),
}));

import { renderExportHostJob } from '@/services/export/exportRenderer';
import {
    DEFAULT_FORMULA_FONT_SIZE_PX,
    renderFormulaMathmlAsset,
    renderFormulaSvgAsset,
} from '@/services/math/formulaAssetRenderer';

describe('formulaAssetRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes the SVG compatibility facade through the unified export render host', async () => {
        const asset = await renderFormulaSvgAsset({
            source: 'x+y',
            displayMode: false,
            fontSizePx: 40,
            foregroundColor: 'rgb(23, 23, 23)',
        });

        expect(renderExportHostJob).toHaveBeenCalledWith({
            kind: 'formula-asset',
            spec: {
                source: 'x+y',
                displayMode: false,
                fontSizePx: 40,
                foregroundColor: 'rgb(23, 23, 23)',
            },
            output: 'svg',
        }, expect.objectContaining({ timeoutMs: 8000 }));
        expect(asset).toMatchObject({
            source: 'x+y',
            displayMode: false,
            fontSizePx: 40,
            width: 72,
            height: 36,
            viewBox: '0 0 1000 500',
        });
    });

    it('routes MathML through the same host and preserves the default font contract', async () => {
        const asset = await renderFormulaMathmlAsset({ source: String.raw`\frac{x}{2}`, displayMode: true });

        expect(renderExportHostJob).toHaveBeenCalledWith(expect.objectContaining({
            kind: 'formula-asset',
            output: 'mathml',
            spec: expect.objectContaining({
                source: String.raw`\frac{x}{2}`,
                displayMode: true,
                fontSizePx: DEFAULT_FORMULA_FONT_SIZE_PX,
            }),
        }), expect.any(Object));
        expect(asset.mathml).toContain('<math');
    });

    it('rejects empty formula source before creating a renderer job', async () => {
        await expect(renderFormulaSvgAsset({ source: '   ', displayMode: false })).rejects.toThrow('Formula source is empty.');
        expect(renderExportHostJob).not.toHaveBeenCalled();
    });
});
