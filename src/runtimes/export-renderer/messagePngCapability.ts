import { toCanvas } from 'html-to-image';
import type { PngArtifactMetadata, ImageExportProgressEvent } from '../../services/export/imageExportContracts';
import type { MessagePngRenderHostJob } from '../../services/export/exportRenderHostProtocol';
import { renderMessageCardProfile } from '../../services/export/messageCardProfile';
import { planMessageBands } from '../../services/export/messageBandPlanner';
import {
    MESSAGE_PNG_LIMITS,
    planMessagePngOutput,
} from '../../services/export/messagePngOutputPlan';
import { getKatexCssWithEmbeddedFonts } from '../../core/export/katexAssets';
import { WorkerPngEncoderClient } from './workerPngEncoderClient';
import {
    activateMessageBandScene,
    indexMessageBandScene,
    type MessageBandSceneIndex,
} from './messageBandScene';

const ROOT_ID = 'aimd-export-renderer-message-root';
const DEFAULT_IMAGE_TIMEOUT_MS = 1_500;
// html-to-image caches this list on first use, so it must stay fixed for the lifetime of the
// message capability chunk. The closed message-card profile carries its own scoped stylesheet;
// this set retains the computed properties that affect layout and paint without copying every
// browser-specific property for every KaTeX span in every band.
const MESSAGE_CAPTURE_STYLE_PROPERTIES: string[] = [
    'display', 'position', 'inset', 'top', 'right', 'bottom', 'left', 'z-index',
    'float', 'clear', 'box-sizing', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom',
    'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-width', 'border-style', 'border-color', 'border-top', 'border-right',
    'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing',
    'background', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'box-shadow', 'color', 'opacity', 'visibility',
    'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch',
    'font-variant', 'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-indent',
    'text-transform', 'text-decoration', 'text-shadow', 'white-space', 'overflow', 'overflow-x',
    'overflow-y', 'overflow-wrap', 'word-break', 'hyphens', 'vertical-align', 'list-style',
    'list-style-type', 'list-style-position', 'list-style-image', 'table-layout', 'caption-side',
    'empty-cells', 'columns', 'column-count', 'column-gap', 'column-width', 'break-before',
    'break-after', 'break-inside', 'page-break-before', 'page-break-after', 'page-break-inside',
    'transform', 'transform-origin', 'transform-box', 'filter', 'clip-path', 'object-fit',
    'object-position', 'aspect-ratio', 'flex', 'flex-grow', 'flex-shrink', 'flex-basis',
    'flex-direction', 'flex-wrap', 'align-items', 'align-content', 'align-self',
    'justify-content', 'justify-items', 'justify-self', 'order', 'gap', 'row-gap',
    'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'place-items', 'place-content', 'place-self', 'content', 'counter-increment', 'counter-reset',
    'quotes', 'appearance', '-webkit-appearance', 'pointer-events',
];
// Real-browser benchmarks show that roughly 2M device pixels keeps html-to-image's
// per-band DOM work bounded without multiplying the fixed serialization overhead.
// This remains well below the 8M hard safety ceiling enforced by the output plan.
const PREFERRED_BAND_PIXELS = 2_000_000;
const ULTRA_LONG_DOCUMENT_HEIGHT_PX = 50_000;
const BAND_BLOCK_SELECTOR = [
    '.message-header',
    '.user-prompt',
    '.assistant-response-label',
    '.reader-markdown > *',
    '.reader-markdown li',
    '.reader-markdown tbody > tr',
].join(',');

export type MessagePngCapabilitySink = {
    onProgress: (event: ImageExportProgressEvent) => void;
    onArtifactStart: (metadata: PngArtifactMetadata) => void;
    onArtifactChunk: (sequence: number, bytes: ArrayBuffer) => void;
    onArtifactComplete: () => void;
};

export type MessagePngCapabilityOptions = {
    signal?: AbortSignal;
    createWorker?: () => Worker;
    imageTimeoutMs?: number;
};

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException('Image export cancelled.', 'AbortError');
}

function yieldToRenderer(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

function createRoot(widthCssPx: number): HTMLElement {
    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'fixed';
    root.style.left = '-100000px';
    root.style.top = '0';
    root.style.width = `${widthCssPx}px`;
    root.style.overflow = 'visible';
    root.style.pointerEvents = 'none';
    (document.body || document.documentElement).appendChild(root);
    return root;
}

async function waitForFonts(): Promise<void> {
    try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
        // Font readiness is best-effort because the capture embeds its own KaTeX font CSS.
    }
}

async function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const done = () => {
                image.removeEventListener('load', done);
                image.removeEventListener('error', done);
                resolve();
            };
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            window.setTimeout(done, timeoutMs);
        });
    }));
}

function replaceUnavailableImages(root: HTMLElement): void {
    for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('img'))) {
        if (image.complete && image.naturalWidth > 0) continue;
        const placeholder = document.createElement('div');
        placeholder.className = 'aimd-png-image-placeholder';
        placeholder.textContent = `Image unavailable: ${image.alt || image.getAttribute('src') || 'unknown image'}`;
        image.replaceWith(placeholder);
    }
}

function removeNonVisualPngMarkup(root: HTMLElement): void {
    // KaTeX emits a hidden MathML accessibility tree beside the visible HTML tree. A bitmap has
    // no accessibility semantics, so retaining it only makes every band clone thousands of nodes.
    // Reader, PDF, SVG, and MathML outputs keep their original semantic markup.
    for (const mathMl of Array.from(root.querySelectorAll<HTMLElement>('.katex-mathml'))) {
        mathMl.remove();
    }
}

function fitWideFormulaBlocks(root: HTMLElement): void {
    for (const display of Array.from(root.querySelectorAll<HTMLElement>('.katex-display'))) {
        const formula = display.querySelector<HTMLElement>('.katex');
        if (!formula) continue;
        const availableWidth = Math.max(1, display.clientWidth);
        const formulaWidth = Math.max(formula.scrollWidth, formula.getBoundingClientRect().width);
        if (formulaWidth <= availableWidth) continue;
        const scale = availableWidth / formulaWidth;
        const formulaHeight = Math.max(formula.scrollHeight, formula.getBoundingClientRect().height);
        formula.style.display = 'inline-block';
        formula.style.transform = `scale(${scale})`;
        formula.style.transformOrigin = 'top left';
        display.style.height = `${Math.ceil(formulaHeight * scale)}px`;
        display.style.width = '100%';
    }
}

function semanticBoundaryRows(root: HTMLElement, pixelRatio: number, totalHeight: number): number[] {
    const rootTop = root.getBoundingClientRect().top;
    const rows: number[] = [];
    const elements = root.querySelectorAll<HTMLElement>([
        '.message-section',
        '.message-header',
        '.user-prompt',
        '.assistant-response-label',
        '.reader-markdown > *',
        '.reader-code-block',
        'table tr',
        'li',
    ].join(','));
    for (const element of Array.from(elements)) {
        const rect = element.getBoundingClientRect();
        rows.push(Math.round((rect.top - rootTop) * pixelRatio));
        rows.push(Math.round((rect.bottom - rootTop) * pixelRatio));
        if (element.matches('pre, .reader-code-block')) {
            const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
            if (Number.isFinite(lineHeight) && lineHeight > 0) {
                for (let y = rect.top + lineHeight; y < rect.bottom; y += lineHeight) {
                    rows.push(Math.round((y - rootTop) * pixelRatio));
                }
            }
        }
    }
    return Array.from(new Set(rows))
        .filter((row) => row > 0 && row < totalHeight)
        .sort((left, right) => left - right);
}

function defaultWorkerFactory(): Worker {
    return new Worker(new URL('png-encoder-worker.js', window.location.href), { name: 'aimd-png-encoder' });
}

type PrunedElementState = {
    element: HTMLElement;
    children: DocumentFragment | null;
    styleCssText: string;
    ariaHidden: string | null;
};

function pruneOffBandBlocks(
    source: HTMLElement,
    startCssPx: number,
    endCssPx: number,
): () => void {
    const sourceTop = source.getBoundingClientRect().top;
    const measured = Array.from(source.querySelectorAll<HTMLElement>(BAND_BLOCK_SELECTOR)).map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
    }));
    const offBand = new Set(measured.filter(({ rect }) => {
        const top = rect.top - sourceTop;
        const bottom = rect.bottom - sourceTop;
        return !(bottom > startCssPx && top < endCssPx);
    }).map(({ element }) => element));
    const roots = measured.filter(({ element }) => {
        if (!offBand.has(element)) return false;
        let ancestor = element.parentElement?.closest<HTMLElement>(BAND_BLOCK_SELECTOR) ?? null;
        while (ancestor && source.contains(ancestor)) {
            if (offBand.has(ancestor)) return false;
            ancestor = ancestor.parentElement?.closest<HTMLElement>(BAND_BLOCK_SELECTOR) ?? null;
        }
        return true;
    });
    const states: PrunedElementState[] = [];

    const save = (element: HTMLElement, keepChildren: boolean): PrunedElementState => {
        const state: PrunedElementState = {
            element,
            children: keepChildren ? null : document.createDocumentFragment(),
            styleCssText: element.style.cssText,
            ariaHidden: element.getAttribute('aria-hidden'),
        };
        if (state.children) {
            while (element.firstChild) state.children.appendChild(element.firstChild);
        }
        states.push(state);
        return state;
    };

    for (const { element, rect } of roots) {
        const isTableRow = element.tagName === 'TR';
        save(element, isTableRow);
        if (isTableRow) {
            for (const cell of Array.from((element as HTMLTableRowElement).cells)) save(cell, false);
        }
        // Preserve the measured box and table/list structure while removing the subtree that
        // html-to-image would otherwise serialize again for every unrelated band.
        element.setAttribute('aria-hidden', 'true');
        element.style.boxSizing = 'border-box';
        element.style.height = `${Math.max(0, rect.height)}px`;
        element.style.minHeight = `${Math.max(0, rect.height)}px`;
        element.style.visibility = 'hidden';
    }

    return () => {
        for (let index = states.length - 1; index >= 0; index -= 1) {
            const state = states[index]!;
            if (state.children) state.element.replaceChildren(state.children);
            state.element.style.cssText = state.styleCssText;
            if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
            else state.element.setAttribute('aria-hidden', state.ariaHidden);
        }
    };
}

async function renderBand(
    source: HTMLElement,
    startRow: number,
    endRow: number,
    widthCssPx: number,
    pixelRatio: number,
    sceneIndex: MessageBandSceneIndex | null,
): Promise<HTMLCanvasElement> {
    const heightCssPx = (endRow - startRow) / pixelRatio;
    const canvasWidthCssPx = Math.ceil(widthCssPx * pixelRatio) / pixelRatio;
    const viewport = document.createElement('div');
    viewport.style.position = 'fixed';
    // html-to-image serializes the capture node's own positioning into its foreignObject.
    // The renderer iframe is already hidden by the content host, so keep the capture viewport
    // at the iframe origin; an offscreen left offset would move every cloned pixel out of frame.
    viewport.style.left = '0';
    viewport.style.top = '0';
    viewport.style.width = `${widthCssPx}px`;
    viewport.style.height = `${heightCssPx}px`;
    viewport.style.overflow = 'hidden';
    viewport.style.background = '#ffffff';
    viewport.style.pointerEvents = 'none';

    const sourceParent = source.parentNode;
    const sourceNextSibling = source.nextSibling;
    const sourceStyle = source.style.cssText;
    const activeScene = sceneIndex
        ? activateMessageBandScene(
            sceneIndex,
            startRow / pixelRatio,
            endRow / pixelRatio,
            pixelRatio,
        )
        : null;
    const restoreBlocks = activeScene
        ? () => undefined
        : pruneOffBandBlocks(source, startRow / pixelRatio, endRow / pixelRatio);
    (document.body || document.documentElement).appendChild(viewport);
    viewport.appendChild(source);
    source.style.position = 'absolute';
    source.style.left = '0';
    source.style.top = `${activeScene?.sourceTopCssPx ?? -startRow / pixelRatio}px`;
    source.style.width = `${widthCssPx}px`;

    try {
        return await toCanvas(viewport, {
            width: widthCssPx,
            height: heightCssPx,
            canvasWidth: canvasWidthCssPx,
            canvasHeight: heightCssPx,
            pixelRatio,
            backgroundColor: '#ffffff',
            cacheBust: false,
            // The cloned root already carries the job-scoped KaTeX CSS and data fonts exactly once.
            fontEmbedCSS: '',
            skipAutoScale: true,
            includeStyleProperties: MESSAGE_CAPTURE_STYLE_PROPERTIES,
            ...(activeScene ? { filter: activeScene.filter } : {}),
        });
    } finally {
        source.style.cssText = sourceStyle;
        if (sourceParent) {
            if (sourceNextSibling?.parentNode === sourceParent) sourceParent.insertBefore(source, sourceNextSibling);
            else sourceParent.appendChild(source);
        }
        activeScene?.restore();
        restoreBlocks();
        viewport.remove();
    }
}

export async function renderMessagePngCapability(
    job: MessagePngRenderHostJob,
    sink: MessagePngCapabilitySink,
    options: MessagePngCapabilityOptions = {},
): Promise<void> {
    throwIfAborted(options.signal);
    sink.onProgress({ phase: 'compiling' });
    const rendered = renderMessageCardProfile(job.document, { widthCssPx: job.options.widthCssPx });
    const root = createRoot(job.options.widthCssPx);
    root.innerHTML = rendered.html;
    removeNonVisualPngMarkup(root);

    try {
        const fontEmbed = await getKatexCssWithEmbeddedFonts(rendered.html);
        if (fontEmbed.css) {
            const katexStyle = document.createElement('style');
            katexStyle.dataset.aimdExportKatex = 'true';
            katexStyle.textContent = fontEmbed.css;
            root.prepend(katexStyle);
        }
        sink.onProgress({ phase: 'layout' });
        await waitForFonts();
        await waitForImages(root, options.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
        replaceUnavailableImages(root);
        fitWideFormulaBlocks(root);
        await yieldToRenderer(options.signal);
        const heightCssPx = Math.max(1, Math.ceil(root.scrollHeight || root.getBoundingClientRect().height));
        const output = planMessagePngOutput({
            widthCssPx: job.options.widthCssPx,
            heightCssPx,
            requestedPixelRatio: job.options.requestedPixelRatio,
        });
        const boundaries = semanticBoundaryRows(root, output.effectivePixelRatio, output.pixelHeight);
        // Keep ordinary bands small for responsiveness. Ultra-long exports use the 8M hard
        // ceiling because Firefox's repeated foreignObject setup becomes slower than the larger
        // band raster; the built-renderer gate keeps this branch below the 20-second file target.
        const preferredBandPixels = output.pixelHeight >= ULTRA_LONG_DOCUMENT_HEIGHT_PX
            ? MESSAGE_PNG_LIMITS.maxBandPixels
            : PREFERRED_BAND_PIXELS;
        const parts = planMessageBands({
            totalPixelHeight: output.pixelHeight,
            maxPartPixelHeight: output.maxPartPixelHeight,
            maxBandPixelHeight: Math.max(1, Math.min(
                output.maxBandPixelHeight,
                Math.floor(preferredBandPixels / output.pixelWidth),
            )),
            boundaryPixelRows: boundaries,
        });
        const totalBands = parts.reduce((total, part) => total + part.bands.length, 0);
        const sceneIndex = totalBands > 1 ? indexMessageBandScene(root) : null;
        let completedBands = 0;

        for (const part of parts) {
            throwIfAborted(options.signal);
            let sequence = 0;
            const partWorker = new WorkerPngEncoderClient(
                (options.createWorker ?? defaultWorkerFactory)(),
                (bytes) => sink.onArtifactChunk(sequence++, bytes),
            );
            const partHeight = part.endRow - part.startRow;
            sink.onArtifactStart({
                mimeType: 'image/png',
                widthPx: output.pixelWidth,
                heightPx: partHeight,
                effectivePixelRatio: output.effectivePixelRatio,
                partNumber: part.partNumber,
                partCount: part.partCount,
            });
            const cancelWorker = () => {
                void partWorker.cancel().catch(() => undefined);
            };
            try {
                await partWorker.start(output.pixelWidth, partHeight);
                options.signal?.addEventListener('abort', cancelWorker, { once: true });
                throwIfAborted(options.signal);
                for (let bandIndex = 0; bandIndex < part.bands.length; bandIndex += 1) {
                    throwIfAborted(options.signal);
                    const band = part.bands[bandIndex]!;
                    sink.onProgress({
                        phase: 'rasterizing',
                        completed: completedBands,
                        total: totalBands,
                    });
                    await yieldToRenderer(options.signal);
                    const canvas = await renderBand(
                        root,
                        band.startRow,
                        band.endRow,
                        job.options.widthCssPx,
                        output.effectivePixelRatio,
                        sceneIndex,
                    );
                    try {
                        const expectedHeight = band.endRow - band.startRow;
                        if (canvas.width !== output.pixelWidth || canvas.height !== expectedHeight) {
                            throw new Error(
                                `Band canvas size mismatch: expected ${output.pixelWidth}x${expectedHeight}, received ${canvas.width}x${canvas.height}.`,
                            );
                        }
                        const context = canvas.getContext('2d', { willReadFrequently: true });
                        if (!context) throw new Error('Band canvas context unavailable.');
                        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
                        const bytes = rgba.buffer instanceof ArrayBuffer
                            && rgba.byteOffset === 0
                            && rgba.byteLength === rgba.buffer.byteLength
                            ? rgba.buffer
                            : rgba.slice().buffer;
                        sink.onProgress({ phase: 'encoding', completed: completedBands, total: totalBands });
                        throwIfAborted(options.signal);
                        const encoded = partWorker.writeBand(
                            band.startRow - part.startRow,
                            expectedHeight,
                            bytes,
                        );
                        // postMessage transfers RGBA synchronously; release the backing canvas while the worker
                        // filters and compresses instead of retaining another band-sized surface until its ack.
                        canvas.width = 1;
                        canvas.height = 1;
                        await encoded;
                        completedBands += 1;
                    } finally {
                        canvas.width = 1;
                        canvas.height = 1;
                    }
                }
                await partWorker.finish();
                sink.onArtifactComplete();
            } catch (error) {
                await partWorker.cancel().catch(() => undefined);
                throw error;
            } finally {
                options.signal?.removeEventListener('abort', cancelWorker);
                partWorker.terminate();
            }
        }
        sink.onProgress({ phase: 'finalizing', completed: parts.length, total: parts.length });
    } finally {
        root.remove();
    }
}
