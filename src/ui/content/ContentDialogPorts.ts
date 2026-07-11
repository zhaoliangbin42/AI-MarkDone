import type { BookmarkSaveDialog } from './bookmarks/save/BookmarkSaveDialog';
import type { SaveMessagesDialog } from './export/SaveMessagesDialog';

export type BookmarkSaveDialogPort = Pick<BookmarkSaveDialog,
    | 'open'
    | 'setTheme'
    | 'setThemeOverrides'
>;

export type SaveMessagesDialogPort = Pick<SaveMessagesDialog,
    | 'open'
    | 'setTheme'
    | 'setThemeOverrides'
    | 'setExportSettings'
    | 'setMarkdownFormulaFormat'
>;
