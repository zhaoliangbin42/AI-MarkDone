import type { Folder } from '../../../core/bookmarks/types';
import { PathUtils } from '../../../core/bookmarks/path';
import { normalizeBookmarkTitle, validateBookmarkTitle } from '../../../core/bookmarks/title';
import type {
    BookmarkSaveDraftAction,
    BookmarkSaveDraftState,
    BookmarkSaveDraftValidation,
    DeriveInitialSelectionParams,
    SaveDialogMode,
} from './types';

function normalizeExistingFolderCandidate(path: string | null | undefined, folders: Folder[]): string | null {
    if (!path) return null;
    try {
        const normalized = PathUtils.normalize(path);
        return folders.some((f) => f.path === normalized) ? normalized : null;
    } catch {
        return null;
    }
}

function pickFirstRootFolderPath(folders: Folder[]): string | null {
    if (folders.length === 0) return null;

    const roots = folders.filter((f) => PathUtils.getParentPath(f.path) === null);
    const list = roots.length > 0 ? roots : folders;

    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return sorted[0]?.path ?? null;
}

export function deriveDefaultTitle(params: { userPrompt: string; existingTitle?: string | null }): string {
    const existing = normalizeBookmarkTitle(params.existingTitle ?? '');
    if (existing) return existing.length > 100 ? existing.slice(0, 100) : existing;

    const prompt = normalizeBookmarkTitle(params.userPrompt ?? '');
    if (!prompt) return '';
    return prompt.length > 100 ? prompt.slice(0, 100) : prompt;
}

export function expandAncestors(path: string): Set<string> {
    const expanded = new Set<string>();
    const normalized = PathUtils.normalize(path);
    const segments = normalized.split(PathUtils.SEPARATOR);
    let current = '';
    for (const seg of segments) {
        current = current ? `${current}${PathUtils.SEPARATOR}${seg}` : seg;
        expanded.add(current);
    }
    return expanded;
}

export function deriveInitialSelection(params: DeriveInitialSelectionParams): string | null {
    const folders = params.folders;
    const candidateRaw =
        params.mode === 'edit' ? (params.currentFolderPath ?? null) : (params.lastSelectedFolderPath ?? null);

    const candidate = normalizeExistingFolderCandidate(candidateRaw, folders);
    if (candidate) return candidate;

    return pickFirstRootFolderPath(folders);
}

export function createInitialDraftState(params: {
    mode: SaveDialogMode;
    title: string;
    selectedFolderPath: string | null;
}): BookmarkSaveDraftState {
    return {
        mode: params.mode,
        title: params.title,
        selectedFolderPath: params.selectedFolderPath,
        expandedPaths: params.selectedFolderPath ? expandAncestors(params.selectedFolderPath) : new Set<string>(),
    };
}

export function reduceDraft(state: BookmarkSaveDraftState, action: BookmarkSaveDraftAction): BookmarkSaveDraftState {
    switch (action.type) {
        case 'setMode':
            return { ...state, mode: action.mode };
        case 'setTitle':
            return { ...state, title: action.title };
        case 'setSelectedFolderPath': {
            const nextExpanded = new Set(state.expandedPaths);
            if (action.path) {
                for (const p of expandAncestors(action.path)) nextExpanded.add(p);
            }
            return { ...state, selectedFolderPath: action.path, expandedPaths: nextExpanded };
        }
        case 'toggleExpanded': {
            const next = new Set(state.expandedPaths);
            if (next.has(action.path)) next.delete(action.path);
            else next.add(action.path);
            return { ...state, expandedPaths: next };
        }
        case 'expandToPath': {
            const next = new Set(state.expandedPaths);
            for (const p of expandAncestors(action.path)) next.add(p);
            return { ...state, expandedPaths: next };
        }
        default:
            return state;
    }
}

export function validateDraft(state: BookmarkSaveDraftState): BookmarkSaveDraftValidation {
    if (!state.selectedFolderPath) {
        return { canSubmit: false, folderError: 'missing' };
    }

    if (state.mode === 'folder-select') {
        return { canSubmit: true };
    }

    const res = validateBookmarkTitle(state.title);
    if (!res.ok) return { canSubmit: false, titleError: res.reason };
    return { canSubmit: true };
}

