import { toBlob } from 'html-to-image';
import { logger } from '../../../core/logger';

export type RenderPngPlan = {
    filename: string;
    html: string;
    width: number;
    pixelRatio: number;
    backgroundColor: string;
    imageTimeoutMs?: number;
};

const ROOT_ID = 'aimd-png-export-root';
const DEFAULT_IMAGE_TIMEOUT_MS = 1500;
const SAFE_CANVAS_DIMENSION_LIMIT = 16384;
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

function resolveSafePixelRatio(requestedPixelRatio: number, width: number, height: number): number {
    const requested = Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0 ? requestedPixelRatio : 1;
    const maxDimension = Math.max(1, width, height);
    const safeRatio = Math.min(requested, SAFE_CANVAS_DIMENSION_LIMIT / maxDimension);
    return Math.max(0.1, Math.round(safeRatio * 10000) / 10000);
}

export async function renderPngBlob(plan: RenderPngPlan): Promise<Blob> {
    const root = createRoot();
    const node = document.createElement('div');
    node.style.width = `${plan.width}px`;
    node.style.background = plan.backgroundColor;
    node.innerHTML = plan.html;
    root.appendChild(node);

    try {
        await waitForFonts();
        await waitForImages(node, plan.imageTimeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS);
        replaceUnavailableImages(node);
        const exportWidth = node.scrollWidth || plan.width;
        const exportHeight = node.scrollHeight;
        const effectivePixelRatio = resolveSafePixelRatio(plan.pixelRatio, exportWidth, exportHeight);
        if (effectivePixelRatio < plan.pixelRatio) {
            logger.warn('[AI-MarkDone][PNGExport] Export node exceeds safe canvas dimension; pixel ratio was capped.', {
                filename: plan.filename,
                width: exportWidth,
                height: exportHeight,
                requestedPixelRatio: plan.pixelRatio,
                effectivePixelRatio,
                canvasDimensionLimit: SAFE_CANVAS_DIMENSION_LIMIT,
            });
        }
        const blob = await toBlob(node, {
            pixelRatio: effectivePixelRatio,
            backgroundColor: plan.backgroundColor,
            cacheBust: true,
            imagePlaceholder: IMAGE_PLACEHOLDER_DATA_URL,
            fontEmbedCSS: '',
        });
        if (!blob) {
            throw new Error(
                `PNG export failed for ${plan.filename}: renderer returned an empty blob ` +
                `(${exportWidth}x${exportHeight}, pixelRatio ${effectivePixelRatio}).`
            );
        }
        return blob;
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
