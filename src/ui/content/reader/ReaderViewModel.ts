import type { AppSettings } from '../../../core/settings/types';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import type { ReaderOutlineItem } from '../../../services/renderer/renderMarkdown';
import type { ReaderWorkflowSnapshot } from './ReaderWorkflow';

export type ReaderStickyBlockView = {
    id: string;
    renderedHtml: string;
};

export type ReaderDisplayState = {
    fullscreen: boolean;
    panelSizeRatio: AppSettings['reader']['panelSizeRatio'];
    contentMaxWidthPx: number;
    bodyFontSizePx: number;
    stickyOpen: boolean;
    stickyWidthPx: number;
    stickyBlocks: readonly ReaderStickyBlockView[];
    renderedHtml: string;
    outlineItems: readonly ReaderOutlineItem[];
    activeOutlineId: string;
    showOutlineInReader: boolean;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
};

export type ReaderPanelViewModel = {
    items: readonly ReaderItem[];
    index: number;
    fullscreen: boolean;
    panelSizeRatio: AppSettings['reader']['panelSizeRatio'];
    contentMaxWidthPx: number;
    bodyFontSizePx: number;
    stickyEnabled: boolean;
    stickyOpen: boolean;
    stickyWidthPx: number;
    stickyBlocks: readonly ReaderStickyBlockView[];
    renderedHtml: string;
    outlineItems: readonly ReaderOutlineItem[];
    activeOutlineId: string;
    showOutlineRail: boolean;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    showCopy: boolean;
    showOpenConversation: boolean;
    canOpenConversation: boolean;
};

export function createReaderPanelViewModel(params: {
    workflow: ReaderWorkflowSnapshot;
    display: ReaderDisplayState;
    stickyEnabled: boolean;
    canOpenConversation: boolean;
}): ReaderPanelViewModel {
    const { workflow, display } = params;
    return {
        items: workflow.items,
        index: workflow.index,
        fullscreen: display.fullscreen,
        panelSizeRatio: display.panelSizeRatio,
        contentMaxWidthPx: display.contentMaxWidthPx,
        bodyFontSizePx: display.bodyFontSizePx,
        stickyEnabled: params.stickyEnabled,
        stickyOpen: display.stickyOpen,
        stickyWidthPx: display.stickyWidthPx,
        stickyBlocks: display.stickyBlocks,
        renderedHtml: display.renderedHtml,
        outlineItems: display.outlineItems,
        activeOutlineId: display.activeOutlineId,
        showOutlineRail: display.showOutlineInReader,
        userPromptDisplay: display.userPromptDisplay,
        statusText: display.statusText,
        showCopy: workflow.options.showCopy,
        showOpenConversation: workflow.options.showOpenConversation,
        canOpenConversation: params.canOpenConversation,
    };
}
