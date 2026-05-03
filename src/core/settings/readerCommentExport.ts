export type CommentTemplateTokenKey = 'selected_source' | 'user_comment';

export type CommentTemplateSegment =
    | { type: 'text'; value: string }
    | { type: 'token'; key: CommentTemplateTokenKey };

export type ReaderCommentPrompt = {
    id: string;
    title: string;
    content: string;
};

export type ReaderCommentPromptPosition = 'top' | 'bottom';

export type ReaderCommentExportSettings = {
    prompts: ReaderCommentPrompt[];
    template: CommentTemplateSegment[];
    promptPosition: ReaderCommentPromptPosition;
};

export const DEFAULT_READER_COMMENT_PROMPT_POSITION: ReaderCommentPromptPosition = 'top';

const DEFAULT_READER_COMMENT_PROMPTS: ReaderCommentPrompt[] = [
    {
        id: 'prompt-1',
        title: 'Precise Revision',
        content: 'Please revise the content according to my annotations below. Keep anything I did not mention unchanged whenever possible.',
    },
    {
        id: 'prompt-2',
        title: 'Point-by-Point Revision',
        content: 'Please go through my annotations one by one. Briefly explain how you will address each point, then provide the revised version.',
    },
    {
        id: 'prompt-3',
        title: 'Polished Final Draft',
        content: 'Please use my annotations below to produce a polished final version. Prioritize accuracy, clarity, and natural wording.',
    },
];

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
        { type: 'text', value: 'Regarding the following text:\n<selected_text>\n' },
        { type: 'token', key: 'selected_source' },
        { type: 'text', value: '\n</selected_text>\n\nMy annotation:\n<annotation>\n' },
        { type: 'token', key: 'user_comment' },
        { type: 'text', value: '\n</annotation>' },
    ];
}

export function createDefaultReaderCommentPrompts(): ReaderCommentPrompt[] {
    return DEFAULT_READER_COMMENT_PROMPTS.map((prompt) => ({ ...prompt }));
}

export function createDefaultReaderCommentPrompt(): ReaderCommentPrompt {
    return createDefaultReaderCommentPrompts()[0]!;
}

export function createDefaultReaderCommentExportSettings(): ReaderCommentExportSettings {
    return {
        prompts: createDefaultReaderCommentPrompts(),
        template: createDefaultCommentTemplate(),
        promptPosition: DEFAULT_READER_COMMENT_PROMPT_POSITION,
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
    if (!Array.isArray(value)) return createDefaultReaderCommentPrompts();
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

    if (prompts.length < 1) return createDefaultReaderCommentPrompts();
    return prompts;
}

export function normalizeReaderCommentPromptPosition(value: unknown): ReaderCommentPromptPosition {
    return value === 'bottom' ? 'bottom' : DEFAULT_READER_COMMENT_PROMPT_POSITION;
}

export function normalizeReaderCommentExportSettings(value: unknown): ReaderCommentExportSettings {
    if (!isRecord(value)) return createDefaultReaderCommentExportSettings();
    const prompts = normalizeReaderCommentPrompts(value.prompts);
    const template = normalizeCommentTemplate(value.template as CommentTemplateSegment[] | string | undefined);

    return {
        prompts,
        template: template.length > 0 ? template : createDefaultCommentTemplate(),
        promptPosition: normalizeReaderCommentPromptPosition(value.promptPosition),
    };
}
