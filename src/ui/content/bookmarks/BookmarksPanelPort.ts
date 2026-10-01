import type { FormulaRenderOptions, FormulaSvgAsset } from '../../../services/math/formulaAssetRenderer';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';

export type LibraryAnnotationPort = {
    listLive(): ReaderCommentRecord[];
    updateLive(record: ReaderCommentRecord): Promise<void>;
    removeLive(record: ReaderCommentRecord): Promise<void>;
    subscribe(listener: () => void): () => void;
    canInsert(record: ReaderCommentRecord): boolean;
    insert(record: ReaderCommentRecord): Promise<void>;
    compose(record: ReaderCommentRecord): string;
};

export type BookmarksPanelOptions = {
    renderFormulaPreview?:(options:FormulaRenderOptions)=>Promise<FormulaSvgAsset>;
    onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void;
    annotations?: LibraryAnnotationPort;
};

export type BookmarksPanelPort = {
    isVisible(): boolean;
    toggle(): Promise<void>;
    show(options?: {tab: 'bookmarks' | 'settings'}): Promise<void>;
    hide(): void;
};
