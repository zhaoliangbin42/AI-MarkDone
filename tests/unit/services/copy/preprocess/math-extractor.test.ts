import { describe, expect, it } from 'vitest';
import { MathExtractor } from '@/services/copy/preprocess/math-extractor';

describe('MathExtractor', () => {
    it('extracts display KaTeX into placeholders and restores as $$', () => {
        const ex = new MathExtractor();
        const html =
            '<p>Eq:</p><span class="katex-display"><span class="katex"><annotation encoding="application/x-tex">x_1 + y</annotation></span></span>';
        const extracted = ex.extract(html);
        expect(extracted).toContain('{{MATH-0}}');

        const restored = ex.restore(`before\n\n{{MATH-0}}\n\nafter`);
        expect(restored).toContain('$$');
        expect(restored).toContain('x_1 + y');
    });

    it('extracts raw \\( ... \\) patterns', () => {
        const ex = new MathExtractor();
        const extracted = ex.extract('<p>Inline: \\(a_b\\)</p>');
        expect(extracted).toContain('{{MATH-0}}');
        const restored = ex.restore(`{{MATH-0}}`);
        expect(restored).toContain('$a_b$');
    });
});
