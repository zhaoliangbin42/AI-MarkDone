import type { ReaderCommentRecord } from './commentSession';

export type CommentTemplateTokenKey = 'selected_source' | 'user_comment';

export type CommentTemplateSegment =
    | { type: 'text'; value: string }
    | { type: 'token'; key: CommentTemplateTokenKey };

export type ReaderCommentExportPrompts = {
    userPrompt: string;
    commentTemplate: CommentTemplateSegment[];
};

const LEGACY_SELECTED_TEXT_PLACEHOLDER = '【选中文字】';
const LEGACY_USER_COMMENT_PLACEHOLDER = '【用户评论】';

export function createDefaultCommentTemplate(): CommentTemplateSegment[] {
    return [
        { type: 'text', value: 'Regarding\n' },
        { type: 'token', key: 'selected_source' },
        { type: 'text', value: '\nMy comment is:\n' },
        { type: 'token', key: 'user_comment' },
    ];
}

function pushText(segments: CommentTemplateSegment[], value: string): void {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.type === 'text') {
        last.value += value;
        return;
    }
    segments.push({ type: 'text', value });
}

export function normalizeCommentTemplate(
    value: CommentTemplateSegment[] | string,
): CommentTemplateSegment[] {
    if (Array.isArray(value)) {
        const normalized: CommentTemplateSegment[] = [];
        value.forEach((segment) => {
            if (segment.type === 'text') {
                pushText(normalized, segment.value);
                return;
            }
            normalized.push(segment);
        });
        return normalized;
    }

    const input = value || '';
    if (!input) return [];

    const tokenMap = new Map<string, CommentTemplateTokenKey>([
        [LEGACY_SELECTED_TEXT_PLACEHOLDER, 'selected_source'],
        [LEGACY_USER_COMMENT_PLACEHOLDER, 'user_comment'],
    ]);
    const tokens = Array.from(tokenMap.keys());
    const normalized: CommentTemplateSegment[] = [];
    let index = 0;

    while (index < input.length) {
        const match = tokens
            .map((token) => ({ token, index: input.indexOf(token, index) }))
            .filter((entry) => entry.index >= 0)
            .sort((left, right) => left.index - right.index)[0];

        if (!match) {
            pushText(normalized, input.slice(index));
            break;
        }

        if (match.index > index) {
            pushText(normalized, input.slice(index, match.index));
        }
        normalized.push({ type: 'token', key: tokenMap.get(match.token)! });
        index = match.index + match.token.length;
    }

    return normalized;
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
