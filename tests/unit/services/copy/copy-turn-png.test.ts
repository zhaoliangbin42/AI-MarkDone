import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/export/renderPng', () => ({
    renderPngBlob: vi.fn(async (plan: any) => {
        plan.onMetrics?.({
            width: 1200,
            height: 12000,
            requestedPixelRatio: 2,
            effectivePixelRatio: 1.291,
            pixelArea: 24000000,
            capReason: 'pixel-area',
            fontStatus: 'loaded',
            strategy: 'chunked',
            chunkCount: 3,
            maxChunkHeight: 2000,
            fontEmbedMode: 'data-url',
        });
        return new Blob(['png'], { type: 'image/png' });
    }),
}));
vi.mock('../../../../src/drivers/content/clipboard/copyImageToClipboard', () => ({
    copyImageBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../../src/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));

import { renderPngBlob } from '../../../../src/drivers/content/export/renderPng';
import { copyImageBlobToClipboard } from '../../../../src/drivers/content/clipboard/copyImageToClipboard';
import { downloadBlob } from '../../../../src/drivers/content/export/downloadBlob';
import { copyTurnsPng } from '../../../../src/services/copy/copy-turn-png';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';

function t(key: string): string {
    return key;
}

describe('copyTurnsPng', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const turns: ChatTurn[] = [
        { user: 'u1', assistant: 'a1', index: 0 },
        { user: 'u2', assistant: 'a2', index: 1 },
    ];
    const metadata: ConversationMetadata = {
        url: 'https://chatgpt.com/c/1',
        exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        title: 'PNG Copy',
        count: 2,
        platform: 'ChatGPT',
    };

    it('reuses the existing PNG render path and writes the rendered blob to the clipboard', async () => {
        const result = await copyTurnsPng(turns, [1], metadata, { t });

        expect(result).toEqual({ ok: true, noop: false });
        expect(renderPngBlob).toHaveBeenCalledTimes(1);
        expect(copyImageBlobToClipboard).toHaveBeenCalledTimes(1);
        expect(downloadBlob).not.toHaveBeenCalled();
        expect(vi.mocked(renderPngBlob).mock.calls[0][0].filename).toBe('PNG_Copy-message-001.png');
    });

    it('returns a localized unsupported error when image clipboard write is unavailable', async () => {
        vi.mocked(copyImageBlobToClipboard).mockResolvedValueOnce({ ok: false, reason: 'unsupported' });

        const result = await copyTurnsPng(turns, [0], metadata, { t });

        expect(result).toEqual({
            ok: false,
            error: {
                code: 'CLIPBOARD_UNSUPPORTED',
                message: 'clipboardImageWriteUnsupported',
            },
        });
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('downloads the rendered PNG when clipboard image write is rejected', async () => {
        const blob = new Blob(['png'], { type: 'image/png' });
        vi.mocked(renderPngBlob).mockResolvedValueOnce(blob);
        vi.mocked(copyImageBlobToClipboard).mockResolvedValueOnce({
            ok: false,
            reason: 'write_failed',
            errorName: 'NotAllowedError',
            errorMessage: 'The request is not allowed by the user agent.',
        });

        const result = await copyTurnsPng(turns, [0], metadata, { t });

        expect(result).toEqual({ ok: true, noop: false, fallback: 'download' });
        expect(downloadBlob).toHaveBeenCalledWith({
            filename: 'PNG_Copy-message-001.png',
            blob,
        });
    });

    it('emits phase-level debug timings without message text', async () => {
        const onDebug = vi.fn();

        const result = await copyTurnsPng(turns, [1], metadata, { t, onDebug });

        expect(result).toEqual({ ok: true, noop: false });
        expect(onDebug.mock.calls.map((call) => call[0].stage)).toEqual([
            'build_plan',
            'render_blob',
            'clipboard_write',
            'copy_done',
        ]);
        expect(onDebug.mock.calls[0][0]).toMatchObject({
            selectedCount: 1,
            turnCount: 2,
            assistantChars: 2,
            userChars: 2,
        });
        expect(onDebug.mock.calls[1][0]).toMatchObject({
            stage: 'render_blob',
            width: 1200,
            height: 12000,
            requestedPixelRatio: 2,
            effectivePixelRatio: 1.291,
            pixelArea: 24000000,
            capReason: 'pixel-area',
            fontStatus: 'loaded',
            strategy: 'chunked',
            chunkCount: 3,
            maxChunkHeight: 2000,
            fontEmbedMode: 'data-url',
        });
        expect(JSON.stringify(onDebug.mock.calls)).not.toContain('u2');
        expect(JSON.stringify(onDebug.mock.calls)).not.toContain('a2');
    });
});
