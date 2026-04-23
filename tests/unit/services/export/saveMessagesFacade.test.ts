import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/export/downloadFile', () => ({
    downloadText: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/printPdf', () => ({
    printPdf: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/renderPng', () => ({
    renderPngBlob: vi.fn(async (plan: any) => new Blob([plan.filename], { type: 'image/png' })),
}));
vi.mock('../../../../src/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/zipBlobs', () => ({
    zipBlobs: vi.fn(async () => new Blob(['zip'], { type: 'application/zip' })),
}));
vi.mock('../../../../src/drivers/content/conversation/collectConversationTurnRefs', () => ({
    collectConversationTurnRefs: vi.fn(() => [
        {
            index: 0,
            primaryMessageEl: document.createElement('div'),
            messageEls: [document.createElement('div')],
            userPrompt: 'u1',
            messageId: 'm1',
            turnRootEl: document.createElement('div'),
        },
    ]),
}));
vi.mock('../../../../src/services/copy/copy-markdown', () => ({
    copyMarkdownFromMessage: vi.fn(() => ({ ok: true, markdown: 'MD' })),
}));

import { downloadText } from '../../../../src/drivers/content/export/downloadFile';
import { downloadBlob } from '../../../../src/drivers/content/export/downloadBlob';
import { zipBlobs } from '../../../../src/drivers/content/export/zipBlobs';
import { collectConversationTurnsAsync, exportConversationMarkdown, exportTurnsPng } from '../../../../src/services/export/saveMessagesFacade';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';

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

    it('uses ChatGPT payload snapshot turns when an engine is provided', async () => {
        const adapter: any = { getPlatformId: () => 'chatgpt' };
        const chatGptConversationEngine: any = {
            forceRefreshCurrentConversation: vi.fn(async () => ({
                conversationId: 'conv-1',
                buildFingerprint: 'build-1',
                capturedAt: 1,
                source: 'runtime-bridge',
                rounds: [
                    {
                        id: 'round-1',
                        position: 1,
                        userPrompt: 'Payload user',
                        assistantContent: 'Payload formula: \\(x = y\\)',
                        preview: 'Payload user',
                        messageId: 'a1',
                        userMessageId: 'u1',
                        assistantMessageId: 'a1',
                    },
                ],
            })),
        };

        const { turns } = await collectConversationTurnsAsync(adapter, { chatGptConversationEngine });

        expect(turns).toEqual([
            {
                user: 'Payload user',
                assistant: 'Payload formula: $x = y$',
                index: 0,
            },
        ]);
    });
});

describe('exportTurnsPng', () => {
    const turns: ChatTurn[] = [
        { user: 'u1', assistant: 'a1', index: 0 },
        { user: 'u2', assistant: 'a2', index: 1 },
    ];
    const metadata: ConversationMetadata = {
        url: 'https://chatgpt.com/c/1',
        exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        title: 'PNG Export',
        count: 2,
        platform: 'ChatGPT',
    };

    it('downloads a single PNG directly when one message is selected', async () => {
        vi.mocked(downloadBlob).mockClear();
        vi.mocked(zipBlobs).mockClear();

        const res = await exportTurnsPng(turns, [0], metadata, { t });

        expect(res.ok).toBe(true);
        expect(res.noop).toBe(false);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(vi.mocked(downloadBlob).mock.calls[0][0].filename).toBe('PNG_Export-message-001.png');
        expect(zipBlobs).not.toHaveBeenCalled();
    });

    it('packages multiple selected PNG files into a ZIP download', async () => {
        vi.mocked(downloadBlob).mockClear();
        vi.mocked(zipBlobs).mockClear();

        const res = await exportTurnsPng(turns, [0, 1], metadata, { t });

        expect(res.ok).toBe(true);
        expect(res.noop).toBe(false);
        expect(zipBlobs).toHaveBeenCalledTimes(1);
        expect(vi.mocked(zipBlobs).mock.calls[0][0].files).toHaveLength(2);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(vi.mocked(downloadBlob).mock.calls[0][0].filename).toBe('PNG_Export-png.zip');
    });

    it('reports PNG progress across plan preparation, rendering, zipping, and download', async () => {
        vi.mocked(downloadBlob).mockClear();
        vi.mocked(zipBlobs).mockClear();
        const progress: string[] = [];

        const res = await exportTurnsPng(turns, [0, 1], metadata, {
            t,
            onProgress: (event: any) => progress.push(`${event.phase}:${event.completed}/${event.total}`),
        });

        expect(res.ok).toBe(true);
        expect(progress).toEqual([
            'preparing:0/2',
            'rendering:0/2',
            'rendering:1/2',
            'rendering:1/2',
            'rendering:2/2',
            'zipping:2/2',
            'downloading:2/2',
            'done:2/2',
        ]);
    });
});
