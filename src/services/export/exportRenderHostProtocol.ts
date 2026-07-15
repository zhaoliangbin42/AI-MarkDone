import type {
    ExportDocumentV1,
    ImageExportErrorCode,
    ImageRenderPhase,
    MessagePngOptions,
    PngArtifactMetadata,
} from './imageExportContracts';

export const EXPORT_RENDER_HOST_PROTOCOL_VERSION = 1 as const;
export const EXPORT_RENDER_HOST_CONNECT_TYPE = 'aimd:export-render-host:connect' as const;
const MAX_EXPORT_DOCUMENT_SECTIONS = 2_000;
const MAX_EXPORT_DOCUMENT_TEXT_UNITS = 2_000_000;
const MAX_FORMULA_SOURCE_UNITS = 100_000;

export type MessagePngRenderHostJob = {
    kind: 'message-png';
    document: ExportDocumentV1;
    options: MessagePngOptions;
};

export type FormulaAssetSpec = {
    source: string;
    displayMode: boolean;
    fontSizePx: number;
    foregroundColor: string;
};

export type FormulaAssetRenderHostJob = {
    kind: 'formula-asset';
    spec: FormulaAssetSpec;
    output: 'png' | 'svg' | 'mathml';
};

export type RenderHostJob = MessagePngRenderHostJob | FormulaAssetRenderHostJob;

export type RenderHostStartCommand = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'start';
    jobId: string;
    job: RenderHostJob;
};

export type RenderHostCancelCommand = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'cancel';
    jobId: string;
};

export type RenderHostCommand = RenderHostStartCommand | RenderHostCancelCommand;

export type RenderHostArtifactChunkEvent = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'artifact-chunk';
    jobId: string;
    sequence: number;
    bytes: ArrayBuffer;
};

export type RenderHostTextArtifactMetadata = {
    mimeType: 'image/svg+xml' | 'application/mathml+xml';
    widthPx?: number;
    heightPx?: number;
    partNumber: 1;
    partCount: 1;
};

export type RenderHostArtifactMetadata = PngArtifactMetadata | RenderHostTextArtifactMetadata;

export type RenderHostProgressEvent = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'progress';
    jobId: string;
    phase: ImageRenderPhase;
    completed?: number;
    total?: number;
};

export type RenderHostArtifactStartEvent = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'artifact-start';
    jobId: string;
    metadata: RenderHostArtifactMetadata;
};

export type RenderHostArtifactCompleteEvent = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'artifact-complete';
    jobId: string;
};

export type RenderHostFailedEvent = {
    v: typeof EXPORT_RENDER_HOST_PROTOCOL_VERSION;
    type: 'failed';
    jobId: string;
    code: ImageExportErrorCode;
    message: string;
};

export type RenderHostEvent =
    | RenderHostProgressEvent
    | RenderHostArtifactStartEvent
    | RenderHostArtifactChunkEvent
    | RenderHostArtifactCompleteEvent
    | RenderHostFailedEvent;

const IMAGE_RENDER_PHASES = new Set<ImageRenderPhase>([
    'queued',
    'preparing',
    'compiling',
    'layout',
    'rasterizing',
    'encoding',
    'finalizing',
]);

const IMAGE_EXPORT_ERROR_CODES = new Set<ImageExportErrorCode>([
    'CANCELLED',
    'INVALID_REQUEST',
    'SOURCE_UNAVAILABLE',
    'HOST_UNAVAILABLE',
    'PROTOCOL_ERROR',
    'RENDER_FAILED',
    'ENCODE_FAILED',
    'LIMIT_EXCEEDED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
    return value instanceof ArrayBuffer
        || Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

function isOptionalNonNegativeNumber(value: unknown): value is number | undefined {
    return value === undefined
        || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isOptionalPositiveDimension(value: unknown): value is number | undefined {
    return value === undefined
        || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function isPngArtifactMetadata(value: unknown): value is PngArtifactMetadata {
    return isRecord(value)
        && value.mimeType === 'image/png'
        && typeof value.widthPx === 'number'
        && Number.isInteger(value.widthPx)
        && value.widthPx > 0
        && typeof value.heightPx === 'number'
        && Number.isInteger(value.heightPx)
        && value.heightPx > 0
        && typeof value.effectivePixelRatio === 'number'
        && Number.isFinite(value.effectivePixelRatio)
        && value.effectivePixelRatio > 0
        && typeof value.partNumber === 'number'
        && Number.isInteger(value.partNumber)
        && value.partNumber > 0
        && typeof value.partCount === 'number'
        && Number.isInteger(value.partCount)
        && value.partCount > 0
        && value.partNumber <= value.partCount;
}

function isTextArtifactMetadata(value: unknown): value is RenderHostTextArtifactMetadata {
    return isRecord(value)
        && (value.mimeType === 'image/svg+xml' || value.mimeType === 'application/mathml+xml')
        && isOptionalPositiveDimension(value.widthPx)
        && isOptionalPositiveDimension(value.heightPx)
        && value.partNumber === 1
        && value.partCount === 1;
}

function isArtifactMetadata(value: unknown): value is RenderHostArtifactMetadata {
    return isPngArtifactMetadata(value) || isTextArtifactMetadata(value);
}

function isMessagePngOptions(value: unknown): value is MessagePngOptions {
    if (!isRecord(value)) return false;
    const width = value.widthCssPx;
    const ratio = value.requestedPixelRatio;
    return typeof width === 'number'
        && Number.isInteger(width)
        && width >= 360
        && width <= 1200
        && typeof ratio === 'number'
        && Number.isFinite(ratio)
        && ratio >= 1
        && ratio <= 3
        && Number.isInteger(ratio * 2);
}

function isExportDocumentV1(value: unknown): value is ExportDocumentV1 {
    if (!isRecord(value)
        || value.schemaVersion !== 1
        || value.profile !== 'message-card-v1'
        || typeof value.title !== 'string'
        || !isRecord(value.labels)
        || typeof value.labels.user !== 'string'
        || typeof value.labels.assistant !== 'string'
        || !Array.isArray(value.sections)) {
        return false;
    }

    if (value.sections.length === 0 || value.sections.length > MAX_EXPORT_DOCUMENT_SECTIONS) return false;
    let textUnits = value.title.length + value.labels.user.length + value.labels.assistant.length;
    for (const section of value.sections) {
        if (!isRecord(section)
            || typeof section.sourceIndex !== 'number'
            || !Number.isInteger(section.sourceIndex)
            || typeof section.heading !== 'string'
            || typeof section.userText !== 'string'
            || typeof section.assistantMarkdown !== 'string') {
            return false;
        }
        textUnits += section.heading.length + section.userText.length + section.assistantMarkdown.length;
        if (textUnits > MAX_EXPORT_DOCUMENT_TEXT_UNITS) return false;
    }
    return true;
}

function isFormulaAssetSpec(value: unknown): value is FormulaAssetSpec {
    return isRecord(value)
        && isNonEmptyString(value.source)
        && value.source.length <= MAX_FORMULA_SOURCE_UNITS
        && typeof value.displayMode === 'boolean'
        && typeof value.fontSizePx === 'number'
        && Number.isFinite(value.fontSizePx)
        && value.fontSizePx > 0
        && isNonEmptyString(value.foregroundColor);
}

function isRenderHostJob(value: unknown): value is RenderHostJob {
    if (!isRecord(value)) return false;
    if (value.kind === 'message-png') {
        return isExportDocumentV1(value.document) && isMessagePngOptions(value.options);
    }
    if (value.kind === 'formula-asset') {
        return isFormulaAssetSpec(value.spec)
            && (value.output === 'png' || value.output === 'svg' || value.output === 'mathml');
    }
    return false;
}

export function isRenderHostCommand(value: unknown): value is RenderHostCommand {
    if (!isRecord(value)
        || value.v !== EXPORT_RENDER_HOST_PROTOCOL_VERSION
        || !isNonEmptyString(value.jobId)) {
        return false;
    }
    if (value.type === 'cancel') return true;
    return value.type === 'start' && isRenderHostJob(value.job);
}

export function isRenderHostEvent(value: unknown): value is RenderHostEvent {
    if (!isRecord(value)
        || value.v !== EXPORT_RENDER_HOST_PROTOCOL_VERSION
        || !isNonEmptyString(value.jobId)) {
        return false;
    }

    switch (value.type) {
        case 'progress':
            return typeof value.phase === 'string'
                && IMAGE_RENDER_PHASES.has(value.phase as ImageRenderPhase)
                && isOptionalNonNegativeNumber(value.completed)
                && isOptionalNonNegativeNumber(value.total)
                && (value.completed === undefined
                    || value.total === undefined
                    || value.completed <= value.total);
        case 'artifact-start':
            return isArtifactMetadata(value.metadata);
        case 'artifact-chunk':
            return typeof value.sequence === 'number'
                && Number.isInteger(value.sequence)
                && value.sequence >= 0
                && isArrayBuffer(value.bytes);
        case 'artifact-complete':
            return true;
        case 'failed':
            return typeof value.code === 'string'
                && IMAGE_EXPORT_ERROR_CODES.has(value.code as ImageExportErrorCode)
                && isNonEmptyString(value.message);
        default:
            return false;
    }
}

export function getRenderHostEventTransferables(value: unknown): ArrayBuffer[] {
    return isRenderHostEvent(value) && value.type === 'artifact-chunk'
        ? [value.bytes]
        : [];
}
