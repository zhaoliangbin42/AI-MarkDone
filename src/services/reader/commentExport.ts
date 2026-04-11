import type { ReaderCommentRecord } from './commentSession';

export type ReaderCommentExportPrompts = {
    userPrompt: string;
    prompt1: string;
    prompt2: string;
    prompt3: string;
};

export function buildCommentsExport(
    comments: ReaderCommentRecord[],
    prompts: ReaderCommentExportPrompts,
): string {
    const lines = comments.map((record, index) => (
        `${index + 1}. ${prompts.prompt1}${record.sourceMarkdown}${prompts.prompt2}${record.comment}${prompts.prompt3}`
    ));

    if (lines.length < 1) return '';
    const prefix = prompts.userPrompt.trim();
    return prefix ? [prefix, ...lines].join('\n') : lines.join('\n');
}
