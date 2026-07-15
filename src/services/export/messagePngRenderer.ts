import {
    DEFAULT_PNG_EXPORT_PIXEL_RATIO,
    DEFAULT_PNG_EXPORT_WIDTH,
} from '../../core/settings/export';
import { renderExportHostJob } from './exportRenderer';
import type {
    ExportDocumentV1,
    ImageExportProgressEvent,
    MessagePngOptions,
    PngArtifactMetadata,
} from './imageExportContracts';

const MESSAGE_RENDER_TIMEOUT_MS = 120_000;

export type MessagePngRenderSettings = {
    width?: number;
    pixelRatio?: number;
};

export type RenderedMessagePngArtifact = {
    metadata: PngArtifactMetadata;
    blob: Blob;
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

export async function renderMessageDocumentPng(
    document: ExportDocumentV1,
    settings?: MessagePngRenderSettings,
    execution: RenderMessageDocumentPngOptions = {},
): Promise<RenderedMessagePngArtifact[]> {
    const result = await renderExportHostJob({
        kind: 'message-png',
        document,
        options: resolveMessagePngOptions(settings),
    }, {
        ...execution,
        timeoutMs: MESSAGE_RENDER_TIMEOUT_MS,
    });
    return result.artifacts.map((artifact) => {
        if (artifact.metadata.mimeType !== 'image/png') {
            throw new Error(`Unexpected message export artifact: ${artifact.metadata.mimeType}.`);
        }
        return {
            metadata: artifact.metadata,
            blob: new Blob(artifact.chunks, { type: 'image/png' }),
        };
    });
}
