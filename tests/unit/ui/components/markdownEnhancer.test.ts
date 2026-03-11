import { describe, expect, it, vi } from 'vitest';

vi.mock('highlight.js/lib/common', () => ({
    default: {
        highlightElement: vi.fn((code: HTMLElement) => {
            code.innerHTML = `<span class="hljs-keyword">${code.textContent ?? ''}</span>`;
        }),
    },
}));

import { enhanceRenderedMarkdown } from '@/ui/content/components/markdownEnhancer';

describe('enhanceRenderedMarkdown', () => {
    it('highlights regular fenced code blocks without mermaid-specific hydration', async () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <pre data-code-language="ts"><code class="language-ts">const x = 1;</code></pre>
          <pre data-code-language="mermaid"><code class="language-mermaid">graph TD;A-->B;</code></pre>
        `;

        await enhanceRenderedMarkdown(container);

        expect(container.querySelector('pre[data-code-language="ts"] code')?.dataset.aimdHighlighted).toBe('1');
        expect(container.querySelector('pre[data-code-language="mermaid"] code')?.dataset.aimdHighlighted).toBe('1');
        expect(container.querySelector('.aimd-mermaid')).toBeNull();
    });
});
