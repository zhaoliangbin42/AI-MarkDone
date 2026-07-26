import {
    normalizeFormulaSourceFormat,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';
import { renderCanonicalMarkdownToBasicRichHtml } from '../renderer/renderMarkdown';

export type AtomicSelectionRichPayload = {
    html: string;
    plainText: string;
};

export type CanonicalMarkdownRichPayloadParams = {
    canonicalMarkdown: string;
    plainText: string;
    formulaFormat?: FormulaSourceFormat;
};

export function buildCanonicalMarkdownRichPayload(
    params: CanonicalMarkdownRichPayloadParams,
): AtomicSelectionRichPayload | null {
    const canonicalMarkdown = params.canonicalMarkdown.trim();
    if (!canonicalMarkdown) return null;

    try {
        const html = renderCanonicalMarkdownToBasicRichHtml(
            canonicalMarkdown,
            normalizeFormulaSourceFormat(params.formulaFormat ?? 'markdown-dollar'),
        );
        if (!html.trim()) return null;
        return {
            html: [
                '<!doctype html>',
                '<html>',
                '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>',
                `<body><!--StartFragment-->${html}<!--EndFragment--></body></html>`,
            ].join(''),
            plainText: params.plainText,
        };
    } catch {
        return null;
    }
}
