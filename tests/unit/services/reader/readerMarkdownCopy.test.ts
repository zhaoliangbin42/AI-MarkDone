import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

import { copyTextToClipboard } from '@/drivers/content/clipboard/clipboard';
import {
    copyReaderItemMarkdownToClipboard,
    formatReaderMarkdownForCopy,
    setReaderMarkdownCopyFormulaFormat,
} from '@/services/reader/readerMarkdownCopy';

describe('readerMarkdownCopy formula formatting', () => {
    beforeEach(() => {
        vi.mocked(copyTextToClipboard).mockClear();
        setReaderMarkdownCopyFormulaFormat('markdown-dollar');
    });

    it('rewrites markdown math for reader and toolbar copy without mutating plain text', () => {
        setReaderMarkdownCopyFormulaFormat('latex-brackets');

        expect(formatReaderMarkdownForCopy('Inline $x+y$')).toBe('Inline \\(x+y\\)');
        expect(formatReaderMarkdownForCopy('Plain text')).toBe('Plain text');
    });

    it('copies resolved reader item markdown with the selected formula format', async () => {
        setReaderMarkdownCopyFormulaFormat('equation');

        await copyReaderItemMarkdownToClipboard({
            id: 'item-1',
            userPrompt: 'Prompt',
            content: 'Block:\n\n$$\na^2+b^2=c^2\n$$',
        });

        expect(copyTextToClipboard).toHaveBeenCalledWith('Block:\n\n\\begin{equation}\na^2+b^2=c^2\n\\end{equation}');
    });
});
