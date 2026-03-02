import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { collectConversationMessageRefs } from '../../drivers/content/conversation/collectConversationMessageRefs';
import { downloadText } from '../../drivers/content/export/downloadFile';
import { printPdf } from '../../drivers/content/export/printPdf';
import { copyMarkdownFromMessage } from '../copy/copy-markdown';
import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { buildMarkdownExport } from './saveMessagesMarkdown';
import { buildPdfPrintPlan } from './saveMessagesPdf';

export type ExportResult = { ok: true; noop: boolean } | { ok: false; error: { code: string; message: string } };

export type ExportOptions = {
    t: TranslateFn;
};

function platformNameFromId(id: string): string {
    switch (id) {
        case 'chatgpt':
            return 'ChatGPT';
        case 'gemini':
            return 'Gemini';
        case 'claude':
            return 'Claude';
        case 'deepseek':
            return 'DeepSeek';
        default:
            return 'Unknown';
    }
}

function getConversationTitle(): string {
    let title = document.querySelector('title')?.textContent?.trim() || 'Conversation';
    title = title
        .replace(' - ChatGPT', '')
        .replace(' - Claude', '')
        .replace(' - Gemini', '')
        .replace(' - DeepSeek', '')
        .trim();
    if (title.length > 100) title = `${title.substring(0, 100)}...`;
    if (!title) title = 'Conversation';
    return title;
}

function getConversationMetadata(adapter: SiteAdapter, count: number): ConversationMetadata {
    return {
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        title: getConversationTitle(),
        count,
        platform: platformNameFromId(adapter.getPlatformId()),
    };
}

function buildTurns(adapter: SiteAdapter): ChatTurn[] {
    const refs = collectConversationMessageRefs(adapter);
    return refs.map((ref) => {
        const res = copyMarkdownFromMessage(adapter, ref.messageEl);
        return {
            user: ref.userPrompt,
            assistant: res.ok ? res.markdown : '',
            index: ref.index,
        };
    });
}

export async function exportConversationMarkdown(
    adapter: SiteAdapter,
    selectedIndices: number[],
    options: ExportOptions
): Promise<ExportResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };

    try {
        const turns = buildTurns(adapter);
        const meta = getConversationMetadata(adapter, turns.length);
        const out = buildMarkdownExport(turns, selectedIndices, meta, options.t);
        if (!out) return { ok: true, noop: true };
        downloadText({ filename: out.filename, content: out.markdown, mime: 'text/markdown;charset=utf-8' });
        return { ok: true, noop: false };
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
        const turns = buildTurns(adapter);
        const meta = getConversationMetadata(adapter, turns.length);
        const plan = buildPdfPrintPlan(turns, selectedIndices, meta, options.t);
        if (!plan) return { ok: true, noop: true };
        await printPdf({ html: plan.html, containerId: plan.containerId });
        return { ok: true, noop: false };
    } catch (err: any) {
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Export failed' } };
    }
}
