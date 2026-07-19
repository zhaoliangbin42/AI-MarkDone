import {
    DEFAULT_PNG_EXPORT_PIXEL_RATIO,
    DEFAULT_PNG_EXPORT_WIDTH,
} from '../../core/settings/export';
import {
    renderPngBlob,
    type RenderPngMetrics,
} from '../../drivers/content/export/renderPng';
import type { RenderProgressEvent } from '../../drivers/content/export/renderControl';
import { renderMessageCardProfile } from './messageCardProfile';
import { planMessagePngFilenames } from './messagePngFilenames';
import type {
    ExportDocumentV1,
    ImageExportProgressEvent,
    MessagePngOptions,
    PngArtifactMetadata,
} from './imageExportContracts';

export type MessagePngRenderSettings = {
    width?: number;
    pixelRatio?: number;
};

export type RenderedMessagePngArtifact = {
    metadata: PngArtifactMetadata;
    chunks: readonly ArrayBuffer[];
    readonly blob: Blob;
};

export type RenderMessageDocumentPngOptions = {
    signal?: AbortSignal;
    onProgress?: (event: ImageExportProgressEvent) => void;
};

export function resolveMessagePngOptions(settings?: MessagePngRenderSettings): MessagePngOptions {
    return {
        widthCssPx: settings?.width ?? DEFAULT_PNG_EXPORT_WIDTH,
        requestedPixelRatio: settings?.pixelRatio ?? DEFAULT_PNG_EXPORT_PIXEL_RATIO,
    };
}

function mapProgress(event: RenderProgressEvent): ImageExportProgressEvent {
    switch (event.phase) {
        case 'preparing':
            return { phase: 'preparing' };
        case 'loading_assets':
            return { phase: 'layout' };
        case 'rendering':
        case 'rendering_chunk':
        case 'stitching':
            return {
                phase: 'rasterizing',
                completed: event.completed,
                total: event.total,
            };
        case 'encoding':
            return { phase: 'encoding' };
        case 'done':
            return { phase: 'finalizing' };
    }
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error('PNG blob could not be read as binary data.'));
        }, { once: true });
        reader.addEventListener('error', () => reject(reader.error ?? new Error('PNG blob read failed.')), { once: true });
        reader.readAsArrayBuffer(blob);
    });
}

export async function renderMessageDocumentPng(
    document: ExportDocumentV1,
    settings?: MessagePngRenderSettings,
    execution: RenderMessageDocumentPngOptions = {},
): Promise<RenderedMessagePngArtifact[]> {
    const options = resolveMessagePngOptions(settings);
    const rendered = renderMessageCardProfile(document, {
        widthCssPx: options.widthCssPx,
        backgroundColor: '#ffffff',
    });
    const filename = planMessagePngFilenames(document.title, document.sections.length, 1)
        .artifactFilenames[0]!;
    let metrics: Partial<RenderPngMetrics> = {};
    const blob = await renderPngBlob({
        filename,
        html: rendered.html,
        width: options.widthCssPx,
        pixelRatio: options.requestedPixelRatio,
        backgroundColor: '#ffffff',
        signal: execution.signal,
        onProgress: (event) => execution.onProgress?.(mapProgress(event)),
        onMetrics: (next) => {
            metrics = next;
        },
    });
    const effectivePixelRatio = metrics.effectivePixelRatio ?? options.requestedPixelRatio;
    const widthCssPx = metrics.width ?? options.widthCssPx;
    const heightCssPx = metrics.height ?? 1;
    const bytes = await blobToArrayBuffer(blob);

    return [{
        metadata: {
            mimeType: 'image/png',
            widthPx: Math.max(1, Math.round(widthCssPx * effectivePixelRatio)),
            heightPx: Math.max(1, Math.round(heightCssPx * effectivePixelRatio)),
            effectivePixelRatio,
            partNumber: 1,
            partCount: 1,
        },
        chunks: [bytes],
        blob,
    }];
}
