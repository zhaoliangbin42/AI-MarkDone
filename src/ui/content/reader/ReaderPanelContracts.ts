import type { AppSettings } from '../../../core/settings/types';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderCommentExportSettings } from '../../../services/reader/commentExport';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';

export type ReaderPanelActionContext = {
    item: ReaderItem;
    index: number;
    items: ReaderItem[];
    anchorEl?: HTMLElement;
    shadow?: ShadowRoot;
    notify: (text: string, timeoutMs?: number) => void;
    rerender: () => void;
};

export type ReaderPanelAction = {
    id: string;
    label: string;
    icon?: string;
    tooltip?: string;
    kind?: 'default' | 'primary' | 'danger';
    placement?: 'header' | 'footer_left';
    toggle?: boolean;
    rerenderOnClick?: boolean;
    isActive?: (ctx: ReaderPanelActionContext) => boolean;
    onClick: (ctx: ReaderPanelActionContext) => void | Promise<void>;
};

export type ReaderPanelProfile = 'conversation-reader' | 'bookmark-preview';

export type ReaderPanelShowOptions = {
    profile?: ReaderPanelProfile;
    onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    onRequestClose?: () => void | Promise<void>;
    actions?: ReaderPanelAction[];
};

export type ReaderPanelSettingsController = {
    onChange: (patch: Partial<AppSettings['reader']>) => Promise<void> | void;
};

export type ReaderCommentPromptProvider = () => Promise<ReaderCommentExportSettings['prompts']> | ReaderCommentExportSettings['prompts'];

export type ReaderCommentExportContext = {
    comments: ReaderCommentRecord[];
    listReaderPrompts: ReaderCommentPromptProvider;
    template: ReaderCommentExportSettings['template'];
    promptPosition: ReaderCommentExportSettings['promptPosition'];
    sortMode: ReaderCommentExportSettings['sortMode'];
};

export type ReaderPanelPromptManagerController = {
    onOpenManager: (anchor: HTMLElement) => Promise<void> | void;
    listReaderPrompts?: ReaderCommentPromptProvider;
};
