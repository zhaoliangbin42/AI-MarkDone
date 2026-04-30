import { copyImageBlobToClipboard } from '../../drivers/content/clipboard/copyImageToClipboard';
import { copySvgBlobToClipboard } from '../../drivers/content/clipboard/copySvgToClipboard';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { rasterizeFormulaSvgToPngBlob } from '../../drivers/content/export/renderFormulaPng';
import { DEFAULT_FORMULA_FONT_SIZE_PX, renderFormulaSvgAsset } from './formulaAssetRenderer';

export type FormulaAssetAction = 'copy_png' | 'copy_svg' | 'save_png' | 'save_svg';

export type FormulaAssetActionResult =
    | { ok: true; status: 'copied' | 'saved' }
    | { ok: false; code: 'EMPTY_SOURCE' | 'CLIPBOARD_UNSUPPORTED' | 'CLIPBOARD_WRITE_FAILED' | 'RENDER_FAILED'; message: string };

export type RunFormulaAssetActionOptions = {
    action: FormulaAssetAction;
    source: string;
    displayMode: boolean;
    fontSizePx?: number;
    pixelRatio?: number;
};

const SVG_FILENAME = 'AI-MarkDone-formula.svg';
const PNG_FILENAME = 'AI-MarkDone-formula.png';

function svgBlob(svg: string): Blob {
    return new Blob([svg], { type: 'image/svg+xml' });
}

function clipboardError(code: 'CLIPBOARD_UNSUPPORTED' | 'CLIPBOARD_WRITE_FAILED', fallback: string): FormulaAssetActionResult {
    return { ok: false, code, message: fallback };
}

export async function runFormulaAssetAction(options: RunFormulaAssetActionOptions): Promise<FormulaAssetActionResult> {
    const source = options.source.trim();
    if (!source) return { ok: false, code: 'EMPTY_SOURCE', message: 'Formula source is empty.' };

    try {
        const asset = await renderFormulaSvgAsset({
            source,
            displayMode: options.displayMode,
            fontSizePx: options.fontSizePx ?? DEFAULT_FORMULA_FONT_SIZE_PX,
        });

        if (options.action === 'copy_svg') {
            const result = await copySvgBlobToClipboard(svgBlob(asset.svg));
            if (result.ok) return { ok: true, status: 'copied' };
            if (result.reason === 'unsupported') return clipboardError('CLIPBOARD_UNSUPPORTED', 'SVG clipboard copy is not supported by this browser.');
            return clipboardError('CLIPBOARD_WRITE_FAILED', result.errorMessage || 'SVG clipboard copy failed.');
        }

        if (options.action === 'save_svg') {
            downloadBlob({ filename: SVG_FILENAME, blob: svgBlob(asset.svg) });
            return { ok: true, status: 'saved' };
        }

        const pngBlob = await rasterizeFormulaSvgToPngBlob(asset, { pixelRatio: options.pixelRatio });
        if (options.action === 'save_png') {
            downloadBlob({ filename: PNG_FILENAME, blob: pngBlob });
            return { ok: true, status: 'saved' };
        }

        const result = await copyImageBlobToClipboard(pngBlob);
        if (result.ok) return { ok: true, status: 'copied' };
        if (result.reason === 'unsupported') return clipboardError('CLIPBOARD_UNSUPPORTED', 'PNG clipboard copy is not supported by this browser.');
        return clipboardError('CLIPBOARD_WRITE_FAILED', result.errorMessage || 'PNG clipboard copy failed.');
    } catch (error: any) {
        return {
            ok: false,
            code: 'RENDER_FAILED',
            message: error?.message || 'Formula render failed.',
        };
    }
}
