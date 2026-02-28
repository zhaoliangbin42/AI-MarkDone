import { describe, expect, it } from 'vitest';
import { renderMarkdownToSanitizedHtml } from '@/services/renderer/renderMarkdown';

describe('renderMarkdownToSanitizedHtml', () => {
    it('sanitizes dangerous HTML', () => {
        const html = renderMarkdownToSanitizedHtml(
            `<img src="x" onerror="alert(1)">\n<script>alert(1)</script>\n<a href="javascript:alert(1)">x</a>`
        );

        expect(html).not.toContain('onerror=');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:');
    });

    it('renders inline math via katex extension', () => {
        const html = renderMarkdownToSanitizedHtml('Inline: $x_1 + y$');
        expect(html).toContain('katex');
    });
});

