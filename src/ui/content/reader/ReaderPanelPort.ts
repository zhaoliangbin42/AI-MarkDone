import type { ReaderPanel } from './ReaderPanel';

export type ReaderPanelPort = Pick<ReaderPanel,
    | 'setTheme'
    | 'setThemeOverrides'
    | 'setReaderSettings'
    | 'setReaderSettingsController'
    | 'setPromptManagerController'
    | 'show'
    | 'hide'
    | 'isShowingConversationReader'
    | 'getItemsSnapshot'
    | 'appendItem'
    | 'getCommentExportContext'
>;
