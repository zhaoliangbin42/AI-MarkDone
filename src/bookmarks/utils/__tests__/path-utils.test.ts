/**
 * Unit tests for PathUtils
 * 
 * Tests cover:
 * - Path normalization
 * - Security validation (directory traversal prevention)
 * - Edge cases (empty paths, special characters)
 * - Parent/child relationships
 * - Depth calculations
 */

import { PathUtils, PathValidationError } from "../path-utils";

describe('PathUtils', () => {
    describe('normalize', () => {
        it('should normalize simple paths', () => {
            expect(PathUtils.normalize('Work')).toBe('Work');
            expect(PathUtils.normalize('Work/AI Research')).toBe('Work/AI Research');
        });

        it('should remove redundant separators', () => {
            expect(PathUtils.normalize('Work//AI Research')).toBe('Work/AI Research');
            expect(PathUtils.normalize('Work///AI///Research')).toBe('Work/AI/Research');
        });

        it('should remove trailing separators', () => {
            expect(PathUtils.normalize('Work/')).toBe('Work');
            expect(PathUtils.normalize('Work/AI Research/')).toBe('Work/AI Research');
        });

        it('should remove leading separators', () => {
            expect(PathUtils.normalize('/Work')).toBe('Work');
            expect(PathUtils.normalize('/Work/AI Research')).toBe('Work/AI Research');
        });

        it('should throw on directory traversal attempts', () => {
            expect(() => PathUtils.normalize('Work/../Personal')).toThrow(PathValidationError);
            expect(() => PathUtils.normalize('../Work')).toThrow(PathValidationError);
            expect(() => PathUtils.normalize('Work/AI Research/..')).toThrow(PathValidationError);
        });

        it('should throw on invalid input', () => {
            expect(() => PathUtils.normalize('')).toThrow(PathValidationError);
            expect(() => PathUtils.normalize(null as any)).toThrow(PathValidationError);
            expect(() => PathUtils.normalize(undefined as any)).toThrow(PathValidationError);
        });
    });

    describe('normalizeFolderName', () => {
        it('should trim leading and trailing spaces', () => {
            const result = PathUtils.normalizeFolderName('  Work  ');
            expect(result.value).toBe('Work');
            expect(result.trimmed).toBe(true);
            expect(result.collapsedSpaces).toBe(true);
            expect(result.removedSlash).toBe(false);
        });

        it('should collapse consecutive spaces', () => {
            const result = PathUtils.normalizeFolderName('AI   Research');
            expect(result.value).toBe('AI Research');
            expect(result.collapsedSpaces).toBe(true);
        });

        it('should remove slashes', () => {
            const result = PathUtils.normalizeFolderName('Work/AI');
            expect(result.value).toBe('WorkAI');
            expect(result.removedSlash).toBe(true);
        });

        it('should normalize combined cases', () => {
            const result = PathUtils.normalizeFolderName('  Work//  AI  ');
            expect(result.value).toBe('Work AI');
            expect(result.trimmed).toBe(true);
            expect(result.collapsedSpaces).toBe(true);
            expect(result.removedSlash).toBe(true);
        });
    });

    describe('getParentPath', () => {
        it('should return parent path correctly', () => {
            expect(PathUtils.getParentPath('Work/AI Research')).toBe('Work');
            expect(PathUtils.getParentPath('Work/AI Research/ChatGPT')).toBe('Work/AI Research');
        });

        it('should return null for root level', () => {
            expect(PathUtils.getParentPath('Work')).toBeNull();
            expect(PathUtils.getParentPath('Personal')).toBeNull();
        });

        it('should return null for empty path', () => {
            expect(PathUtils.getParentPath('')).toBeNull();
        });
    });

    describe('getFolderName', () => {
        it('should extract folder name from path', () => {
            expect(PathUtils.getFolderName('Work/AI Research')).toBe('AI Research');
            expect(PathUtils.getFolderName('Work/AI Research/ChatGPT')).toBe('ChatGPT');
        });

        it('should return full name for root level', () => {
            expect(PathUtils.getFolderName('Work')).toBe('Work');
        });

        it('should return empty for empty path', () => {
            expect(PathUtils.getFolderName('')).toBe('');
        });
    });

    describe('getDepth', () => {
        it('should calculate depth correctly', () => {
            expect(PathUtils.getDepth('Work')).toBe(1);
            expect(PathUtils.getDepth('Work/AI Research')).toBe(2);
            expect(PathUtils.getDepth('Work/AI Research/ChatGPT')).toBe(3);
        });

        it('should return 0 for empty path', () => {
            expect(PathUtils.getDepth('')).toBe(0);
        });
    });

    describe('isDescendantOf', () => {
        it('should identify descendants correctly', () => {
            expect(PathUtils.isDescendantOf('Work/AI Research', 'Work')).toBe(true);
            expect(PathUtils.isDescendantOf('Work/AI Research/ChatGPT', 'Work')).toBe(true);
            expect(PathUtils.isDescendantOf('Work/AI Research/ChatGPT', 'Work/AI Research')).toBe(true);
        });

        it('should return false for non-descendants', () => {
            expect(PathUtils.isDescendantOf('Personal', 'Work')).toBe(false);
            expect(PathUtils.isDescendantOf('Work', 'Personal')).toBe(false);
        });

        it('should return false for self', () => {
            expect(PathUtils.isDescendantOf('Work', 'Work')).toBe(false);
        });

        it('should return false for empty paths', () => {
            expect(PathUtils.isDescendantOf('', 'Work')).toBe(false);
            expect(PathUtils.isDescendantOf('Work', '')).toBe(false);
        });
    });

    describe('join', () => {
        it('should join path segments correctly', () => {
            expect(PathUtils.join('Work', 'AI Research')).toBe('Work/AI Research');
            expect(PathUtils.join('Work', 'AI Research', 'ChatGPT')).toBe('Work/AI Research/ChatGPT');
        });

        it('should ignore empty segments', () => {
            expect(PathUtils.join('Work', '', 'AI Research')).toBe('Work/AI Research');
            expect(PathUtils.join('', 'Work', '')).toBe('Work');
        });

        it('should throw on traversal in segments', () => {
            expect(() => PathUtils.join('Work', '..')).toThrow(PathValidationError);
            expect(() => PathUtils.join('..', 'Work')).toThrow(PathValidationError);
        });

        it('should throw on separator in segments', () => {
            expect(() => PathUtils.join('Work/AI', 'Research')).toThrow(PathValidationError);
        });
    });

    describe('updatePathPrefix', () => {
        it('should update exact match', () => {
            expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Work')).toBe('Projects');
        });

        it('should update descendant paths', () => {
            expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Work/AI Research'))
                .toBe('Projects/AI Research');
            expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Work/AI Research/ChatGPT'))
                .toBe('Projects/AI Research/ChatGPT');
        });

        it('should not update non-matching paths', () => {
            expect(PathUtils.updatePathPrefix('Work', 'Projects', 'Personal/Research'))
                .toBe('Personal/Research');
        });
    });

    describe('isValidFolderName', () => {
        it('should accept valid names', () => {
            expect(PathUtils.isValidFolderName('Work')).toBe(true);
            expect(PathUtils.isValidFolderName('AI Research')).toBe(true);
            expect(PathUtils.isValidFolderName('Project 2024')).toBe(true);
            expect(PathUtils.isValidFolderName('My-Folder_123')).toBe(true);
            expect(PathUtils.isValidFolderName('Name: 2024')).toBe(true);
        });

        it('should reject empty names', () => {
            expect(PathUtils.isValidFolderName('')).toBe(false);
            expect(PathUtils.isValidFolderName('   ')).toBe(false);
        });

        it('should reject names with forbidden characters', () => {
            expect(PathUtils.isValidFolderName('Work/AI')).toBe(false);
            expect(PathUtils.isValidFolderName(`Work\u0001AI`)).toBe(false);
        });

        it('should reject names with traversal sequences', () => {
            expect(PathUtils.isValidFolderName('..')).toBe(false);
            expect(PathUtils.isValidFolderName('Work..')).toBe(true);
        });

        it('should reject names that are too long', () => {
            const longName = 'a'.repeat(101);
            expect(PathUtils.isValidFolderName(longName)).toBe(false);
        });
    });

    describe('getFolderNameValidation', () => {
        it('should return normalization details', () => {
            const result = PathUtils.getFolderNameValidation('  Work/AI  ');
            expect(result.normalized).toBe('WorkAI');
            expect(result.normalization.trimmed).toBe(true);
            expect(result.normalization.removedSlash).toBe(true);
            expect(result.isValid).toBe(true);
        });

        it('should surface empty and length errors', () => {
            const emptyResult = PathUtils.getFolderNameValidation('   ');
            expect(emptyResult.isValid).toBe(false);
            expect(emptyResult.errors).toContain('empty');

            const longResult = PathUtils.getFolderNameValidation('a'.repeat(101));
            expect(longResult.isValid).toBe(false);
            expect(longResult.errors).toContain('tooLong');
        });
    });

    describe('generateAutoRenameName', () => {
        it('should generate the next available name', () => {
            const result = PathUtils.generateAutoRenameName('Work', ['Work', 'Work-1']);
            expect(result).toBe('Work-2');
        });

        it('should handle case-insensitive conflicts', () => {
            const result = PathUtils.generateAutoRenameName('Work', ['work', 'Work-1']);
            expect(result).toBe('Work-2');
        });

        it('should truncate base name to fit the suffix', () => {
            const base = 'a'.repeat(100);
            const result = PathUtils.generateAutoRenameName(base, [base]);
            expect(result.length).toBe(100);
            expect(result.endsWith('-1')).toBe(true);
        });

        it('should normalize base name before generating', () => {
            const result = PathUtils.generateAutoRenameName('Work/  AI', ['Work AI']);
            expect(result).toBe('Work AI-1');
        });
    });

    describe('hasNameConflict', () => {
        it('should detect case-insensitive conflicts', () => {
            const conflict = PathUtils.hasNameConflict('Work', ['work']);
            expect(conflict).toBe(true);
        });

        it('should compare normalized names', () => {
            const conflict = PathUtils.hasNameConflict('Work  AI', ['Work AI']);
            expect(conflict).toBe(true);
        });

        it('should return false when no conflicts exist', () => {
            const conflict = PathUtils.hasNameConflict('Work', ['Personal', 'Archive']);
            expect(conflict).toBe(false);
        });
    });

    describe('validatePath', () => {
        it('should accept valid paths', () => {
            expect(() => PathUtils.validatePath('Work')).not.toThrow();
            expect(() => PathUtils.validatePath('Work/AI Research')).not.toThrow();
            expect(() => PathUtils.validatePath('Work/AI Research/ChatGPT')).not.toThrow();
        });

        it('should reject paths exceeding max depth', () => {
            expect(() => PathUtils.validatePath('A/B/C/D')).not.toThrow();
            expect(() => PathUtils.validatePath('A/B/C/D/E')).toThrow(PathValidationError);
        });

        it('should reject paths with invalid segments', () => {
            expect(() => PathUtils.validatePath(`Work/Bad\u0001Name`)).toThrow(PathValidationError);
            expect(() => PathUtils.validatePath('Work/../Personal')).toThrow(PathValidationError);
        });
    });

    describe('getAncestors', () => {
        it('should return all ancestors', () => {
            expect(PathUtils.getAncestors('Work/AI Research/ChatGPT'))
                .toEqual(['Work', 'Work/AI Research']);
            expect(PathUtils.getAncestors('Work/AI Research'))
                .toEqual(['Work']);
        });

        it('should return empty for root level', () => {
            expect(PathUtils.getAncestors('Work')).toEqual([]);
        });

        it('should return empty for empty path', () => {
            expect(PathUtils.getAncestors('')).toEqual([]);
        });
    });

    describe('areEqual', () => {
        it('should compare paths correctly', () => {
            expect(PathUtils.areEqual('Work', 'Work')).toBe(true);
            expect(PathUtils.areEqual('Work/', 'Work')).toBe(true);
            expect(PathUtils.areEqual('Work//AI', 'Work/AI')).toBe(true);
        });

        it('should return false for different paths', () => {
            expect(PathUtils.areEqual('Work', 'Personal')).toBe(false);
        });

        it('should handle empty paths', () => {
            expect(PathUtils.areEqual('', '')).toBe(true);
            expect(PathUtils.areEqual('Work', '')).toBe(false);
        });
    });
});
