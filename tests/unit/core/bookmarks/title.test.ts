import { describe, expect, it } from 'vitest';
import { normalizeBookmarkTitle, validateBookmarkTitle } from '../../../../src/core/bookmarks/title';

describe('bookmarks/title', () => {
    it('normalizes by trimming', () => {
        expect(normalizeBookmarkTitle('  Hello  ')).toBe('Hello');
    });

    it('rejects empty titles', () => {
        expect(validateBookmarkTitle('')).toEqual({ ok: false, reason: 'empty' });
        expect(validateBookmarkTitle('   ')).toEqual({ ok: false, reason: 'empty' });
    });

    it('rejects titles longer than 100 chars', () => {
        const long = 'a'.repeat(101);
        expect(validateBookmarkTitle(long)).toEqual({ ok: false, reason: 'tooLong' });
    });

    it('rejects forbidden characters', () => {
        for (const c of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
            expect(validateBookmarkTitle(`a${c}b`)).toEqual({ ok: false, reason: 'forbiddenChars' });
        }
    });

    it('accepts a normal title', () => {
        expect(validateBookmarkTitle('My bookmark title')).toEqual({ ok: true });
    });
});

