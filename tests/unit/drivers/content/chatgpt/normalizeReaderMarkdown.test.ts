import { describe, expect, it } from 'vitest';

import { cleanChatGPTReferenceNoise, normalizeChatGPTReaderMarkdown } from '@/drivers/content/chatgpt/normalizeReaderMarkdown';

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

    it('keeps citation markers when citation stripping is disabled', () => {
        expect(cleanChatGPTReferenceNoise('Alpha citeturn0search0 beta.', { stripCitationMarkers: false }))
            .toBe('Alpha citeturn0search0 beta.');
    });

    it('turns ChatGPT entity annotations into their display names', () => {
        expect(normalizeChatGPTReaderMarkdown(
            '1976年\n由 entity["people","Whitfield Diffie","Public-key cryptography pioneer"] 和 entity["people","Martin Hellman","Public-key cryptography pioneer"] 提出。'
        )).toBe('1976年\n由 Whitfield Diffie 和 Martin Hellman 提出。');
    });

    it('turns ChatGPT GenUI math block annotations into Markdown math', () => {
        expect(normalizeChatGPTReaderMarkdown(
            '其核心模型：\n\ngenui{"math_block_widget_always_prefetch_v2":{"content":"\\\\mathbf{y}=\\\\mathbf{H}\\\\mathbf{x}+\\\\mathbf{n}"}}\n\n强调：'
        )).toBe([
            '其核心模型：',
            '',
            '$$',
            '\\mathbf{y}=\\mathbf{H}\\mathbf{x}+\\mathbf{n}',
            '$$',
            '',
            '强调：',
        ].join('\n'));
    });

    it('removes unknown ChatGPT internal annotations instead of exposing payload JSON', () => {
        expect(normalizeChatGPTReaderMarkdown('前文 unknown{"private":"metadata"} 后文'))
            .toBe('前文  后文');
    });
});
