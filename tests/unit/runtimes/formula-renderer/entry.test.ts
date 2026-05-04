import { beforeAll, describe, expect, it } from 'vitest';
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
    ])('keeps inline formula %s in a single complete SVG asset', async (source, expectedGlyphs) => {
        const response = await renderFormula(source, false);

        expect(response.ok).toBe(true);
        if (!response.ok) throw new Error(response.message);
        expect(response.asset.svg.match(/<svg\b/g)).toHaveLength(1);
        for (const glyph of expectedGlyphs) {
            expect(response.asset.svg).toContain(glyph);
        }
        expect(response.asset.svg).not.toContain('mjx-break');
    });
});
