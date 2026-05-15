import { describe, expect, it } from 'vitest';

import { enhanceRenderedMarkdown } from '@/ui/content/components/markdownEnhancer';

describe('enhanceRenderedMarkdown', () => {
    it('acts as a compatibility no-op because highlighting now happens in the markdown renderer', async () => {
        const container = document.createElement('div');
        container.innerHTML = `
          <pre data-code-language="ts"><code class="hljs language-ts"><span class="hljs-keyword">const</span> x = 1;</code></pre>
          <pre data-code-language="json"><code class="hljs language-json">{"ok":true}</code></pre>
        `;
        const before = container.innerHTML;

        await enhanceRenderedMarkdown(container);

        expect(container.innerHTML).toBe(before);
    });
});
