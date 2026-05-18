import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    FORMULA_RENDERER_REQUEST_TYPE,
    FORMULA_RENDERER_RESPONSE_TYPE,
    type FormulaRendererResponse,
} from '@/core/math/formulaRendererProtocol';

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

describe('formula renderer entry', () => {
    beforeAll(async () => {
        await import('@/runtimes/formula-renderer/entry');
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
            for (const glyph of expectedGlyphs) {
                expect(response.asset.svg).toContain(glyph);
            }
            expect(response.asset.svg).not.toContain('mjx-break');
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
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
