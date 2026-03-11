import { describe, expect, it, vi } from 'vitest';

vi.mock('highlight.js/lib/common', () => ({
    default: {
        highlightElement: vi.fn((code: HTMLElement) => {
            code.innerHTML = `<span class="hljs-keyword">${code.textContent ?? ''}</span>`;
        }),
    },
}));

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel markdown enhancement', () => {
    it('renders mermaid fences as regular code blocks and still highlights fenced code', async () => {
        const panel = new ReaderPanel();
        const markdown = '```mermaid\ngraph TD\nA-->B\n```\n\n```ts\nconst x = 1;\n```';

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: markdown }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('[data-role="content"]');

            expect(content?.querySelector('.aimd-mermaid')).toBeNull();
            expect(content?.querySelector('pre[data-code-language="mermaid"] code')?.dataset.aimdHighlighted).toBe('1');
            expect(content?.querySelector('pre[data-code-language="ts"] code')?.dataset.aimdHighlighted).toBe('1');
        } finally {
            panel.hide();
        }
    });
});
