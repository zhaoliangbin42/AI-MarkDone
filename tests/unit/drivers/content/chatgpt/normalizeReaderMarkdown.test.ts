import { describe, expect, it } from 'vitest';

import { cleanChatGPTReferenceNoise } from '@/drivers/content/chatgpt/normalizeReaderMarkdown';

describe('cleanChatGPTReferenceNoise', () => {
    it('removes ChatGPT citation markers and file citations', () => {
        expect(cleanChatGPTReferenceNoise('Alpha citeturn0search0 beta .'))
            .toBe('Alpha  beta .');
        expect(cleanChatGPTReferenceNoise('Answer done.')).toBe('Answer done.');
    });

    it('turns markdown links into plain text and removes bare urls', () => {
        expect(cleanChatGPTReferenceNoise('Read [paper](https://example.com/paper.pdf) and https://example.com/raw.'))
            .toBe('Read paper and');
    });

    it('preserves markdown links and bare urls inside code spans and fenced code blocks', () => {
        const markdown = [
            'Read [paper](https://example.com/paper.pdf) and https://example.com/raw.',
            '',
            '`https://example.com/inline`',
            '',
            '```ts',
            'const url = "https://example.com/api";',
            'const link = "[docs](https://example.com/docs)";',
            '```',
        ].join('\n');

        expect(cleanChatGPTReferenceNoise(markdown)).toBe([
            'Read paper and',
            '',
            '`https://example.com/inline`',
            '',
            '```ts',
            'const url = "https://example.com/api";',
            'const link = "[docs](https://example.com/docs)";',
            '```',
        ].join('\n'));
    });

    it('can keep markdown links when configured for a future settings toggle', () => {
        expect(cleanChatGPTReferenceNoise('[paper](https://example.com)', { stripMarkdownLinks: false, stripBareUrls: false }))
            .toBe('[paper](https://example.com)');
    });
});
