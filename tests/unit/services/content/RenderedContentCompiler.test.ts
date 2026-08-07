import { describe, expect, it } from 'vitest';

import { RenderedContentCompiler } from '@/services/content/RenderedContentCompiler';
import { chatgptMarkdownParserAdapter } from '@/drivers/content/adapters/parser/chatgpt';

describe('RenderedContentCompiler', () => {
    it('compiles semantic structures through wrappers without provider selectors', () => {
        const root = document.createElement('div');
        root.innerHTML = `
            <section data-random-wrapper="one">
                <h2>Heading</h2>
                <p>Text <strong>bold</strong> and <a href="https://example.com">link</a>.</p>
                <ul><li>First</li><li>Second</li></ul>
                <blockquote><p>Quoted</p></blockquote>
                <pre><code class="language-ts">const answer = 42;</code></pre>
                <p>Formula <span data-math-source="x+y" class="katex"><span class="katex-html">visual</span></span></p>
            </section>
        `;

        const result = new RenderedContentCompiler({
            parserAdapter: chatgptMarkdownParserAdapter,
        }).compile(root);

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.markdown).toContain('## Heading');
        expect(result.markdown).toContain('**bold**');
        expect(result.markdown).toContain('- First');
        expect(result.markdown).toContain('> Quoted');
        expect(result.markdown).toContain('```ts');
        expect(result.markdown).toContain('$x+y$');
    });

    it('fails closed instead of returning raw text for empty or unsupported content', () => {
        const empty = document.createElement('div');
        expect(new RenderedContentCompiler({ parserAdapter: chatgptMarkdownParserAdapter }).compile(empty))
            .toMatchObject({ kind: 'rejected', reason: 'empty-content' });
        expect(new RenderedContentCompiler({ parserAdapter: null }).compile(document.createElement('div')))
            .toMatchObject({ kind: 'rejected', reason: 'unsupported-parser' });
    });
});
