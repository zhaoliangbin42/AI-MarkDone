import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

import { toBlob } from 'html-to-image';
import { logger } from '../../../../../src/core/logger';
import { renderPngBlob } from '../../../../../src/drivers/content/export/renderPng';

describe('renderPngBlob', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('renders an offscreen PNG card with fixed width, pixel ratio, white background, and cleanup', async () => {
        const blob = await renderPngBlob({
            filename: 'message.png',
            html: '<div class="message-section"><img src="bad://image.png" alt="bad"></div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            imageTimeoutMs: 0,
        });

        expect(blob.type).toBe('image/png');
        expect(toBlob).toHaveBeenCalledTimes(1);
        const [node, options] = vi.mocked(toBlob).mock.calls[0];
        expect((node as HTMLElement).style.width).toBe('800px');
        expect(options).toMatchObject({
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            cacheBust: true,
            imagePlaceholder: expect.stringContaining('data:image/svg+xml'),
            fontEmbedCSS: '',
        });
        expect(document.getElementById('aimd-png-export-root')).toBeNull();
    });

    it('caps pixel ratio before rendering when long content would exceed the safe canvas dimension', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(10000);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

        await renderPngBlob({
            filename: 'long-message.png',
            html: '<div>long</div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });

        expect(vi.mocked(toBlob).mock.calls[0][1]).toMatchObject({
            pixelRatio: 1.6384,
        });
        expect(warn).toHaveBeenCalledWith(
            '[AI-MarkDone][PNGExport] Export node exceeds safe canvas dimension; pixel ratio was capped.',
            expect.objectContaining({
                requestedPixelRatio: 2,
                effectivePixelRatio: 1.6384,
                canvasDimensionLimit: 16384,
            }),
        );
        scrollHeight.mockRestore();
        warn.mockRestore();
    });

    it('throws a useful error when html-to-image returns null', async () => {
        vi.mocked(toBlob).mockResolvedValueOnce(null);

        await expect(renderPngBlob({
            filename: 'message.png',
            html: '<div>hello</div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        })).rejects.toThrow('PNG export failed');
    });
});
