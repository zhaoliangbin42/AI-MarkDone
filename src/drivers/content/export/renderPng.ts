import { toCanvas } from 'html-to-image';
import { logger } from '../../../core/logger';
import { getKatexCssWithEmbeddedFonts, type KatexEmbeddedCssResult } from '../../../core/export/katexAssets';
import {
    BITMAP_CAPTURE_STYLE_PROPERTIES,
    fitWideBitmapFormulaBlocks,
    removeNonVisualBitmapMarkup,
} from './htmlToImageCapture';
import { isRenderAbortError, throwIfAborted, yieldToBrowser, type RenderProgressEvent } from './renderControl';

export type RenderPngMetrics = {
    width: number;
    height: number;
    requestedPixelRatio: number;
    effectivePixelRatio: number;
    pixelArea: number;
    capReason?: 'dimension' | 'pixel-area';
    fontStatus: 'skipped' | 'loaded';
    strategy: 'single' | 'chunked';
    chunkCount?: number;
    maxChunkHeight?: number;
    fontEmbedMode: 'none' | 'data-url' | 'failed';
};

export type RenderPngPlan = {
    filename: string;
    html: string;
    width: number;
    pixelRatio: number;
    backgroundColor: string;
    imageTimeoutMs?: number;
    onMetrics?: (metrics: RenderPngMetrics) => void;
    onProgress?: (event: RenderProgressEvent) => void;
    signal?: AbortSignal;
};

type PixelRatioResult = {
    effectivePixelRatio: number;
    capReason?: 'dimension' | 'pixel-area';
};

const ROOT_ID = 'aimd-png-export-root';
const DEFAULT_IMAGE_TIMEOUT_MS = 1500;
const SAFE_CANVAS_DIMENSION_LIMIT = 16384;
const SAFE_CANVAS_PIXEL_AREA_LIMIT = 24_000_000;
const CHUNK_HEIGHT_TRIGGER = 2000;
const MAX_CHUNK_HEIGHT = 2000;
const TARGET_CHUNK_HEIGHT = 2000;
const TARGET_CHUNK_NODE_COUNT = 900;
const TARGET_CHUNK_COMPLEX_NODE_COUNT = 120;
const TARGET_CHUNK_TEXT_CHARS = 16000;
const IMAGE_PLACEHOLDER_DATA_URL =
    'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22320%22 viewBox=%220 0 640 320%22%3E%3Crect width=%22640%22 height=%22320%22 rx=%2216%22 fill=%22%23f6f8fa%22/%3E%3Crect x=%221%22 y=%221%22 width=%22638%22 height=%22318%22 rx=%2215%22 fill=%22none%22 stroke=%22%23d0d7de%22/%3E%3Ctext x=%22320%22 y=%22162%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2220%22 fill=%22%2357606a%22%3EImage unavailable%3C/text%3E%3C/svg%3E';

type BlockCost = {
    height: number;
    nodes: number;
    complexNodes: number;
    textChars: number;
};

type ChunkGroup = {
    sectionId: string;
    blockIds: string[];
    includePreamble: boolean;
};

function createRoot(): HTMLElement {
    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'fixed';
    root.style.left = '-100000px';
    root.style.top = '0';
    root.style.width = '1px';
    root.style.height = '1px';
    root.style.overflow = 'hidden';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
    return root;
}

async function waitForFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    try {
        await fonts?.ready;
    } catch {
        // Font readiness is best-effort; export should still try with available fonts.
    }
}

async function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    if (images.length === 0) return;
    await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const done = () => {
                img.removeEventListener('load', done);
                img.removeEventListener('error', done);
                resolve();
            };
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            window.setTimeout(done, Math.max(0, timeoutMs));
        });
    }));
}

function replaceUnavailableImages(root: HTMLElement): void {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    for (const img of images) {
        if (img.complete && img.naturalWidth > 0) continue;
        const placeholder = document.createElement('div');
        placeholder.className = 'aimd-png-image-placeholder';
        const label = img.alt || img.getAttribute('src') || 'Image unavailable';
        placeholder.textContent = `Image unavailable: ${label}`;
        img.replaceWith(placeholder);
    }
}

function resolveSafePixelRatio(requestedPixelRatio: number, width: number, height: number): PixelRatioResult {
    const requested = Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0 ? requestedPixelRatio : 1;
    const maxDimension = Math.max(1, width, height);
    const dimensionRatio = SAFE_CANVAS_DIMENSION_LIMIT / maxDimension;
    const areaRatio = Math.sqrt(SAFE_CANVAS_PIXEL_AREA_LIMIT / Math.max(1, width * height));
    const safeRatio = Math.min(requested, dimensionRatio, areaRatio);
    const effectivePixelRatio = Math.max(0.1, Math.round(safeRatio * 10000) / 10000);
    let capReason: 'dimension' | 'pixel-area' | undefined;
    if (effectivePixelRatio < requested) {
        capReason = dimensionRatio <= areaRatio ? 'dimension' : 'pixel-area';
    }
    return { effectivePixelRatio, capReason };
}

function createRenderOptions(plan: RenderPngPlan, pixelRatio: number) {
    return {
        pixelRatio,
        backgroundColor: plan.backgroundColor,
        cacheBust: false,
        imagePlaceholder: IMAGE_PLACEHOLDER_DATA_URL,
        // The capture node already owns the job-scoped KaTeX CSS and embedded fonts.
        fontEmbedCSS: '',
        skipAutoScale: true,
        includeStyleProperties: BITMAP_CAPTURE_STYLE_PROPERTIES,
    };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('renderer returned an empty blob'));
        }, 'image/png');
    });
}

function readElementHeight(element: HTMLElement, fallback = 1): number {
    const rectHeight = element.getBoundingClientRect?.().height || 0;
    return Math.max(0, element.scrollHeight || element.offsetHeight || rectHeight || fallback);
}

function estimateBlockCost(block: HTMLElement, fallbackHeight: number): BlockCost {
    const descendants = Array.from(block.querySelectorAll('*'));
    const complexNodes = descendants.filter((node) => {
        if (!(node instanceof Element)) return false;
        return node.matches([
            'img',
            'svg',
            'canvas',
            'table',
            'thead',
            'tbody',
            'tr',
            'td',
            'th',
            'pre',
            'code',
            '.reader-code-block',
            '.reader-code-block *',
            '.katex',
            '.katex *',
            'mjx-container',
            'mjx-container *',
        ].join(','));
    }).length;
    return {
        height: readElementHeight(block, fallbackHeight),
        nodes: descendants.length + 1,
        complexNodes,
        textChars: block.textContent?.length ?? 0,
    };
}

function wouldExceedChunkBudget(current: BlockCost, next: BlockCost): boolean {
    // Low-height content can still stall html-to-image when rich DOM nodes pile up.
    return current.height + next.height > TARGET_CHUNK_HEIGHT
        || current.nodes + next.nodes > TARGET_CHUNK_NODE_COUNT
        || current.complexNodes + next.complexNodes > TARGET_CHUNK_COMPLEX_NODE_COUNT
        || current.textChars + next.textChars > TARGET_CHUNK_TEXT_CHARS;
}

function groupBlocks(blocks: HTMLElement[], totalHeight: number): HTMLElement[][] {
    if (blocks.length === 0) return [];
    const fallbackHeight = Math.max(1, Math.ceil(totalHeight / blocks.length));
    const costs = blocks.map((block) => estimateBlockCost(block, fallbackHeight));
    const groups: HTMLElement[][] = [];
    let current: HTMLElement[] = [];
    let currentCost: BlockCost = { height: 0, nodes: 0, complexNodes: 0, textChars: 0 };
    blocks.forEach((block, index) => {
        const cost = costs[index] ?? estimateBlockCost(block, fallbackHeight);
        if (current.length > 0 && wouldExceedChunkBudget(currentCost, cost)) {
            groups.push(current);
            current = [];
            currentCost = { height: 0, nodes: 0, complexNodes: 0, textChars: 0 };
        }
        current.push(block);
        currentCost = {
            height: currentCost.height + cost.height,
            nodes: currentCost.nodes + cost.nodes,
            complexNodes: currentCost.complexNodes + cost.complexNodes,
            textChars: currentCost.textChars + cost.textChars,
        };
    });
    if (current.length > 0) groups.push(current);
    return groups;
}

function planChunkGroups(sourceNode: HTMLElement, totalHeight: number): ChunkGroup[] {
    const readers = Array.from(sourceNode.querySelectorAll<HTMLElement>('.reader-markdown'));
    if (readers.length === 0) return [];

    const groups: ChunkGroup[] = [];
    readers.forEach((reader, readerIndex) => {
        const section = reader.closest<HTMLElement>('.message-section')
            ?? reader.closest<HTMLElement>('.aimd-png-export-card')
            ?? reader;
        const sectionId = `section-${readerIndex}`;
        section.dataset.aimdPngSectionId = sectionId;
        const blocks = Array.from(reader.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        blocks.forEach((block, blockIndex) => {
            block.dataset.aimdPngBlockId = `${sectionId}-block-${blockIndex}`;
        });
        const sectionHeight = readElementHeight(section, Math.max(1, totalHeight / readers.length));
        groupBlocks(blocks, sectionHeight).forEach((blockGroup, groupIndex) => {
            groups.push({
                sectionId,
                blockIds: blockGroup.map((block) => block.dataset.aimdPngBlockId!),
                includePreamble: groupIndex === 0,
            });
        });
    });
    return groups;
}

function buildChunkNode(sourceNode: HTMLElement, group: ChunkGroup): HTMLElement {
    const chunk = sourceNode.cloneNode(true) as HTMLElement;
    const selected = new Set(group.blockIds);

    for (const section of Array.from(chunk.querySelectorAll<HTMLElement>('[data-aimd-png-section-id]'))) {
        if (section.dataset.aimdPngSectionId !== group.sectionId) {
            section.remove();
            continue;
        }
        for (const block of Array.from(section.querySelectorAll<HTMLElement>('[data-aimd-png-block-id]'))) {
            if (!selected.has(block.dataset.aimdPngBlockId!)) block.remove();
            else block.removeAttribute('data-aimd-png-block-id');
        }
        section.removeAttribute('data-aimd-png-section-id');
        if (!group.includePreamble) {
            section.querySelector('.message-header')?.remove();
            section.querySelector('.user-prompt')?.remove();
            section.querySelector('.assistant-response-label')?.remove();
        }
    }
    return chunk;
}

async function renderNodeToCanvas(node: HTMLElement, plan: RenderPngPlan, pixelRatio: number): Promise<HTMLCanvasElement> {
    return toCanvas(node, createRenderOptions(plan, pixelRatio));
}

async function renderChunkedCanvas(sourceNode: HTMLElement, plan: RenderPngPlan, pixelRatio: number, totalHeight: number): Promise<{
    canvas: HTMLCanvasElement;
    chunkCount: number;
}> {
    const groups = planChunkGroups(sourceNode, totalHeight);
    if (groups.length <= 1) {
        return { canvas: await renderNodeToCanvas(sourceNode, plan, pixelRatio), chunkCount: 1 };
    }

    const canvases: HTMLCanvasElement[] = [];
    for (let index = 0; index < groups.length; index += 1) {
        throwIfAborted(plan.signal);
        plan.onProgress?.({ phase: 'rendering_chunk', completed: index, total: groups.length });
        await yieldToBrowser(plan.signal);
        const chunkNode = buildChunkNode(sourceNode, groups[index]!);
        sourceNode.parentElement?.appendChild(chunkNode);
        try {
            await waitForImages(chunkNode, plan.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
            replaceUnavailableImages(chunkNode);
            canvases.push(await renderNodeToCanvas(chunkNode, plan, pixelRatio));
            plan.onProgress?.({ phase: 'rendering_chunk', completed: index + 1, total: groups.length });
            await yieldToBrowser(plan.signal);
        } finally {
            chunkNode.remove();
        }
    }

    throwIfAborted(plan.signal);
    plan.onProgress?.({ phase: 'stitching', completed: groups.length, total: groups.length });
    await yieldToBrowser(plan.signal);
    const width = Math.max(...canvases.map((canvas) => canvas.width));
    const height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
    if (width > SAFE_CANVAS_DIMENSION_LIMIT || height > SAFE_CANVAS_DIMENSION_LIMIT) {
        throw new Error(`PNG export failed for ${plan.filename}: stitched canvas exceeds browser limit (${width}x${height}).`);
    }
    const stitched = document.createElement('canvas');
    stitched.width = width;
    stitched.height = height;
    const context = stitched.getContext('2d');
    if (!context) throw new Error(`PNG export failed for ${plan.filename}: canvas context unavailable.`);
    context.fillStyle = plan.backgroundColor;
    context.fillRect(0, 0, stitched.width, stitched.height);
    let y = 0;
    for (const canvas of canvases) {
        context.drawImage(canvas, 0, y);
        y += canvas.height;
    }
    return { canvas: stitched, chunkCount: canvases.length };
}

function injectKatexCss(node: HTMLElement, fontEmbed: KatexEmbeddedCssResult): void {
    if (fontEmbed.mode !== 'data-url' || !fontEmbed.css) return;
    const style = document.createElement('style');
    style.dataset.aimdKatexExportCss = '1';
    style.textContent = fontEmbed.css;
    node.prepend(style);
}

export async function renderPngBlob(plan: RenderPngPlan): Promise<Blob> {
    throwIfAborted(plan.signal);
    plan.onProgress?.({ phase: 'preparing' });
    const root = createRoot();
    const node = document.createElement('div');
    node.style.width = `${plan.width}px`;
    node.style.background = plan.backgroundColor;
    node.innerHTML = plan.html;
    removeNonVisualBitmapMarkup(node);
    root.appendChild(node);

    try {
        const fontEmbed = await getKatexCssWithEmbeddedFonts(plan.html);
        injectKatexCss(node, fontEmbed);
        await yieldToBrowser(plan.signal);
        plan.onProgress?.({ phase: 'loading_assets' });
        await waitForFonts();
        throwIfAborted(plan.signal);
        await waitForImages(node, plan.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
        throwIfAborted(plan.signal);
        replaceUnavailableImages(node);
        fitWideBitmapFormulaBlocks(node);
        await yieldToBrowser(plan.signal);
        const exportWidth = node.scrollWidth || plan.width;
        const exportHeight = node.scrollHeight;
        const { effectivePixelRatio, capReason } = resolveSafePixelRatio(plan.pixelRatio, exportWidth, exportHeight);
        if (effectivePixelRatio < plan.pixelRatio) {
            const warningMessage = capReason === 'pixel-area'
                ? '[AI-MarkDone][PNGExport] Export node exceeds safe canvas budget; pixel ratio was capped.'
                : '[AI-MarkDone][PNGExport] Export node exceeds safe canvas dimension; pixel ratio was capped.';
            logger.warn(warningMessage, {
                filename: plan.filename,
                width: exportWidth,
                height: exportHeight,
                requestedPixelRatio: plan.pixelRatio,
                effectivePixelRatio,
                capReason,
                canvasDimensionLimit: SAFE_CANVAS_DIMENSION_LIMIT,
                canvasPixelAreaLimit: SAFE_CANVAS_PIXEL_AREA_LIMIT,
            });
        }

        const strategy = exportHeight > CHUNK_HEIGHT_TRIGGER ? 'chunked' : 'single';
        plan.onProgress?.({ phase: 'rendering', completed: 0, total: strategy === 'chunked' ? undefined : 1 });
        await yieldToBrowser(plan.signal);
        const rendered = strategy === 'chunked'
            ? await renderChunkedCanvas(node, plan, effectivePixelRatio, exportHeight)
            : { canvas: await renderNodeToCanvas(node, plan, effectivePixelRatio), chunkCount: 1 };
        throwIfAborted(plan.signal);
        if (strategy === 'single') {
            plan.onProgress?.({ phase: 'rendering', completed: 1, total: 1 });
        }
        plan.onMetrics?.({
            width: exportWidth,
            height: exportHeight,
            requestedPixelRatio: plan.pixelRatio,
            effectivePixelRatio,
            pixelArea: Math.round(exportWidth * exportHeight * effectivePixelRatio * effectivePixelRatio),
            capReason,
            fontStatus: fontEmbed.mode === 'data-url' ? 'loaded' : 'skipped',
            strategy,
            chunkCount: rendered.chunkCount,
            maxChunkHeight: strategy === 'chunked' ? MAX_CHUNK_HEIGHT : undefined,
            fontEmbedMode: fontEmbed.mode,
        });
        plan.onProgress?.({ phase: 'encoding' });
        await yieldToBrowser(plan.signal);
        const blob = await canvasToBlob(rendered.canvas);
        throwIfAborted(plan.signal);
        plan.onProgress?.({ phase: 'done' });
        return blob;
    } catch (err: any) {
        if (isRenderAbortError(err)) throw err;
        if (err?.message?.startsWith('PNG export failed')) throw err;
        const exportWidth = node.scrollWidth || plan.width;
        const exportHeight = node.scrollHeight;
        throw new Error(
            `PNG export failed for ${plan.filename} ` +
            `(${exportWidth}x${exportHeight}, pixelRatio ${plan.pixelRatio}): ${err?.message || String(err)}`
        );
    } finally {
        root.remove();
    }
}
