import { mathjax } from '@mathjax/src/js/mathjax.js';
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
import '@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js';
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

const PRELOADED_NEWCM_DYNAMIC_FILES = ['double-struck'];

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
