import { describe, expect, it } from 'vitest';

import { createKatexMarkdownParserAdapter } from '@/drivers/content/adapters/parser/katex';

describe('KaTeX Markdown parser adapter', () => {
    it('does not use unresolved formula DOM as LaTeX source', () => {
        const formula = document.createElement('span');
        formula.className = 'katex';
        formula.innerHTML = '<span class="katex-html" aria-hidden="true"></span>';
        const adapter = createKatexMarkdownParserAdapter('ChatGPT', 'ChatGPT');

        expect(adapter.extractLatex(formula)).toBeNull();
    });

    it('uses the shared recoverable source rules for accessible LaTeX labels', () => {
        const formula = document.createElement('span');
        formula.className = 'katex';
        formula.setAttribute('aria-label', '\\sqrt{x}');
        const adapter = createKatexMarkdownParserAdapter('ChatGPT', 'ChatGPT');

        expect(adapter.extractLatex(formula)).toEqual({
            latex: '\\sqrt{x}',
            isBlock: false,
        });
    });
});
