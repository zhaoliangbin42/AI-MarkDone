import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { buildChatGPTConversationTurns } from '../../drivers/content/chatgpt/chatgptConversationSource';
import { collectConversationTurnRefs } from '../../drivers/content/conversation/collectConversationTurnRefs';
import { buildConversationMetadata } from '../../drivers/content/conversation/metadata';
import { downloadText } from '../../drivers/content/export/downloadFile';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { printPdf } from '../../drivers/content/export/printPdf';
import { renderPngBlob } from '../../drivers/content/export/renderPng';
import { zipBlobs } from '../../drivers/content/export/zipBlobs';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';
import type {
    ChatTurn,
    ConversationMetadata,
    ExportProgressCallback,
    TranslateFn,
} from './saveMessagesTypes';
import { buildMarkdownExport } from './saveMessagesMarkdown';
import { buildPdfPrintPlan } from './saveMessagesPdf';
import { buildPngExportPlans, type BuildPngExportPlanOptions } from './saveMessagesPng';

export type ExportResult = { ok: true; noop: boolean } | { ok: false; error: { code: string; message: string } };

export type ExportOptions = {
    t: TranslateFn;
    png?: BuildPngExportPlanOptions;
    onProgress?: ExportProgressCallback;
};

export type CollectConversationTurnsOptions = {
    chatGptConversationEngine?: ChatGPTConversationEngine | null;
};

function buildTurns(adapter: SiteAdapter): ChatTurn[] {
    const refs = collectConversationTurnRefs(adapter);
    return refs.map((ref) => {
        const md = copyMarkdownFromTurn(adapter, ref.messageEls);
        const assistant = md.ok ? md.markdown : '';
        return {
            user: ref.userPrompt,
            assistant,
            index: ref.index,
        };
    });
}

export function collectConversationTurns(adapter: SiteAdapter): { turns: ChatTurn[]; metadata: ConversationMetadata } {
    const turns = buildTurns(adapter);
    const metadata = buildConversationMetadata(adapter, turns.length) as ConversationMetadata;
    return { turns, metadata };
}

export async function collectConversationTurnsAsync(
    adapter: SiteAdapter,
    options?: CollectConversationTurnsOptions
): Promise<{ turns: ChatTurn[]; metadata: ConversationMetadata }> {
    if (adapter.getPlatformId?.() === 'chatgpt' && options?.chatGptConversationEngine) {
        try {
            const snapshot = await options.chatGptConversationEngine.forceRefreshCurrentConversation();
            if (snapshot?.rounds?.length) {
                const turns = buildChatGPTConversationTurns(snapshot);
                const metadata = buildConversationMetadata(adapter, turns.length) as ConversationMetadata;
                return { turns, metadata };
            }
        } catch {
            // Fall back to the established DOM path if the ChatGPT payload bridge is temporarily unavailable.
        }
    }
    return collectConversationTurns(adapter);
}

export async function exportTurnsMarkdown(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };
    try {
        const out = buildMarkdownExport(turns, selectedIndices, metadata, options.t);
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
        const result = buildPngExportPlans(turns, selectedIndices, metadata, options.t, options.png);
        if (!result || result.plans.length < 1) return { ok: true, noop: true };
        const total = result.plans.length;
        options.onProgress?.({ phase: 'preparing', completed: 0, total });
        const files: Array<{ filename: string; blob: Blob }> = [];
        for (const plan of result.plans) {
            options.onProgress?.({ phase: 'rendering', completed: files.length, total, filename: plan.filename });
            const blob = await renderPngBlob(plan);
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
            options.onProgress?.({ phase: 'downloading', completed: 1, total, filename: files[0].filename });
            downloadBlob({ filename: files[0].filename, blob: files[0].blob });
            options.onProgress?.({ phase: 'done', completed: 1, total, filename: files[0].filename });
            return { ok: true, noop: false };
        }
        options.onProgress?.({ phase: 'zipping', completed: files.length, total, filename: result.zipFilename });
        const zip = await zipBlobs({ files });
        options.onProgress?.({ phase: 'downloading', completed: files.length, total, filename: result.zipFilename });
        downloadBlob({ filename: result.zipFilename, blob: zip });
        options.onProgress?.({ phase: 'done', completed: files.length, total, filename: result.zipFilename });
        return { ok: true, noop: false };
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}

export async function exportConversationMarkdown(
    adapter: SiteAdapter,
    selectedIndices: number[],
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };

    try {
        const { turns, metadata } = collectConversationTurns(adapter);
        return await exportTurnsMarkdown(turns, selectedIndices, metadata, options);
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}

export async function exportConversationPdf(
    adapter: SiteAdapter,
    selectedIndices: number[],
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };

    try {
        const { turns, metadata } = collectConversationTurns(adapter);
        return await exportTurnsPdf(turns, selectedIndices, metadata, options);
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}

export async function exportConversationPng(
    adapter: SiteAdapter,
    selectedIndices: number[],
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };

    try {
        const { turns, metadata } = collectConversationTurns(adapter);
        return await exportTurnsPng(turns, selectedIndices, metadata, options);
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}
