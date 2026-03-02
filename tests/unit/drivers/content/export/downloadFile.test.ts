import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../../../../src/drivers/content/export/downloadFile';

describe('downloadText', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('creates a Blob URL, triggers download, and revokes URL', () => {
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        downloadText({ filename: 'test.md', content: '# hi', mime: 'text/markdown;charset=utf-8' });

        expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');

        const anchor = appendSpy.mock.calls
            .map((call) => call[0])
            .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
        expect(anchor).toBeDefined();
        expect(anchor?.download).toBe('test.md');
    });
});

