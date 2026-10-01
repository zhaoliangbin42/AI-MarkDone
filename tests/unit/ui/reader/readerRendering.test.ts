import { describe, expect, it } from 'vitest';

import { renderReaderItem } from '@/ui/content/reader/ReaderRendering';

describe('ReaderRendering', () => {
    it('resolves lazy content and returns the complete Reader rendering model', async () => {
        const result = await renderReaderItem({
            id: 'a',
            userPrompt: 'Explain the example',
            content: async () => '# Title\n\n```tex\nx^2\n```',
        }, {
            highlightCode: true,
            labels: {
                copyCode: 'Copy code',
                enableCodeWrap: 'Enable wrap',
                disableCodeWrap: 'Disable wrap',
            },
        });

        expect(result.markdownSource).toContain('# Title');
        expect(result.html).toContain('reader-code-block');
        expect(result.html).toContain('reader-code-block--soft-wrap');
        expect(result.outlineItems.map(({ text }) => text)).toEqual(['Title']);
        expect(result.activeOutlineId).toBe(result.outlineItems[0]?.id);
        expect(result.userPromptDisplay.full).toBe('Explain the example');
        expect(result.atomicUnits.length).toBeGreaterThan(0);
    });

    it('renders the same filtered Markdown used by copy and export', async () => {
        const result = await renderReaderItem({
            id: 'source', userPrompt: 'Prompt',
            content: 'Read paper\n\n```ts\nconst answer = 42;\n```',
            sourceContent: 'Read [paper](https://example.com)\n\n```ts\nconst answer = 42;\n```',
        }, {
            highlightCode: true,
            contentCleanup: { preserveLinks: true, includeCodeBlocks: false },
            labels: { copyCode: 'Copy code', enableCodeWrap: 'Wrap', disableCodeWrap: 'No wrap' },
        });
        expect(result.markdownSource).toBe('Read [paper](https://example.com)');
        expect(result.html).toContain('https://example.com');
        expect(result.html).not.toContain('reader-code-block');
    });
});
