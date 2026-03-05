import type { Folder } from '../../../core/bookmarks/types';
import type { BookmarkTitleValidationError } from '../../../core/bookmarks/title';

export type SaveDialogMode = 'create' | 'edit' | 'folder-select';

export type BookmarkSaveDraftState = {
    mode: SaveDialogMode;
    title: string;
    selectedFolderPath: string | null;
    expandedPaths: Set<string>;
};

export type BookmarkSaveDraftValidation = {
    canSubmit: boolean;
    titleError?: BookmarkTitleValidationError;
    folderError?: 'missing';
};

export type BookmarkSaveDraftAction =
    | { type: 'setMode'; mode: SaveDialogMode }
    | { type: 'setTitle'; title: string }
    | { type: 'setSelectedFolderPath'; path: string | null }
    | { type: 'toggleExpanded'; path: string }
    | { type: 'expandToPath'; path: string };

export type FolderPickerNodeViewModel = {
    path: string;
    name: string;
    depth: number;
    isExpanded: boolean;
    isSelected: boolean;
    canCreateSubfolder: boolean;
    children: FolderPickerNodeViewModel[];
};

export type FolderPickerViewModel = {
    nodes: FolderPickerNodeViewModel[];
    selectedPath: string | null;
    expandedPaths: Set<string>;
};

export type DeriveInitialSelectionParams = {
    folders: Folder[];
    mode: SaveDialogMode;
    lastSelectedFolderPath?: string | null;
    currentFolderPath?: string | null;
};

