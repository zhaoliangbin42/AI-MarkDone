import { describe, expect, it, vi } from 'vitest';
import { copySvgBlobToClipboard } from '@/drivers/content/clipboard/copySvgToClipboard';

describe('copySvgBlobToClipboard', () => {
    it('writes an SVG blob when async clipboard SVG support is available', async () => {
        const write = vi.fn(async () => undefined);
        class MockClipboardItem {
            static supports = vi.fn(() => true);
            constructor(public readonly data: Record<string, Blob>) {}
        }
        Object.assign(navigator, { clipboard: { write } });
        Object.assign(window, { ClipboardItem: MockClipboardItem });

        const blob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
        const result = await copySvgBlobToClipboard(blob);

        expect(result).toEqual({ ok: true });
        expect(MockClipboardItem.supports).toHaveBeenCalledWith('image/svg+xml');
        expect(write).toHaveBeenCalledTimes(1);
    });

    it('returns unsupported when ClipboardItem does not support SVG', async () => {
        class MockClipboardItem {
            static supports = vi.fn(() => false);
        }
        Object.assign(navigator, { clipboard: { write: vi.fn() } });
        Object.assign(window, { ClipboardItem: MockClipboardItem });

        const result = await copySvgBlobToClipboard(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }));

        expect(result).toEqual({ ok: false, reason: 'unsupported' });
    });
});
