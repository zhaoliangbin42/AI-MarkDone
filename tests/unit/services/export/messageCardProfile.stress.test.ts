import { describe, expect, it } from 'vitest';
import { createImageExportStressDocument } from '../../../fixtures/image-export/stressDocument';
import { renderMessageCardProfile } from '@/services/export/messageCardProfile';

describe('message-card-v1 fixed stress corpus', () => {
    it('compiles the thousand-line code, wide table, and hundreds of formulas without semantic loss', () => {
        const rendered = renderMessageCardProfile(createImageExportStressDocument(), { widthCssPx: 800 });

        expect(rendered.html).toContain('line_0001');
        expect(rendered.html).toContain('line_1000');
        expect(rendered.html).toContain('R24C12-long-cell-value');
        expect(rendered.html.match(/class="katex"/g)?.length ?? 0).toBeGreaterThanOrEqual(300);
        expect(rendered.html).toContain('مرحبا');
        expect(rendered.html).toContain('/broken-image.png');
        expect(rendered.html).toContain('table-layout: fixed');
        expect(rendered.html).toContain('white-space: pre-wrap');
    });
});
