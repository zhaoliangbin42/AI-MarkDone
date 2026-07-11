import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    FORMULA_RENDERER_REQUEST_TYPE,
    FORMULA_RENDERER_RESPONSE_TYPE,
    type FormulaRendererResponse,
} from '@/core/math/formulaRendererProtocol';
import { rasterizeFormulaSvgToPngBlob } from '@/drivers/content/export/renderFormulaPng';

async function renderFormula(source: string, displayMode: boolean): Promise<FormulaRendererResponse> {
    const id = `test-${Math.random().toString(36).slice(2)}`;
    let resolveResponse!: (response: FormulaRendererResponse) => void;
    const response = new Promise<FormulaRendererResponse>((resolve) => {
        resolveResponse = resolve;
    });
    const sourceWindow = {
        postMessage(data: FormulaRendererResponse) {
            if (data?.type === FORMULA_RENDERER_RESPONSE_TYPE && data.id === id) {
                resolveResponse(data);
            }
        },
    };

    window.dispatchEvent(new MessageEvent('message', {
        data: {
            type: FORMULA_RENDERER_REQUEST_TYPE,
            id,
            source,
            displayMode,
            fontSizePx: 36,
            format: 'svg',
        },
        origin: window.location.origin,
        source: sourceWindow as Window,
    }));

    return response;
}

async function renderFormulaMathml(source: string, displayMode: boolean): Promise<FormulaRendererResponse> {
    const id = `test-${Math.random().toString(36).slice(2)}`;
    let resolveResponse!: (response: FormulaRendererResponse) => void;
    const response = new Promise<FormulaRendererResponse>((resolve) => {
        resolveResponse = resolve;
    });
    const sourceWindow = {
        postMessage(data: FormulaRendererResponse) {
            if (data?.type === FORMULA_RENDERER_RESPONSE_TYPE && data.id === id) {
                resolveResponse(data);
            }
        },
    };

    window.dispatchEvent(new MessageEvent('message', {
        data: {
            type: FORMULA_RENDERER_REQUEST_TYPE,
            id,
            source,
            displayMode,
            fontSizePx: 36,
            format: 'mathml',
        },
        origin: window.location.origin,
        source: sourceWindow as Window,
    }));

    return response;
}

function uniqueFormulaSourcesFromHtml(html: string): Array<{ source: string; displayMode: boolean }> {
    const template = document.createElement('template');
    template.innerHTML = html;
    const formulas: Array<{ source: string; displayMode: boolean }> = [];
    const seen = new Set<string>();
    template.content.querySelectorAll('.katex, .katex-display, .math-inline, .math-block').forEach((element) => {
        const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
        const source = annotation?.textContent?.trim();
        if (!source) return;
        const displayMode = element.classList.contains('katex-display')
            || Boolean(element.closest('.katex-display, .math-block'));
        const key = JSON.stringify([displayMode, source]);
        if (seen.has(key)) return;
        seen.add(key);
        formulas.push({ source, displayMode });
    });
    return formulas;
}

function installFormulaPngMocks(): () => void {
    const originalImage = globalThis.Image;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:formula-svg');
    URL.revokeObjectURL = vi.fn();
    class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
            queueMicrotask(() => this.onload?.());
        }
    }
    (globalThis as any).Image = MockImage;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
    } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
        callback(new Blob(['png'], { type: 'image/png' }));
    });

    return () => {
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        (globalThis as any).Image = originalImage;
        vi.restoreAllMocks();
    };
}

describe('formula renderer entry', () => {
    let restoreFormulaPngMocks: (() => void) | null = null;

    beforeAll(async () => {
        await import('@/runtimes/formula-renderer/entry');
    });

    afterEach(() => {
        restoreFormulaPngMocks?.();
        restoreFormulaPngMocks = null;
    });

    it.each([
        [String.raw`W_N^k = e^{-j\frac{2\pi}{N}k}`, ['data-c="3D"', 'data-c="1D452"']],
        ['a+b=c+d', ['data-c="3D"', 'data-c="1D450"', 'data-c="1D451"']],
        [String.raw`\mathbb{R}^{m\times n}\rightarrow \sum_{i=1}^n x_i`, ['data-c="2211"']],
    ])('keeps inline formula %s in a single complete SVG asset', async (source, expectedGlyphs) => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const response = await renderFormula(source, false);

            expect(response.ok).toBe(true);
            if (!response.ok) throw new Error(response.message);
            expect(response.asset.svg.match(/<svg\b/g)).toHaveLength(1);
            expect(new Blob([response.asset.svg]).size).toBeLessThan(100_000);
            expect(response.asset.svg).not.toContain('foreignObject');
            expect(response.asset.svg).not.toContain('data:font');
            expect(response.asset.svg).not.toMatch(/(?:href|src)="https?:/);
            for (const glyph of expectedGlyphs) {
                expect(response.asset.svg).toContain(glyph);
            }
            expect(response.asset.svg).not.toContain('mjx-break');
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('keeps CJK text formulas renderable for SVG and PNG rasterization', async () => {
        const response = await renderFormula(String.raw`x+\text{中文}`, false);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset.svg).toContain('中文');
        expect(response.asset.svg).toContain('PingFang SC');
        expect(response.asset.svg).not.toContain('NaN');
        expect(response.asset.width).toBeGreaterThan(36);
        expect(response.asset.viewBox).not.toContain('NaN');
        expect(response.asset.svg).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(response.asset.svg).not.toContain('foreignObject');
        expect(response.asset.svg).not.toContain('data:font');
        expect(new DOMParser().parseFromString(response.asset.svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
    });

    it('uses the configured CJK fallback font while laying out an underbrace', async () => {
        const response = await renderFormula(String.raw`\underbrace{\text{频率选择性多径信道}}_{\text{原本难处理}}`, true);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset.svg).toContain('data-variant="-explicitFont"');
        expect(response.asset.svg).toContain('PingFang SC');
        expect(response.asset.svg).toContain('频率选择性多径信道');
        expect(response.asset.svg).not.toContain('NaN');
    });

    it.each([
        [String.raw`\ce{H2O + CO2 -> H2CO3}`, 'mhchem'],
        [String.raw`\cancel{x}+\qty(2)`, 'cancel and physics'],
        [String.raw`\begin{dcases}x & x>0\\-x & x\le0\end{dcases}`, 'mathtools'],
    ])('renders the safe %s extension set without leaving literal commands in the SVG', async (source) => {
        const response = await renderFormula(source, true);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        const parsed = new DOMParser().parseFromString(response.asset.svg, 'image/svg+xml');
        expect(parsed.querySelector('[data-mml-node="merror"]')).toBeNull();
        expect(parsed.querySelector('[data-mml-node="mtext"][fill="red"][stroke="red"]')).toBeNull();
        expect(response.asset.svg).not.toContain('foreignObject');
        expect(response.asset.svg).not.toContain('NaN');
    });

    it('fails explicitly when TeX contains a command outside the supported package set', async () => {
        const response = await renderFormula(String.raw`x+\definitelyUnknownCommand{y}`, false);

        expect(response).toEqual(expect.objectContaining({
            ok: false,
            message: expect.stringContaining('Unsupported TeX command'),
        }));
    });

    it('resolves inherited formula color to black while preserving explicit child colors', async () => {
        const response = await renderFormula(String.raw`x+\color{red}{y}`, false);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        const parsed = new DOMParser().parseFromString(response.asset.svg, 'image/svg+xml');
        expect(parsed.documentElement.firstElementChild).toEqual(expect.objectContaining({
            tagName: 'g',
        }));
        expect(parsed.documentElement.firstElementChild?.getAttribute('fill')).toBe('#000000');
        expect(parsed.querySelector('[fill="red"]')).not.toBeNull();
    });

    it('preserves natural dimensions for long horizontal and vertical formulas', async () => {
        const horizontal = Array.from({ length: 100 }, (_, index) => `x_{${index}}`).join('+');
        const vertical = String.raw`\begin{aligned}`
            + Array.from({ length: 50 }, (_, index) => `y_{${index}}&=x_{${index}}+1`).join(String.raw`\\`)
            + String.raw`\end{aligned}`;

        const [horizontalResponse, verticalResponse] = await Promise.all([
            renderFormula(horizontal, true),
            renderFormula(vertical, true),
        ]);

        expect(horizontalResponse.ok).toBe(true);
        expect(verticalResponse.ok).toBe(true);
        if (!horizontalResponse.ok || !verticalResponse.ok) return;
        expect(horizontalResponse.asset.width).toBeGreaterThan(4000);
        expect(horizontalResponse.asset.height).toBeLessThan(200);
        expect(verticalResponse.asset.height).toBeGreaterThan(1500);
        expect(verticalResponse.asset.width).toBeLessThan(1000);
        expect(horizontalResponse.asset.svg).not.toContain('NaN');
        expect(verticalResponse.asset.svg).not.toContain('NaN');
    });

    it('uses the browser SVG content bounds when standalone SVG text is wider than the MathJax root viewBox', async () => {
        const originalGetBBox = (SVGSVGElement.prototype as any).getBBox;
        (SVGSVGElement.prototype as any).getBBox = vi.fn(() => ({
            x: 0,
            y: -850,
            width: 8200,
            height: 2300,
        }));

        try {
            const response = await renderFormula(String.raw`\underbrace{\text{频率选择性多径信道}}_{\text{原本难处理}}`, true);

            expect(response.ok).toBe(true);
            if (!response.ok) throw new Error(response.message);
            expect(response.asset.width).toBe(312);
            expect(response.asset.height).toBe(99);
            expect(response.asset.viewBox).toContain('8644.444444444445');
            expect(response.asset.svg).toContain('width="312"');
            expect(response.asset.svg).toContain('height="99"');
        } finally {
            if (originalGetBBox) {
                (SVGSVGElement.prototype as any).getBBox = originalGetBBox;
            } else {
                delete (SVGSVGElement.prototype as any).getBBox;
            }
        }
    });

    it('keeps stretch glyph nested SVGs inside one exported formula SVG', async () => {
        const html = readFileSync('mocks/ChatGPT/chatGPT-entity-2.html', 'utf8');
        const formula = uniqueFormulaSourcesFromHtml(html)
            .find((item) => item.source.includes('IFFT'));
        expect(formula).toBeTruthy();
        const response = await renderFormula(formula!.source, formula!.displayMode);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset.svg).toMatch(/^<svg\b/);
        expect(response.asset.svg.match(/<svg\b/g)?.length ?? 0).toBeGreaterThan(1);
        expect(response.asset.svg).toContain('IFFT');
        expect(response.asset.svg).not.toContain('NaN');
        expect(response.asset.svg).not.toContain('MathJax produced split SVG output');
    });

    it('renders every formula in the captured ChatGPT entity page as SVG and PNG', async () => {
        restoreFormulaPngMocks = installFormulaPngMocks();
        const html = readFileSync('mocks/ChatGPT/chatGPT-entity-2.html', 'utf8');
        const formulas = uniqueFormulaSourcesFromHtml(html);

        expect(formulas.length).toBeGreaterThan(20);
        for (const formula of formulas) {
            const response = await renderFormula(formula.source, formula.displayMode);
            expect(response.ok, formula.source).toBe(true);
            if (!response.ok) throw new Error(response.message);
            expect(response.asset.svg, formula.source).toMatch(/^<svg\b/);
            expect(response.asset.svg, formula.source).not.toContain('NaN');

            const png = await rasterizeFormulaSvgToPngBlob(response.asset);
            expect(png.type, formula.source).toBe('image/png');
        }
    });

    it.each([
        [String.raw`\mathcal A`, 'calligraphic'],
        [String.raw`h(\ell),\quad \ell=0,\cdots,L-1`, 'script'],
    ])('preloads the NewCM %s dynamic font data', async (source) => {
        const response = await renderFormula(source, true);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset.svg).toMatch(/^<svg\b/);
    });

    it('can return Presentation MathML from the same TeX input', async () => {
        const response = await renderFormulaMathml(String.raw`\frac{x_1}{2}`, true);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset).toMatchObject({
            source: String.raw`\frac{x_1}{2}`,
            displayMode: true,
            mathml: expect.stringContaining('<math'),
        });
        expect(response.asset.mathml).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
        expect(response.asset.mathml).toContain('<mfrac');
        expect(response.asset.mathml).toContain('<msub');
    });
});
