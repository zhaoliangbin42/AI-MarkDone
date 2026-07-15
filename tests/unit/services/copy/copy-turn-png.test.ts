import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/services/export/messagePngRenderer', async () => {
    const actual = await vi.importActual<typeof import('../../../../src/services/export/messagePngRenderer')>(
        '../../../../src/services/export/messagePngRenderer',
    );
    return {
        ...actual,
        renderMessageDocumentPng: vi.fn(async (_document: unknown, _settings: unknown, execution: any) => {
            execution?.onProgress?.({ phase: 'rasterizing', completed: 1, total: 3 });
            return [{
                metadata: {
                    mimeType: 'image/png',
                    widthPx: 1200,
                    heightPx: 12000,
                    effectivePixelRatio: 2,
                    partNumber: 1,
                    partCount: 1,
                },
                blob: new Blob(['png'], { type: 'image/png' }),
            }];
        }),
    };
});
vi.mock('../../../../src/drivers/content/clipboard/copyImageToClipboard', () => ({
    copyImageBlobToClipboard: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../../src/drivers/content/export/downloadBlob', () => ({
    downloadBlob: vi.fn(),
}));
vi.mock('../../../../src/drivers/content/export/zipBlobs', () => ({
    zipBlobs: vi.fn(async () => new Blob(['zip'], { type: 'application/zip' })),
}));

import { copyImageBlobToClipboard } from '../../../../src/drivers/content/clipboard/copyImageToClipboard';
import { downloadBlob } from '../../../../src/drivers/content/export/downloadBlob';
import { zipBlobs } from '../../../../src/drivers/content/export/zipBlobs';
import { copyMessagePng } from '../../../../src/services/copy/copy-turn-png';
import { renderMessageDocumentPng } from '../../../../src/services/export/messagePngRenderer';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';

function t(key: string): string {
    return key;
}

const turn: ChatTurn = { user: 'u2', assistant: 'a2', index: 1 };
const metadata: ConversationMetadata = {
    url: 'https://chatgpt.com/c/1',
    exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
    title: 'PNG Copy',
    count: 1,
    platform: 'ChatGPT',
};

describe('copyMessagePng', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds one semantic document and copies its single PNG artifact', async () => {
        const result = await copyMessagePng(turn, metadata, { t });

        expect(result).toEqual({ ok: true, noop: false });
        expect(renderMessageDocumentPng).toHaveBeenCalledWith(
            expect.objectContaining({
                schemaVersion: 1,
                profile: 'message-card-v1',
                sections: [expect.objectContaining({ userText: 'u2', assistantMarkdown: 'a2' })],
            }),
            undefined,
            expect.any(Object),
        );
        expect(copyImageBlobToClipboard).toHaveBeenCalledTimes(1);
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('returns a localized unsupported error when image clipboard write is unavailable', async () => {
        vi.mocked(copyImageBlobToClipboard).mockResolvedValueOnce({ ok: false, reason: 'unsupported' });

        const result = await copyMessagePng(turn, metadata, { t });

        expect(result).toEqual({
            ok: false,
            error: { code: 'CLIPBOARD_UNSUPPORTED', message: 'clipboardImageWriteUnsupported' },
        });
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('downloads the single PNG when clipboard image write is rejected', async () => {
        vi.mocked(copyImageBlobToClipboard).mockResolvedValueOnce({
            ok: false,
            reason: 'write_failed',
            errorName: 'NotAllowedError',
            errorMessage: 'The request is not allowed by the user agent.',
        });

        const result = await copyMessagePng(turn, metadata, { t });

        expect(result).toEqual({ ok: true, noop: false, fallback: 'download' });
        expect(downloadBlob).toHaveBeenCalledWith(expect.objectContaining({
            filename: 'PNG_Copy-message-001.png',
            blob: expect.any(Blob),
        }));
    });

    it('downloads a ZIP instead of copying only the first artifact when the hard budget requires parts', async () => {
        const artifacts = [1, 2].map((partNumber) => ({
            metadata: {
                mimeType: 'image/png' as const,
                widthPx: 1200,
                heightPx: 60000,
                effectivePixelRatio: 1,
                partNumber,
                partCount: 2,
            },
            blob: new Blob([`part-${partNumber}`], { type: 'image/png' }),
        }));
        vi.mocked(renderMessageDocumentPng).mockResolvedValueOnce(artifacts);

        const result = await copyMessagePng(turn, metadata, { t });

        expect(result).toEqual({ ok: true, noop: false, fallback: 'download' });
        expect(copyImageBlobToClipboard).not.toHaveBeenCalled();
        expect(zipBlobs).toHaveBeenCalledWith({
            files: [
                { filename: 'PNG_Copy-part-001-of-2.png', blob: artifacts[0].blob },
                { filename: 'PNG_Copy-part-002-of-2.png', blob: artifacts[1].blob },
            ],
            signal: undefined,
        });
        expect(downloadBlob).toHaveBeenCalledWith(expect.objectContaining({
            filename: 'PNG_Copy-png.zip',
        }));
    });

    it('emits phase timings without including message content', async () => {
        const onDebug = vi.fn();

        const result = await copyMessagePng(turn, metadata, { t, onDebug });

        expect(result).toEqual({ ok: true, noop: false });
        expect(onDebug.mock.calls.map((call) => call[0].stage)).toEqual([
            'build_document',
            'render_artifacts',
            'clipboard_write',
            'copy_done',
        ]);
        expect(onDebug.mock.calls[0][0]).toMatchObject({
            selectedCount: 1,
            turnCount: 1,
            sectionCount: 1,
            assistantChars: 2,
            userChars: 2,
        });
        expect(onDebug.mock.calls[1][0]).toMatchObject({
            width: 1200,
            height: 12000,
            effectivePixelRatio: 2,
            artifactCount: 1,
            bandCount: 3,
        });
        expect(JSON.stringify(onDebug.mock.calls)).not.toContain('u2');
        expect(JSON.stringify(onDebug.mock.calls)).not.toContain('a2');
    });

    it('passes progress and abort through while avoiding clipboard and download after cancellation', async () => {
        const abort = new AbortController();
        const onProgress = vi.fn();
        vi.mocked(renderMessageDocumentPng).mockImplementationOnce(async (_document, _settings, execution) => {
            expect(execution.signal).toBe(abort.signal);
            execution.onProgress?.({ phase: 'rasterizing', completed: 1, total: 2 });
            abort.abort();
            return [];
        });

        const result = await copyMessagePng(turn, metadata, { t, signal: abort.signal, onProgress });

        expect(result).toEqual({
            ok: false,
            cancelled: true,
            error: { code: 'CANCELLED', message: 'btnCancel' },
        });
        expect(onProgress).toHaveBeenCalledWith({ phase: 'rasterizing', completed: 1, total: 2 });
        expect(copyImageBlobToClipboard).not.toHaveBeenCalled();
        expect(downloadBlob).not.toHaveBeenCalled();
    });
});
