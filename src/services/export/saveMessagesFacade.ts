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
import { DEFAULT_CONTENT_CLEANUP_SETTINGS, type ContentCleanupSettings } from '../../core/settings/content';
import { projectChatGPTMarkdown, omitMarkdownCodeBlocks } from '../../core/content/chatgptMarkdownCleanup';
import { buildMarkdownExport } from './saveMessagesMarkdown';
import { buildPdfPrintPlan } from './saveMessagesPdf';
import { buildMessageExportDocument } from './messageExportDocument';
import { planMessagePngFilenames } from './messagePngFilenames';
import {
    renderMessageDocumentPng,
    type MessagePngRenderSettings,
} from './messagePngRenderer';
import { prepareRichOutput, type RichOutputManifest } from './prepareRichOutput';

export type ExportResult =
    | { ok: true; noop: boolean; richContent?: { included: number; placeholders: number } }
    | { ok: false; error: { code: string; message: string }; cancelled?: boolean };

export type ExportOptions = {
    t: TranslateFn;
    markdownFormulaFormat?: FormulaSourceFormat;
    markdownIncludeImages?: boolean;
    contentCleanup?: ContentCleanupSettings;
    png?: MessagePngRenderSettings;
    onProgress?: ExportProgressCallback;
    signal?: AbortSignal;
    visuals?: 'include' | 'placeholder';
    onPrepared?: () => void;
};

function richSummary(manifest: RichOutputManifest) {
    return manifest.blocks.length ? { richContent: {
        included: manifest.blocks.filter(block => block.outcome === 'included').length,
        placeholders: manifest.blocks.filter(block => block.outcome === 'placeholder').length,
    } } : {};
}

function projectTurns(turns: ChatTurn[], settings: ContentCleanupSettings = DEFAULT_CONTENT_CLEANUP_SETTINGS): ChatTurn[] {
    if (!settings.preserveLinks && settings.includeCodeBlocks) return turns;
    return turns.map((turn) => ({
        ...turn,
        assistant: !settings.preserveLinks
            ? omitMarkdownCodeBlocks(turn.assistant)
            : turn.assistantSource?.trim()
            ? projectChatGPTMarkdown(turn.assistantSource, settings)
            : settings.includeCodeBlocks ? turn.assistant : omitMarkdownCodeBlocks(turn.assistant),
    }));
}

export async function exportTurnsMarkdown(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    try {
        throwIfAborted(options.signal);
        const out = buildMarkdownExport(projectTurns(turns, options.contentCleanup), selectedIndices, metadata, options.t, {
            formulaFormat: options.markdownFormulaFormat,
            includeImages: options.markdownIncludeImages,
        });
        if (!out) return { ok: true, noop: true };
        throwIfAborted(options.signal);
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
    let prepared: Awaited<ReturnType<typeof prepareRichOutput>> | null = null;
    let printOwnsResources = false;
    try {
        prepared = await prepareRichOutput(projectTurns(turns, options.contentCleanup), selectedIndices, {
            target: 'visual', visuals: options.visuals ?? 'include', signal: options.signal, onProgress: options.onProgress,
        });
        const plan = buildPdfPrintPlan(prepared.turns, selectedIndices, metadata, options.t);
        if (!plan) return { ok: true, noop: true };
        throwIfAborted(options.signal);
        options.onPrepared?.();
        await printPdf(plan, { onCleanup: prepared.release });
        printOwnsResources = true;
        return { ok: true, noop: false, ...richSummary(prepared.manifest) };
    } catch (err: any) {
        if (isRenderAbortError(err)) return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: options.t('pngExportCancelled') } };
        return {
            ok: false,
            error: { code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Export failed' },
        };
    } finally { if (!printOwnsResources) prepared?.release(); }
}

export async function exportTurnsMarkdownZip(
    turns: ChatTurn[], selectedIndices: number[], metadata: ConversationMetadata, options: ExportOptions,
): Promise<ExportResult> {
    if (!selectedIndices.length) return { ok: true, noop: true };
    let prepared: Awaited<ReturnType<typeof prepareRichOutput>> | null = null;
    try {
        prepared = await prepareRichOutput(projectTurns(turns, options.contentCleanup), selectedIndices, {
            target: 'archive', visuals: options.visuals ?? 'include', signal: options.signal, onProgress: options.onProgress,
        });
        const markdown = buildMarkdownExport(prepared.turns, selectedIndices, metadata, options.t, { formulaFormat: options.markdownFormulaFormat });
        if (!markdown) return { ok: true, noop: true };
        const filename = markdown.filename.replace(/\.md$/i, '-offline.zip');
        const files = [
            { filename: 'conversation.md', blob: new Blob([markdown.markdown], { type: 'text/markdown;charset=utf-8' }) },
            ...prepared.files,
            { filename: 'manifest.json', blob: new Blob([JSON.stringify({ ...prepared.manifest, sourceUrl: metadata.url }, null, 2)], { type: 'application/json' }) },
        ];
        options.onProgress?.({ phase: 'zipping', completed: files.length, total: files.length, filename });
        const zip = await zipBlobs({ files, signal: options.signal });
        throwIfAborted(options.signal);
        downloadBlob({ filename, blob: zip });
        options.onProgress?.({ phase: 'done', completed: files.length, total: files.length, filename });
        return { ok: true, noop: false, ...richSummary(prepared.manifest) };
    } catch (err: any) {
        return { ok: false, ...(isRenderAbortError(err) ? { cancelled: true } : {}),
            error: { code: isRenderAbortError(err) ? 'CANCELLED' : 'EXPORT_FAILED', message: err?.message || 'Export failed' } };
    } finally { prepared?.release(); }
}

export async function exportTurnsPng(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    let prepared: Awaited<ReturnType<typeof prepareRichOutput>> | null = null;
    try {
        throwIfAborted(options.signal);
        prepared = await prepareRichOutput(projectTurns(turns, options.contentCleanup), selectedIndices, {
            target: 'visual', visuals: options.visuals ?? 'include', signal: options.signal, onProgress: options.onProgress,
        });
        const document = buildMessageExportDocument(prepared.turns, selectedIndices, {
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
                completed: current.phase === 'finalizing' ? 1 : 0,
                total: 1,
                render: current,
            }),
        });
        throwIfAborted(options.signal);
        if (artifacts.length === 0) throw new Error('PNG renderer returned no artifacts.');
        const filenames = planMessagePngFilenames(metadata.title, document.sections.length, artifacts.length);
        const total = artifacts.length;
        if (artifacts.length === 1) {
            const artifact = artifacts[0]!;
            const filename = filenames.artifactFilenames[0]!;
            throwIfAborted(options.signal);
            options.onProgress?.({ phase: 'downloading', completed: 1, total, filename });
            throwIfAborted(options.signal);
            downloadBlob({ filename, blob: artifact.blob });
            options.onProgress?.({ phase: 'done', completed: 1, total, filename });
            return { ok: true, noop: false, ...richSummary(prepared.manifest) };
        }
        const files = artifacts.map((artifact, index) => ({
            filename: filenames.artifactFilenames[index]!,
            chunks: artifact.chunks,
        }));
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'zipping', completed: files.length, total, filename: filenames.zipFilename });
        const zip = await zipBlobs({ files, signal: options.signal });
        throwIfAborted(options.signal);
        options.onProgress?.({ phase: 'downloading', completed: files.length, total, filename: filenames.zipFilename });
        throwIfAborted(options.signal);
        downloadBlob({ filename: filenames.zipFilename, blob: zip });
        options.onProgress?.({ phase: 'done', completed: files.length, total, filename: filenames.zipFilename });
        return { ok: true, noop: false, ...richSummary(prepared.manifest) };
    } catch (err: any) {
        if (isRenderAbortError(err)) {
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: options.t('pngExportCancelled') } };
        }
        return {
            ok: false,
            error: { code: err?.code || 'INTERNAL_ERROR', message: err?.message || 'Export failed' },
        };
    } finally { prepared?.release(); }
}
