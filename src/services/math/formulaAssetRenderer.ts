import type {
    FormulaMathmlAsset,
    FormulaSource,
    FormulaSvgAsset,
} from '../../core/math/formulaAssetTypes';
import { ExportRenderHostError } from '../export/exportRenderHostClient';
import { renderExportHostJob, type RenderExportJobOptions } from '../export/exportRenderer';
import { runExclusiveExportTask } from '../export/exportTaskScheduler';
import type { RenderHostArtifactMetadata } from '../export/exportRenderHostProtocol';

export type { FormulaMathmlAsset, FormulaSvgAsset } from '../../core/math/formulaAssetTypes';

export const DEFAULT_FORMULA_FONT_SIZE_PX = 36;
const DEFAULT_RENDER_TIMEOUT_MS = 8000;

export type FormulaRenderOptions = {
    source: string;
    displayMode: boolean;
    fontSizePx?: number;
    foregroundColor?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
};

export type FormulaAssetRenderOptions = Omit<FormulaRenderOptions, 'source'> & {
    source: FormulaSource;
    output: 'png' | 'svg' | 'mathml';
    pixelRatio?: number;
};

export type RenderedFormulaAsset = {
    blob: Blob;
    metadata: RenderHostArtifactMetadata;
};

function normalizeFontSize(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? 0) > 0
        ? Math.round(value!)
        : DEFAULT_FORMULA_FONT_SIZE_PX;
}

function readBlobText(blob: Blob): Promise<string> {
    if (typeof blob.text === 'function') return blob.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('Formula asset could not be read.'));
        reader.readAsText(blob);
    });
}

export async function renderFormulaAsset(options: FormulaAssetRenderOptions): Promise<RenderedFormulaAsset> {
    if (options.source.kind === 'dom-only') {
        if (options.output !== 'png') {
            throw new ExportRenderHostError(
                'SOURCE_UNAVAILABLE',
                'Authoritative TeX source is unavailable for this formula.',
            );
        }
        const sourceElement = options.source.sourceElement;
        const asset = await runExclusiveExportTask(async () => {
            if (options.signal?.aborted) throw new DOMException('Formula render cancelled.', 'AbortError');
            const { renderFormulaDomPngAsset } = await import('../../drivers/content/export/renderFormulaDomAsset');
            const rendered = await renderFormulaDomPngAsset({
                sourceElement,
                fontSizePx: normalizeFontSize(options.fontSizePx),
                pixelRatio: options.pixelRatio,
            });
            if (options.signal?.aborted) throw new DOMException('Formula render cancelled.', 'AbortError');
            return rendered;
        }, options.signal);
        return {
            blob: asset.blob,
            metadata: {
                mimeType: 'image/png',
                widthPx: asset.widthPx,
                heightPx: asset.heightPx,
                effectivePixelRatio: asset.effectivePixelRatio,
                partNumber: 1,
                partCount: 1,
            },
        };
    }

    const source = options.source.value.trim();
    if (!source) throw new Error('Formula source is empty.');
    const fontSizePx = normalizeFontSize(options.fontSizePx);
    const renderOptions: RenderExportJobOptions = {
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS,
    };
    const result = await renderExportHostJob({
        kind: 'formula-asset',
        spec: {
            source,
            displayMode: options.displayMode,
            fontSizePx,
            foregroundColor: options.foregroundColor?.trim() || '#000000',
        },
        output: options.output,
    }, renderOptions);
    const artifact = result.artifacts[0];
    if (!artifact || result.artifacts.length !== 1) {
        throw new Error('Formula renderer returned an invalid artifact set.');
    }
    return {
        blob: new Blob(artifact.chunks, { type: artifact.metadata.mimeType }),
        metadata: artifact.metadata,
    };
}

export async function renderFormulaSvgAsset(options: FormulaRenderOptions): Promise<FormulaSvgAsset> {
    const source = options.source.trim();
    const fontSizePx = normalizeFontSize(options.fontSizePx);
    const rendered = await renderFormulaAsset({
        ...options,
        source: { kind: 'tex', value: source, confidence: 'authoritative' },
        fontSizePx,
        output: 'svg',
    });
    const svg = await readBlobText(rendered.blob);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') {
        throw new Error('Formula renderer returned invalid SVG.');
    }
    const width = rendered.metadata.widthPx ?? 1;
    const height = rendered.metadata.heightPx ?? 1;
    return {
        source,
        displayMode: options.displayMode,
        fontSizePx,
        width,
        height,
        viewBox: parsed.documentElement.getAttribute('viewBox') || `0 0 ${width} ${height}`,
        svg,
    };
}

export async function renderFormulaMathmlAsset(
    options: Omit<FormulaRenderOptions, 'fontSizePx'>,
): Promise<FormulaMathmlAsset> {
    const source = options.source.trim();
    const rendered = await renderFormulaAsset({
        ...options,
        source: { kind: 'tex', value: source, confidence: 'authoritative' },
        fontSizePx: DEFAULT_FORMULA_FONT_SIZE_PX,
        output: 'mathml',
    });
    return {
        source,
        displayMode: options.displayMode,
        mathml: await readBlobText(rendered.blob),
    };
}
