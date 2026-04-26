import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyImageBlobToClipboard } from '../../../../../src/drivers/content/clipboard/copyImageToClipboard';

describe('copyImageBlobToClipboard', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('writes a PNG blob with ClipboardItem when the async clipboard image API is available', async () => {
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        } as any);
        vi.stubGlobal('navigator', {
            clipboard: { write },
        } as any);
        vi.stubGlobal('window', {
            ClipboardItem: ClipboardItemStub,
        } as any);

        const blob = new Blob(['png'], { type: 'image/png' });
        const result = await copyImageBlobToClipboard(blob);

        expect(result).toEqual({ ok: true });
        expect(ClipboardItemStub).toHaveBeenCalledWith({ 'image/png': blob });
        expect(write).toHaveBeenCalledTimes(1);
    });

    it('returns unsupported when ClipboardItem or clipboard.write is unavailable', async () => {
        vi.stubGlobal('navigator', {} as any);
        vi.stubGlobal('window', {} as any);

        const result = await copyImageBlobToClipboard(new Blob(['png'], { type: 'image/png' }));

        expect(result).toEqual({ ok: false, reason: 'unsupported' });
    });

    it('returns invalid_blob for non-PNG blobs', async () => {
        const result = await copyImageBlobToClipboard(new Blob(['txt'], { type: 'text/plain' }));

        expect(result).toEqual({ ok: false, reason: 'invalid_blob' });
    });

    it('returns the underlying clipboard error details when image write is rejected', async () => {
        const error = new DOMException('The request is not allowed.', 'NotAllowedError');
        const write = vi.fn(async () => {
            throw error;
        });
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        } as any);
        vi.stubGlobal('navigator', {
            clipboard: { write },
        } as any);
        vi.stubGlobal('window', {
            ClipboardItem: ClipboardItemStub,
        } as any);

        const result = await copyImageBlobToClipboard(new Blob(['png'], { type: 'image/png' }));

        expect(result).toEqual({
            ok: false,
            reason: 'write_failed',
            errorName: 'NotAllowedError',
            errorMessage: 'The request is not allowed.',
        });
    });
});
