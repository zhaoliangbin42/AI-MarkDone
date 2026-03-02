import { beforeEach, describe, expect, it, vi } from 'vitest';
import { printPdf } from '../../../../../src/drivers/content/export/printPdf';

describe('printPdf', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('no-ops when plan html is empty', async () => {
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        await printPdf({ html: '' } as any);
        expect(printSpy).not.toHaveBeenCalled();
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('creates print container and cleans up on afterprint', async () => {
        vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await printPdf({ html: '<div>hello</div>' } as any);
        expect(document.getElementById('aimd-pdf-export-container')).not.toBeNull();

        window.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('cleans up by timeout when afterprint not fired', async () => {
        vi.useFakeTimers();
        vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await printPdf({ html: '<div>hello</div>' } as any);
        expect(document.getElementById('aimd-pdf-export-container')).not.toBeNull();

        vi.advanceTimersByTime(30000);
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('cleans up when print throws', async () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });
        vi.spyOn(window, 'print').mockImplementation(() => {
            throw new Error('print-fail');
        });

        await printPdf({ html: '<div>hello</div>' } as any);
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });
});

