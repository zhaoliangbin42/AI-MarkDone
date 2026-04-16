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
});
