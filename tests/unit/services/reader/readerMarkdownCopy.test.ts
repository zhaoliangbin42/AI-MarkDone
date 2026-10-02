import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

import { copyTextToClipboard } from '@/drivers/content/clipboard/clipboard';
import {
    formatCanonicalMarkdownForCopy,
    setCanonicalMarkdownCopyFormulaFormat,
} from '@/services/copy/canonicalMarkdownCopy';
import {
    copyReaderItemMarkdownToClipboard,
} from '@/services/reader/readerMarkdownCopy';

describe('readerMarkdownCopy formula formatting', () => {
    beforeEach(() => {
        vi.mocked(copyTextToClipboard).mockClear();
        setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
    });

    it('rewrites markdown math for reader and toolbar copy without mutating plain text', () => {
        setCanonicalMarkdownCopyFormulaFormat('latex-brackets');

        expect(formatCanonicalMarkdownForCopy('Inline $x+y$')).toBe('Inline \\(x+y\\)');
        expect(formatCanonicalMarkdownForCopy('Plain text')).toBe('Plain text');
    });

    it('copies resolved reader item markdown with the selected formula format', async () => {
        setCanonicalMarkdownCopyFormulaFormat('equation');

        await copyReaderItemMarkdownToClipboard({
            id: 'item-1',
            userPrompt: 'Prompt',
            content: 'Block:\n\n$$\na^2+b^2=c^2\n$$',
        });

        expect(copyTextToClipboard).toHaveBeenCalledWith('Block:\n\n\\begin{equation}\na^2+b^2=c^2\n\\end{equation}');
    });

    it('does not publish reconstructed DOM content as canonical Markdown', async () => {
        await expect(copyReaderItemMarkdownToClipboard({
            id: 'item-reconstructed',
            userPrompt: 'Prompt',
            content: '**visually inferred**',
            meta: { sourceQuality: 'reconstructed' },
        })).resolves.toBe(false);

        expect(copyTextToClipboard).not.toHaveBeenCalled();
    });

    it('keeps legacy default copy and projects preserved links and hidden code from the source', async () => {
        const item = {
            id: 'item-source', userPrompt: 'Prompt',
            content: 'Read paper\n\n```ts\nconst answer = 42;\n```',
            sourceContent: 'Read [paper](https://example.com)\n\n```ts\nconst answer = 42;\n```',
        };
        await copyReaderItemMarkdownToClipboard(item);
        expect(copyTextToClipboard).toHaveBeenLastCalledWith(item.content);

        await copyReaderItemMarkdownToClipboard(item, { preserveLinks: true, includeCodeBlocks: false });
        expect(copyTextToClipboard).toHaveBeenLastCalledWith('Read [paper](https://example.com)');
    });
});

describe('Question and reply copy', () => {
    it('preserves question text while formatting and cleaning only the reply', async () => {
        const { copyReaderPromptReplyToClipboard } = await import('@/services/reader/readerMarkdownCopy');
        setCanonicalMarkdownCopyFormulaFormat('latex-brackets');
        const prompt = 'Please keep $x$ and [my link](https://example.com) exactly.';
        expect(await copyReaderPromptReplyToClipboard({id:'pair',userPrompt:prompt,content:'$y$\n\n```js\nanswer()\n```'}, {preserveLinks:false,includeCodeBlocks:false})).toBe(true);
        expect(copyTextToClipboard).toHaveBeenLastCalledWith(`## Question\n\n${prompt}\n\n## AI Reply\n\n\\(y\\)`);
    });
    it('does not write an incomplete or reconstructed pair', async () => {
        const { copyReaderPromptReplyToClipboard } = await import('@/services/reader/readerMarkdownCopy');
        const copy=vi.mocked(copyTextToClipboard);copy.mockClear();
        expect(await copyReaderPromptReplyToClipboard({id:'empty',userPrompt:'',content:'Answer'})).toBe(false);
        expect(await copyReaderPromptReplyToClipboard({id:'missing',userPrompt:'Question',content:''})).toBe(false);
        expect(await copyReaderPromptReplyToClipboard({id:'reconstructed',userPrompt:'Question',content:'Answer',meta:{sourceQuality:'reconstructed'}})).toBe(false);
        expect(copy).not.toHaveBeenCalled();setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
    });
});
