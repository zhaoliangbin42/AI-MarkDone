import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/export/downloadFile', () => ({
    downloadText: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/printPdf', () => ({
    printPdf: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/renderPng', () => ({
    renderPngBlob: vi.fn(async (plan: any) => {
        plan.onProgress?.({ phase: 'rendering_chunk', completed: 1, total: 3 });
        return new Blob([plan.filename], { type: 'image/png' });
    }),
}));
vi.mock('../../../../src/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/zipBlobs', () => ({
    zipBlobs: vi.fn(async () => new Blob(['zip'], { type: 'application/zip' })),
}));

import { downloadText } from '../../../../src/drivers/content/export/downloadFile';
import { downloadBlob } from '../../../../src/drivers/content/export/downloadBlob';
import { renderPngBlob } from '../../../../src/drivers/content/export/renderPng';
import { zipBlobs } from '../../../../src/drivers/content/export/zipBlobs';
import { exportTurnsMarkdown, exportTurnsPng } from '../../../../src/services/export/saveMessagesFacade';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

describe('exportTurnsMarkdown', () => {
    const turns: ChatTurn[] = [
        { user: 'u1', assistant: 'MD', index: 0 },
    ];
    const metadata: ConversationMetadata = {
        url: 'https://chatgpt.com/c/1',
        exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        title: 'My Title',
        count: 1,
        platform: 'ChatGPT',
    };

    it('no-ops when selection is empty', async () => {
        (downloadText as any).mockClear?.();
        const res = await exportTurnsMarkdown(turns, [], metadata, { t });
        expect(res.ok).toBe(true);
        expect(res.noop).toBe(true);
        expect(downloadText).not.toHaveBeenCalled();
    });

    it('builds markdown and triggers download when selection is present', async () => {
        const res = await exportTurnsMarkdown([
            { user: 'Question $q$', assistant: 'Inline $x+y$', index: 0 },
        ], [0], metadata, {
            t,
            markdownFormulaFormat: 'latex-brackets',
        });
        expect(res.ok).toBe(true);
        expect(res.noop).toBe(false);
        expect(downloadText).toHaveBeenCalledTimes(1);

        const arg = (downloadText as any).mock.calls[0][0];
        expect(arg.filename.endsWith('.md')).toBe(true);
        expect(arg.content).toContain('Question \\(q\\)');
        expect(arg.content).toContain('Inline \\(x+y\\)');
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
            'rendering:0/2',
            'rendering:1/2',
            'rendering:1/2',
            'rendering:1/2',
            'rendering:2/2',
            'zipping:2/2',
            'downloading:2/2',
            'done:2/2',
        ]);
    });

    it('reports current message PNG render progress inside the total export progress event', async () => {
        const progress: any[] = [];

        const res = await exportTurnsPng(turns, [0], metadata, {
            t,
            onProgress: (event: any) => progress.push(event),
        });

        expect(res.ok).toBe(true);
        expect(progress).toContainEqual(expect.objectContaining({
            phase: 'rendering',
            completed: 0,
            total: 1,
            filename: 'PNG_Export-message-001.png',
            current: { phase: 'rendering_chunk', completed: 1, total: 3 },
        }));
    });

    it('cancels PNG export before downloading when the abort signal fires', async () => {
        vi.mocked(downloadBlob).mockClear();
        const abort = new AbortController();
        vi.mocked(renderPngBlob).mockImplementationOnce(async (plan: any) => {
            plan.onProgress?.({ phase: 'rendering_chunk', completed: 1, total: 2 });
            abort.abort();
            return new Blob([plan.filename], { type: 'image/png' });
        });

        const res = await exportTurnsPng(turns, [0], metadata, {
            t,
            signal: abort.signal,
        });

        expect(res).toEqual({
            ok: false,
            cancelled: true,
            error: { code: 'CANCELLED', message: 'pngExportCancelled' },
        });
        expect(downloadBlob).not.toHaveBeenCalled();
    });
});
