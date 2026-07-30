import type { BookmarkSaveDialog } from './bookmarks/save/BookmarkSaveDialog';
import type { SaveMessagesDialog } from './export/SaveMessagesDialog';

export type BookmarkSaveDialogPort = Pick<BookmarkSaveDialog,
    | 'open'
    | 'setAppearance'
>;

export type SaveMessagesDialogPort = Pick<SaveMessagesDialog,
    | 'open'
    | 'isOpen'
    | 'close'
    | 'setAppearance'
    | 'setExportSettings'
    | 'setMarkdownFormulaFormat'
>;
