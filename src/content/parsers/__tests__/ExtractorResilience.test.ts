import { describe, expect, it } from 'vitest';
import { CodeExtractor } from '../code-extractor';
import { TableParser } from '../table-parser';
import { MathExtractor } from '../math-extractor';

describe('parser extractor resilience', () => {
    it('CodeExtractor should handle malformed html and restore fenced block', () => {
        const extractor = new CodeExtractor();
        const html = '<div><pre><code class="language-js">\\n  console.log(1)\\n</code></pre><span>';
        const extracted = extractor.extract(html);
        const restored = extractor.restore(extracted);

        expect(restored).toContain('```js');
        expect(restored).toContain('console.log(1)');
    });

    it('TableParser should tolerate incomplete table structure', () => {
        const parser = new TableParser();
        const html = '<table><tr><th>A<th>B</tr><tr><td>1<td>2</tr></table><div>';
        const extracted = parser.extract(html);
        const restored = parser.restore(extracted);

        expect(restored).toContain('| A | B |');
        expect(restored).toContain('| 1 | 2 |');
    });

    it('MathExtractor should handle mixed rendered/raw math content', () => {
        const extractor = new MathExtractor();
        const html = [
            '<span class="katex"><annotation encoding="application/x-tex">x^2</annotation></span>',
            '<p>inline \\(a+b\\) and block \\[c=d\\]</p>',
            '<span class="katex-error">\\(y=z\\)</span>'
        ].join('');

        const extracted = extractor.extract(html);
        const restored = extractor.restore(extracted);

        expect(restored).toContain('$x^2$');
        expect(restored).toContain('$a+b$');
        expect(restored).toContain('$$');
    });

    it('extractors should remain stable on large mixed html input', () => {
        const codeExtractor = new CodeExtractor();
        const tableParser = new TableParser();
        const mathExtractor = new MathExtractor();

        const chunk = [
            '<pre><code class="language-ts">const x = 1;</code></pre>',
            '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
            '<span class="katex"><annotation encoding="application/x-tex">x_i^2</annotation></span>',
            '<p>raw \\(a+b\\) text</p>'
        ].join('');
        const html = `<div>${chunk.repeat(80)}</div>`;

        const afterCode = codeExtractor.restore(codeExtractor.extract(html));
        const afterTable = tableParser.restore(tableParser.extract(afterCode));
        const afterMath = mathExtractor.restore(mathExtractor.extract(afterTable));

        expect(afterMath.length).toBeGreaterThan(1000);
        expect(afterMath).toContain('```ts');
        expect(afterMath).toContain('| A | B |');
        expect(afterMath).toContain('$x_i^2$');
    });

    it('extractors should not throw on control characters and invalid unicode markers', () => {
        const codeExtractor = new CodeExtractor();
        const tableParser = new TableParser();
        const mathExtractor = new MathExtractor();

        const html = '<div>\u0000\u0008\u000Bpre\u0000</div>' +
            '<pre><code class="language-py">print("ok")\u0000</code></pre>' +
            '<table><tr><th>X</th></tr><tr><td>\u0000</td></tr></table>' +
            '<span class="katex"><annotation encoding="application/x-tex">a_{\\uD800}</annotation></span>';

        expect(() => {
            const afterCode = codeExtractor.restore(codeExtractor.extract(html));
            const afterTable = tableParser.restore(tableParser.extract(afterCode));
            mathExtractor.restore(mathExtractor.extract(afterTable));
        }).not.toThrow();
    });

    it('MathExtractor should keep pipeline stable on malformed katex fragments', () => {
        const extractor = new MathExtractor();
        const html = [
            '<span class="katex"><annotation encoding="application/x-tex">x+y',
            '<span class="katex-display"><annotation encoding="application/x-tex">\\frac{1}{2}',
            '<span class="katex-error">\\(broken'
        ].join('');

        expect(() => {
            const extracted = extractor.extract(html);
            extractor.restore(extracted);
        }).not.toThrow();
    });
});
