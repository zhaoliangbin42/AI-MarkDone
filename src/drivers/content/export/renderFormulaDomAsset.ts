import { toCanvas, toSvg } from 'html-to-image';
import { getKatexCssWithEmbeddedFonts } from './katexAssets';

export type FormulaDomCaptureOptions = {
    sourceElement?: Element | null;
    fontSizePx: number;
    pixelRatio?: number;
    backgroundColor?: string;
};

const ROOT_ID = 'aimd-formula-dom-export-root';
const DEFAULT_PIXEL_RATIO = 2;
const MAX_REQUESTED_PIXEL_RATIO = 4;
const SAFE_CANVAS_DIMENSION_LIMIT = 16384;
const SAFE_CANVAS_PIXEL_AREA_LIMIT = 24_000_000;
const CAPTURE_PADDING_PX = 4;

type PreparedFormulaNode = {
    root: HTMLElement;
    node: HTMLElement;
    width: number;
    height: number;
    fontEmbedCss: string;
    cleanup: () => void;
};

type VisualBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

function findFormulaVisualRoot(element: Element | null | undefined): HTMLElement | null {
    if (!(element instanceof HTMLElement)) return null;
    const root = element.closest<HTMLElement>('.katex-display, .math-block, .math-inline')
        || element.closest<HTMLElement>('.katex')
        || (element.matches('mjx-container, .MathJax') ? element : null);
    return root;
}

function sanitizeCloneStyles(root: HTMLElement): void {
    const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
    for (const element of elements) {
        element.style.cursor = '';
        element.style.background = '';
        element.style.backgroundColor = '';
        element.style.transition = '';
    }
}

function createCaptureRoot(): HTMLElement {
    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'fixed';
    root.style.left = '-100000px';
    root.style.top = '0';
    root.style.width = 'max-content';
    root.style.height = 'max-content';
    root.style.overflow = 'visible';
    root.style.pointerEvents = 'none';
    root.style.background = 'transparent';
    document.body.appendChild(root);
    return root;
}

async function waitForFonts(): Promise<void> {
    try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
        // Font readiness is best-effort; html-to-image still gets embedded KaTeX font CSS.
    }
}

function readNodeSize(node: HTMLElement): { width: number; height: number } {
    const rect = node.getBoundingClientRect?.();
    const width = Math.ceil(rect?.width || node.scrollWidth || node.offsetWidth || 1);
    const height = Math.ceil(rect?.height || node.scrollHeight || node.offsetHeight || 1);
    return {
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}

function readVisualBounds(node: HTMLElement): VisualBounds {
    const origin = node.getBoundingClientRect?.();
    const originLeft = origin?.left || 0;
    const originTop = origin?.top || 0;
    const elements = [node, ...Array.from(node.querySelectorAll<HTMLElement | SVGElement>('*'))];
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const element of elements) {
        if (!shouldMeasureVisualElement(node, element)) continue;
        if (element.closest('svg') && element.tagName.toLowerCase() !== 'svg') continue;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        left = Math.min(left, rect.left - originLeft);
        top = Math.min(top, rect.top - originTop);
        right = Math.max(right, rect.right - originLeft);
        bottom = Math.max(bottom, rect.bottom - originTop);
    }

    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
        const fallback = readNodeSize(node);
        return {
            left: 0,
            top: 0,
            right: fallback.width,
            bottom: fallback.height,
            width: fallback.width,
            height: fallback.height,
        };
    }

    const flooredLeft = Math.floor(left);
    const flooredTop = Math.floor(top);
    const ceiledRight = Math.ceil(right);
    const ceiledBottom = Math.ceil(bottom);
    return {
        left: flooredLeft,
        top: flooredTop,
        right: ceiledRight,
        bottom: ceiledBottom,
        width: Math.max(1, ceiledRight - flooredLeft),
        height: Math.max(1, ceiledBottom - flooredTop),
    };
}

function hasClippedAncestor(root: HTMLElement, element: Element): boolean {
    let current: Element | null = element;
    while (current && current !== root) {
        if (current instanceof HTMLElement || current instanceof SVGElement) {
            const style = getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') {
                return true;
            }
            if (style.clip && style.clip !== 'auto') return true;
            if (style.clipPath && style.clipPath !== 'none') return true;
        }
        current = current.parentElement;
    }
    return false;
}

function shouldMeasureVisualElement(root: HTMLElement, element: HTMLElement | SVGElement): boolean {
    if (element !== root && hasClippedAncestor(root, element)) return false;
    const tag = element.tagName.toLowerCase();
    if (tag === 'svg' || tag === 'img' || tag === 'canvas' || tag === 'video') return true;
    if (element.closest('svg')) return false;
    return element.children.length === 0;
}

function requestedPixelRatio(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? 0) > 0
        ? Math.min(MAX_REQUESTED_PIXEL_RATIO, Math.max(1, value!))
        : DEFAULT_PIXEL_RATIO;
}

function resolveSafePixelRatio(requested: number, width: number, height: number): number {
    const dimensionRatio = SAFE_CANVAS_DIMENSION_LIMIT / Math.max(1, width, height);
    const areaRatio = Math.sqrt(SAFE_CANVAS_PIXEL_AREA_LIMIT / Math.max(1, width * height));
    return Math.max(0.1, Math.min(requested, dimensionRatio, areaRatio));
}

function dataUrlToBlob(dataUrl: string, type: string): Blob {
    const marker = 'base64,';
    const base64Index = dataUrl.indexOf(marker);
    if (base64Index >= 0) {
        const binary = atob(dataUrl.slice(base64Index + marker.length));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type });
    }

    const commaIndex = dataUrl.indexOf(',');
    const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
    return new Blob([decodeURIComponent(payload)], { type });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Formula DOM PNG renderer returned an empty blob.'));
        }, 'image/png');
    });
}

async function prepareFormulaNode(options: FormulaDomCaptureOptions): Promise<PreparedFormulaNode> {
    return prepareFormulaNodeWithPadding(options, CAPTURE_PADDING_PX);
}

async function prepareFormulaNodeWithPadding(options: FormulaDomCaptureOptions, paddingPx: number): Promise<PreparedFormulaNode> {
    const visualRoot = findFormulaVisualRoot(options.sourceElement);
    if (!visualRoot) throw new Error('Formula DOM source is unavailable.');

    const root = createCaptureRoot();
    const style = document.createElement('style');
    const frame = document.createElement('div');
    const clone = visualRoot.cloneNode(true) as HTMLElement;
    sanitizeCloneStyles(clone);
    clone.style.fontSize = `${options.fontSizePx}px`;
    clone.style.lineHeight = 'normal';
    clone.style.color = getComputedStyle(visualRoot).color || 'currentColor';
    clone.style.background = 'transparent';
    clone.style.width = 'max-content';
    clone.style.maxWidth = 'none';
    clone.style.overflow = 'visible';
    clone.style.display = clone.classList.contains('katex-display') || clone.classList.contains('math-block')
        ? 'block'
        : 'inline-block';
    frame.style.position = 'relative';
    frame.style.display = 'block';
    frame.style.overflow = 'visible';
    frame.style.background = 'transparent';
    frame.append(clone);

    const fontCss = await getKatexCssWithEmbeddedFonts(clone.outerHTML);
    style.textContent = `
${fontCss.css}
#${ROOT_ID} {
  font-size: ${options.fontSizePx}px;
  line-height: normal;
  color: ${clone.style.color || 'currentColor'};
}
#${ROOT_ID} .katex-display {
  margin: 0;
  text-align: left;
}
#${ROOT_ID}, #${ROOT_ID} * {
  box-sizing: content-box;
}
`;
    root.append(style, frame);
    await waitForFonts();
    const bounds = readVisualBounds(clone);
    frame.style.width = `${bounds.width + paddingPx * 2}px`;
    frame.style.height = `${bounds.height + paddingPx * 2}px`;
    clone.style.position = 'absolute';
    clone.style.left = `${paddingPx - bounds.left}px`;
    clone.style.top = `${paddingPx - bounds.top}px`;
    clone.style.transform = '';

    return {
        root,
        node: frame,
        width: bounds.width + paddingPx * 2,
        height: bounds.height + paddingPx * 2,
        fontEmbedCss: fontCss.css,
        cleanup: () => root.remove(),
    };
}

export async function renderFormulaDomSvgBlob(options: FormulaDomCaptureOptions): Promise<Blob> {
    const prepared = await prepareFormulaNode(options);
    try {
        const svgDataUrl = await toSvg(prepared.node, {
            backgroundColor: options.backgroundColor,
            cacheBust: true,
            fontEmbedCSS: prepared.fontEmbedCss,
            width: prepared.width,
            height: prepared.height,
        });
        return dataUrlToBlob(svgDataUrl, 'image/svg+xml');
    } finally {
        prepared.cleanup();
    }
}

export async function renderFormulaDomPngBlob(options: FormulaDomCaptureOptions): Promise<Blob> {
    const prepared = await prepareFormulaNode(options);
    try {
        const size = { width: prepared.width, height: prepared.height };
        const pixelRatio = resolveSafePixelRatio(requestedPixelRatio(options.pixelRatio), size.width, size.height);
        const canvas = await toCanvas(prepared.node, {
            backgroundColor: options.backgroundColor,
            cacheBust: true,
            fontEmbedCSS: prepared.fontEmbedCss,
            width: size.width,
            height: size.height,
            canvasWidth: size.width,
            canvasHeight: size.height,
            pixelRatio,
        });
        return await canvasToPngBlob(canvas);
    } finally {
        prepared.cleanup();
    }
}
