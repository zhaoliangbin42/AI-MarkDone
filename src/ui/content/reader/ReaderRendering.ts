import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { formatReaderUserPromptDisplay, type ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import { renderMarkdownForReader, type ReaderAtomicUnit, type ReaderOutlineItem } from '../../../services/renderer/renderMarkdown';
import { decorateReaderCodeBlocksHtml } from './readerCodeBlockEnhancer';
import {
    ensureShadowStylesheetLink,
    getReaderPanelCss,
    getReaderPanelHtml,
} from './readerPanelTemplate';
import type { ReaderPanelViewModel } from './ReaderViewModel';

export type ReaderLabelResolver = (key: string, fallback: string, substitutions?: string | string[]) => string;

export type ReaderRenderResult = {
    html: string;
    markdownSource: string;
    atomicUnits: ReaderAtomicUnit[];
    outlineItems: ReaderOutlineItem[];
    activeOutlineId: string;
    userPromptDisplay: ReaderUserPromptDisplay;
};

export function createEmptyReaderRenderResult(userPrompt = ''): ReaderRenderResult {
    return {
        html: '',
        markdownSource: '',
        atomicUnits: [],
        outlineItems: [],
        activeOutlineId: '',
        userPromptDisplay: formatReaderUserPromptDisplay(userPrompt),
    };
}

export async function renderReaderItem(item: ReaderItem, options: {
    highlightCode: boolean;
    labels: {
        copyCode: string;
        enableCodeWrap: string;
        disableCodeWrap: string;
    };
}): Promise<ReaderRenderResult> {
    const markdown = await resolveContent(item.content);
    const rendered = renderMarkdownForReader(markdown, {
        highlightCode: options.highlightCode,
    });
    return {
        html: decorateReaderCodeBlocksHtml(rendered.html, {
            copyLabel: options.labels.copyCode,
            wrapLabel: options.labels.enableCodeWrap,
            unwrapLabel: options.labels.disableCodeWrap,
        }),
        markdownSource: rendered.markdownSource,
        atomicUnits: rendered.atomicUnits,
        outlineItems: rendered.outlineItems,
        activeOutlineId: rendered.outlineItems[0]?.id ?? '',
        userPromptDisplay: formatReaderUserPromptDisplay(item.userPrompt),
    };
}

export function renderReaderStickyBlock(markdown: string, options: { highlightCode: boolean }): string {
    return renderMarkdownForReader(markdown, {
        softBreaks: true,
        highlightCode: options.highlightCode,
    }).html;
}

export function getReaderSurfaceCss(): string {
    return getReaderPanelCss();
}

export function renderReaderSurface(viewModel: ReaderPanelViewModel, getLabel: ReaderLabelResolver): string {
    return getReaderPanelHtml({
        state: viewModel,
        canOpenConversation: viewModel.canOpenConversation,
        getLabel,
    });
}

export function ensureReaderStylesheetLink(shadow: ShadowRoot, href: string, styleId: string): HTMLLinkElement {
    return ensureShadowStylesheetLink(shadow, href, styleId);
}
