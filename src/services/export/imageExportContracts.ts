export type ExportDocumentV1 = {
    schemaVersion: 1;
    profile: 'message-card-v1';
    title: string;
    labels: {
        user: string;
        assistant: string;
    };
    sections: Array<{
        sourceIndex: number;
        heading: string;
        userText: string;
        assistantMarkdown: string;
    }>;
};

export type MessagePngOptions = {
    widthCssPx: number;
    requestedPixelRatio: number;
};

export type ImageRenderPhase =
    | 'queued'
    | 'preparing'
    | 'compiling'
    | 'layout'
    | 'rasterizing'
    | 'encoding'
    | 'finalizing';

export type ImageExportErrorCode =
    | 'CANCELLED'
    | 'INVALID_REQUEST'
    | 'SOURCE_UNAVAILABLE'
    | 'HOST_UNAVAILABLE'
    | 'PROTOCOL_ERROR'
    | 'RENDER_FAILED'
    | 'ENCODE_FAILED'
    | 'LIMIT_EXCEEDED';

export type PngArtifactMetadata = {
    mimeType: 'image/png';
    widthPx: number;
    heightPx: number;
    effectivePixelRatio: number;
    partNumber: number;
    partCount: number;
};

export type ImageExportArtifact = {
    kind: 'png' | 'svg' | 'mathml' | 'zip';
    mimeType: string;
    filename: string;
    blob: Blob;
};

export type ImageExportProgressEvent = {
    phase: ImageRenderPhase;
    completed?: number;
    total?: number;
};

export type ImageExportFailure = {
    code: ImageExportErrorCode;
    message: string;
};

export type ImageExportResult =
    | { ok: true; artifacts: ImageExportArtifact[]; fallback?: 'download' }
    | { ok: false; error: ImageExportFailure };
