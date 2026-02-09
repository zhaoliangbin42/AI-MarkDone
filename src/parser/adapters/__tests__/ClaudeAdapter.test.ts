import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { ClaudeAdapter } from '@/parser/adapters/ClaudeAdapter';

describe('ClaudeAdapter', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
        adapter = new ClaudeAdapter();
    });

    it('converts MathML mfrac into valid LaTeX fraction', () => {
        const html = `
            <span class="katex">
                <math>
                    <mfrac>
                        <mi>a</mi>
                        <mi>b</mi>
                    </mfrac>
                </math>
            </span>
        `;
        const dom = new JSDOM(html);
        const node = dom.window.document.querySelector('.katex') as HTMLElement;

        const result = adapter.extractLatex(node);

        expect(result).not.toBeNull();
        expect(result?.latex).toBe('\\frac{a}{b}');
    });
});
