import { toCanvas } from 'html-to-image';
import { logger } from '../../../core/logger';
import { getPngKatexFontEmbed, type PngKatexFontEmbedResult } from './pngKatexFonts';

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
const IMAGE_PLACEHOLDER_DATA_URL =
    'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22320%22 viewBox=%220 0 640 320%22%3E%3Crect width=%22640%22 height=%22320%22 rx=%2216%22 fill=%22%23f6f8fa%22/%3E%3Crect x=%221%22 y=%221%22 width=%22638%22 height=%22318%22 rx=%2215%22 fill=%22none%22 stroke=%22%23d0d7de%22/%3E%3Ctext x=%22320%22 y=%22162%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2220%22 fill=%22%2357606a%22%3EImage unavailable%3C/text%3E%3C/svg%3E';

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

function createRenderOptions(plan: RenderPngPlan, pixelRatio: number, fontEmbed: PngKatexFontEmbedResult) {
    return {
        pixelRatio,
        backgroundColor: plan.backgroundColor,
        cacheBust: true,
        imagePlaceholder: IMAGE_PLACEHOLDER_DATA_URL,
        fontEmbedCSS: fontEmbed.css,
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

function collectChunkBlocks(node: HTMLElement): HTMLElement[] {
    const reader = node.querySelector<HTMLElement>('.reader-markdown');
    if (reader) {
        const blocks = Array.from(reader.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        if (blocks.length > 0) return blocks;
    }
    const card = node.querySelector<HTMLElement>('.aimd-png-export-card') || node;
    return Array.from(card.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function groupBlocks(blocks: HTMLElement[], totalHeight: number): HTMLElement[][] {
    if (blocks.length === 0) return [];
    const measured = blocks.map((block) => readElementHeight(block, 0));
    const fallbackHeight = Math.max(1, Math.ceil(totalHeight / blocks.length));
    const heights = measured.map((height) => height > 0 ? height : fallbackHeight);
    const groups: HTMLElement[][] = [];
    let current: HTMLElement[] = [];
    let currentHeight = 0;
    blocks.forEach((block, index) => {
        const height = heights[index] ?? fallbackHeight;
        if (current.length > 0 && currentHeight + height > TARGET_CHUNK_HEIGHT) {
            groups.push(current);
            current = [];
            currentHeight = 0;
        }
        current.push(block);
        currentHeight += height;
    });
    if (current.length > 0) groups.push(current);
    return groups;
}

function buildChunkNode(sourceNode: HTMLElement, blocks: HTMLElement[], index: number): HTMLElement {
    const chunk = document.createElement('div');
    chunk.style.width = sourceNode.style.width;
    chunk.style.background = sourceNode.style.background;

    Array.from(sourceNode.children).forEach((child) => {
        if (child instanceof HTMLStyleElement) chunk.appendChild(child.cloneNode(true));
    });

    const sourceCard = sourceNode.querySelector<HTMLElement>('.aimd-png-export-card');
    if (!sourceCard) {
        blocks.forEach((block) => chunk.appendChild(block.cloneNode(true)));
        return chunk;
    }

    const card = sourceCard.cloneNode(true) as HTMLElement;
    const reader = card.querySelector<HTMLElement>('.reader-markdown');
    if (reader) {
        reader.replaceChildren(...blocks.map((block) => block.cloneNode(true)));
        if (index > 0) {
            card.querySelector('.message-header')?.remove();
            card.querySelector('.user-prompt')?.remove();
            card.querySelector('.assistant-response-label')?.remove();
        }
    } else {
        card.replaceChildren(...blocks.map((block) => block.cloneNode(true)));
    }
    chunk.appendChild(card);
    return chunk;
}

async function renderNodeToCanvas(node: HTMLElement, plan: RenderPngPlan, pixelRatio: number, fontEmbed: PngKatexFontEmbedResult): Promise<HTMLCanvasElement> {
    return toCanvas(node, createRenderOptions(plan, pixelRatio, fontEmbed));
}

async function renderChunkedCanvas(sourceNode: HTMLElement, plan: RenderPngPlan, pixelRatio: number, fontEmbed: PngKatexFontEmbedResult, totalHeight: number): Promise<{
    canvas: HTMLCanvasElement;
    chunkCount: number;
}> {
    const blocks = collectChunkBlocks(sourceNode);
    const groups = groupBlocks(blocks, totalHeight);
    if (groups.length <= 1) {
        return { canvas: await renderNodeToCanvas(sourceNode, plan, pixelRatio, fontEmbed), chunkCount: 1 };
    }

    const canvases: HTMLCanvasElement[] = [];
    for (let index = 0; index < groups.length; index += 1) {
        const chunkNode = buildChunkNode(sourceNode, groups[index]!, index);
        sourceNode.parentElement?.appendChild(chunkNode);
        try {
            await waitForImages(chunkNode, plan.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
            replaceUnavailableImages(chunkNode);
            canvases.push(await renderNodeToCanvas(chunkNode, plan, pixelRatio, fontEmbed));
        } finally {
            chunkNode.remove();
        }
    }

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

export async function renderPngBlob(plan: RenderPngPlan): Promise<Blob> {
    const root = createRoot();
    const node = document.createElement('div');
    node.style.width = `${plan.width}px`;
    node.style.background = plan.backgroundColor;
    node.innerHTML = plan.html;
    root.appendChild(node);

    try {
        const fontEmbed = await getPngKatexFontEmbed(plan.html);
        await waitForFonts();
        await waitForImages(node, plan.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
        replaceUnavailableImages(node);
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
        const rendered = strategy === 'chunked'
            ? await renderChunkedCanvas(node, plan, effectivePixelRatio, fontEmbed, exportHeight)
            : { canvas: await renderNodeToCanvas(node, plan, effectivePixelRatio, fontEmbed), chunkCount: 1 };
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
        return await canvasToBlob(rendered.canvas);
    } catch (err: any) {
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
