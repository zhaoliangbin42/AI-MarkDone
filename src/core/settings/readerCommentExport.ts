export type CommentTemplateTokenKey = 'selected_source' | 'user_comment';

export type CommentTemplateSegment =
    | { type: 'text'; value: string }
    | { type: 'token'; key: CommentTemplateTokenKey };

export type ReaderCommentPrompt = {
    id: string;
    title: string;
    content: string;
};

export type ReaderCommentExportSettings = {
    prompts: ReaderCommentPrompt[];
    template: CommentTemplateSegment[];
};

const LEGACY_SELECTED_TEXT_PLACEHOLDER = '【选中文字】';
const LEGACY_USER_COMMENT_PLACEHOLDER = '【用户评论】';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

export function createDefaultCommentTemplate(): CommentTemplateSegment[] {
    return [
        { type: 'text', value: 'Regarding\n' },
        { type: 'token', key: 'selected_source' },
        { type: 'text', value: '\nMy comment is:\n' },
        { type: 'token', key: 'user_comment' },
    ];
}

export function createDefaultReaderCommentPrompt(): ReaderCommentPrompt {
    return {
        id: 'prompt-1',
        title: 'Prompt 1',
        content: 'Please review the following comments:',
    };
}

export function createDefaultReaderCommentExportSettings(): ReaderCommentExportSettings {
    return {
        prompts: [createDefaultReaderCommentPrompt()],
        template: createDefaultCommentTemplate(),
    };
}

export function normalizeCommentTemplate(
    value: CommentTemplateSegment[] | string | null | undefined,
): CommentTemplateSegment[] {
    if (Array.isArray(value)) {
        const normalized: CommentTemplateSegment[] = [];
        value.forEach((segment) => {
            if (!segment || typeof segment !== 'object') return;
            if (segment.type === 'text') {
                pushText(normalized, typeof segment.value === 'string' ? segment.value : '');
                return;
            }
            if (segment.type === 'token' && (segment.key === 'selected_source' || segment.key === 'user_comment')) {
                normalized.push({ type: 'token', key: segment.key });
            }
        });
        return normalized;
    }

    const input = typeof value === 'string' ? value : '';
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

export function normalizeReaderCommentPrompts(value: unknown): ReaderCommentPrompt[] {
    if (!Array.isArray(value)) return [createDefaultReaderCommentPrompt()];
    const prompts: ReaderCommentPrompt[] = [];
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return;
        const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id : `prompt-${index + 1}`;
        const title = typeof entry.title === 'string' && entry.title.trim()
            ? entry.title
            : `Prompt ${index + 1}`;
        const content = typeof entry.content === 'string' ? entry.content : '';
        prompts.push({
            id,
            title,
            content,
        });
    });

    if (prompts.length < 1) return [createDefaultReaderCommentPrompt()];
    return prompts;
}

export function normalizeReaderCommentExportSettings(value: unknown): ReaderCommentExportSettings {
    if (!isRecord(value)) return createDefaultReaderCommentExportSettings();
    const prompts = normalizeReaderCommentPrompts(value.prompts);
    const template = normalizeCommentTemplate(value.template as CommentTemplateSegment[] | string | undefined);

    return {
        prompts,
        template: template.length > 0 ? template : createDefaultCommentTemplate(),
    };
}
