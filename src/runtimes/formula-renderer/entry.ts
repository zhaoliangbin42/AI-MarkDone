import { mathjax } from '@mathjax/src/js/mathjax.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/calligraphic.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/script.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import type { FormulaMathmlAsset, FormulaSvgAsset } from '../../core/math/formulaAssetTypes';
import {
    FORMULA_RENDERER_REQUEST_TYPE,
    FORMULA_RENDERER_RESPONSE_TYPE,
    type FormulaRendererRequest,
    type FormulaRendererResponse,
} from '../../core/math/formulaRendererProtocol';

type MathDocumentLike = {
    convert: (source: string, options: { display?: boolean; end?: number }) => Element | unknown;
    convertPromise: (source: string, options: { display?: boolean; end?: number }) => Promise<Element | unknown>;
};

type NewcmDynamicFontFile = {
    setup: (font: MathJaxNewcmFont) => void;
};

type NewcmFontClassWithDynamicFiles = {
    dynamicFiles: Record<string, NewcmDynamicFontFile>;
};

const PRELOADED_NEWCM_DYNAMIC_FILES = ['calligraphic', 'double-struck', 'script'];
const FALLBACK_TEXT_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
const DEFAULT_TEXT_VIEWBOX_Y = -750;
const DEFAULT_TEXT_VIEWBOX_HEIGHT = 950;
const SVG_VIEWPORT_PADDING_PX = 4;

function primeNewcmDynamicFontData(font: MathJaxNewcmFont): void {
    const dynamicFiles = (MathJaxNewcmFont as unknown as NewcmFontClassWithDynamicFiles).dynamicFiles;
    for (const file of PRELOADED_NEWCM_DYNAMIC_FILES) {
        dynamicFiles[file]?.setup(font);
    }
}

const adaptor = browserAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({
    packages: ['base', 'ams', 'newcommand', 'noundefined'],
});
const font = new MathJaxNewcmFont();
primeNewcmDynamicFontData(font);
const svg = new SVG({
    fontData: font,
    fontCache: 'none',
    displayOverflow: 'overflow',
    linebreaks: { inline: false },
});
const html = mathjax.document('', {
    InputJax: tex,
    OutputJax: svg,
}) as unknown as MathDocumentLike;
const mathmlVisitor = new SerializedMmlVisitor();

function createMeasurementRoot(fontSizePx: number): HTMLElement {
    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.style.left = '-100000px';
    root.style.top = '0';
    root.style.width = 'max-content';
    root.style.height = 'max-content';
    root.style.overflow = 'visible';
    root.style.pointerEvents = 'none';
    root.style.fontSize = `${fontSizePx}px`;
    root.style.lineHeight = '1';
    document.body.appendChild(root);
    return root;
}

function isFinitePositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
    const [x, y, width, height] = viewBox.split(/\s+/).map((part) => Number(part));
    return { x, y, width, height };
}

function textWidthEm(text: string): number {
    let width = 0;
    for (const char of Array.from(text)) {
        if (/\s/u.test(char)) {
            width += 0.35;
        } else if (/[\u3400-\u9FFF\uF900-\uFAFF]/u.test(char)) {
            width += 1;
        } else {
            width += 0.62;
        }
    }
    return width;
}

function estimateFallbackWidth(svgElement: SVGSVGElement, source: string, fontSizePx: number): number {
    const textContentWidth = Array.from(svgElement.querySelectorAll('text'))
        .reduce((total, text) => total + textWidthEm(text.textContent || ''), 0);
    const readableSource = source
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}_^]/g, '')
        .trim();
    const sourceWidth = textWidthEm(readableSource);
    const widthEm = Math.max(1, textContentWidth, sourceWidth);
    return Math.ceil(widthEm * fontSizePx);
}

function readSvgSize(svgElement: SVGSVGElement, fontSizePx: number, source: string): { width: number; height: number } {
    const rect = svgElement.getBoundingClientRect?.();
    const rectWidth = rect?.width || 0;
    const rectHeight = rect?.height || 0;
    if (isFinitePositive(rectWidth) && isFinitePositive(rectHeight)) {
        return {
            width: Math.ceil(rectWidth),
            height: Math.ceil(rectHeight),
        };
    }

    const viewBox = svgElement.getAttribute('viewBox') || '';
    const { width: vbWidth, height: vbHeight } = parseViewBox(viewBox);
    const width = isFinitePositive(vbWidth)
        ? Math.ceil(vbWidth / 1000 * fontSizePx)
        : estimateFallbackWidth(svgElement, source, fontSizePx);
    const height = isFinitePositive(vbHeight) ? Math.ceil(vbHeight / 1000 * fontSizePx) : fontSizePx;
    return { width, height };
}

function readSvgContentViewBox(svgElement: SVGSVGElement): string | null {
    const bbox = svgElement.getBBox?.();
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y) || !isFinitePositive(bbox.width) || !isFinitePositive(bbox.height)) {
        return null;
    }
    return `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
}

function sizeFromViewBox(viewBox: string, fontSizePx: number): { width: number; height: number } | null {
    const parsed = parseViewBox(viewBox);
    if (!isFinitePositive(parsed.width) || !isFinitePositive(parsed.height)) return null;
    return {
        width: Math.ceil(parsed.width / 1000 * fontSizePx),
        height: Math.ceil(parsed.height / 1000 * fontSizePx),
    };
}

function normalizeSvgViewBox(viewBox: string, size: { width: number; height: number }, fontSizePx: number): string {
    const parsed = parseViewBox(viewBox);
    const x = Number.isFinite(parsed.x) ? parsed.x : 0;
    const y = Number.isFinite(parsed.y) ? parsed.y : DEFAULT_TEXT_VIEWBOX_Y;
    const width = isFinitePositive(parsed.width)
        ? parsed.width
        : Math.ceil(size.width / fontSizePx * 1000);
    const height = isFinitePositive(parsed.height)
        ? parsed.height
        : Math.ceil(size.height / fontSizePx * 1000) || DEFAULT_TEXT_VIEWBOX_HEIGHT;
    return `${x} ${y} ${width} ${height}`;
}

function padSvgViewport(viewBox: string, size: { width: number; height: number }, fontSizePx: number): { viewBox: string; width: number; height: number } {
    const parsed = parseViewBox(viewBox);
    const paddingUnits = SVG_VIEWPORT_PADDING_PX / fontSizePx * 1000;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y) || !isFinitePositive(parsed.width) || !isFinitePositive(parsed.height)) {
        return { viewBox, width: size.width, height: size.height };
    }

    return {
        viewBox: `${parsed.x - paddingUnits} ${parsed.y - paddingUnits} ${parsed.width + paddingUnits * 2} ${parsed.height + paddingUnits * 2}`,
        width: size.width + SVG_VIEWPORT_PADDING_PX * 2,
        height: size.height + SVG_VIEWPORT_PADDING_PX * 2,
    };
}

function removeInvalidSvgNumbers(svgElement: SVGSVGElement): void {
    svgElement.querySelectorAll('*').forEach((element) => {
        for (const attribute of Array.from(element.attributes)) {
            if (!/\bNaN\b/.test(attribute.value)) continue;
            element.setAttribute(attribute.name, attribute.value.replace(/\bNaN\b/g, '0'));
        }
    });
}

function sanitizeSvg(svgElement: SVGSVGElement, width: number, height: number, viewBox: string): string {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    removeInvalidSvgNumbers(clone);
    clone.querySelectorAll('text').forEach((text) => {
        text.setAttribute('font-family', FALLBACK_TEXT_FONT_FAMILY);
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', viewBox);
    clone.removeAttribute('style');
    return new XMLSerializer().serializeToString(clone);
}

function getTopLevelSvgElement(root: HTMLElement): SVGSVGElement | null {
    const rendered = root.firstElementChild;
    if (rendered instanceof SVGSVGElement) return rendered;
    if (!rendered) return null;

    const directSvgElements = Array.from(rendered.children)
        .filter((child): child is SVGSVGElement => child instanceof SVGSVGElement);
    if (directSvgElements.length > 1) {
        throw new Error('MathJax produced multiple top-level SVG outputs.');
    }
    return directSvgElements[0] ?? null;
}

async function renderFormulaSvgAsset(request: FormulaRendererRequest): Promise<FormulaSvgAsset> {
    const source = request.source.trim();
    if (!source) throw new Error('Formula source is empty.');
    const fontSizePx = Number.isFinite(request.fontSizePx) && request.fontSizePx > 0
        ? Math.round(request.fontSizePx)
        : 36;
    const rendered = await html.convertPromise(source, { display: request.displayMode }) as Node;
    const root = createMeasurementRoot(fontSizePx);
    try {
        root.appendChild(rendered);
        const svgElement = getTopLevelSvgElement(root);
        if (!svgElement) throw new Error('MathJax did not produce SVG output.');
        const rawViewBox = svgElement.getAttribute('viewBox') || '0 0 1 1';
        const contentViewBox = readSvgContentViewBox(svgElement);
        const size = contentViewBox
            ? sizeFromViewBox(contentViewBox, fontSizePx) ?? readSvgSize(svgElement, fontSizePx, source)
            : readSvgSize(svgElement, fontSizePx, source);
        const normalizedViewBox = contentViewBox ?? normalizeSvgViewBox(rawViewBox, size, fontSizePx);
        const paddedViewport = padSvgViewport(normalizedViewBox, size, fontSizePx);
        return {
            source,
            displayMode: request.displayMode,
            fontSizePx,
            width: paddedViewport.width,
            height: paddedViewport.height,
            viewBox: paddedViewport.viewBox,
            svg: sanitizeSvg(svgElement, paddedViewport.width, paddedViewport.height, paddedViewport.viewBox),
        };
    } finally {
        root.remove();
    }
}

function ensureMathmlNamespace(mathml: string): string {
    return mathml.replace(/^<math\b(?![^>]*\sxmlns=)/, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
}

async function renderFormulaMathmlAsset(request: FormulaRendererRequest): Promise<FormulaMathmlAsset> {
    const source = request.source.trim();
    if (!source) throw new Error('Formula source is empty.');
    const root = await html.convertPromise(source, { display: request.displayMode, end: STATE.COMPILED });
    const mathml = ensureMathmlNamespace(mathmlVisitor.visitTree(root as any).trim());
    return {
        source,
        displayMode: request.displayMode,
        mathml,
    };
}

window.addEventListener('message', (event: MessageEvent) => {
    const request = event.data as Partial<FormulaRendererRequest>;
    if (request?.type !== FORMULA_RENDERER_REQUEST_TYPE || typeof request.id !== 'string') return;
    const renderRequest = request as FormulaRendererRequest;
    const requestId = request.id;

    void (async () => {
        let response: FormulaRendererResponse;
        try {
            response = {
                type: FORMULA_RENDERER_RESPONSE_TYPE,
                id: requestId,
                ok: true,
                asset: renderRequest.format === 'mathml'
                    ? await renderFormulaMathmlAsset(renderRequest)
                    : await renderFormulaSvgAsset(renderRequest),
            };
        } catch (error: any) {
            response = {
                type: FORMULA_RENDERER_RESPONSE_TYPE,
                id: requestId,
                ok: false,
                message: error?.message || 'Formula render failed.',
            };
        }
        event.source?.postMessage(response, { targetOrigin: event.origin || '*' });
    })();
});
