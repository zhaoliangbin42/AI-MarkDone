import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const toCanvas = vi.fn(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 144;
        canvas.height = 72;
        canvas.toBlob = (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' }));
        return canvas;
    });
    const getKatexCssWithEmbeddedFonts = vi.fn(async () => ({
        mode: 'data-url' as const,
        css: '@font-face{font-family:KaTeX_Main;src:url("data:font/woff2;base64,AA==")}.katex{font-family:KaTeX_Main}',
    }));
    return { getKatexCssWithEmbeddedFonts, toCanvas };
});

vi.mock('html-to-image', () => ({
    toCanvas: mocks.toCanvas,
}));

vi.mock('@/core/export/katexAssets', () => ({
    getKatexCssWithEmbeddedFonts: mocks.getKatexCssWithEmbeddedFonts,
}));

import {
    renderFormulaDomPngAsset,
    type FormulaDomCaptureOptions,
} from '@/drivers/content/export/renderFormulaDomAsset';

async function renderFormulaDomPngBlob(options: FormulaDomCaptureOptions): Promise<Blob> {
    return (await renderFormulaDomPngAsset(options)).blob;
}

describe('renderFormulaDomAsset', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('captures a KaTeX display formula as PNG with embedded fonts, configured font size, text, and nested SVG intact', async () => {
        const source = document.createElement('div');
        source.className = 'katex-display';
        source.innerHTML = '<span class="katex"><span class="base">中文</span><svg data-glyph="brace"></svg></span>';
        document.body.append(source);

        const blob = await renderFormulaDomPngBlob({ sourceElement: source.querySelector('.katex'), fontSizePx: 40 });

        expect(blob.type).toBe('image/png');
        expect(mocks.getKatexCssWithEmbeddedFonts).toHaveBeenCalledWith(expect.stringContaining('data-glyph="brace"'));
        const [node, options] = mocks.toCanvas.mock.calls[0]!;
        const clone = (node as HTMLElement).firstElementChild as HTMLElement;
        expect(clone.classList.contains('katex-display')).toBe(true);
        expect(clone.style.fontSize).toBe('40px');
        expect(clone.innerHTML).toContain('中文');
        expect(clone.innerHTML).toContain('data-glyph="brace"');
        expect((node as HTMLElement).parentElement?.querySelector('style')?.textContent).toContain('KaTeX_Main');
        expect(options).toMatchObject({
            cacheBust: false,
            fontEmbedCSS: '',
            skipAutoScale: true,
            includeStyleProperties: [],
        });
    });

    it('captures PNG through the same isolated DOM node with the safe single-canvas pixel ratio', async () => {
        const source = document.createElement('span');
        source.className = 'math-inline';
        source.innerHTML = '<span class="katex">x+y</span>';
        document.body.append(source);

        const blob = await renderFormulaDomPngBlob({ sourceElement: source, fontSizePx: 36, pixelRatio: 2 });

        expect(blob.type).toBe('image/png');
        const [node, options] = mocks.toCanvas.mock.calls[0]!;
        const clone = (node as HTMLElement).firstElementChild as HTMLElement;
        expect(clone.classList.contains('math-inline')).toBe(true);
        expect(clone.style.fontSize).toBe('36px');
        expect(options).toMatchObject({
            cacheBust: false,
            fontEmbedCSS: '',
            pixelRatio: 2,
        });
    });

    it('falls back to a reduced effective pixel ratio for oversized DOM captures without slicing', async () => {
        const source = document.createElement('span');
        source.className = 'math-inline';
        source.innerHTML = '<span class="katex">wide</span>';
        document.body.append(source);
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
            if ((this as HTMLElement).classList.contains('math-inline')) {
                return {
                    width: 12000,
                    height: 200,
                    x: 0,
                    y: 0,
                    top: 0,
                    left: 0,
                    right: 12000,
                    bottom: 200,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return originalGetBoundingClientRect.call(this);
        };

        try {
            await renderFormulaDomPngBlob({ sourceElement: source, fontSizePx: 36, pixelRatio: 2 });
        } finally {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        }

        expect(mocks.toCanvas.mock.calls[0]?.[1]?.pixelRatio).toBeLessThan(2);
        expect(mocks.toCanvas).toHaveBeenCalledTimes(1);
    });

    it('sizes the capture frame from the full visual DOM bounds so overflow is not clipped', async () => {
        const source = document.createElement('span');
        source.className = 'math-inline';
        source.innerHTML = '<span class="katex"><span class="base">x</span><span class="accent">wide</span></span>';
        document.body.append(source);
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
            if ((this as HTMLElement).classList.contains('math-inline')) {
                return {
                    width: 100,
                    height: 40,
                    x: -100000,
                    y: 0,
                    top: 0,
                    left: -100000,
                    right: -99900,
                    bottom: 40,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if ((this as HTMLElement).classList.contains('accent')) {
                return {
                    width: 140,
                    height: 55,
                    x: -100020,
                    y: -8,
                    top: -8,
                    left: -100020,
                    right: -99880,
                    bottom: 47,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return originalGetBoundingClientRect.call(this);
        };

        try {
            await renderFormulaDomPngBlob({ sourceElement: source, fontSizePx: 36 });
        } finally {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        }

        const [frame, options] = mocks.toCanvas.mock.calls[0]!;
        const clone = (frame as HTMLElement).firstElementChild as HTMLElement;
        expect((frame as HTMLElement).style.width).toBe('148px');
        expect((frame as HTMLElement).style.height).toBe('63px');
        expect(clone.style.left).toBe('24px');
        expect(clone.style.top).toBe('12px');
        expect(options).toMatchObject({ width: 148, height: 63 });
    });

    it('treats nested SVG graphics as atomic so internal path geometry cannot inflate the capture frame', async () => {
        const source = document.createElement('span');
        source.className = 'math-inline';
        source.innerHTML = '<span class="katex"><svg class="brace"><path d="M0 0"></path></svg><span class="base">x</span></span>';
        document.body.append(source);
        const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        const originalHtmlGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        const mockGetBoundingClientRect = function getBoundingClientRect(this: Element) {
            const element = this as Element;
            if (element.classList.contains('math-inline')) {
                return {
                    width: 100,
                    height: 40,
                    x: -100000,
                    y: 0,
                    top: 0,
                    left: -100000,
                    right: -99900,
                    bottom: 40,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (element.tagName.toLowerCase() === 'svg') {
                return {
                    width: 32,
                    height: 20,
                    x: -99980,
                    y: 10,
                    top: 10,
                    left: -99980,
                    right: -99948,
                    bottom: 30,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (element.tagName.toLowerCase() === 'path') {
                return {
                    width: 8000,
                    height: 6,
                    x: -104000,
                    y: 12,
                    top: 12,
                    left: -104000,
                    right: -96000,
                    bottom: 18,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return originalGetBoundingClientRect.call(this);
        };
        Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = mockGetBoundingClientRect as typeof HTMLElement.prototype.getBoundingClientRect;

        try {
            await renderFormulaDomPngBlob({ sourceElement: source, fontSizePx: 36 });
        } finally {
            Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
            HTMLElement.prototype.getBoundingClientRect = originalHtmlGetBoundingClientRect;
        }

        const [frame, options] = mocks.toCanvas.mock.calls[0]!;
        expect((frame as HTMLElement).style.width).toBe('40px');
        expect(options).toMatchObject({ width: 40, height: 28 });
    });
});
