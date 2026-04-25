export type BookmarkTitleValidationError = 'empty' | 'tooLong' | 'forbiddenChars';

const MAX_TITLE_LENGTH = 100;
const FORBIDDEN_CHARS = /[\/\\:*?"<>|]/;
export const BOOKMARK_TITLE_FORBIDDEN_CHARACTERS = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'] as const;

export function normalizeBookmarkTitle(input: string): string {
    return String(input ?? '').trim();
}

export function validateBookmarkTitle(input: string): { ok: boolean; reason?: BookmarkTitleValidationError } {
    const title = normalizeBookmarkTitle(input);

    if (!title) return { ok: false, reason: 'empty' };
    if (title.length > MAX_TITLE_LENGTH) return { ok: false, reason: 'tooLong' };
    if (FORBIDDEN_CHARS.test(title)) return { ok: false, reason: 'forbiddenChars' };
    return { ok: true };
}

export function getBookmarkTitleForbiddenCharacters(input: string): string[] {
    const forbidden = new Set<string>(BOOKMARK_TITLE_FORBIDDEN_CHARACTERS);
    const seen = new Set<string>();
    const result: string[] = [];

    for (const char of String(input ?? '')) {
        if (!forbidden.has(char) || seen.has(char)) continue;
        seen.add(char);
        result.push(char);
    }

    return result;
}
