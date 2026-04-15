import type { ReaderCommentExportSettings, ReaderCommentPrompt } from '../../core/settings/readerCommentExport';
import {
    createDefaultCommentTemplate,
    createDefaultReaderCommentExportSettings,
    normalizeCommentTemplate,
    type CommentTemplateSegment,
} from '../../core/settings/readerCommentExport';
import type { ReaderCommentRecord } from './commentSession';

export type { CommentTemplateSegment, CommentTemplateTokenKey, ReaderCommentExportSettings } from '../../core/settings/readerCommentExport';

export type ReaderCommentExportPrompts = {
    userPrompt: string;
    commentTemplate: CommentTemplateSegment[];
};

export { createDefaultCommentTemplate, createDefaultReaderCommentExportSettings, normalizeCommentTemplate };

export function resolvePromptById(settings: ReaderCommentExportSettings, promptId?: string | null): ReaderCommentPrompt | null {
    if (settings.prompts.length < 1) return null;
    if (!promptId) return settings.prompts[0] ?? null;
    return settings.prompts.find((prompt) => prompt.id === promptId)
        ?? settings.prompts[0]
        ?? null;
}

export function resolveActiveReaderCommentPrompt(settings: ReaderCommentExportSettings): ReaderCommentPrompt {
    return resolvePromptById(settings) ?? createDefaultReaderCommentExportSettings().prompts[0]!;
}

export function resolveReaderCommentExportPrompts(settings: ReaderCommentExportSettings, promptId?: string | null): ReaderCommentExportPrompts {
    const prompt = resolvePromptById(settings, promptId) ?? createDefaultReaderCommentExportSettings().prompts[0]!;
    return {
        userPrompt: prompt.content,
        commentTemplate: settings.template,
    };
}

export function renderCommentTemplate(
    template: CommentTemplateSegment[] | string,
    record: ReaderCommentRecord,
): string {
    return normalizeCommentTemplate(template)
        .map((segment) => {
            if (segment.type === 'text') return segment.value;
            return segment.key === 'selected_source' ? record.sourceMarkdown : record.comment;
        })
        .join('');
}

function formatNumberedMultilineItem(index: number, content: string): string {
    const lines = content.split('\n');
    const [firstLine = '', ...restLines] = lines;
    const numbered = `${index}. ${firstLine}`;
    if (restLines.length < 1) return numbered;
    const indented = restLines.map((line) => `   ${line}`);
    return [numbered, ...indented].join('\n');
}

export function buildCommentsExport(
    comments: ReaderCommentRecord[],
    prompts: ReaderCommentExportPrompts,
): string {
    const lines = comments.map((record, index) => formatNumberedMultilineItem(
        index + 1,
        renderCommentTemplate(prompts.commentTemplate, record),
    ));

    if (lines.length < 1) return '';
    const prefix = prompts.userPrompt.trim();
    return prefix ? [prefix, '', ...lines].join('\n') : lines.join('\n');
}
