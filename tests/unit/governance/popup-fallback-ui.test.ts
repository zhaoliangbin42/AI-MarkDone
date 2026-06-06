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
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');

        expect(script).toContain('const approvedAccentColors = new Set');
        expect(script).toContain("'#2563eb'");
        expect(script).toContain("'#059669'");
        expect(script).toContain("'#7c3aed'");
        expect(script).toContain("'#e11d48'");
        expect(script).toContain("'#d97706'");
    });

    it('keeps popup JavaScript external so extension CSP does not need unsafe-inline', () => {
        const html = readPopupHtml();

        expect(html).toContain('<script src="/src/popup/popup.js"></script>');
        expect(html).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/i);
    });

    it('links to ChatGPT plus formula copy hosts from the unsupported-site popup', () => {
        const html = readPopupHtml();

        expect(html).toContain('href="https://chatgpt.com/"');
        expect(html).toContain('href="https://gemini.google.com/"');
        expect(html).toContain('href="https://claude.ai/"');
        expect(html).toContain('href="https://chat.deepseek.com/"');
        expect(html).toContain('Formula copy');
        expect(html).toContain('Open ChatGPT, Gemini, Claude, or DeepSeek to use AI-MarkDone.');
    });
});
