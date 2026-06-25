import { PROMPT_TRIGGER_PREFIX } from './promptLibrary';

export type PromptTriggerToken = {
    start: number;
    end: number;
    token: string;
    query: string;
};

export type SlashPromptToken = PromptTriggerToken;

const CURSOR_MARKER = '{{cursor}}';

function isWhitespace(value: string): boolean {
    return /\s/.test(value);
}

function clampIndex(index: number, text: string): number {
    if (!Number.isFinite(index)) return text.length;
    return Math.max(0, Math.min(text.length, Math.floor(index)));
}

export function findPromptTriggerToken(text: string, cursorIndex: number): PromptTriggerToken | null {
    const cursor = clampIndex(cursorIndex, text);
    let start = cursor;
    while (start > 0 && !isWhitespace(text[start - 1] ?? '')) {
        start -= 1;
    }

    const token = text.slice(start, cursor);
    if (!token.startsWith(PROMPT_TRIGGER_PREFIX)) return null;
    if (start > 0 && !isWhitespace(text[start - 1] ?? '')) return null;
    if (token.length > 1 && token.slice(1).includes(PROMPT_TRIGGER_PREFIX)) return null;

    return {
        start,
        end: cursor,
        token,
        query: token.slice(1).toLowerCase(),
    };
}

export function findSlashPromptToken(text: string, cursorIndex: number): SlashPromptToken | null {
    return findPromptTriggerToken(text, cursorIndex);
}

export function applyPromptToTriggerToken(
    text: string,
    token: PromptTriggerToken,
    promptContent: string,
): { text: string; cursorIndex: number } {
    const start = clampIndex(token.start, text);
    const end = Math.max(start, clampIndex(token.end, text));
    const markerIndex = promptContent.indexOf(CURSOR_MARKER);
    const replacement = promptContent.replace(CURSOR_MARKER, '');
    const nextText = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
    const cursorIndex = markerIndex >= 0
        ? start + markerIndex
        : start + replacement.length;
    return { text: nextText, cursorIndex };
}

export function applyPromptToSlashToken(
    text: string,
    token: SlashPromptToken,
    promptContent: string,
): { text: string; cursorIndex: number } {
    return applyPromptToTriggerToken(text, token, promptContent);
}
