import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({
    toCanvas: vi.fn(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        return canvas;
    }),
}));

import { toCanvas } from 'html-to-image';
import { logger } from '../../../../../src/core/logger';
import { renderPngBlob } from '../../../../../src/drivers/content/export/renderPng';

const KATEX_CSS = `
@font-face{font-family:KaTeX_Main;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2")}
.katex{font-family:KaTeX_Main}
.katex-display > .katex > .katex-html > .tag{position:absolute;right:0}
`;

describe('renderPngBlob', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('katex.min.css')) return new Response(KATEX_CSS, { status: 200 });
            if (url.endsWith('KaTeX_Main-Regular.woff2')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
            return new Response('', { status: 404 });
        }));
        vi.stubGlobal('browser', {
            runtime: {
                getURL: (path: string) => `chrome-extension://aimd/${path}`,
            },
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillStyle: '',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
        } as any);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(callback: BlobCallback) {
            callback(new Blob(['png'], { type: 'image/png' }));
        });
        document.body.innerHTML = '';
    });

    it('renders a short PNG card with fixed width, pixel ratio, white background, and cleanup', async () => {
        const blob = await renderPngBlob({
            filename: 'message.png',
            html: '<div class="message-section"><img src="bad://image.png" alt="bad"></div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            imageTimeoutMs: 0,
        });

        expect(blob.type).toBe('image/png');
        expect(toCanvas).toHaveBeenCalledTimes(1);
        const [node, options] = vi.mocked(toCanvas).mock.calls[0];
        expect((node as HTMLElement).style.width).toBe('800px');
        expect(options).toMatchObject({
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            cacheBust: false,
            imagePlaceholder: expect.stringContaining('data:image/svg+xml'),
            fontEmbedCSS: '',
            skipAutoScale: true,
            includeStyleProperties: [],
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

        expect(vi.mocked(toCanvas).mock.calls[0][1]).toMatchObject({
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

    it('embeds KaTeX font CSS as data URLs when rendering formula content', async () => {
        await renderPngBlob({
            filename: 'formula.png',
            html: `
<span class="katex">
  <span class="katex-mathml">semantic-only</span>
  <span class="katex-html">visual-formula</span>
</span>`,
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });

        const options = vi.mocked(toCanvas).mock.calls[0][1] as any;
        const renderedNode = vi.mocked(toCanvas).mock.calls[0][0] as HTMLElement;
        const katexStyle = renderedNode.querySelector<HTMLStyleElement>('style[data-aimd-katex-export-css="1"]');
        expect(katexStyle?.textContent).toContain('.katex{font-family:KaTeX_Main}');
        expect(katexStyle?.textContent).toContain('data:font/woff2;base64');
        expect(katexStyle?.textContent).toContain('.katex-display > .katex > .katex-html > .tag');
        expect(renderedNode.textContent).toContain('visual-formula');
        expect(renderedNode.textContent).not.toContain('semantic-only');
        expect(options.fontEmbedCSS).toBe('');
    });

    it('does not load or embed KaTeX font CSS when content has no formula markup', async () => {
        const fetchMock = vi.mocked(fetch);

        await renderPngBlob({
            filename: 'plain.png',
            html: '<div>plain text</div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });

        const options = vi.mocked(toCanvas).mock.calls[0][1] as any;
        expect(options.fontEmbedCSS).toBe('');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('scales an oversized display formula into the configured export width', async () => {
        const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function clientWidth() {
            return (this as HTMLElement).classList.contains('katex-display') ? 600 : 800;
        });
        const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function scrollWidth() {
            return (this as HTMLElement).classList.contains('katex') ? 1200 : 800;
        });
        const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBounds() {
            const formula = (this as HTMLElement).classList.contains('katex');
            return {
                width: formula ? 1200 : 600,
                height: formula ? 100 : 50,
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: formula ? 1200 : 600,
                bottom: formula ? 100 : 50,
                toJSON: () => ({}),
            } as DOMRect;
        });

        await renderPngBlob({
            filename: 'wide-formula.png',
            html: '<div class="katex-display"><span class="katex"><span class="katex-html">wide</span></span></div>',
            width: 800,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
        });

        const renderedNode = vi.mocked(toCanvas).mock.calls[0][0] as HTMLElement;
        const display = renderedNode.querySelector<HTMLElement>('.katex-display')!;
        const formula = display.querySelector<HTMLElement>('.katex')!;
        expect(formula.style.transform).toBe('scale(0.5)');
        expect(formula.style.transformOrigin).toBe('top left');
        expect(display.style.height).toBe('50px');
        expect(display.style.overflow).toBe('hidden');
        expect(display.style.textAlign).toBe('left');

        clientWidth.mockRestore();
        scrollWidth.mockRestore();
        bounds.mockRestore();
    });

    it('caps pixel ratio by total pixel budget for very tall content', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(12000);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

        await renderPngBlob({
            filename: 'very-long-message.png',
            html: '<div>long</div>',
            width: 1200,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });

        expect(vi.mocked(toCanvas).mock.calls[0][1]).toMatchObject({
            pixelRatio: 1.291,
        });
        expect(warn).toHaveBeenCalledWith(
            '[AI-MarkDone][PNGExport] Export node exceeds safe canvas budget; pixel ratio was capped.',
            expect.objectContaining({
                requestedPixelRatio: 2,
                effectivePixelRatio: 1.291,
                capReason: 'pixel-area',
            }),
        );
        scrollHeight.mockRestore();
        warn.mockRestore();
    });

    it('reports render metrics when an onMetrics callback is provided', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(12000);
        const onMetrics = vi.fn();

        await renderPngBlob({
            filename: 'metrics.png',
            html: '<div>long</div>',
            width: 1200,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            onMetrics,
        });

        expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
            width: 1200,
            height: 12000,
            requestedPixelRatio: 2,
            effectivePixelRatio: 1.291,
            capReason: 'pixel-area',
            fontStatus: 'skipped',
        }));
        scrollHeight.mockRestore();
    });

    it('renders tall content as multiple block chunks without passing the full long DOM to each render', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(9000);
        const onMetrics = vi.fn();
        const html = `
<style>.reader-markdown p{margin:0}</style>
<div class="aimd-png-export-card">
  <section class="message-section">
    <div class="message-header">Header</div>
    <div class="assistant-response">
      <div class="assistant-response-label">Answer</div>
      <div class="reader-markdown markdown-body">
        <p>chunk-one-content</p>
        <p>chunk-two-content</p>
        <p>chunk-three-content</p>
      </div>
    </div>
  </section>
</div>`;
        vi.mocked(toCanvas).mockImplementation(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 1000;
            return canvas;
        });

        const blob = await renderPngBlob({
            filename: 'chunked.png',
            html,
            width: 800,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            onMetrics,
        });

        expect(blob.type).toBe('image/png');
        expect(toCanvas).toHaveBeenCalledTimes(3);
        const renderedHtml = vi.mocked(toCanvas).mock.calls.map((call) => (call[0] as HTMLElement).textContent || '');
        expect(renderedHtml[0]).toContain('chunk-one-content');
        expect(renderedHtml[0]).not.toContain('chunk-two-content');
        expect(renderedHtml[1]).toContain('chunk-two-content');
        expect(renderedHtml[1]).not.toContain('chunk-one-content');
        expect(renderedHtml[2]).toContain('chunk-three-content');
        expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
            strategy: 'chunked',
            chunkCount: 3,
            maxChunkHeight: 2000,
        }));
        scrollHeight.mockRestore();
    });

    it('keeps every selected message section when a unified document is chunked', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(9000);
        const html = `
<style>.reader-markdown p{margin:0}</style>
<div class="aimd-png-export-card">
  <section class="message-section">
    <div class="message-header">Message 1</div>
    <div class="assistant-response">
      <div class="reader-markdown">
        <p>first-section-answer</p>
        <p>first-section-continuation</p>
      </div>
    </div>
  </section>
  <section class="message-section">
    <div class="message-header">Message 2</div>
    <div class="assistant-response">
      <div class="reader-markdown"><p>second-section-answer</p></div>
    </div>
  </section>
</div>`;

        await renderPngBlob({
            filename: 'multi-message.png',
            html,
            width: 800,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
        });

        const renderedText = vi.mocked(toCanvas).mock.calls
            .map((call) => (call[0] as HTMLElement).textContent || '')
            .join('\n');
        expect(renderedText).toContain('first-section-answer');
        expect(renderedText).toContain('second-section-answer');
        scrollHeight.mockRestore();
    });

    it('starts chunk rendering once content exceeds the 2000px stability budget', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2500);
        const onMetrics = vi.fn();
        const html = `
<div class="aimd-png-export-card">
  <div class="reader-markdown markdown-body">
    <p>first-budget-chunk</p>
    <p>second-budget-chunk</p>
  </div>
</div>`;

        await renderPngBlob({
            filename: 'budget.png',
            html,
            width: 800,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            onMetrics,
        });

        expect(toCanvas).toHaveBeenCalledTimes(2);
        expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
            strategy: 'chunked',
            chunkCount: 2,
            maxChunkHeight: 2000,
        }));
        scrollHeight.mockRestore();
    });

    it('splits low-height chunks by DOM complexity without changing the height trigger', async () => {
        const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2500);
        const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
        const onMetrics = vi.fn();
        const denseSpans = Array.from({ length: 650 }, (_, index) => `<span class="token">token-${index}</span>`).join('');
        const html = `
<div class="aimd-png-export-card">
  <div class="reader-markdown markdown-body">
    <p>plain-start</p>
    <pre><code>${denseSpans}</code></pre>
    <p>plain-end</p>
  </div>
</div>`;

        await renderPngBlob({
            filename: 'complexity-budget.png',
            html,
            width: 800,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            onMetrics,
        });

        expect(toCanvas).toHaveBeenCalledTimes(3);
        const renderedHtml = vi.mocked(toCanvas).mock.calls.map((call) => (call[0] as HTMLElement).textContent || '');
        expect(renderedHtml[0]).toContain('plain-start');
        expect(renderedHtml[0]).not.toContain('token-0');
        expect(renderedHtml[1]).toContain('token-0');
        expect(renderedHtml[1]).toContain('token-649');
        expect(renderedHtml[1]).not.toContain('plain-end');
        expect(renderedHtml[2]).toContain('plain-end');
        expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({
            strategy: 'chunked',
            chunkCount: 3,
        }));
        scrollHeight.mockRestore();
        offsetHeight.mockRestore();
    });

    it('throws a useful error when html-to-image canvas rendering fails', async () => {
        vi.mocked(toCanvas).mockRejectedValueOnce(new Error('render-fail'));

        await expect(renderPngBlob({
            filename: 'message.png',
            html: '<div>hello</div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        })).rejects.toThrow('PNG export failed');
    });

    it('preserves abort errors instead of wrapping them as PNG export failures', async () => {
        const abort = new AbortController();
        abort.abort();

        await expect(renderPngBlob({
            filename: 'cancelled.png',
            html: '<div>cancelled</div>',
            width: 800,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            signal: abort.signal,
        })).rejects.toMatchObject({ name: 'AbortError' });
    });
});
