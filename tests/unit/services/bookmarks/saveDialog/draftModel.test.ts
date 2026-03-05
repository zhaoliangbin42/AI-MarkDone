import { describe, expect, it } from 'vitest';
import type { Folder } from '../../../../../src/core/bookmarks/types';
import {
    createInitialDraftState,
    deriveDefaultTitle,
    deriveInitialSelection,
    expandAncestors,
    reduceDraft,
    validateDraft,
} from '../../../../../src/services/bookmarks/saveDialog/draftModel';

function folder(path: string): Folder {
    const parts = path.split('/');
    return { path, name: parts[parts.length - 1]!, depth: parts.length, createdAt: 1, updatedAt: 1 };
}

describe('bookmarks/saveDialog draftModel', () => {
    it('deriveDefaultTitle prefers existingTitle', () => {
        expect(deriveDefaultTitle({ userPrompt: 'Prompt', existingTitle: '  Title  ' })).toBe('Title');
    });

    it('deriveDefaultTitle falls back to userPrompt', () => {
        expect(deriveDefaultTitle({ userPrompt: '  Hello world  ' })).toBe('Hello world');
    });

    it('deriveInitialSelection prefers currentFolderPath in edit mode', () => {
        const folders = [folder('Import'), folder('Work')];
        expect(deriveInitialSelection({ folders, mode: 'edit', currentFolderPath: 'Work', lastSelectedFolderPath: 'Import' })).toBe('Work');
    });

    it('deriveInitialSelection prefers lastSelectedFolderPath in create mode', () => {
        const folders = [folder('Import'), folder('Work')];
        expect(deriveInitialSelection({ folders, mode: 'create', lastSelectedFolderPath: 'Work' })).toBe('Work');
    });

    it('deriveInitialSelection falls back to first root folder when lastSelected missing', () => {
        const folders = [folder('B'), folder('A'), folder('A/Sub')];
        expect(deriveInitialSelection({ folders, mode: 'create', lastSelectedFolderPath: 'Missing' })).toBe('A');
    });

    it('expandAncestors includes each prefix segment and itself', () => {
        expect(Array.from(expandAncestors('A/B/C'))).toEqual(['A', 'A/B', 'A/B/C']);
    });

    it('setSelectedFolderPath expands ancestors and itself', () => {
        const state = createInitialDraftState({ mode: 'create', title: '', selectedFolderPath: null });
        const next = reduceDraft(state, { type: 'setSelectedFolderPath', path: 'A/B' });
        expect(next.selectedFolderPath).toBe('A/B');
        expect(next.expandedPaths.has('A')).toBe(true);
        expect(next.expandedPaths.has('A/B')).toBe(true);
    });

    it('validateDraft requires folder in all modes', () => {
        const state = createInitialDraftState({ mode: 'create', title: 'T', selectedFolderPath: null });
        expect(validateDraft(state)).toEqual({ canSubmit: false, folderError: 'missing' });
    });

    it('validateDraft requires non-empty valid title in create/edit mode', () => {
        const state = createInitialDraftState({ mode: 'create', title: '   ', selectedFolderPath: 'Import' });
        expect(validateDraft(state).canSubmit).toBe(false);
        expect(validateDraft(state).titleError).toBe('empty');
    });

    it('validateDraft does not require title in folder-select mode', () => {
        const state = createInitialDraftState({ mode: 'folder-select', title: '', selectedFolderPath: 'Import' });
        expect(validateDraft(state)).toEqual({ canSubmit: true });
    });
});

