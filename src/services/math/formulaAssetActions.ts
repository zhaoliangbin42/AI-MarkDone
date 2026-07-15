import { copyImageBlobToClipboard } from '../../drivers/content/clipboard/copyImageToClipboard';
import { copyMathmlToClipboard } from '../../drivers/content/clipboard/copyMathmlToClipboard';
import { copySvgBlobToClipboard } from '../../drivers/content/clipboard/copySvgToClipboard';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import type { FormulaSource } from '../../core/math/formulaAssetTypes';
import type { ImageExportErrorCode } from '../export/imageExportContracts';
import {
    DEFAULT_FORMULA_FONT_SIZE_PX,
    renderFormulaAsset,
} from './formulaAssetRenderer';

export type FormulaAssetAction = 'copy_png' | 'copy_svg' | 'copy_mathml' | 'save_png' | 'save_svg';

export type FormulaAssetActionResult =
    | { ok: true; status: 'copied' | 'saved' }
    | { ok: false; code: 'EMPTY_SOURCE' | 'CLIPBOARD_UNSUPPORTED' | 'CLIPBOARD_WRITE_FAILED' | ImageExportErrorCode; message: string };

export type RunFormulaAssetActionOptions = {
    action: FormulaAssetAction;
    source: FormulaSource;
    displayMode: boolean;
    fontSizePx?: number;
    pixelRatio?: number;
    foregroundColor?: string;
};

const SVG_FILENAME = 'AI-MarkDone-formula.svg';
const PNG_FILENAME = 'AI-MarkDone-formula.png';

function clipboardError(code: 'CLIPBOARD_UNSUPPORTED' | 'CLIPBOARD_WRITE_FAILED', fallback: string): FormulaAssetActionResult {
    return { ok: false, code, message: fallback };
}

async function renderSvgBlob(options: RunFormulaAssetActionOptions): Promise<Blob> {
    return (await renderFormulaAsset({
        source: options.source,
        displayMode: options.displayMode,
        fontSizePx: options.fontSizePx ?? DEFAULT_FORMULA_FONT_SIZE_PX,
        foregroundColor: options.foregroundColor,
        output: 'svg',
    })).blob;
}

async function renderPngBlob(options: RunFormulaAssetActionOptions): Promise<Blob> {
    return (await renderFormulaAsset({
        source: options.source,
        displayMode: options.displayMode,
        fontSizePx: options.fontSizePx ?? DEFAULT_FORMULA_FONT_SIZE_PX,
        foregroundColor: options.foregroundColor,
        pixelRatio: options.pixelRatio,
        output: 'png',
    })).blob;
}

export async function runFormulaAssetAction(options: RunFormulaAssetActionOptions): Promise<FormulaAssetActionResult> {
    const source = options.source.kind === 'tex' ? options.source.value.trim() : '';
    if (options.source.kind === 'tex' && !source) {
        return { ok: false, code: 'EMPTY_SOURCE', message: 'Formula source is empty.' };
    }
    try {
        if (options.action === 'copy_mathml') {
            const mathml = await readBlobText((await renderFormulaAsset({
                source: options.source,
                displayMode: options.displayMode,
                fontSizePx: options.fontSizePx ?? DEFAULT_FORMULA_FONT_SIZE_PX,
                foregroundColor: options.foregroundColor,
                output: 'mathml',
            })).blob);
            const result = await copyMathmlToClipboard(mathml);
            if (result.ok) return { ok: true, status: 'copied' };
            return clipboardError('CLIPBOARD_WRITE_FAILED', result.errorMessage || 'MathML clipboard copy failed.');
        }

        if (options.action === 'copy_svg') {
            const result = await copySvgBlobToClipboard(await renderSvgBlob(options));
            if (result.ok) return { ok: true, status: 'copied' };
            if (result.reason === 'unsupported') return clipboardError('CLIPBOARD_UNSUPPORTED', 'SVG clipboard copy is not supported by this browser.');
            return clipboardError('CLIPBOARD_WRITE_FAILED', result.errorMessage || 'SVG clipboard copy failed.');
        }

        if (options.action === 'save_svg') {
            downloadBlob({ filename: SVG_FILENAME, blob: await renderSvgBlob(options) });
            return { ok: true, status: 'saved' };
        }

        const pngBlob = await renderPngBlob(options);
        if (options.action === 'save_png') {
            downloadBlob({ filename: PNG_FILENAME, blob: pngBlob });
            return { ok: true, status: 'saved' };
        }

        const result = await copyImageBlobToClipboard(pngBlob);
        if (result.ok) return { ok: true, status: 'copied' };
        if (result.reason === 'unsupported') return clipboardError('CLIPBOARD_UNSUPPORTED', 'PNG clipboard copy is not supported by this browser.');
        return clipboardError('CLIPBOARD_WRITE_FAILED', result.errorMessage || 'PNG clipboard copy failed.');
    } catch (error: any) {
        if (typeof error?.code === 'string' && IMAGE_EXPORT_ERROR_CODES.has(error.code)) {
            return { ok: false, code: error.code as ImageExportErrorCode, message: error.message };
        }
        return {
            ok: false,
            code: 'RENDER_FAILED',
            message: error?.message || 'Formula render failed.',
        };
    }
}

const IMAGE_EXPORT_ERROR_CODES = new Set<ImageExportErrorCode>([
    'CANCELLED',
    'INVALID_REQUEST',
    'SOURCE_UNAVAILABLE',
    'HOST_UNAVAILABLE',
    'PROTOCOL_ERROR',
    'RENDER_FAILED',
    'ENCODE_FAILED',
    'LIMIT_EXCEEDED',
]);

function readBlobText(blob: Blob): Promise<string> {
    if (typeof blob.text === 'function') return blob.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('Formula asset could not be read.'));
        reader.readAsText(blob);
    });
}
