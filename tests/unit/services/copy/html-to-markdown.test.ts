import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '@/services/copy/html-to-markdown';

describe('htmlToMarkdown', () => {
    it('renders headings, emphasis, links, and code blocks', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <h2>Title</h2>
          <p>Hello <strong>world</strong> and <em>friends</em>.</p>
          <p><a href="https://example.com">link</a></p>
          <pre><code class="language-ts">const x = 1;\nconsole.log(x);\n</code></pre>
        `;
        const md = htmlToMarkdown(root);
        expect(md).toContain('## Title');
        expect(md).toContain('Hello **world** and *friends*.');
        expect(md).toContain('[link](https://example.com)');
        expect(md).toContain('```ts');
        expect(md).toContain('const x = 1;');
    });

    it('renders lists and blockquotes', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <blockquote><p>Quoted</p></blockquote>
          <ul><li>One</li><li>Two</li></ul>
          <ol><li>A</li><li>B</li></ol>
        `;
        const md = htmlToMarkdown(root);
        expect(md).toContain('> Quoted');
        expect(md).toContain('- One');
        expect(md).toContain('1. A');
    });
});

