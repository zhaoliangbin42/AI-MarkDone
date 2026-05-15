import {
    chevronRightIcon,
    copyIcon,
    externalLinkIcon,
    maximizeIcon,
    messageSquareShareIcon,
    minimizeIcon,
    xIcon,
} from '../../../assets/icons';
import { getPanelChromeCss } from '../components/styles/panelChromeCss';
import { getMarkdownThemeCss } from '../components/markdownTheme';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import type { ReaderOutlineItem } from '../../../services/renderer/renderMarkdown';

type ReaderTemplateState = {
    items: ReaderItem[];
    index: number;
    fullscreen: boolean;
    contentMaxWidthPx: number;
    renderedHtml: string;
    outlineItems: ReaderOutlineItem[];
    activeOutlineId: string;
    showOutlineRail: boolean;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    showCopy: boolean;
    showOpenConversation: boolean;
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
    outlineItems: ReaderOutlineItem[];
    activeOutlineId: string;
    getLabel: (key: string, fallback: string, substitutions?: string | string[]) => string;
}): string {
    const { outlineItems, activeOutlineId, getLabel } = params;
    if (outlineItems.length < 2) return '';

    const label = getLabel('readerOutlineLabel', 'Markdown outline');
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
    const closeLabel = getLabel('btnClose', 'Close panel');
    const previousLabel = getLabel('previousMessage', 'Previous message');
    const nextLabel = getLabel('nextMessage', 'Next message');
    const pagerHint = '';

    return `
<div class="panel-window panel-window--reader" data-fullscreen="${state.fullscreen ? '1' : '0'}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
      <div class="reader-header-page">${total > 0 ? `${state.index + 1}/${total}` : '0/0'}</div>
    </div>
    <div class="panel-header__actions">
      <div class="panel-header__actions-group" data-role="header-custom-actions"></div>
      ${state.showOpenConversation && canOpenConversation ? `<button class="icon-btn" data-action="reader-open-conversation" aria-label="${escapeHtml(openConversationLabel)}" title="${escapeHtml(openConversationLabel)}">${iconMarkup(externalLinkIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-copy-comments" aria-label="${escapeHtml(getLabel('readerCommentCopyComments', 'Copy annotations'))}" title="${escapeHtml(getLabel('readerCommentCopyComments', 'Copy annotations'))}">${iconMarkup(messageSquareShareIcon)}</button>
      ${state.showCopy ? `<button class="icon-btn" data-action="reader-copy" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-fullscreen" aria-label="${escapeHtml(fullscreenLabel)}" title="${escapeHtml(fullscreenLabel)}">${iconMarkup(state.fullscreen ? minimizeIcon : maximizeIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="reader-body-wrap" data-has-outline="${hasOutline ? '1' : '0'}">
    <div class="reader-body">
      <article class="reader-content" style="--_reader-content-max-width: ${Math.max(1, Math.round(state.contentMaxWidthPx))}px;">
        <div class="reader-thread">
          <section class="reader-message reader-message--user">
            <div class="reader-message__label">User message</div>
            <div class="reader-message__body reader-message__body--prompt">${renderUserPromptMarkup(state.userPromptDisplay)}</div>
          </section>
          <section class="reader-message reader-message--assistant">
            <div class="reader-message__label">AI response</div>
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
</div>
`;
}

export function getReaderPanelCss(): string {
    return `
:host { font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }

${getPanelChromeCss()}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window {
  width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-6)));
  height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-6)));
  max-height: calc(100vh - var(--aimd-space-6));
}

.panel-window--reader {
  min-height: min(720px, calc(100vh - var(--aimd-space-6)));
}

.panel-window--reader[data-fullscreen="1"] {
  inset: 0;
  transform: none;
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
}

.panel-header__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.panel-header__meta--reader {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-header-gap);
}

.reader-header-page {
  display: inline-flex;
  align-items: center;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.panel-header__actions,
.panel-header__actions-group {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-action-gap);
}

.icon-btn--active {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.icon-btn--active:hover,
.icon-btn--active:active {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.icon-btn--danger {
  color: var(--aimd-interactive-danger);
}

.secondary-btn--compact {
  min-height: var(--aimd-size-control-compact);
  padding: 0 var(--aimd-space-2);
}

.secondary-btn--primary {
  font-weight: var(--aimd-font-semibold);
}

.reader-body-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.reader-body {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: calc(var(--aimd-space-6) + var(--aimd-space-1) / 2) calc(var(--aimd-space-6) + var(--aimd-space-1)) var(--aimd-space-5);
}

.reader-body-wrap[data-has-outline="1"] .reader-body {
  padding-right: calc(var(--aimd-space-6) + var(--aimd-size-control-icon-panel) + var(--aimd-space-4));
}

.reader-content {
  max-width: min(var(--_reader-content-max-width, 1000px), 100%);
  margin: 0 auto;
}

.reader-thread {
  display: grid;
  gap: calc(var(--aimd-space-4) + var(--aimd-space-1) / 2);
}

.reader-message {
  display: grid;
  gap: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  padding: var(--aimd-space-6) calc(var(--aimd-space-6) + var(--aimd-space-1));
  border-radius: var(--aimd-radius-2xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent);
}

.reader-message--assistant {
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
}

.reader-message__label {
  font-size: var(--aimd-text-xs);
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.reader-message__body--prompt {
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-reading);
  color: var(--aimd-text-primary);
}

.reader-message__body--prompt-truncated {
  display: grid;
  gap: var(--aimd-space-3);
}

.reader-message__prompt-segment {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reader-message__ellipsis-line {
  text-align: center;
  color: var(--aimd-text-secondary);
}

.reader-markdown {
  min-width: 0;
  --_reader-atomic-selected-bg: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  --_reader-atomic-selected-bg-strong: color-mix(in srgb, var(--aimd-interactive-selected) 96%, var(--aimd-bg-primary));
  --_reader-atomic-selected-border: color-mix(in srgb, var(--aimd-interactive-primary) 28%, transparent);
  --_reader-atomic-selected-border-strong: color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
}

.reader-markdown-shell {
  position: relative;
  min-width: 0;
  padding-right: calc(var(--aimd-space-5) + var(--aimd-size-control-icon-panel));
  --_reader-comment-floating-bg: var(--aimd-button-floating-bg);
  --_reader-comment-floating-border: var(--aimd-button-floating-border);
  --_reader-comment-floating-hover-bg: var(--aimd-button-floating-hover);
  --_reader-comment-floating-active-bg: var(--aimd-button-floating-active);
}

.reader-comment-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reader-comment-highlight {
  position: absolute;
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  border-radius: var(--aimd-radius-sm);
}

.reader-comment-highlight--active {
  background: color-mix(in srgb, var(--aimd-interactive-selected) 98%, var(--aimd-interactive-primary) 12%);
}

.reader-comment-action {
  position: absolute;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  white-space: nowrap;
}

.reader-comment-anchor {
  position: absolute;
  pointer-events: auto;
}

.reader-comment-action .aimd-icon,
.reader-comment-anchor .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-action__button {
  color: var(--aimd-text-secondary);
  background: var(--_reader-comment-floating-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-action__button:hover,
.reader-comment-action__button:focus-visible,
.reader-comment-anchor:hover {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-hover-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-action__button:active,
.reader-comment-action__button:focus,
.reader-comment-anchor:active {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-active-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-anchor {
  border-color: var(--_reader-comment-floating-border);
  background: var(--_reader-comment-floating-bg);
}

${getMarkdownThemeCss('.reader-markdown')}

.reader-markdown :where([data-aimd-unit-state="selected"]) {
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg);
  box-shadow: inset 0 0 0 1px var(--_reader-atomic-selected-border);
}

.reader-markdown :where(.katex[data-aimd-unit-state="selected"]) {
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow:
    inset 0 -0.22em 0 var(--_reader-atomic-selected-bg-strong),
    inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
}

.reader-markdown :where(code[data-aimd-unit-state="selected"]) {
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
}

.reader-markdown :where(.katex-display[data-aimd-unit-state="selected"]) {
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
}

.reader-markdown :where(pre[data-aimd-unit-state="selected"], table[data-aimd-unit-state="selected"], img[data-aimd-unit-state="selected"]) {
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
}

.reader-code-block {
  margin: 0 0 1em;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, var(--aimd-text-primary) 4%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 60%, transparent);
  overflow: hidden;
}

.reader-code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  min-height: 40px;
  padding: 0 var(--aimd-space-3);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 34%, transparent);
}

.reader-code-block__language {
  min-width: 0;
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  letter-spacing: 0.08em;
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-secondary);
}

.reader-code-block__copy {
  flex: 0 0 auto;
  margin-left: auto;
}

.reader-code-block__scroll {
  max-height: 320px;
  overflow: auto;
}

.reader-code-block__scroll :where(pre) {
  margin: 0;
  max-height: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.reader-markdown :where(.katex-display) {
  margin: 1em 0;
  padding: 0;
}

.reader-footer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  position: relative;
}

.reader-footer__left,
.reader-footer__center {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-action-gap);
}

.reader-footer__left {
  position: relative;
  min-width: 96px;
}

.reader-footer__actions {
  display: flex;
  align-items: center;
  min-height: 36px;
  gap: var(--aimd-panel-action-gap);
}

.reader-footer__center {
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.reader-footer__meta {
  display: grid;
  gap: var(--aimd-space-1);
  justify-self: end;
  text-align: right;
  max-width: 220px;
}

.reader-footer__meta .hint {
  font-size: var(--aimd-text-sm);
  line-height: 1.45;
  color: color-mix(in srgb, var(--aimd-text-secondary) 94%, transparent);
}

.reader-footer-page {
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  color: color-mix(in srgb, var(--aimd-text-secondary) 94%, transparent);
}

.status-line {
  min-height: 18px;
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.status-line:empty {
  display: none;
}

.reader-dots {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: var(--aimd-dot-gap);
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 2px 6px 2px 0;
  white-space: nowrap;
}

.reader-dots::-webkit-scrollbar {
  display: none;
}

.reader-dot {
  all: unset;
  box-sizing: border-box;
  display: block;
  cursor: pointer;
  border: 0;
  box-shadow: none;
  flex: none;
  width: var(--aimd-dot-size);
  height: var(--aimd-dot-size);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-strong) 82%, transparent);
}

.reader-dot:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 88%, var(--aimd-surface-hover));
}

.reader-dot:active {
  background: var(--aimd-button-icon-active);
}

.reader-dot:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.reader-dot--active {
  width: calc(var(--aimd-dot-size) * 2.2);
  background: var(--aimd-interactive-primary);
}

.reader-dot--bookmarked {
  border-radius: var(--aimd-radius-xs);
}

.reader-dot--bookmarked.reader-dot--active {
  border-radius: var(--aimd-radius-sm);
}

.reader-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: calc((var(--aimd-dot-size) * 2.2) + (var(--aimd-dot-gap) * 0.8));
  gap: calc(var(--aimd-dot-gap) * 0.4);
}

.reader-ellipsis__dot {
  display: block;
  width: calc(var(--aimd-dot-size) * 0.46);
  height: calc(var(--aimd-dot-size) * 0.46);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-text-secondary) 70%, transparent);
}

.nav-btn--reader {
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
}

.nav-btn--reader:first-child .aimd-icon svg {
  transform: rotate(180deg);
}

.reader-outline-rail {
  position: absolute;
  top: var(--aimd-space-5);
  right: var(--aimd-space-3);
  bottom: var(--aimd-space-5);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  width: calc(var(--aimd-space-4) + var(--aimd-space-6));
  max-width: calc(100% - var(--aimd-space-6));
  pointer-events: auto;
  transition: width var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-outline-rail:hover,
.reader-outline-rail:focus-within {
  width: min(28em, calc(100% - var(--aimd-space-6)));
}

.reader-outline-rail__list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0;
  width: 100%;
  height: max-content;
  max-height: 100%;
  overflow: hidden auto;
  padding: var(--aimd-space-1) 0;
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
  scrollbar-gutter: stable;
  transition:
    padding var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-outline-rail:hover .reader-outline-rail__list,
.reader-outline-rail:focus-within .reader-outline-rail__list {
  padding: var(--aimd-space-2);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, transparent);
  border-color: color-mix(in srgb, var(--aimd-border-subtle) 72%, transparent);
  box-shadow: var(--aimd-shadow-lg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.reader-outline-rail__item {
  --_reader-outline-indent: 0px;
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  justify-items: end;
  grid-auto-flow: column;
  gap: var(--aimd-space-2);
  width: 100%;
  min-height: var(--aimd-space-5);
  padding: var(--aimd-space-1) 0;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
  transition:
    padding var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-outline-rail__item::after {
  content: "";
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  display: block;
  width: var(--aimd-space-5);
  height: 2px;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  transform: scaleX(0.7);
  transform-origin: right center;
  transition:
    transform var(--aimd-duration-fast) var(--aimd-ease-in-out),
    height var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-outline-rail__index,
.reader-outline-rail__label {
  min-width: 0;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--aimd-text-sm);
  line-height: 1.25;
  grid-row: 1;
  transition:
    max-width var(--aimd-duration-fast) var(--aimd-ease-in-out),
    opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-outline-rail__index {
  grid-column: 1;
  display: block;
  color: var(--aimd-text-tertiary);
  font-weight: var(--aimd-font-medium);
  letter-spacing: 0;
}

.reader-outline-rail__label {
  grid-column: 2;
  display: block;
  color: inherit;
}

.reader-outline-rail:hover .reader-outline-rail__item,
.reader-outline-rail:focus-within .reader-outline-rail__item {
  grid-template-columns: 2.75em minmax(0, 1fr);
  justify-items: start;
  min-height: var(--aimd-size-control-compact);
  padding: var(--aimd-space-1) var(--aimd-space-2);
  padding-left: var(--_reader-outline-indent);
}

.reader-outline-rail:hover .reader-outline-rail__item::after,
.reader-outline-rail:focus-within .reader-outline-rail__item::after {
  display: none;
}

.reader-outline-rail:hover .reader-outline-rail__index,
.reader-outline-rail:hover .reader-outline-rail__label,
.reader-outline-rail:focus-within .reader-outline-rail__index,
.reader-outline-rail:focus-within .reader-outline-rail__label {
  max-width: 22em;
  opacity: 1;
}

.reader-outline-rail__item[data-level="2"] {
  --_reader-outline-indent: var(--aimd-space-4);
}

.reader-outline-rail__item[data-level="3"] {
  --_reader-outline-indent: var(--aimd-space-6);
}

.reader-outline-rail__item[data-level="4"],
.reader-outline-rail__item[data-level="5"],
.reader-outline-rail__item[data-level="6"] {
  --_reader-outline-indent: calc(var(--aimd-space-6) + var(--aimd-space-3));
}

.reader-outline-rail__item[data-active="1"] {
  color: var(--aimd-interactive-primary);
}

.reader-outline-rail__item[data-active="1"]::after {
  transform: scaleX(1);
  background: var(--aimd-interactive-primary);
}

.reader-outline-rail__item:hover,
.reader-outline-rail__item:focus-visible {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-text-primary);
}

.reader-outline-rail__item:hover::after,
.reader-outline-rail__item:focus-visible::after {
  transform: scaleX(1);
  background: var(--aimd-interactive-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}

.reader-outline-rail__item:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .panel-window {
    width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-4)));
    height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-4)));
  }

  .reader-body {
    padding: var(--aimd-space-5) calc(var(--aimd-space-4) + var(--aimd-space-1) / 2) var(--aimd-space-4);
  }

  .reader-message {
    padding: var(--aimd-space-5);
  }

  .reader-code-block__scroll {
    max-height: 240px;
  }

  .reader-footer {
    gap: var(--aimd-panel-action-gap);
  }

  .reader-outline-rail {
    display: none;
  }

  .reader-body-wrap[data-has-outline="1"] .reader-body {
    padding-right: calc(var(--aimd-space-4) + var(--aimd-space-1) / 2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-outline-rail,
  .reader-outline-rail__list,
  .reader-outline-rail__item,
  .reader-outline-rail__item::after,
  .reader-outline-rail__index,
  .reader-outline-rail__label {
    transition: none;
  }
}

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .reader-outline-rail:hover .reader-outline-rail__list,
  .reader-outline-rail:focus-within .reader-outline-rail__list {
    background: var(--aimd-bg-primary);
    border-color: var(--aimd-border-subtle);
  }

  .reader-outline-rail__item::after {
    background: var(--aimd-border-default);
  }

  .reader-outline-rail__item[data-active="1"]::after,
  .reader-outline-rail__item:hover::after,
  .reader-outline-rail__item:focus-visible::after {
    background: var(--aimd-interactive-primary);
  }
}
`;
}

export function ensureShadowStylesheetLink(shadow: ShadowRoot, href: string, styleId: string): HTMLLinkElement {
    const existing = shadow.querySelector<HTMLLinkElement>(`link[data-aimd-style-link="${styleId}"]`);
    if (existing) {
        if (existing.href !== href) existing.href = href;
        return existing;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-aimd-style-link', styleId);
    shadow.appendChild(link);
    return link;
}
