import { beforeEach, describe, expect, it, vi } from 'vitest';
import { printPdf } from '../../../../../src/drivers/content/export/printPdf';

const KATEX_CSS = [
    '@font-face{font-family:KaTeX_Main;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2")}',
    '@font-face{font-family:KaTeX_Math;src:url(fonts/KaTeX_Math-Italic.woff2) format("woff2")}',
    '.katex{font-family:KaTeX_Main}',
].join('');

describe('printPdf', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        vi.useRealTimers();
        vi.stubGlobal('browser', {
            runtime: {
                getURL: (path: string) => `chrome-extension://aimd/${path}`,
            },
        });
    });

    function mockKatexFetch(): void {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.endsWith('katex.min.css')) return new Response(KATEX_CSS, { status: 200 });
            if (url.endsWith('.woff2')) return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 });
            return new Response('', { status: 404 });
        }));
    }

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
        expect(document.querySelector('link[href*="vendor/katex/katex.min.css"]')).toBeNull();

        window.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
    });

    it('embeds local KaTeX CSS and fonts before printing formula content', async () => {
        mockKatexFetch();
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        await printPdf({ html: '<span class="katex">x</span>' } as any);

        const style = document.querySelector<HTMLStyleElement>('style[data-aimd-katex-export-css="1"]');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('font-family:KaTeX_Main');
        expect(style?.textContent).toContain('data:font/woff2;base64');
        expect(document.querySelector('link[href*="vendor/katex/katex.min.css"]')).toBeNull();
        expect(printSpy).toHaveBeenCalledTimes(1);
    });

    it('waits for document fonts before printing formula content', async () => {
        mockKatexFetch();
        const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
            cb(0);
            return 0;
        });

        let resolveFonts!: () => void;
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                ready: new Promise<void>((resolve) => {
                    resolveFonts = resolve;
                }),
            },
        });

        const printPromise = printPdf({ html: '<span class="katex">x</span>' } as any);
        await Promise.resolve();
        expect(printSpy).not.toHaveBeenCalled();

        resolveFonts();
        await printPromise;
        expect(printSpy).toHaveBeenCalledTimes(1);
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
