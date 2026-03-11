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

    it('renders mermaid fences as regular code blocks and preserves language classes for fenced code blocks', () => {
        const html = renderMarkdownToSanitizedHtml('```mermaid\ngraph TD\nA-->B\n```\n\n```ts\nconst x = 1;\n```');

        expect(html).not.toContain('data-aimd-mermaid-block="1"');
        expect(html).toContain('class="language-mermaid"');
        expect(html).toContain('class="language-ts"');
        expect(html).toContain('data-code-language="ts"');
        expect(html).toContain('data-code-language="mermaid"');
    });
});
