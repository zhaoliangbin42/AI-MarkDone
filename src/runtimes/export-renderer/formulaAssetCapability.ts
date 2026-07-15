import type { ImageExportProgressEvent } from '../../services/export/imageExportContracts';
import type {
    FormulaAssetRenderHostJob,
    RenderHostArtifactMetadata,
} from '../../services/export/exportRenderHostProtocol';
import { rasterizeFormulaSvgToPng } from './formulaSvgRasterizer';
import {
    renderFormulaMathmlAsset,
    renderFormulaSvgAsset,
} from './formulaMathJax';

const OUTPUT_CHUNK_BYTES = 256 * 1024;

export type FormulaAssetCapabilitySink = {
    onProgress: (event: ImageExportProgressEvent) => void;
    onArtifactStart: (metadata: RenderHostArtifactMetadata) => void;
    onArtifactChunk: (sequence: number, bytes: ArrayBuffer) => void;
    onArtifactComplete: () => void;
};

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException('Formula render cancelled.', 'AbortError');
}

function emitBytes(bytes: Uint8Array, sink: FormulaAssetCapabilitySink): void {
    let sequence = 0;
    for (let offset = 0; offset < bytes.byteLength; offset += OUTPUT_CHUNK_BYTES) {
        const chunk = bytes.slice(offset, offset + OUTPUT_CHUNK_BYTES);
        sink.onArtifactChunk(sequence++, chunk.buffer as ArrayBuffer);
    }
}

function emitText(
    text: string,
    metadata: RenderHostArtifactMetadata,
    sink: FormulaAssetCapabilitySink,
): void {
    sink.onArtifactStart(metadata);
    emitBytes(new TextEncoder().encode(text), sink);
    sink.onArtifactComplete();
}

export async function renderFormulaAssetCapability(
    job: FormulaAssetRenderHostJob,
    sink: FormulaAssetCapabilitySink,
    signal?: AbortSignal,
): Promise<void> {
    throwIfAborted(signal);
    sink.onProgress({ phase: 'compiling' });

    if (job.output === 'mathml') {
        const asset = await renderFormulaMathmlAsset(job.spec);
        throwIfAborted(signal);
        emitText(asset.mathml, {
            mimeType: 'application/mathml+xml',
            partNumber: 1,
            partCount: 1,
        }, sink);
        return;
    }

    const svg = await renderFormulaSvgAsset(job.spec);
    throwIfAborted(signal);
    if (job.output === 'svg') {
        emitText(svg.svg, {
            mimeType: 'image/svg+xml',
            widthPx: svg.width,
            heightPx: svg.height,
            partNumber: 1,
            partCount: 1,
        }, sink);
        return;
    }

    sink.onProgress({ phase: 'rasterizing' });
    const rasterized = await rasterizeFormulaSvgToPng(svg);
    throwIfAborted(signal);
    const bytes = new Uint8Array(await rasterized.blob.arrayBuffer());
    sink.onArtifactStart({
        mimeType: 'image/png',
        widthPx: rasterized.widthPx,
        heightPx: rasterized.heightPx,
        effectivePixelRatio: rasterized.effectivePixelRatio,
        partNumber: 1,
        partCount: 1,
    });
    sink.onProgress({ phase: 'encoding' });
    emitBytes(bytes, sink);
    sink.onArtifactComplete();
}
