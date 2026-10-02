import readerBaseCss from './readerPanelBase.css?inline';
import readerLayoutCss from './readerPanelLayout.css?inline';
import readerContentCss from './readerPanelContent.css?inline';
import {
    chevronRightIcon,
    copyIcon,
    externalLinkIcon,
    gripHorizontalIcon,
    maximizeIcon,
    messageSquareTextIcon,
    messageSquareShareIcon,
    minimizeIcon,
    panelLeftIcon,
    settingsIcon,
    trashIcon,
    xIcon,
} from '../../../assets/icons';
import { getPanelChromeCss } from '../components/styles/panelChromeCss';
import { getHighlightSwatchesCss } from '../components/HighlightSwatches';
import { getMarkdownThemeCss } from '../../../services/renderer/markdownTheme';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import type { ReaderOutlineItem } from '../../../services/renderer/renderMarkdown';

type ReaderTemplateState = {
    items: readonly ReaderItem[];
    index: number;
    fullscreen: boolean;
    panelSizeRatio: { widthRatio: number; heightRatio: number };
    contentMaxWidthPx: number;
    bodyFontSizePx: number;
    stickyEnabled: boolean;
    stickyOpen: boolean;
    stickyWidthPx: number;
    stickyBlocks: readonly ReaderStickyBlockTemplate[];
    renderedHtml: string;
    outlineItems: readonly ReaderOutlineItem[];
    activeOutlineId: string;
    showOutlineRail: boolean;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    showCopy: boolean;
    showOpenConversation: boolean;
};

type ReaderStickyBlockTemplate = {
    id: string;
    renderedHtml: string;
};

function iconMarkup(svg: string): string {
    return `<span class="aimd-icon">${svg}</span>`;
}

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}

function renderUserPromptMarkup(display: ReaderUserPromptDisplay): string {
    if (!display.truncated) return escapeHtml(display.full);
    return `
      <div class="reader-message__body--prompt-truncated">
        <div class="reader-message__prompt-segment" data-role="user-prompt-segment">${escapeHtml(display.head)}</div>
        <div class="reader-message__ellipsis-line" data-role="user-prompt-ellipsis">...</div>
        <div class="reader-message__prompt-segment" data-role="user-prompt-segment">${escapeHtml(display.middle)}</div>
        <div class="reader-message__ellipsis-line" data-role="user-prompt-ellipsis">...</div>
        <div class="reader-message__prompt-segment" data-role="user-prompt-segment">${escapeHtml(display.tail)}</div>
      </div>
    `;
}

function renderOutlineMarkup(params: {
    outlineItems: readonly ReaderOutlineItem[];
    activeOutlineId: string;
    getLabel: (key: string, fallback: string, substitutions?: string | string[]) => string;
}): string {
    const { outlineItems, activeOutlineId, getLabel } = params;
    if (outlineItems.length < 2) return '';

    const label = getLabel('readerOutlineLabel', 'Heading outline');
    const items = outlineItems.map((item) => {
        const level = Math.max(1, Math.min(6, Math.round(item.level)));
        const itemLabel = getLabel('readerOutlineGoToHeading', `Go to heading ${item.text}`, item.text);
        return `
          <button class="reader-outline-rail__item" type="button" data-action="reader-outline-jump" data-outline-id="${escapeHtml(item.id)}" data-level="${level}" data-active="${item.id === activeOutlineId ? '1' : '0'}" aria-label="${escapeHtml(itemLabel)}" title="${escapeHtml(item.text)}">
            <span class="reader-outline-rail__index" aria-hidden="true">H${level}</span>
            <span class="reader-outline-rail__label">${escapeHtml(item.text)}</span>
          </button>
        `;
    }).join('');

    return `
      <nav class="reader-outline-rail" aria-label="${escapeHtml(label)}">
        <div class="reader-outline-rail__list">
          ${items}
        </div>
      </nav>
    `;
}

function renderStickyMarkup(params: {
    enabled: boolean;
    open: boolean;
    widthPx: number;
    blocks: readonly ReaderStickyBlockTemplate[];
    getLabel: (key: string, fallback: string, substitutions?: string | string[]) => string;
}): string {
    const { enabled, open, widthPx, blocks, getLabel } = params;
    if (!enabled) return '';

    const title = getLabel('readerStickyTitle', 'Excerpt tray');
    const empty = getLabel('readerStickyEmpty', 'Select important content and choose Keep excerpt.');
    const deleteLabel = getLabel('readerStickyDelete', 'Remove excerpt');
    const dragLabel = getLabel('readerStickyDrag', 'Drag to reorder');

    const body = blocks.length > 0
        ? blocks.map((block) => `
          <article class="reader-sticky-block" data-role="reader-sticky-block" data-sticky-id="${escapeHtml(block.id)}">
            <div class="reader-sticky-block__toolbar">
              <button class="icon-btn reader-sticky-block__drag" type="button" draggable="true" data-action="reader-sticky-drag" data-sticky-id="${escapeHtml(block.id)}" aria-label="${escapeHtml(dragLabel)}" title="${escapeHtml(dragLabel)}">${iconMarkup(gripHorizontalIcon)}</button>
              <button class="icon-btn icon-btn--danger reader-sticky-block__tool" type="button" data-action="reader-sticky-delete" data-sticky-id="${escapeHtml(block.id)}" aria-label="${escapeHtml(deleteLabel)}" title="${escapeHtml(deleteLabel)}">${iconMarkup(trashIcon)}</button>
            </div>
            <div class="reader-sticky-block__content markdown-body">${block.renderedHtml}</div>
          </article>
        `).join('')
        : `<div class="reader-sticky-empty">${escapeHtml(empty)}</div>`;

    return `
      <aside class="reader-sticky-panel" data-open="${open ? '1' : '0'}" style="--_reader-sticky-width: ${Math.max(1, Math.round(widthPx))}px;">
        <div class="reader-sticky-shell" aria-hidden="${open ? 'false' : 'true'}">
          <div class="reader-sticky-header">
            <div class="reader-sticky-title">${escapeHtml(title)}</div>
            <div class="reader-sticky-count">${blocks.length}</div>
          </div>
          <div class="reader-sticky-list">
            ${body}
          </div>
          <div class="reader-sticky-resize" data-action="reader-sticky-resize" aria-hidden="true"></div>
        </div>
      </aside>
    `;
}

export function getReaderPanelHtml(params: {
    state: ReaderTemplateState;
    canOpenConversation: boolean;
    getLabel: (key: string, fallback: string, substitutions?: string | string[]) => string;
}): string {
    const { state, canOpenConversation, getLabel } = params;
    const total = state.items.length;
    const hasOutline = state.showOutlineRail && state.outlineItems.length >= 2;
    const title = getLabel('btnReader', 'Reader panel');
    const openConversationLabel = getLabel('openConversationLabel', 'Open conversation');
    const copyLabel = getLabel('btnCopyText', 'Copy markdown');
    const fullscreenLabel = state.fullscreen
        ? getLabel('exitFullscreen', 'Exit fullscreen')
        : getLabel('toggleFullscreen', 'Toggle fullscreen');
    const settingsLabel = getLabel('readerSettingsLabel', 'Reader settings');
    const userMessageLabel = getLabel('readerUserMessageLabel', 'Question');
    const assistantMessageLabel = getLabel('readerAssistantMessageLabel', 'AI response');
    const closeLabel = getLabel('btnClose', 'Close panel');
    const previousLabel = getLabel('previousMessage', 'Previous message');
    const nextLabel = getLabel('nextMessage', 'Next message');
    const pagerHint = '';

    return `
<div class="panel-window panel-window--reader" data-fullscreen="${state.fullscreen ? '1' : '0'}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" style="--_reader-panel-width-ratio: ${Math.max(0.01, state.panelSizeRatio.widthRatio)}; --_reader-panel-height-ratio: ${Math.max(0.01, state.panelSizeRatio.heightRatio)}; --aimd-reader-markdown-body-size: ${Math.max(1, Math.round(state.bodyFontSizePx))}px;">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
      <div class="reader-header-page">${total > 0 ? `${state.index + 1}/${total}` : '0/0'}</div>
    </div>
    <div class="panel-header__actions">
      <div class="panel-header__actions-group" data-role="header-custom-actions"></div>
      ${state.showOpenConversation && canOpenConversation ? `<button class="icon-btn" data-action="reader-open-conversation" aria-label="${escapeHtml(openConversationLabel)}" title="${escapeHtml(openConversationLabel)}">${iconMarkup(externalLinkIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-comment-list" aria-label="${escapeHtml(getLabel('readerCommentListTitle', 'Annotations'))}" title="${escapeHtml(getLabel('readerCommentListTitle', 'Annotations'))}">${iconMarkup(messageSquareTextIcon)}</button>
      <button class="icon-btn" data-action="reader-copy-comments" aria-label="${escapeHtml(getLabel('readerCommentCopyComments', 'Copy annotations'))}" title="${escapeHtml(getLabel('readerCommentCopyComments', 'Copy annotations'))}">${iconMarkup(messageSquareShareIcon)}</button>
      ${state.showCopy ? `<button class="icon-btn" data-action="reader-copy" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-settings" aria-label="${escapeHtml(settingsLabel)}" title="${escapeHtml(settingsLabel)}">${iconMarkup(settingsIcon)}</button>
      <button class="icon-btn" data-action="reader-fullscreen" aria-label="${escapeHtml(fullscreenLabel)}" title="${escapeHtml(fullscreenLabel)}">${iconMarkup(state.fullscreen ? minimizeIcon : maximizeIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="reader-body-wrap" data-has-outline="${hasOutline ? '1' : '0'}" data-has-sticky="${state.stickyEnabled ? '1' : '0'}" data-sticky-open="${state.stickyOpen ? '1' : '0'}">
    ${renderStickyMarkup({
        enabled: state.stickyEnabled,
        open: state.stickyOpen,
        widthPx: state.stickyWidthPx,
        blocks: state.stickyBlocks,
        getLabel,
    })}
    <div class="reader-body">
      <article class="reader-content" style="--_reader-content-max-width: ${Math.max(1, Math.round(state.contentMaxWidthPx))}px;">
        <div class="reader-thread">
          <section class="reader-message reader-message--user">
            <div class="reader-message__label">${escapeHtml(userMessageLabel)}</div>
            <div class="reader-message__body reader-message__body--prompt">${renderUserPromptMarkup(state.userPromptDisplay)}</div>
          </section>
          <section class="reader-message reader-message--assistant">
            <div class="reader-message__label">${escapeHtml(assistantMessageLabel)}</div>
            <div class="reader-markdown-shell" data-role="reader-markdown-shell">
              <div class="reader-markdown markdown-body">${state.renderedHtml}</div>
              <div class="reader-comment-overlay" data-role="comment-overlay"></div>
            </div>
          </section>
        </div>
      </article>
    </div>
    ${hasOutline ? renderOutlineMarkup({
        outlineItems: state.outlineItems,
        activeOutlineId: state.activeOutlineId,
        getLabel,
    }) : ''}
  </div>
  <div class="panel-footer reader-footer">
    <div class="reader-footer__left">
      ${state.stickyEnabled ? `<button class="icon-btn reader-sticky-footer-toggle" type="button" data-action="reader-sticky-toggle" data-active="${state.stickyOpen ? '1' : '0'}" aria-label="${escapeHtml(state.stickyOpen ? getLabel('readerStickyCollapse', 'Hide excerpt tray') : getLabel('readerStickyExpand', 'Show excerpt tray'))}" title="${escapeHtml(state.stickyOpen ? getLabel('readerStickyCollapse', 'Hide excerpt tray') : getLabel('readerStickyExpand', 'Show excerpt tray'))}">${iconMarkup(panelLeftIcon)}</button>` : ''}
      <div class="reader-footer__actions" data-role="footer-left-actions"></div>
    </div>
    <div class="reader-footer__center">
      <button class="nav-btn nav-btn--reader" data-action="reader-prev" aria-label="${escapeHtml(previousLabel)}" title="${escapeHtml(previousLabel)}" ${state.index <= 0 ? 'disabled' : ''}>${iconMarkup(chevronRightIcon)}</button>
      <div class="reader-dots" aria-label="${escapeHtml(getLabel('paginationLabel', 'Pagination'))}"></div>
      <button class="nav-btn nav-btn--next nav-btn--reader" data-action="reader-next" aria-label="${escapeHtml(nextLabel)}" title="${escapeHtml(nextLabel)}" ${state.index >= total - 1 ? 'disabled' : ''}>${iconMarkup(chevronRightIcon)}</button>
    </div>
    <div class="reader-footer__meta">
      <div class="hint">${escapeHtml(pagerHint)}</div>
      <div class="reader-footer-page">${total > 0 ? `${state.index + 1}/${total}` : '0/0'}</div>
      <div class="status-line" data-field="status">${escapeHtml(state.statusText)}</div>
    </div>
  </div>
  <div class="reader-panel-resize" data-action="reader-panel-resize" aria-hidden="true"></div>
</div>
`;
}

export function getReaderPanelCss(): string {
    // --aimd-font-family-sans and the scoped layout remain in the CSS sources.
    return getHighlightSwatchesCss() + readerBaseCss + getPanelChromeCss() + readerLayoutCss
        + getMarkdownThemeCss('.reader-markdown') + getMarkdownThemeCss('.reader-sticky-block__content') + readerContentCss;
}

export function ensureShadowStylesheetLink(shadow: ShadowRoot, href: string, styleId: string): HTMLLinkElement {
    const existing = shadow.querySelector<HTMLLinkElement>(`link[data-aimd-style-link="${styleId}"]`);
    if (existing) {
        if (existing.href !== href) existing.href = href;
        return existing;
    }

    const link = shadow.ownerDocument.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-aimd-style-link', styleId);
    shadow.appendChild(link);
    return link;
}
