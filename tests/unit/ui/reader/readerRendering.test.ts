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
});
