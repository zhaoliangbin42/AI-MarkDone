import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/export/renderPng', () => ({
    renderPngBlob: vi.fn(async (plan: any) => {
        plan.onProgress?.({ phase: 'preparing' });
        plan.onProgress?.({ phase: 'loading_assets' });
        plan.onProgress?.({ phase: 'rendering', completed: 0, total: 1 });
        plan.onMetrics?.({
            width: plan.width,
            height: 640,
            requestedPixelRatio: plan.pixelRatio,
            effectivePixelRatio: plan.pixelRatio,
        });
        plan.onProgress?.({ phase: 'rendering', completed: 1, total: 1 });
        plan.onProgress?.({ phase: 'encoding' });
        plan.onProgress?.({ phase: 'done' });
        return new Blob(['png'], { type: 'image/png' });
    }),
}));

vi.mock('@/services/export/exportRenderer', () => ({
    renderExportHostJob: vi.fn(async () => ({ artifacts: [] })),
}));

import { renderPngBlob } from '@/drivers/content/export/renderPng';
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
        assistantMarkdown: '**Answer**',
    }],
};

describe('messagePngRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the proven content-side renderer instead of the iframe render host', async () => {
        const controller = new AbortController();
        const onProgress = vi.fn();

        await renderMessageDocumentPng(document, { width: 480, pixelRatio: 1 }, {
            signal: controller.signal,
            onProgress,
        });

        expect(renderPngBlob).toHaveBeenCalledWith(expect.objectContaining({
            filename: 'Conversation-message-001.png',
            html: expect.stringContaining('<strong>Answer</strong>'),
            width: 480,
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            signal: controller.signal,
            onProgress: expect.any(Function),
            onMetrics: expect.any(Function),
        }));
        expect(renderExportHostJob).not.toHaveBeenCalled();
        expect(onProgress.mock.calls.map(([event]) => event.phase)).toEqual([
            'preparing',
            'layout',
            'rasterizing',
            'rasterizing',
            'encoding',
            'finalizing',
        ]);
    });

    it('returns one PNG artifact backed by the rendered blob bytes', async () => {
        const [artifact] = await renderMessageDocumentPng(document, { width: 480, pixelRatio: 2 });

        expect(artifact?.metadata).toEqual({
            mimeType: 'image/png',
            widthPx: 960,
            heightPx: 1280,
            effectivePixelRatio: 2,
            partNumber: 1,
            partCount: 1,
        });
        expect(artifact?.chunks).toHaveLength(1);
        expect(artifact?.blob).toBeInstanceOf(Blob);
        expect(artifact?.blob.size).toBe(3);
    });
});
