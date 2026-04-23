import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../../../../../src/drivers/content/export/downloadBlob';

describe('downloadBlob', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('creates a Blob URL, triggers download, and revokes URL', () => {
        const blob = new Blob(['png'], { type: 'image/png' });
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        downloadBlob({ filename: 'message.png', blob });

        expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');
        expect(document.querySelector('a')).toBeNull();
    });
});
