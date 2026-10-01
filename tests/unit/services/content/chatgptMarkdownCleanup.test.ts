import { describe, expect, it } from 'vitest';
import {
    normalizeChatGPTReaderMarkdown,
    projectChatGPTMarkdown,
} from '@/core/content/chatgptMarkdownCleanup';
import { DEFAULT_CONTENT_CLEANUP_SETTINGS } from '@/core/settings/content';

const source = [
    'Read [paper](https://example.com/paper.pdf) and https://example.com/raw. citeturn0search0',
    '',
    'Inline `https://example.com/inside-code` and \\(x + y\\).',
    '',
    '```ts',
    'const url = "https://example.com/code";',
    '```',
].join('\n');

describe('shared ChatGPT Markdown cleanup', () => {
    it('keeps the existing default output byte-for-byte', () => {
        expect(projectChatGPTMarkdown(source, DEFAULT_CONTENT_CLEANUP_SETTINGS))
            .toBe(normalizeChatGPTReaderMarkdown(source));
    });

    it('retains ordinary links and URLs when requested without restoring citation noise or images', () => {
        const output = projectChatGPTMarkdown(
            `${source}\n\n![diagram](https://example.com/image(test).png)`,
            { preserveLinks: true, includeCodeBlocks: true },
        );
        expect(output).toContain('[paper](https://example.com/paper.pdf)');
        expect(output).toContain('https://example.com/raw.');
        expect(output).not.toContain('cite');
        expect(output).toContain('diagram');
        expect(output).not.toContain('![diagram]');
    });

    it('omits whole fenced code blocks while keeping inline code and surrounding prose', () => {
        const output = projectChatGPTMarkdown(source, { preserveLinks: false, includeCodeBlocks: false });
        expect(output).not.toContain('const url');
        expect(output).not.toContain('```');
        expect(output).toContain('`https://example.com/inside-code`');
        expect(output).toContain('Read paper');
    });
});
