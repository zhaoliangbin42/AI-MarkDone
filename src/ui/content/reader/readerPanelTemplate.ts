import {
    chevronRightIcon,
    copyIcon,
    externalLinkIcon,
    fileCodeIcon,
    maximizeIcon,
    minimizeIcon,
    xIcon,
} from '../../../assets/icons';
import { getPanelChromeCss } from '../components/styles/panelChromeCss';
import { getMarkdownThemeCss } from '../components/markdownTheme';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';

type ReaderTemplateState = {
    items: ReaderItem[];
    index: number;
    fullscreen: boolean;
    renderedHtml: string;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    showCopy: boolean;
    showSource: boolean;
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

export function getReaderPanelHtml(params: {
    state: ReaderTemplateState;
    canOpenConversation: boolean;
    getLabel: (key: string, fallback: string, substitutions?: string | string[]) => string;
}): string {
    const { state, canOpenConversation, getLabel } = params;
    const total = state.items.length;
    const title = getLabel('btnReader', 'Reader panel');
    const openConversationLabel = getLabel('openConversationLabel', 'Open conversation');
    const copyLabel = getLabel('btnCopyText', 'Copy markdown');
    const sourceLabel = getLabel('btnViewSource', 'View source');
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
      ${state.showCopy ? `<button class="icon-btn" data-action="reader-copy" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>` : ''}
      ${state.showSource ? `<button class="icon-btn" data-action="reader-source" aria-label="${escapeHtml(sourceLabel)}" title="${escapeHtml(sourceLabel)}">${iconMarkup(fileCodeIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-fullscreen" aria-label="${escapeHtml(fullscreenLabel)}" title="${escapeHtml(fullscreenLabel)}">${iconMarkup(state.fullscreen ? minimizeIcon : maximizeIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="reader-body">
    <article class="reader-content">
      <div class="reader-thread">
        <section class="reader-message reader-message--user">
          <div class="reader-message__label">User message</div>
          <div class="reader-message__body reader-message__body--prompt">${renderUserPromptMarkup(state.userPromptDisplay)}</div>
        </section>
        <section class="reader-message reader-message--assistant">
          <div class="reader-message__label">AI response</div>
          <div class="reader-markdown markdown-body">${state.renderedHtml}</div>
        </section>
      </div>
    </article>
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
  min-height: 36px;
  padding: 0 var(--aimd-space-3);
}

.secondary-btn--primary {
  font-weight: var(--aimd-font-semibold);
}

.reader-body {
  flex: 1;
  overflow: auto;
  padding: 26px 28px 20px;
}

.reader-content {
  max-width: min(1000px, 100%);
  margin: 0 auto;
}

.reader-thread {
  display: grid;
  gap: 18px;
}

.reader-message {
  display: grid;
  gap: 14px;
  padding: 24px 28px;
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
}

${getMarkdownThemeCss('.reader-markdown')}

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
  gap: var(--aimd-dot-gap, 8px);
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
  width: var(--aimd-dot-size, 10px);
  height: var(--aimd-dot-size, 10px);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-strong) 82%, transparent);
}

.reader-dot:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 88%, var(--aimd-sys-color-surface-hover));
}

.reader-dot:active {
  background: var(--aimd-button-icon-active);
}

.reader-dot:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.reader-dot--active {
  width: calc(var(--aimd-dot-size, 10px) * 2.2);
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
  min-width: calc((var(--aimd-dot-size, 10px) * 2.2) + (var(--aimd-dot-gap, 8px) * 0.8));
  gap: calc(var(--aimd-dot-gap, 8px) * 0.4);
}

.reader-ellipsis__dot {
  display: block;
  width: calc(var(--aimd-dot-size, 10px) * 0.46);
  height: calc(var(--aimd-dot-size, 10px) * 0.46);
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

@media (max-width: 900px) {
  .panel-window {
    width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-4)));
    height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-4)));
  }

  .reader-body {
    padding: 20px 18px 16px;
  }

  .reader-message {
    padding: 20px;
  }

  .reader-code-block__scroll {
    max-height: 240px;
  }

  .reader-footer {
    gap: var(--aimd-panel-action-gap);
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
