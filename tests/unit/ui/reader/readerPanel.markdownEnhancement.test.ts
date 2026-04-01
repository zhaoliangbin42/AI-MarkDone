import { afterEach, describe, expect, it } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel markdown enhancement', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders mermaid fences as regular code blocks and highlights fenced code during markdown rendering', async () => {
        const panel = new ReaderPanel();
        const markdown = '```mermaid\ngraph TD\nA-->B\n```\n\n```ts\nconst x = 1;\n```';

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: markdown }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('.reader-markdown');

            expect(content?.querySelector('.aimd-mermaid')).toBeNull();
            expect(content?.querySelector('pre[data-code-language="mermaid"] code')?.className).toContain('language-mermaid');
            expect(content?.querySelector('pre[data-code-language="ts"] code')?.className).toContain('hljs');
            expect(content?.querySelector('pre[data-code-language="ts"] .hljs-keyword')?.textContent).toBe('const');
        } finally {
            panel.hide();
        }
    });

    it('can disable reader code highlighting through runtime settings wiring', async () => {
        const panel = new ReaderPanel();
        const markdown = '```ts\nconst x = 1;\n```';

        try {
            panel.setRenderCodeInReader(false);
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: markdown }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('.reader-markdown');

            expect(content?.querySelector('pre[data-code-language="ts"] code')?.className || '').not.toContain('hljs');
            expect(content?.textContent).toContain('const x = 1;');
        } finally {
            panel.hide();
        }
    });
});
