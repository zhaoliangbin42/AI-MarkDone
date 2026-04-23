import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({
    toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

import { toBlob } from 'html-to-image';
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
