import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/export/downloadFile', () => ({
    downloadText: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/printPdf', () => ({
    printPdf: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/conversation/collectConversationMessageRefs', () => ({
    collectConversationMessageRefs: vi.fn(() => [
        { index: 0, messageEl: document.createElement('div'), userPrompt: 'u1', messageId: 'm1' },
    ]),
}));
vi.mock('../../../../src/services/copy/copy-markdown', () => ({
    copyMarkdownFromMessage: vi.fn(() => ({ ok: true, markdown: 'MD' })),
}));

import { downloadText } from '../../../../src/drivers/content/export/downloadFile';
import { exportConversationMarkdown } from '../../../../src/services/export/saveMessagesFacade';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

describe('exportConversationMarkdown', () => {
    it('no-ops when selection is empty', async () => {
        (downloadText as any).mockClear?.();
        const adapter: any = { getPlatformId: () => 'chatgpt' };
        const res = await exportConversationMarkdown(adapter, [], { t });
        expect(res.ok).toBe(true);
        expect(res.noop).toBe(true);
        expect(downloadText).not.toHaveBeenCalled();
    });

    it('builds markdown and triggers download when selection is present', async () => {
        document.head.innerHTML = '<title>My Title - ChatGPT</title>';
        const adapter: any = { getPlatformId: () => 'chatgpt' };

        const res = await exportConversationMarkdown(adapter, [0], { t });
        expect(res.ok).toBe(true);
        expect(res.noop).toBe(false);
        expect(downloadText).toHaveBeenCalledTimes(1);

        const arg = (downloadText as any).mock.calls[0][0];
        expect(arg.filename.endsWith('.md')).toBe(true);
        expect(arg.content).toContain('MD');
    });
});

