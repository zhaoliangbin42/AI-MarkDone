import type { Theme } from '../../../core/types/theme';
import type { AppSettings } from '../../../core/settings/types';
import type { ReaderItem } from '../../../services/reader/types';
import type { AppearanceSnapshot } from '../../../style/appearance';
import type {
    ReaderCommentExportContext,
    ReaderPanelPromptManagerController,
    ReaderPanelSettingsController,
    ReaderPanelShowOptions,
} from './ReaderPanelContracts';

export interface ReaderPanelPort {
    setAppearance(snapshot: AppearanceSnapshot): void;
    setReaderSettings(settings: AppSettings['reader']): void;
    setReaderSettingsController(controller: ReaderPanelSettingsController | null): void;
    setPromptManagerController(controller: ReaderPanelPromptManagerController | null): void;
    show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void>;
    hide(): void;
    isShowingConversationReader(): boolean;
    getItemsSnapshot(): ReaderItem[];
    appendItem(item: ReaderItem): Promise<void>;
    getCommentExportContext(): ReaderCommentExportContext | null;
}
