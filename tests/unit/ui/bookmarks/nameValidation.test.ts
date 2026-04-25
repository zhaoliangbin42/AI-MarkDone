import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    folderNameLocalErrorMessage,
    titleValidationMessage,
    validateFolderPathInput,
    validateFolderSegmentName,
} from '@/ui/content/bookmarks/helpers/nameValidation';

vi.mock('@/ui/content/components/i18n', () => ({
    t: (key: string, args: string[] = []) => `${key}${args.length ? `:${args.join('|')}` : ''}`,
}));

describe('bookmark name validation messages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('explains which bookmark title characters are forbidden', () => {
        expect(titleValidationMessage('forbiddenChars', 'Alpha/Beta?')).toBe('titleForbiddenCharsDetailed:/ ?');
    });

    it('explains slash and traversal folder segment failures separately', () => {
        expect(validateFolderSegmentName('Work/Project')).toEqual({
            ok: false,
            message: 'folderNameNoSlash',
        });
        expect(validateFolderSegmentName('..')).toEqual({
            ok: false,
            message: 'folderNameTraversal',
        });
    });

    it('explains control character folder segment failures', () => {
        expect(folderNameLocalErrorMessage(['forbiddenChars'], 'Work\u0001Project')).toBe('folderNameControlChars');
    });

    it('validates folder path input while still allowing slash-separated folder paths', () => {
        expect(validateFolderPathInput('Work/Project')).toEqual({
            ok: true,
            normalized: 'Work/Project',
            note: '',
        });
        expect(validateFolderPathInput('Work/..')).toEqual({
            ok: false,
            message: 'folderNameTraversal',
        });
        expect(validateFolderPathInput('Work/Bad\u0001Name')).toEqual({
            ok: false,
            message: 'folderPathSegmentInvalid:Bad\\u0001Name|folderNameControlChars',
        });
    });
});
