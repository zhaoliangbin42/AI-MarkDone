import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rasterizeFormulaSvgToPngBlob } from '@/drivers/content/export/renderFormulaPng';

describe('rasterizeFormulaSvgToPngBlob', () => {
    const originalImage = globalThis.Image;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const canvasSizes: string[] = [];

    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => 'blob:formula-svg');
        URL.revokeObjectURL = vi.fn();
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
            drawImage: vi.fn(),
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
    });
});
