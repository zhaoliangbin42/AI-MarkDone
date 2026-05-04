import { mathjax } from '@mathjax/src/js/mathjax.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import type { FormulaSvgAsset } from '../../core/math/formulaAssetTypes';
import {
    FORMULA_RENDERER_REQUEST_TYPE,
    FORMULA_RENDERER_RESPONSE_TYPE,
    type FormulaRendererRequest,
    type FormulaRendererResponse,
} from '../../core/math/formulaRendererProtocol';

type MathDocumentLike = {
    convert: (source: string, options: { display?: boolean }) => Element;
};

const adaptor = browserAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({
    packages: ['base', 'ams', 'newcommand', 'noundefined'],
});
const svg = new SVG({
    font: new MathJaxNewcmFont(),
    fontCache: 'none',
    displayOverflow: 'overflow',
    linebreaks: { inline: false },
});
const html = mathjax.document('', {
    InputJax: tex,
    OutputJax: svg,
}) as unknown as MathDocumentLike;

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

function readSvgSize(svgElement: SVGSVGElement, fontSizePx: number): { width: number; height: number } {
    const rect = svgElement.getBoundingClientRect?.();
    const rectWidth = rect?.width || 0;
    const rectHeight = rect?.height || 0;
    if (rectWidth > 0 && rectHeight > 0) {
        return {
            width: Math.ceil(rectWidth),
            height: Math.ceil(rectHeight),
        };
    }

    const viewBox = svgElement.getAttribute('viewBox') || '';
    const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map((part) => Number(part));
    const width = Number.isFinite(vbWidth) && vbWidth > 0 ? Math.ceil(vbWidth / 1000 * fontSizePx) : fontSizePx;
    const height = Number.isFinite(vbHeight) && vbHeight > 0 ? Math.ceil(vbHeight / 1000 * fontSizePx) : fontSizePx;
    return { width, height };
}

function sanitizeSvg(svgElement: SVGSVGElement, width: number, height: number, viewBox: string): string {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', viewBox);
    clone.removeAttribute('style');
    return new XMLSerializer().serializeToString(clone);
}

function renderFormulaSvgAsset(request: FormulaRendererRequest): FormulaSvgAsset {
    const source = request.source.trim();
    if (!source) throw new Error('Formula source is empty.');
    const fontSizePx = Number.isFinite(request.fontSizePx) && request.fontSizePx > 0
        ? Math.round(request.fontSizePx)
        : 36;
    const rendered = html.convert(source, { display: request.displayMode });
    const root = createMeasurementRoot(fontSizePx);
    try {
        root.appendChild(rendered);
        const svgElements = root.querySelectorAll('svg');
        if (svgElements.length > 1) throw new Error('MathJax produced split SVG output.');
        const svgElement = svgElements[0];
        if (!(svgElement instanceof SVGSVGElement)) throw new Error('MathJax did not produce SVG output.');
        const viewBox = svgElement.getAttribute('viewBox') || '0 0 1 1';
        const size = readSvgSize(svgElement, fontSizePx);
        return {
            source,
            displayMode: request.displayMode,
            fontSizePx,
            width: size.width,
            height: size.height,
            viewBox,
            svg: sanitizeSvg(svgElement, size.width, size.height, viewBox),
        };
    } finally {
        root.remove();
    }
}

window.addEventListener('message', (event: MessageEvent) => {
    const request = event.data as Partial<FormulaRendererRequest>;
    if (request?.type !== FORMULA_RENDERER_REQUEST_TYPE || typeof request.id !== 'string') return;

    let response: FormulaRendererResponse;
    try {
        response = {
            type: FORMULA_RENDERER_RESPONSE_TYPE,
            id: request.id,
            ok: true,
            asset: renderFormulaSvgAsset(request as FormulaRendererRequest),
        };
    } catch (error: any) {
        response = {
            type: FORMULA_RENDERER_RESPONSE_TYPE,
            id: request.id,
            ok: false,
            message: error?.message || 'Formula render failed.',
        };
    }
    event.source?.postMessage(response, { targetOrigin: event.origin || '*' });
});
