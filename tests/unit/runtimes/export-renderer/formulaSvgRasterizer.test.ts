import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rasterizeFormulaSvgToPngBlob } from '@/runtimes/export-renderer/formulaSvgRasterizer';

describe('formula SVG rasterizer capability', () => {
    const originalImage = globalThis.Image;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const canvasSizes: string[] = [];
    let drawImage: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => 'blob:formula-svg');
        URL.revokeObjectURL = vi.fn();
        drawImage = vi.fn();
        class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        (globalThis as any).Image = MockImage;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            clearRect: vi.fn(),
            drawImage,
        } as any);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback) {
            canvasSizes.push(`${this.width}x${this.height}`);
            callback(new Blob([`${this.width}x${this.height}`], { type: 'image/png' }));
        });
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        (globalThis as any).Image = originalImage;
        canvasSizes.length = 0;
        vi.restoreAllMocks();
    });

    it('rasterizes the shared SVG asset to PNG using the requested pixel ratio', async () => {
        const blob = await rasterizeFormulaSvgToPngBlob({
            svg: '<svg viewBox="0 0 72 36"></svg>',
            width: 72,
            height: 36,
            source: 'x+y',
            displayMode: false,
            fontSizePx: 36,
        }, { pixelRatio: 2 });

        expect(blob.type).toBe('image/png');
        expect(canvasSizes).toEqual(['144x72']);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:formula-svg');
        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(drawImage.mock.calls[0]?.slice(1)).toEqual([0, 0, 144, 72]);
    });

    it('caps the effective pixel ratio when a wide formula would exceed the canvas dimension limit', async () => {
        const blob = await rasterizeFormulaSvgToPngBlob({
            svg: '<svg viewBox="0 0 10000 100"></svg>',
            width: 10000,
            height: 100,
            source: 'wide',
            displayMode: true,
            fontSizePx: 36,
        }, { pixelRatio: 2 });

        expect(blob.type).toBe('image/png');
        expect(canvasSizes).toEqual(['16384x164']);
        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(drawImage.mock.calls[0]?.slice(1)).toEqual([0, 0, 16384, 164]);
    });

    it('caps the effective pixel ratio when a formula would exceed the canvas pixel-area budget', async () => {
        const blob = await rasterizeFormulaSvgToPngBlob({
            svg: '<svg viewBox="0 0 4000 4000"></svg>',
            width: 4000,
            height: 4000,
            source: 'area',
            displayMode: true,
            fontSizePx: 36,
        }, { pixelRatio: 2 });

        const [width, height] = canvasSizes[0]!.split('x').map(Number);
        expect(blob.type).toBe('image/png');
        expect(width * height).toBeLessThanOrEqual(24_000_000);
        expect(width).toBeLessThan(8000);
        expect(height).toBeLessThan(8000);
        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(drawImage.mock.calls[0]?.slice(1)).toEqual([0, 0, width, height]);
    });

    it('keeps an extreme wide formula as one complete scaled PNG when even 1x would exceed the canvas limit', async () => {
        const blob = await rasterizeFormulaSvgToPngBlob({
            svg: '<svg viewBox="0 0 100000 100"></svg>',
            width: 100000,
            height: 100,
            source: 'extreme',
            displayMode: true,
            fontSizePx: 36,
        }, { pixelRatio: 2 });

        expect(blob.type).toBe('image/png');
        expect(canvasSizes).toEqual(['16384x17']);
        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(drawImage.mock.calls[0]?.slice(1)).toEqual([0, 0, 16384, 17]);
    });
});
