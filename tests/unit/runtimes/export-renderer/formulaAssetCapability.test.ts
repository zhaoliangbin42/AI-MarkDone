import { beforeEach, describe, expect, it, vi } from 'vitest';

const svgAsset = {
    source: String.raw`\frac{1}{2}`,
    displayMode: true,
    fontSizePx: 40,
    width: 72,
    height: 36,
    viewBox: '0 0 72 36',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"></svg>',
};

vi.mock('@/runtimes/export-renderer/formulaMathJax', () => ({
    renderFormulaSvgAsset: vi.fn(async () => svgAsset),
    renderFormulaMathmlAsset: vi.fn(async () => ({
        source: svgAsset.source,
        displayMode: true,
        mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac /></math>',
    })),
}));

vi.mock('@/runtimes/export-renderer/formulaSvgRasterizer', () => ({
    rasterizeFormulaSvgToPng: vi.fn(async () => ({
        blob: {
            type: 'image/png',
            arrayBuffer: async () => new TextEncoder().encode('png-from-svg').buffer,
        } as Blob,
        widthPx: 144,
        heightPx: 72,
        effectivePixelRatio: 2,
    })),
}));

import { renderFormulaAssetCapability } from '@/runtimes/export-renderer/formulaAssetCapability';
import {
    renderFormulaMathmlAsset,
    renderFormulaSvgAsset,
} from '@/runtimes/export-renderer/formulaMathJax';
import { rasterizeFormulaSvgToPng } from '@/runtimes/export-renderer/formulaSvgRasterizer';

function createSink() {
    return {
        onProgress: vi.fn(),
        onArtifactStart: vi.fn(),
        onArtifactChunk: vi.fn(),
        onArtifactComplete: vi.fn(),
    };
}

const jobSpec = {
    source: svgAsset.source,
    displayMode: true,
    fontSizePx: 40,
    foregroundColor: 'rgb(12, 34, 56)',
};

describe('formula asset export-renderer capability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rasterizes authoritative PNG from the exact standalone SVG produced by MathJax', async () => {
        const sink = createSink();

        await renderFormulaAssetCapability({
            kind: 'formula-asset',
            spec: jobSpec,
            output: 'png',
        }, sink);

        expect(renderFormulaSvgAsset).toHaveBeenCalledOnce();
        expect(renderFormulaSvgAsset).toHaveBeenCalledWith(jobSpec);
        expect(rasterizeFormulaSvgToPng).toHaveBeenCalledOnce();
        expect(rasterizeFormulaSvgToPng).toHaveBeenCalledWith(svgAsset);
        expect(renderFormulaMathmlAsset).not.toHaveBeenCalled();
        expect(sink.onArtifactStart).toHaveBeenCalledWith({
            mimeType: 'image/png',
            widthPx: 144,
            heightPx: 72,
            effectivePixelRatio: 2,
            partNumber: 1,
            partCount: 1,
        });
        expect(sink.onArtifactChunk).toHaveBeenCalledWith(0, expect.any(ArrayBuffer));
        expect(sink.onArtifactComplete).toHaveBeenCalledOnce();
    });

    it('uses the same MathJax capability for standalone SVG and MathML without rasterizing either', async () => {
        const svgSink = createSink();
        const mathmlSink = createSink();

        await renderFormulaAssetCapability({
            kind: 'formula-asset',
            spec: jobSpec,
            output: 'svg',
        }, svgSink);
        await renderFormulaAssetCapability({
            kind: 'formula-asset',
            spec: jobSpec,
            output: 'mathml',
        }, mathmlSink);

        expect(renderFormulaSvgAsset).toHaveBeenCalledWith(jobSpec);
        expect(renderFormulaMathmlAsset).toHaveBeenCalledWith(jobSpec);
        expect(rasterizeFormulaSvgToPng).not.toHaveBeenCalled();
        expect(svgSink.onArtifactStart).toHaveBeenCalledWith({
            mimeType: 'image/svg+xml',
            widthPx: 72,
            heightPx: 36,
            partNumber: 1,
            partCount: 1,
        });
        expect(mathmlSink.onArtifactStart).toHaveBeenCalledWith({
            mimeType: 'application/mathml+xml',
            partNumber: 1,
            partCount: 1,
        });
    });
});
