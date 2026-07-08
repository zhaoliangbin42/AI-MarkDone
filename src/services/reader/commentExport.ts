import type {
    ReaderCommentExportSettings,
    ReaderCommentPrompt,
    ReaderCommentPromptPosition,
    ReaderCommentSortMode,
} from '../../core/settings/readerCommentExport';
import {
    createDefaultCommentTemplate,
    createDefaultReaderCommentPrompts,
    createDefaultReaderCommentExportSettings,
    DEFAULT_READER_COMMENT_PROMPT_POSITION,
    DEFAULT_READER_COMMENT_SORT_MODE,
    normalizeCommentTemplate,
    normalizeReaderCommentExportSettings,
    type CommentTemplateSegment,
} from '../../core/settings/readerCommentExport';
import { sortReaderComments, type ReaderCommentRecord } from './commentSession';

export type {
    CommentTemplateSegment,
    CommentTemplateTokenKey,
    ReaderCommentExportSettings,
    ReaderCommentSortMode,
} from '../../core/settings/readerCommentExport';

const CURSOR_MARKER = '{{cursor}}';

export type ReaderCommentExportPrompts = {
    userPrompt: string;
    commentTemplate: CommentTemplateSegment[];
    promptPosition?: ReaderCommentPromptPosition;
    sortMode?: ReaderCommentSortMode;
};

export {
    createDefaultCommentTemplate,
    createDefaultReaderCommentPrompts,
    createDefaultReaderCommentExportSettings,
    normalizeCommentTemplate,
    normalizeReaderCommentExportSettings,
};

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
        promptPosition: settings.promptPosition ?? DEFAULT_READER_COMMENT_PROMPT_POSITION,
        sortMode: settings.sortMode ?? DEFAULT_READER_COMMENT_SORT_MODE,
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

function stripComposerCursorMarker(value: string): string {
    return value.split(CURSOR_MARKER).join('');
}

export function buildCommentsExport(
    comments: ReaderCommentRecord[],
    prompts: ReaderCommentExportPrompts,
): string {
    const sortedComments = sortReaderComments(comments, prompts.sortMode);
    const lines = sortedComments.map((record, index) => formatNumberedMultilineItem(
        index + 1,
        renderCommentTemplate(prompts.commentTemplate, record),
    ));

    const prefix = stripComposerCursorMarker(prompts.userPrompt).trim();
    if (lines.length < 1) return prefix;
    if (!prefix) return lines.join('\n');
    return prompts.promptPosition === 'bottom'
        ? [...lines, '', prefix].join('\n')
        : [prefix, '', ...lines].join('\n');
}
