import { describe, expect, it } from 'vitest';
import { TableExtractor } from '@/services/copy/preprocess/table-extractor';

describe('TableExtractor', () => {
    it('extracts tables and restores markdown pipe format', () => {
        const ex = new TableExtractor();
        const html = `
          <p>Before</p>
          <table>
            <tr><th>A</th><th>B</th></tr>
            <tr><td>1</td><td>2</td></tr>
          </table>
          <p>After</p>
        `;

        const extracted = ex.extract(html);
        expect(extracted).toContain('{{TABLE-0}}');

        const restored = ex.restore(`{{TABLE-0}}`);
        expect(restored).toContain('| A | B |');
        expect(restored).toContain('| 1 | 2 |');
    });
});

