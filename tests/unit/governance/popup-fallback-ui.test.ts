import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readPopupHtml(): string {
    return readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf-8');
}

describe('fallback popup UI', () => {
    it('keeps the unsupported-site popup on the tokenized card layout instead of a bare link list', () => {
        const html = readPopupHtml();

        expect(html).toContain('class="popup-shell"');
        expect(html).toContain('class="popup-header"');
        expect(html).toContain('class="popup-links"');
        expect(html).toContain('class="popup-link"');
        expect(html).toContain('class="popup-footer"');
        expect(html).toContain('--aimd-');
    });

    it('keeps popup theme color fallback constrained to approved swatches', () => {
        const html = readPopupHtml();

        expect(html).toContain('const approvedAccentColors = new Set');
        expect(html).toContain("'#2563eb'");
        expect(html).toContain("'#059669'");
        expect(html).toContain("'#7c3aed'");
        expect(html).toContain("'#e11d48'");
        expect(html).toContain("'#d97706'");
    });
});
