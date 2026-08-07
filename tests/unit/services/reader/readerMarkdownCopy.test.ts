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
});
