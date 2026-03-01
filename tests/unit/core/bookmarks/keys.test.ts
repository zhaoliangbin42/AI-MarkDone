import { describe, expect, it } from 'vitest';
import { buildBookmarkStorageKey, normalizeUrlWithoutProtocol } from '../../../../src/core/bookmarks/keys';

describe('bookmarks keys', () => {
    it('normalizes http/https into the same urlWithoutProtocol', () => {
        expect(normalizeUrlWithoutProtocol('https://chatgpt.com/c/1')).toBe('chatgpt.com/c/1');
        expect(normalizeUrlWithoutProtocol('http://chatgpt.com/c/1')).toBe('chatgpt.com/c/1');
    });

    it('buildBookmarkStorageKey keeps schema stable across http/https', () => {
        const a = buildBookmarkStorageKey('https://chatgpt.com/c/key-1', 1);
        const b = buildBookmarkStorageKey('http://chatgpt.com/c/key-1', 1);
        expect(a).toBe('bookmark:chatgpt.com/c/key-1:1');
        expect(b).toBe(a);
    });
});

