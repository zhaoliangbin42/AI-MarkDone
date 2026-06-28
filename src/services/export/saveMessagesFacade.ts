import { downloadText } from '../../drivers/content/export/downloadFile';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { printPdf } from '../../drivers/content/export/printPdf';
import { renderPngBlob } from '../../drivers/content/export/renderPng';
import { isRenderAbortError, throwIfAborted } from '../../drivers/content/export/renderControl';
import { zipBlobs } from '../../drivers/content/export/zipBlobs';
import type {
    ChatTurn,
    ConversationMetadata,
    ExportProgressCallback,
    TranslateFn,
} from './saveMessagesTypes';
import type { FormulaSourceFormat } from '../../core/math/formulaSourceFormat';
import { buildMarkdownExport } from './saveMessagesMarkdown';
import { buildPdfPrintPlan } from './saveMessagesPdf';
import { buildPngExportPlans, type BuildPngExportPlanOptions } from './saveMessagesPng';

export type ExportResult =
    | { ok: true; noop: boolean }
    | { ok: false; error: { code: string; message: string }; cancelled?: boolean };

export type ExportOptions = {
    t: TranslateFn;
    markdownFormulaFormat?: FormulaSourceFormat;
    png?: BuildPngExportPlanOptions;
    onProgress?: ExportProgressCallback;
    signal?: AbortSignal;
};

export async function exportTurnsMarkdown(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    try {
        const out = buildMarkdownExport(turns, selectedIndices, metadata, options.t, {
            formulaFormat: options.markdownFormulaFormat,
        });
        if (!out) return { ok: true, noop: true };
        downloadText({ filename: out.filename, content: out.markdown, mime: 'text/markdown;charset=utf-8' });
        return { ok: true, noop: false };
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}

export async function exportTurnsPdf(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    try {
        const plan = buildPdfPrintPlan(turns, selectedIndices, metadata, options.t);
        if (!plan) return { ok: true, noop: true };
        await printPdf({ html: plan.html, containerId: plan.containerId });
        return { ok: true, noop: false };
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}

export async function exportTurnsPng(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    try {
        throwIfAborted(options.signal);
        const result = buildPngExportPlans(turns, selectedIndices, metadata, options.t, options.png);
        if (!result || result.plans.length < 1) return { ok: true, noop: true };
        const total = result.plans.length;
        options.onProgress?.({ phase: 'preparing', completed: 0, total });
        throwIfAborted(options.signal);
        const files: Array<{ filename: string; blob: Blob }> = [];
        for (const plan of result.plans) {
            throwIfAborted(options.signal);
            options.onProgress?.({ phase: 'rendering', completed: files.length, total, filename: plan.filename });
            const blob = await renderPngBlob({
                ...plan,
                signal: options.signal,
                onProgress: (current) => {
                    options.onProgress?.({
                        phase: 'rendering',
                        completed: files.length,
                        total,
                        filename: plan.filename,
                        current,
                    });
                },
            });
            throwIfAborted(options.signal);
            files.push({ filename: plan.filename, blob });
            const completed = files.length;
            options.onProgress?.({
                phase: 'rendering',
                completed,
                total,
                filename: plan.filename,
            });
        }
        if (files.length === 1) {
            throwIfAborted(options.signal);
            options.onProgress?.({ phase: 'downloading', completed: 1, total, filename: files[0].filename });
            throwIfAborted(options.signal);
            downloadBlob({ filename: files[0].filename, blob: files[0].blob });
            options.onProgress?.({ phase: 'done', completed: 1, total, filename: files[0].filename });
            return { ok: true, noop: false };
        }
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'zipping', completed: files.length, total, filename: result.zipFilename });
        const zip = await zipBlobs({ files });
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'downloading', completed: files.length, total, filename: result.zipFilename });
        throwIfAborted(options.signal);
        downloadBlob({ filename: result.zipFilename, blob: zip });
        options.onProgress?.({ phase: 'done', completed: files.length, total, filename: result.zipFilename });
        return { ok: true, noop: false };
    } catch (err: any) {
        if (isRenderAbortError(err)) {
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: options.t('pngExportCancelled') } };
        }
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}
