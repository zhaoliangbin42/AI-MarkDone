import { afterEach, describe, expect, it } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel markdown enhancement', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders fenced code blocks with the shared code block chrome', async () => {
        const panel = new ReaderPanel();
        const markdown = '```ts\nconst x = 1;\n```';

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: markdown }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('.reader-markdown');

            expect(content?.querySelector('pre[data-code-language="ts"] code')?.className).toContain('hljs');
            expect(content?.querySelector('pre[data-code-language="ts"]')?.closest('.reader-code-block')).toBeTruthy();
            expect(content?.querySelector('pre[data-code-language="ts"] .hljs-keyword')?.textContent).toBe('const');
        } finally {
            panel.hide();
        }
    });

    it('wraps LaTeX code blocks by default and supports per-block toggling', async () => {
        const panel = new ReaderPanel();
        const markdown = '```latex\nThe collection of broken bikes and on-site repair interact with repositioning.\n```';

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: markdown }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('.reader-markdown');
            const codeBlock = content
                ?.querySelector('pre[data-code-language="latex"]')
                ?.closest<HTMLElement>('.reader-code-block');
            const toggle = codeBlock?.querySelector<HTMLButtonElement>('[data-action="reader-code-wrap-toggle"]');

            expect(codeBlock?.classList.contains('reader-code-block--soft-wrap')).toBe(true);
            expect(toggle?.getAttribute('aria-pressed')).toBe('true');

            toggle?.click();
            expect(codeBlock?.classList.contains('reader-code-block--soft-wrap')).toBe(false);
            expect(toggle?.getAttribute('aria-pressed')).toBe('false');

            toggle?.click();
            expect(codeBlock?.classList.contains('reader-code-block--soft-wrap')).toBe(true);
            expect(toggle?.getAttribute('aria-pressed')).toBe('true');

            const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
            expect(styles).toContain('.reader-code-block--soft-wrap .reader-code-block__scroll pre code');
            expect(styles).toContain('white-space: pre-wrap;');
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
