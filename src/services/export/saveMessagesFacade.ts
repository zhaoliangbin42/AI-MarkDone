import { downloadText } from '../../drivers/content/export/downloadFile';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { printPdf } from '../../drivers/content/export/printPdf';
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
import { buildMessageExportDocument } from './messageExportDocument';
import { planMessagePngFilenames } from './messagePngFilenames';
import {
    renderMessageDocumentPng,
    type MessagePngRenderSettings,
} from './messagePngRenderer';

export type ExportResult =
    | { ok: true; noop: boolean }
    | { ok: false; error: { code: string; message: string }; cancelled?: boolean };

export type ExportOptions = {
    t: TranslateFn;
    markdownFormulaFormat?: FormulaSourceFormat;
    png?: MessagePngRenderSettings;
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
        return {
            ok: false,
            error: { code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Export failed' },
        };
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
        return {
            ok: false,
            error: { code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Export failed' },
        };
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
        const document = buildMessageExportDocument(turns, selectedIndices, {
            title: metadata.title,
            labels: {
                user: options.t('pdfUserLabel'),
                assistant: options.t('pdfAssistantLabel'),
            },
            formatHeading: (ordinal) => options.t('pdfMessagePrefix', `${ordinal}`),
        });
        if (!document) return { ok: true, noop: true };
        options.onProgress?.({ phase: 'preparing', completed: 0, total: 1 });
        throwIfAborted(options.signal);
        const artifacts = await renderMessageDocumentPng(document, options.png, {
            signal: options.signal,
            onProgress: (current) => options.onProgress?.({
                phase: 'rendering',
                completed: current.completed ?? 0,
                total: current.total ?? 1,
            }),
        });
        throwIfAborted(options.signal);
        if (artifacts.length === 0) throw new Error('PNG renderer returned no artifacts.');
        const filenames = planMessagePngFilenames(metadata.title, document.sections.length, artifacts.length);
        const files = artifacts.map((artifact, index) => ({
            filename: filenames.artifactFilenames[index]!,
            blob: artifact.blob,
        }));
        const total = files.length;
        if (files.length === 1) {
            throwIfAborted(options.signal);
            options.onProgress?.({ phase: 'downloading', completed: 1, total, filename: files[0].filename });
            throwIfAborted(options.signal);
            downloadBlob({ filename: files[0].filename, blob: files[0].blob });
            options.onProgress?.({ phase: 'done', completed: 1, total, filename: files[0].filename });
            return { ok: true, noop: false };
        }
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'zipping', completed: files.length, total, filename: filenames.zipFilename });
        const zip = await zipBlobs({ files, signal: options.signal });
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'downloading', completed: files.length, total, filename: filenames.zipFilename });
        throwIfAborted(options.signal);
        downloadBlob({ filename: filenames.zipFilename, blob: zip });
        options.onProgress?.({ phase: 'done', completed: files.length, total, filename: filenames.zipFilename });
        return { ok: true, noop: false };
    } catch (err: any) {
        if (isRenderAbortError(err)) {
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: options.t('pngExportCancelled') } };
        }
        return {
            ok: false,
            error: { code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Export failed' },
        };
    }
}
