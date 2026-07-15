import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/export/exportRenderer', () => ({
    renderExportHostJob: vi.fn(async () => ({ artifacts: [] })),
}));

import { renderExportHostJob } from '@/services/export/exportRenderer';
import { renderMessageDocumentPng } from '@/services/export/messagePngRenderer';
import type { ExportDocumentV1 } from '@/services/export/imageExportContracts';

const document: ExportDocumentV1 = {
    schemaVersion: 1,
    profile: 'message-card-v1',
    title: 'Conversation',
    labels: { user: 'You', assistant: 'Assistant' },
    sections: [{
        sourceIndex: 0,
        heading: 'Message 1',
        userText: 'Question',
        assistantMarkdown: 'Answer',
    }],
};

describe('messagePngRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('gives long-document jobs enough time while preserving cancellation and progress', async () => {
        const controller = new AbortController();
        const onProgress = vi.fn();

        await renderMessageDocumentPng(document, { width: 480, pixelRatio: 1 }, {
            signal: controller.signal,
            onProgress,
        });

        expect(renderExportHostJob).toHaveBeenCalledWith({
            kind: 'message-png',
            document,
            options: { widthCssPx: 480, requestedPixelRatio: 1 },
        }, {
            signal: controller.signal,
            onProgress,
            timeoutMs: 120_000,
        });
    });

    it('preserves transferable PNG chunks for multipart ZIP streaming', async () => {
        const first = new TextEncoder().encode('part-').buffer;
        const second = new TextEncoder().encode('one').buffer;
        vi.mocked(renderExportHostJob).mockResolvedValueOnce({
            artifacts: [{
                metadata: {
                    mimeType: 'image/png',
                    widthPx: 480,
                    heightPx: 1_000,
                    effectivePixelRatio: 1,
                    partNumber: 1,
                    partCount: 1,
                },
                chunks: [first, second],
            }],
        });

        const [artifact] = await renderMessageDocumentPng(document);

        expect(artifact?.chunks).toEqual([first, second]);
        expect(artifact?.blob).toBeInstanceOf(Blob);
        expect(artifact?.blob.size).toBe(8);
    });
});
