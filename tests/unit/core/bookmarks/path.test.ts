import { describe, expect, it } from 'vitest';
import { PathUtils, PathValidationError } from '../../../../src/core/bookmarks/path';

describe('bookmarks path utils', () => {
    it('rejects traversal paths', () => {
        expect(() => PathUtils.validatePath('../escape')).toThrow(PathValidationError);
        expect(() => PathUtils.validatePath('A/../B')).toThrow(PathValidationError);
    });

    it('rejects over-depth paths (MAX_DEPTH=4)', () => {
        expect(() => PathUtils.validatePath('A/B/C/D/E')).toThrow(PathValidationError);
    });

    it('treats same-level folder names as case-insensitive conflicts', () => {
        expect(PathUtils.hasNameConflict('import', ['Import'])).toBe(true);
        expect(PathUtils.hasNameConflict('Work', ['Personal'])).toBe(false);
    });

    it('updatePathPrefix rewrites descendants and exact matches', () => {
        expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Work/AI')).toBe('Projects/AI');
        expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Work')).toBe('Projects');
        expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Personal/Notes')).toBe('Personal/Notes');
    });
});

