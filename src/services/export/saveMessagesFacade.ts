import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { collectConversationTurnRefs } from '../../drivers/content/conversation/collectConversationTurnRefs';
import { buildConversationMetadata } from '../../drivers/content/conversation/metadata';
import { downloadText } from '../../drivers/content/export/downloadFile';
import { printPdf } from '../../drivers/content/export/printPdf';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';
import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { buildMarkdownExport } from './saveMessagesMarkdown';
import { buildPdfPrintPlan } from './saveMessagesPdf';

export type ExportResult = { ok: true; noop: boolean } | { ok: false; error: { code: string; message: string } };

export type ExportOptions = {
    t: TranslateFn;
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
