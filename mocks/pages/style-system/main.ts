import { Icons } from '../../../src/assets/icons';
import { ensureStyle } from '../../../src/style/shadow';
import { getTokenCss } from '../../../src/style/tokens';

type Theme = 'light' | 'dark';

type PageSpec = {
    id: string;
    title: string;
    description: string;
    group: string;
    html: string;
};

function icon(svg: string): string {
    return `<span class="icon" aria-hidden="true">${svg}</span>`;
}

function getPageSystemCss(): string {
    return `
:host {
  color-scheme: light dark;
  font-family: var(--aimd-font-family-base);
  color: var(--aimd-text-primary);
  --page-gap: var(--aimd-space-5);
}

* {
  box-sizing: border-box;
}

button,
input,
select,
textarea {
  font: inherit;
}

.page-system {
  display: grid;
  gap: var(--aimd-space-6);
}

.suite-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-5);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-md);
}

.suite-copy {
  display: grid;
  gap: var(--aimd-space-2);
}

.suite-kicker,
.frame-kicker,
.microcopy,
.meta,
.field-label {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
}

.suite-title,
.frame-title,
.panel-title,
.dialog-title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-weight: var(--aimd-font-semibold);
}

.suite-title {
  font-size: 22px;
  line-height: 1.2;
}

.suite-description {
  max-width: 760px;
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.theme-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 30px;
  padding: 0 var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-xs);
  white-space: nowrap;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--page-gap);
  align-items: start;
}

.page-frame {
  display: grid;
  gap: var(--aimd-space-4);
  min-width: 0;
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-md);
}

.page-frame__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-width: 0;
}

.page-frame__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.frame-title {
  font-size: var(--aimd-panel-title-size);
  line-height: var(--aimd-panel-title-line-height);
}

.page-frame__body {
  min-width: 0;
}

.chrome {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-primary);
}

.browser-window {
  min-height: 580px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-secondary) 58%, transparent), transparent 40%),
    var(--aimd-bg-primary);
}

.browser-topbar,
.mini-toolbar,
.row,
.dialog-actions,
.panel-header,
.tabbar,
.split-header,
.reader-toolbar,
.popup-link,
.directory-item,
.progress-row,
.setting-row,
.bookmark-row,
.turn-row {
  display: flex;
  align-items: center;
}

.browser-topbar {
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-width: 0;
  width: 100%;
  max-width: 100%;
  min-height: 40px;
  padding: 0 var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-surface);
}

.url-pill {
  flex: 1;
  min-width: 0;
  padding: 7px var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px;
  gap: var(--aimd-space-4);
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.conversation {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
}

.message {
  display: grid;
  gap: var(--aimd-space-2);
  width: min(100%, 680px);
  max-width: 680px;
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  overflow-wrap: anywhere;
}

.message[data-kind="user"] {
  justify-self: end;
  width: min(100%, 520px);
  max-width: 520px;
  background: var(--aimd-interactive-selected);
}

.message p {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.message-title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
}

.mini-toolbar {
  flex-wrap: wrap;
  gap: var(--aimd-space-1);
  width: fit-content;
  max-width: 100%;
  min-height: 34px;
  padding: 3px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-primary);
}

.rail {
  display: grid;
  gap: var(--aimd-space-2);
  align-self: start;
  justify-items: center;
  padding: var(--aimd-space-2);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-sm);
}

.icon,
.icon svg {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.icon-btn,
.toolbar-btn,
.round-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  background: transparent;
}

.icon-btn {
  width: 32px;
  height: 32px;
}

.toolbar-btn {
  min-height: 32px;
  padding: 0 var(--aimd-space-3);
  gap: var(--aimd-space-2);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
}

.round-btn {
  width: 36px;
  height: 36px;
}

.icon-btn[data-active="true"],
.toolbar-btn[data-active="true"],
.round-btn[data-active="true"],
.btn-primary {
  border-color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.btn,
.btn-primary,
.btn-danger,
.select,
.input {
  min-height: 36px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  padding: 0 var(--aimd-space-4);
  background: var(--aimd-bg-surface);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.btn-danger {
  color: var(--aimd-color-danger);
}

.input,
.select {
  width: 100%;
  border-radius: var(--aimd-radius-lg);
  font-weight: var(--aimd-font-regular);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--aimd-space-3);
}

.popup-card {
  width: min(360px, 100%);
  display: grid;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: calc(var(--aimd-radius-xl) + 4px);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.popup-brand {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-3);
}

.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.popup-links {
  display: grid;
  gap: var(--aimd-space-2);
}

.popup-link {
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: 52px;
  padding: 0 var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-primary);
}

.unsupported-popup-stage {
  display: grid;
  place-items: start center;
  min-height: 440px;
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent), transparent 38%),
    var(--aimd-bg-primary);
}

.unsupported-popup {
  display: grid;
  gap: var(--aimd-space-5);
  width: min(332px, 100%);
  padding: var(--aimd-space-5);
  border: 1px solid var(--aimd-border-default);
  border-radius: calc(var(--aimd-radius-xl) + 4px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-surface) 98%, white), color-mix(in srgb, var(--aimd-bg-surface) 92%, transparent)),
    var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.unsupported-popup__header {
  display: grid;
  gap: var(--aimd-space-3);
}

.unsupported-popup__note {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 28px;
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
}

.unsupported-popup__brand {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-3);
}

.unsupported-popup__logo {
  width: 40px;
  height: 40px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 12px;
  background: color-mix(in srgb, var(--aimd-bg-surface) 80%, white);
}

.unsupported-popup__title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: 18px;
  line-height: 1.2;
  font-weight: var(--aimd-font-semibold);
}

.unsupported-popup__links {
  display: grid;
  gap: var(--aimd-space-2);
}

.unsupported-popup__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: 44px;
  padding: 0 var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: color-mix(in srgb, var(--aimd-bg-surface) 72%, transparent);
  color: var(--aimd-text-primary);
}

.unsupported-popup__link-meta {
  display: grid;
  gap: 2px;
}

.unsupported-popup__link-label {
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.25;
}

.unsupported-popup__link-hint,
.unsupported-popup__footer {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.55;
}

.unsupported-popup__arrow {
  color: var(--aimd-text-secondary);
  font-size: 16px;
}

.unsupported-popup__footer {
  margin: 0;
  padding-top: var(--aimd-space-4);
  border-top: 1px solid var(--aimd-border-default);
}

.chatgpt-snapshot {
  position: relative;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  min-height: 620px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
}

.chatgpt-sidebar {
  display: grid;
  align-content: start;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-4);
  border-right: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, var(--aimd-bg-surface));
}

.chatgpt-brand {
  margin: 0 0 var(--aimd-space-3);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
}

.chatgpt-nav-row {
  min-height: 30px;
  padding: 0 var(--aimd-space-2);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 30px;
}

.chatgpt-nav-row[data-active="true"] {
  background: color-mix(in srgb, var(--aimd-bg-primary) 82%, transparent);
}

.chatgpt-main {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  background: var(--aimd-bg-surface);
}

.chatgpt-top-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  min-height: 48px;
  padding: var(--aimd-space-2) var(--aimd-space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 56%, transparent);
}

.chatgpt-thread {
  display: grid;
  align-content: end;
  gap: var(--aimd-space-4);
  min-width: 0;
  padding: var(--aimd-space-6);
}

.chatgpt-answer {
  display: grid;
  justify-self: center;
  gap: var(--aimd-space-3);
  width: min(720px, 100%);
}

.chatgpt-answer h4 {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: 22px;
  line-height: 1.25;
}

.chatgpt-answer p,
.chatgpt-answer li {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.chatgpt-answer ol {
  display: grid;
  gap: var(--aimd-space-1);
  margin: 0;
  padding-left: var(--aimd-space-5);
}

.chatgpt-code-card {
  display: grid;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-sm);
}

.chatgpt-official-actions,
.aimd-injected-toolbar,
.aimd-toolbar-stats {
  display: inline-flex;
  align-items: center;
}

.chatgpt-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.chatgpt-official-actions {
  gap: var(--aimd-space-2);
}

.aimd-injected-toolbar {
  gap: 4px;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--aimd-bg-surface) 97%, var(--aimd-bg-primary));
}

.aimd-toolbar-button {
  display: grid;
  place-items: center;
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--aimd-button-icon-text);
}

.aimd-toolbar-button[data-active="true"] {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.aimd-toolbar-stats {
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  min-width: 76px;
  padding: 0 6px;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.25;
  white-space: nowrap;
}

.directory-rail-preview {
  position: absolute;
  top: 48%;
  right: var(--aimd-space-2);
  display: grid;
  gap: 3px;
  width: calc(var(--aimd-space-4) + var(--aimd-space-6));
  transform: translateY(-50%);
  justify-items: end;
}

.directory-mark {
  display: block;
  width: 36px;
  height: 3px;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  transform: scaleX(0.39);
  transform-origin: right center;
}

.directory-mark[data-active="true"] {
  background: var(--aimd-interactive-primary);
  transform: scaleX(0.56);
}

.directory-step-preview {
  position: absolute;
  right: var(--aimd-space-4);
  bottom: var(--aimd-space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--aimd-space-1);
}

.directory-step-preview .icon-btn {
  color: var(--aimd-text-secondary);
}

.reader-modal-stage {
  position: relative;
  min-height: 660px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
}

.reader-modal-backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--aimd-bg-secondary) 74%, transparent) 0 160px, transparent 160px),
    color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.reader-modal-ghost {
  position: absolute;
  inset: var(--aimd-space-5);
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: var(--aimd-space-5);
  opacity: 0.42;
}

.reader-modal-ghost__sidebar,
.reader-modal-ghost__content {
  border-radius: var(--aimd-radius-lg);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent);
}

.reader-panel-window {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(760px, calc(100% - 72px));
  height: min(560px, calc(100% - 72px));
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
  transform: translate(-50%, -50%);
}

.reader-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-4);
  min-height: 58px;
  padding: 0 var(--aimd-space-5);
  border-bottom: 1px solid var(--aimd-border-default);
}

.reader-panel-title-row,
.reader-panel-actions,
.reader-panel-footer-left,
.reader-panel-footer-center,
.reader-panel-footer-meta {
  display: flex;
  align-items: center;
}

.reader-panel-title-row {
  gap: var(--aimd-panel-header-gap);
}

.reader-panel-actions {
  gap: var(--aimd-panel-action-gap);
}

.reader-panel-body {
  overflow: auto;
  padding: 26px 28px 20px;
}

.reader-thread {
  display: grid;
  gap: 18px;
  max-width: 1000px;
  margin: 0 auto;
}

.reader-message-block {
  display: grid;
  gap: 14px;
  padding: 24px 28px;
  border-radius: var(--aimd-radius-2xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent);
}

.reader-message-block[data-kind="assistant"] {
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
}

.reader-message-label {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.reader-message-text {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-reading);
  white-space: pre-wrap;
}

.reader-ellipsis-line {
  color: var(--aimd-text-secondary);
  text-align: center;
}

.reader-panel-footer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-panel-action-gap);
  min-height: 58px;
  padding: 0 var(--aimd-space-5);
  border-top: 1px solid var(--aimd-border-default);
}

.reader-panel-footer-left,
.reader-panel-footer-center {
  gap: var(--aimd-panel-action-gap);
}

.reader-panel-footer-center {
  justify-content: center;
  min-width: 0;
}

.reader-dot-strip {
  display: flex;
  align-items: center;
  gap: var(--aimd-dot-gap, 8px);
}

.reader-dot {
  width: var(--aimd-dot-size, 10px);
  height: var(--aimd-dot-size, 10px);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-interactive-primary);
}

.reader-panel-footer-meta {
  justify-content: flex-end;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
}

.panel-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 540px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.panel-sidebar {
  display: grid;
  align-content: start;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  border-right: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
}

.panel-main {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-width: 0;
}

.panel-header {
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  border-bottom: 1px solid var(--aimd-border-default);
}

.tabbar {
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2) var(--aimd-space-4);
  border-bottom: 1px solid var(--aimd-border-default);
  overflow-x: auto;
}

.tab {
  min-height: 32px;
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  white-space: nowrap;
}

.tab[data-active="true"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.panel-content,
.reader-content,
.settings-list,
.info-page {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: var(--aimd-space-4);
}

.bookmark-row,
.directory-item,
.progress-row,
.setting-row,
.turn-row {
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-primary);
}

.bookmark-row[data-active="true"],
.directory-item[data-active="true"],
.turn-row[data-active="true"] {
  background: var(--aimd-interactive-selected);
  border-color: var(--aimd-interactive-primary);
}

.row-main,
.setting-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.row-title,
.setting-title {
  overflow: hidden;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--aimd-space-4);
}

.reader-shell {
  display: grid;
  gap: var(--aimd-space-3);
  min-height: 540px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
  overflow: hidden;
}

.reader-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-bottom: 1px solid var(--aimd-border-default);
}

.reader-content {
  align-content: start;
  max-width: 720px;
}

.reader-content h3,
.info-page h3 {
  margin: 0;
  font-size: var(--aimd-text-lg);
  line-height: 1.35;
}

.reader-content p,
.info-page p,
.dialog p {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-reading);
}

.code-block {
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.dialog-stack {
  display: grid;
  gap: var(--aimd-space-4);
}

.dialog {
  display: grid;
  gap: var(--aimd-space-4);
  width: min(520px, 100%);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
  overflow: hidden;
}

.dialog-body {
  display: grid;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
}

.dialog-actions {
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-top: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
}

.progress-meter {
  height: 8px;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
  overflow: hidden;
}

.progress-meter > span {
  display: block;
  width: 68%;
  height: 100%;
  background: var(--aimd-interactive-primary);
}

.toggle {
  width: 42px;
  height: 24px;
  padding: 3px;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-interactive-primary);
}

.toggle::before {
  content: "";
  display: block;
  width: 18px;
  height: 18px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--aimd-text-on-primary);
}

.mock-overlay-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 620px;
  overflow: hidden;
  padding: var(--aimd-space-5);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent) 0 164px, transparent 164px),
    color-mix(in srgb, var(--aimd-overlay-bg) 18%, var(--aimd-bg-primary));
}

.mock-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 16%, transparent);
  backdrop-filter: blur(3px);
}

.mock-bookmarks-window {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(920px, 100%);
  height: 560px;
  max-height: calc(100% - var(--aimd-space-4));
  min-height: 500px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.mock-panel-header,
.mock-dialog-header,
.mock-send-head,
.mock-send-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-width: 0;
  min-height: 54px;
  padding: 0 var(--aimd-space-4);
  border-bottom: 1px solid var(--aimd-border-default);
}

.mock-bookmarks-shell {
  display: grid;
  grid-template-columns: 152px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.mock-bookmarks-sidebar {
  display: grid;
  align-content: start;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-3);
  border-right: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 70%, var(--aimd-bg-surface));
}

.mock-bookmarks-tab {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 36px;
  padding: 0 var(--aimd-space-3);
  border: 0;
  border-radius: var(--aimd-radius-lg);
  background: transparent;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.mock-bookmarks-tab[data-active="true"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.mock-bookmarks-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--aimd-bg-surface);
}

.mock-bookmarks-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto;
  gap: var(--aimd-space-2);
  align-items: center;
  min-width: 0;
  padding: var(--aimd-space-3);
  border-bottom: 1px solid var(--aimd-border-default);
}

.mock-search-field,
.mock-text-input,
.mock-send-input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
}

.mock-search-field {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 36px;
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
}

.mock-platform-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 36px;
  padding: 0 var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  white-space: nowrap;
}

.mock-toolbar-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.mock-bookmarks-content {
  display: grid;
  grid-template-columns: minmax(178px, 0.92fr) minmax(180px, 1fr);
  gap: var(--aimd-space-3);
  min-width: 0;
  min-height: 0;
  padding: var(--aimd-space-3);
}

.mock-bookmarks-content--tree {
  grid-template-columns: 1fr;
  padding: 0;
}

.mock-tree-panel,
.mock-bookmark-list,
.mock-settings-list {
  display: grid;
  align-content: start;
  gap: var(--aimd-space-2);
  min-width: 0;
  min-height: 0;
  padding: var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-primary);
}

.mock-bookmarks-tree {
  display: grid;
  align-content: start;
  min-height: 0;
  padding: var(--aimd-space-4) var(--aimd-space-4) 96px;
  overflow: auto;
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.mock-tree-node {
  display: grid;
}

.mock-tree-children {
  display: grid;
}

.mock-tree-item,
.mock-bookmark-item,
.mock-setting-card,
.mock-picker-row,
.mock-message-chip,
.mock-progress-panel,
.mock-confirm-small,
.mock-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-width: 0;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
}

.mock-tree-row {
  position: relative;
  display: grid;
  grid-template-columns: 20px 18px 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 46px;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  padding-right: 110px;
  border-radius: var(--aimd-radius-lg);
  background: transparent;
}

.mock-tree-row:hover,
.mock-tree-row[data-selected="true"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
}

.mock-tree-row[data-kind="bookmark"] {
  min-height: 56px;
}

.mock-tree-caret,
.mock-tree-icon,
.mock-tree-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mock-tree-caret {
  width: 20px;
  height: 20px;
  color: var(--aimd-text-secondary);
}

.mock-tree-row .mock-check {
  justify-self: center;
}

.mock-tree-icon {
  width: 20px;
  height: 20px;
  color: var(--aimd-text-secondary);
}

.mock-tree-label-stack {
  display: grid;
  min-width: 0;
}

.mock-tree-label-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--aimd-space-3);
  align-items: baseline;
  min-width: 0;
}

.mock-tree-count,
.mock-tree-subtitle {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  white-space: nowrap;
}

.mock-tree-actions {
  position: absolute;
  top: 50%;
  right: var(--aimd-space-2);
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(6px);
}

.mock-tree-row:hover .mock-tree-actions,
.mock-tree-row[data-selected="true"] .mock-tree-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0);
}

.mock-tree-row:hover .mock-tree-count,
.mock-tree-row[data-selected="true"] .mock-tree-count,
.mock-tree-row:hover .mock-tree-subtitle,
.mock-tree-row[data-selected="true"] .mock-tree-subtitle {
  opacity: 0;
}

.mock-tree-item,
.mock-bookmark-item,
.mock-setting-card,
.mock-picker-row {
  min-height: 42px;
  padding: 0 var(--aimd-space-3);
}

.mock-tree-item[data-active="true"],
.mock-bookmark-item[data-active="true"],
.mock-message-chip[data-active="true"] {
  border-color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-selected);
}

.mock-tree-main,
.mock-bookmark-main,
.mock-setting-main,
.mock-dialog-title-group {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mock-tree-title,
.mock-bookmark-title,
.mock-setting-title {
  overflow: hidden;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-setting-title {
  white-space: normal;
}

.mock-bookmark-title {
  white-space: normal;
}

.mock-settings-list .mock-setting-card {
  align-items: flex-start;
  min-height: auto;
  padding: var(--aimd-space-3);
}

.mock-settings-scroll {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 20px;
  background: var(--aimd-bg-surface);
}

.mock-settings-content {
  display: grid;
  gap: 16px;
  width: min(760px, 100%);
  margin: 0 auto;
}

.mock-settings-card {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
}

.mock-settings-card-title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.mock-settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 46%, transparent);
}

.mock-settings-card-title + .mock-settings-row {
  border-top: 0;
}

.mock-settings-label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.mock-settings-label strong {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-settings-label p {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-xs);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.mock-toggle-switch {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  width: 48px;
  min-width: 48px;
  height: 28px;
  flex: 0 0 48px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 76%, var(--aimd-text-on-primary) 16%);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-interactive-primary-hover) 82%, var(--aimd-text-on-primary) 18%);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--aimd-interactive-primary) 26%, transparent);
}

.mock-toggle-switch[data-checked="false"] {
  border-color: color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-border-default) 90%, transparent);
  box-shadow: var(--aimd-shadow-xs);
}

.mock-toggle-knob {
  width: 22px;
  height: 22px;
  margin-left: auto;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-sm);
}

.mock-toggle-switch[data-checked="false"] .mock-toggle-knob {
  margin-left: 0;
}

.mock-inline-select,
.mock-number-field {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  justify-self: end;
  min-height: 44px;
  min-width: 148px;
  padding: 0 var(--aimd-space-3);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  white-space: nowrap;
  box-shadow: var(--aimd-shadow-xs);
}

.mock-number-field {
  min-width: 88px;
  font-variant-numeric: tabular-nums;
}

.mock-settings-control-pair {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  justify-self: end;
}

.mock-settings-notice {
  margin: 8px 0 0;
  padding: 10px var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 54%, transparent);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.6;
}

.mock-storage-info {
  display: grid;
  gap: 10px;
}

.mock-storage-header,
.mock-backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.mock-storage-track {
  height: 8px;
  overflow: hidden;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 40%, transparent);
}

.mock-storage-fill {
  display: block;
  width: 32%;
  height: 100%;
  background: var(--aimd-interactive-primary);
}

.mock-backup-row {
  align-items: flex-start;
  padding-top: var(--aimd-space-4);
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 46%, transparent);
}

.mock-advanced-toggle {
  display: grid;
  gap: var(--aimd-space-1);
  width: 100%;
  padding: var(--aimd-space-4);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 74%, var(--aimd-bg-surface));
  color: var(--aimd-text-primary);
}

.mock-advanced-toggle strong {
  font-size: var(--aimd-text-sm);
  line-height: 1.35;
}

.mock-advanced-toggle span {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
}

.mock-check {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-sm);
  color: var(--aimd-text-on-primary);
}

.mock-check[data-active="true"] {
  border-color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-primary);
}

.mock-dialog-stage,
.mock-send-stage,
.mock-toolbar-progress-stage {
  position: relative;
  display: grid;
  gap: var(--aimd-space-4);
  min-height: 620px;
  overflow: hidden;
  padding: var(--aimd-space-5);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-primary);
}

.mock-dialog-pair,
.mock-send-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--aimd-space-4);
  align-items: start;
}

.mock-dialog-window,
.mock-send-modal-window {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(660px, 100%);
  max-height: 560px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.mock-dialog-window[data-size="compact"] {
  width: min(600px, 100%);
}

.mock-dialog-body,
.mock-send-modal-body {
  display: grid;
  gap: var(--aimd-space-4);
  min-width: 0;
  overflow: auto;
  padding: var(--aimd-space-4);
}

.mock-dialog-footer,
.mock-send-foot,
.mock-send-modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: 56px;
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-top: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
}

.mock-button-row,
.mock-format-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  min-width: 0;
}

.mock-field-block {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
}

.mock-text-input,
.mock-send-input {
  min-height: 38px;
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  font-size: var(--aimd-text-sm);
}

.mock-picker-tree,
.mock-message-grid {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
}

.mock-picker-row[data-depth="1"] {
  margin-left: var(--aimd-space-5);
}

.mock-message-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mock-message-chip {
  justify-content: flex-start;
  min-height: 44px;
  padding: 0 var(--aimd-space-3);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
}

.mock-segmented {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-primary);
}

.mock-segmented .toolbar-btn {
  border-radius: var(--aimd-radius-full);
}

.mock-progress-panel {
  display: grid;
  align-items: stretch;
  padding: var(--aimd-space-3);
}

.mock-progress-track,
.mock-task-progress__track {
  height: 6px;
  overflow: hidden;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
}

.mock-progress-fill,
.mock-task-progress__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--aimd-interactive-primary);
}

.mock-send-anchor {
  position: relative;
  min-height: 390px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-secondary) 62%, transparent), transparent 46%),
    var(--aimd-bg-surface);
}

.mock-send-toolbar {
  position: absolute;
  right: var(--aimd-space-4);
  bottom: var(--aimd-space-4);
}

.mock-send-popover {
  position: absolute;
  right: var(--aimd-space-4);
  bottom: calc(var(--aimd-space-4) + 48px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(360px, calc(100% - var(--aimd-space-8)));
  height: 284px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-lg);
}

.mock-send-popover::after {
  content: "";
  position: absolute;
  right: 24px;
  bottom: -7px;
  width: 12px;
  height: 12px;
  border-right: 1px solid var(--aimd-border-default);
  border-bottom: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  transform: rotate(45deg);
}

.mock-send-resize {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: var(--aimd-text-secondary);
}

.mock-send-resize::before {
  content: "";
  width: 14px;
  height: 14px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  border-radius: 2px;
  opacity: 0.6;
}

.mock-send-input {
  min-height: 142px;
  resize: none;
  padding-block: var(--aimd-space-3);
}

.mock-send-modal-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 390px;
  overflow: hidden;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-overlay-bg) 18%, var(--aimd-bg-primary));
}

.mock-send-modal-window {
  width: min(520px, calc(100% - var(--aimd-space-6)));
}

.mock-toolbar-progress-stage {
  align-content: center;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent), transparent 48%),
    var(--aimd-bg-primary);
}

.mock-progress-toolbar-wrap {
  position: relative;
  display: grid;
  justify-self: center;
  gap: var(--aimd-space-3);
  width: min(520px, 100%);
}

.mock-progress-toolbar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  justify-self: end;
  padding: 4px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 12px;
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-sm);
}

.mock-task-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + var(--aimd-space-2));
  display: grid;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-md);
}

.mock-task-progress__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--aimd-space-3);
  align-items: center;
}

.mock-task-progress__label {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-semibold);
}

.mock-confirm-small,
.mock-toast {
  padding: var(--aimd-space-3);
}

.mock-transient-stack {
  display: grid;
  gap: var(--aimd-space-3);
  justify-self: center;
  width: min(520px, 100%);
}

@media (max-width: 1180px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  :host {
    --page-gap: var(--aimd-space-4);
  }

  .suite-header,
  .page-frame__header,
  .host-layout,
  .split,
  .panel-shell,
  .mock-bookmarks-shell,
  .mock-bookmarks-content,
  .mock-dialog-pair,
  .mock-send-pair,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .suite-header,
  .page-frame__header {
    display: grid;
  }

  .rail {
    grid-auto-flow: column;
    justify-content: start;
    width: fit-content;
  }

  .panel-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--aimd-border-default);
  }

  .mock-overlay-stage,
  .mock-dialog-stage,
  .mock-send-stage,
  .mock-toolbar-progress-stage {
    min-height: 640px;
    padding: var(--aimd-space-3);
  }

  .mock-bookmarks-window {
    height: auto;
    min-height: 580px;
  }

  .mock-bookmarks-sidebar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: 0;
    border-bottom: 1px solid var(--aimd-border-default);
  }

  .mock-bookmarks-toolbar {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: center;
  }

  .mock-toolbar-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .mock-platform-trigger {
    max-width: 136px;
    padding-inline: var(--aimd-space-3);
  }

  .mock-tree-row {
    grid-template-columns: 20px 18px 20px minmax(0, 1fr);
    padding-right: var(--aimd-space-2);
  }

  .mock-tree-actions {
    display: none;
  }

  .mock-settings-scroll {
    padding: 10px;
  }

  .mock-settings-card {
    gap: 12px;
    padding: 14px;
  }

  .mock-settings-row {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: center;
    gap: var(--aimd-space-2);
    padding: 9px 0;
  }

  .mock-backup-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .mock-settings-label p {
    line-height: 1.45;
  }

  .mock-inline-select {
    min-width: 116px;
    min-height: 38px;
    padding-inline: var(--aimd-space-3);
  }

  .mock-number-field {
    min-width: 72px;
    min-height: 38px;
  }

  .mock-settings-control-pair {
    grid-column: 1 / -1;
    justify-content: flex-start;
    justify-self: stretch;
    padding-top: var(--aimd-space-1);
  }

  .mock-settings-control-pair .mock-inline-select {
    min-width: 128px;
  }

  .mock-toggle-switch,
  .mock-settings-row > .icon-btn,
  .mock-inline-select,
  .mock-number-field {
    justify-self: end;
  }

  .mock-message-grid {
    grid-template-columns: 1fr;
  }

  .mock-dialog-footer,
  .mock-send-foot,
  .mock-send-modal-foot {
    display: grid;
  }

  .mock-confirm-small,
  .mock-toast {
    display: grid;
    align-items: start;
  }

  .unsupported-popup-stage {
    min-height: auto;
    padding: var(--aimd-space-3);
  }

  .unsupported-popup {
    width: 100%;
    padding: var(--aimd-space-4);
  }

  .chatgpt-snapshot {
    grid-template-columns: 1fr;
    min-height: 640px;
  }

  .chatgpt-sidebar {
    display: none;
  }

  .chatgpt-thread {
    padding: var(--aimd-space-4);
  }

  .chatgpt-action-row {
    align-items: flex-start;
  }

  .chatgpt-official-actions {
    display: none;
  }

  .aimd-injected-toolbar {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .directory-rail-preview {
    display: none;
  }

  .directory-step-preview {
    right: var(--aimd-space-4);
    bottom: var(--aimd-space-4);
    flex-direction: row;
  }

  .reader-modal-stage {
    min-height: 680px;
  }

  .reader-modal-ghost {
    display: none;
  }

  .reader-panel-window {
    width: calc(100% - var(--aimd-space-4));
    height: calc(100% - var(--aimd-space-4));
    border-radius: var(--aimd-radius-xl);
  }

  .reader-panel-header {
    align-items: flex-start;
    padding: var(--aimd-space-3);
  }

  .reader-panel-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .reader-panel-body {
    padding: var(--aimd-space-4);
  }

  .reader-message-block {
    padding: var(--aimd-space-4);
  }

  .reader-panel-footer {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: var(--aimd-space-3);
  }

  .reader-panel-footer-left,
  .reader-panel-footer-meta {
    justify-content: center;
  }
}
`;
}

function wrapFrame(spec: PageSpec): string {
    return `
<article class="page-frame" data-page-id="${spec.id}" data-page-group="${spec.group}">
  <header class="page-frame__header">
    <div class="page-frame__copy">
      <span class="frame-kicker">${spec.group}</span>
      <h3 class="frame-title">${spec.title}</h3>
      <span class="microcopy">${spec.description}</span>
    </div>
  </header>
  <div class="page-frame__body">${spec.html}</div>
</article>`;
}

function popupPage(): PageSpec {
    return {
        id: 'popup',
        group: 'extension page',
        title: 'Popup unsupported page',
        description: 'Browser action popup with supported platform shortcuts.',
        html: `
<div class="unsupported-popup-stage">
  <div class="unsupported-popup">
    <section class="unsupported-popup__header">
      <div class="unsupported-popup__note">Unsupported page</div>
      <div class="unsupported-popup__brand">
        <img class="unsupported-popup__logo" src="/icons/icon48.png" alt="AI-MarkDone logo" />
        <h4 class="unsupported-popup__title">AI-MarkDone</h4>
      </div>
    </section>
    <section class="unsupported-popup__links">
      <div class="unsupported-popup__link"><span class="unsupported-popup__link-meta"><span class="unsupported-popup__link-label">ChatGPT</span><span class="unsupported-popup__link-hint">Primary supported site</span></span><span class="unsupported-popup__arrow">→</span></div>
      <div class="unsupported-popup__link"><span class="unsupported-popup__link-meta"><span class="unsupported-popup__link-label">Gemini</span><span class="unsupported-popup__link-hint">Google AI conversations</span></span><span class="unsupported-popup__arrow">→</span></div>
      <div class="unsupported-popup__link"><span class="unsupported-popup__link-meta"><span class="unsupported-popup__link-label">Claude</span><span class="unsupported-popup__link-hint">Anthropic chat workspace</span></span><span class="unsupported-popup__arrow">→</span></div>
      <div class="unsupported-popup__link"><span class="unsupported-popup__link-meta"><span class="unsupported-popup__link-label">DeepSeek</span><span class="unsupported-popup__link-hint">DeepSeek chat surface</span></span><span class="unsupported-popup__arrow">→</span></div>
    </section>
    <p class="unsupported-popup__footer">The toolbar icon becomes active when the current tab matches one of the supported hosts above.</p>
  </div>
</div>`,
    };
}

function hostRuntimePage(): PageSpec {
    return {
        id: 'host-runtime',
        group: 'content runtime',
        title: 'Host page with toolbar and directory rail',
        description: 'Conversation page shell with injected message toolbar and navigation rail.',
        html: `
<div class="chatgpt-snapshot">
  <aside class="chatgpt-sidebar">
    <h4 class="chatgpt-brand">ChatGPT</h4>
    <div class="chatgpt-nav-row">新聊天</div>
    <div class="chatgpt-nav-row">搜索聊天</div>
    <div class="chatgpt-nav-row">iOS开发</div>
    <div class="chatgpt-nav-row">Holographic MIMO</div>
    <div class="chatgpt-nav-row">LLM学习</div>
    <div class="chatgpt-nav-row" data-active="true">插件审核拒绝原因</div>
  </aside>
  <main class="chatgpt-main">
    <header class="chatgpt-top-actions">
      <button class="icon-btn">${icon(Icons.bookmarkCheck)}</button>
      <button class="btn">分享</button>
      <button class="icon-btn">${icon(Icons.moreHorizontal)}</button>
    </header>
    <section class="chatgpt-thread">
      <article class="chatgpt-answer">
        <h4>九、你现在应该怎么回复审核员</h4>
        <p>如果你准备不上中国区：</p>
        <ol>
          <li>下架中国区</li>
          <li>删除 donation 外链</li>
          <li>回复审核员：</li>
        </ol>
        <div class="chatgpt-code-card">
          <p>Hello App Review Team,</p>
          <p>Thank you for the review and detailed feedback.</p>
          <p>We have updated the app availability settings and removed China mainland distribution from App Store Connect.</p>
        </div>
        <p>这样通常就能过。</p>
        <div class="chatgpt-action-row">
          <div class="chatgpt-official-actions">
            <button class="icon-btn">${icon(Icons.copy)}</button>
            <button class="icon-btn">${icon(Icons.share)}</button>
            <button class="icon-btn">${icon(Icons.refreshCw)}</button>
            <button class="icon-btn">${icon(Icons.moreHorizontal)}</button>
          </div>
          <div class="aimd-injected-toolbar">
            <button class="aimd-toolbar-button" data-active="true" aria-label="书签">${icon(Icons.bookmark)}</button>
            <button class="aimd-toolbar-button" aria-label="复制 Markdown">${icon(Icons.copy)}</button>
            <button class="aimd-toolbar-button" aria-label="阅读器">${icon(Icons.bookOpen)}</button>
            <button class="aimd-toolbar-button" aria-label="导出">${icon(Icons.fileText)}</button>
            <span class="aimd-toolbar-stats"><span>1276 Words</span><span>3578 Chars</span></span>
          </div>
        </div>
      </article>
    </section>
    <aside class="directory-rail-preview" aria-label="Directory rail">
      <span class="directory-mark" data-active="true"></span>
    </aside>
    <div class="directory-step-preview" aria-label="Step controls">
      <button class="icon-btn" disabled>${icon(Icons.chevronUp)}</button>
      <button class="icon-btn" disabled>${icon(Icons.chevronDown)}</button>
    </div>
  </main>
</div>`,
    };
}

function readerPage(): PageSpec {
    return {
        id: 'reader',
        group: 'reader panel',
        title: 'Reader panel',
        description: 'Long-form reading surface with toolbar, content, code, and source comments.',
        html: `
<div class="reader-modal-stage">
  <div class="reader-modal-backdrop"></div>
  <div class="reader-modal-ghost">
    <div class="reader-modal-ghost__sidebar"></div>
    <div class="reader-modal-ghost__content"></div>
  </div>
  <section class="reader-panel-window" role="dialog" aria-label="阅读器">
    <header class="reader-panel-header">
      <div class="reader-panel-title-row">
        <h4 class="panel-title">阅读器</h4>
        <span class="meta">1/1</span>
      </div>
      <div class="reader-panel-actions">
        <button class="icon-btn">${icon(Icons.bookmark)}</button>
        <button class="icon-btn" disabled>${icon(Icons.messageSquareShare)}</button>
        <button class="icon-btn">${icon(Icons.copy)}</button>
        <button class="icon-btn">${icon(Icons.maximize)}</button>
        <button class="icon-btn">${icon(Icons.x)}</button>
      </div>
    </header>
    <div class="reader-panel-body">
      <article class="reader-thread">
        <section class="reader-message-block">
          <div class="reader-message-label">USER MESSAGE</div>
          <p class="reader-message-text">我现在准备上架一个插件在Safari上，现在审核员给了我回复，你解释一下下面审核员的回复。并且说明一下这个插件是因为什么原因而被拒绝。
Hello,

We noticed this is your first app submission and want to congratulate you on joining the Apple Developer Program. We look f</p>
          <div class="reader-ellipsis-line">...</div>
          <p class="reader-message-text">eview Notes to confirm you've suppressed this functionality, and resubmit the app for review.</p>
          <div class="reader-ellipsis-line">...</div>
          <p class="reader-message-text">- Consult with fellow developers and Apple engineers on the Apple Developer Forums.
- Provide feedback on this message and your review experience by completing a short survey.</p>
        </section>
        <section class="reader-message-block" data-kind="assistant">
          <div class="reader-message-label">AI RESPONSE</div>
          <p class="reader-message-text">你的这个 Safari 插件被拒，实际是因为两个独立的问题。分别对应 Apple 审核指南中的外部支付/捐赠入口，以及中国大陆区分发合规。</p>
        </section>
      </article>
    </div>
    <footer class="reader-panel-footer">
      <div class="reader-panel-footer-left">
        <button class="icon-btn">${icon(Icons.send)}</button>
        <button class="icon-btn">${icon(Icons.locate)}</button>
      </div>
      <div class="reader-panel-footer-center">
        <button class="icon-btn" disabled>${icon(Icons.chevronRight)}</button>
        <span class="reader-dot-strip"><span class="reader-dot"></span></span>
        <button class="icon-btn" disabled>${icon(Icons.chevronRight)}</button>
      </div>
      <div class="reader-panel-footer-meta">1/1</div>
    </footer>
  </section>
</div>`,
    };
}

function bookmarksPage(): PageSpec {
    return {
        id: 'bookmarks-manager',
        group: 'bookmarks panel',
        title: 'Bookmarks manager',
        description: 'Primary saved-conversation manager with tabs, tree, list, and settings/info entry points.',
        html: `
<div class="mock-overlay-stage">
  <div class="mock-overlay-backdrop"></div>
  <section class="mock-bookmarks-window" role="dialog" aria-label="Bookmarks">
    <header class="mock-panel-header">
      <div class="mock-dialog-title-group">
        <h4 class="panel-title">Bookmarks</h4>
        <span class="meta">Search, organize, export, and review saved conversations</span>
      </div>
      <button class="icon-btn" aria-label="Close">${icon(Icons.x)}</button>
    </header>
    <div class="mock-bookmarks-shell">
      <nav class="mock-bookmarks-sidebar" aria-label="Bookmarks tabs">
        <button class="mock-bookmarks-tab" data-active="true">${icon(Icons.bookmark)} Bookmarks</button>
        <button class="mock-bookmarks-tab">${icon(Icons.settings)} Settings</button>
        <button class="mock-bookmarks-tab">${icon(Icons.fileText)} Changelog</button>
        <button class="mock-bookmarks-tab">${icon(Icons.info)} About</button>
        <button class="mock-bookmarks-tab">${icon(Icons.messageSquareText)} FAQ</button>
        <button class="mock-bookmarks-tab">${icon(Icons.coffee)} Support</button>
      </nav>
      <section class="mock-bookmarks-body">
        <div class="mock-bookmarks-toolbar">
          <div class="mock-search-field">${icon(Icons.search)} <span>style system</span></div>
          <button class="mock-platform-trigger">All platforms ${icon(Icons.chevronDown)}</button>
          <div class="mock-toolbar-actions">
            <button class="icon-btn">${icon(Icons.sortTime)}</button>
            <button class="icon-btn">${icon(Icons.sortAZ)}</button>
            <button class="icon-btn">${icon(Icons.folderPlus)}</button>
            <button class="icon-btn">${icon(Icons.upload)}</button>
            <button class="icon-btn">${icon(Icons.download)}</button>
          </div>
        </div>
        <div class="mock-bookmarks-content mock-bookmarks-content--tree">
          <section class="mock-bookmarks-tree" role="tree" aria-label="Bookmarks tree">
            <div class="mock-tree-node">
              <div class="mock-tree-row" data-kind="folder" data-selected="true" style="padding-left: 10px">
                <span class="mock-tree-caret">${icon(Icons.chevronDown)}</span>
                <span class="mock-check" data-active="true">${icon(Icons.check)}</span>
                <span class="mock-tree-icon">${icon(Icons.folderOpen)}</span>
                <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Product research</span><span class="mock-tree-count">12</span></span></span>
                <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.folderPlus)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
              </div>
              <div class="mock-tree-children">
                <div class="mock-tree-row" data-kind="folder" style="padding-left: 28px">
                  <span class="mock-tree-caret">${icon(Icons.chevronDown)}</span>
                  <span class="mock-check"></span>
                  <span class="mock-tree-icon">${icon(Icons.folderOpen)}</span>
                  <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Style system</span><span class="mock-tree-count">8</span></span></span>
                  <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.folderPlus)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
                </div>
                <div class="mock-tree-row" data-kind="bookmark" data-selected="true" style="padding-left: 46px">
                  <span class="mock-tree-caret"></span>
                  <span class="mock-check" data-active="true">${icon(Icons.check)}</span>
                  <span class="mock-tree-icon">${icon(Icons.chatgpt)}</span>
                  <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Design system baseline</span><span class="mock-tree-subtitle">Today</span></span></span>
                  <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.link)}</button><button class="icon-btn">${icon(Icons.copy)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
                </div>
                <div class="mock-tree-row" data-kind="bookmark" style="padding-left: 46px">
                  <span class="mock-tree-caret"></span>
                  <span class="mock-check"></span>
                  <span class="mock-tree-icon">${icon(Icons.claude)}</span>
                  <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Shadow DOM injection fallback</span><span class="mock-tree-subtitle">Yesterday</span></span></span>
                  <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.link)}</button><button class="icon-btn">${icon(Icons.copy)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
                </div>
                <div class="mock-tree-row" data-kind="folder" style="padding-left: 28px">
                  <span class="mock-tree-caret">${icon(Icons.chevronRight)}</span>
                  <span class="mock-check"></span>
                  <span class="mock-tree-icon">${icon(Icons.folder)}</span>
                  <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Release notes</span><span class="mock-tree-count">4</span></span></span>
                  <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.folderPlus)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
                </div>
              </div>
            </div>
            <div class="mock-tree-node">
              <div class="mock-tree-row" data-kind="folder" style="padding-left: 10px">
                <span class="mock-tree-caret">${icon(Icons.chevronDown)}</span>
                <span class="mock-check"></span>
                <span class="mock-tree-icon">${icon(Icons.folderOpen)}</span>
                <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Reader exports</span><span class="mock-tree-count">5</span></span></span>
                <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.folderPlus)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
              </div>
              <div class="mock-tree-children">
                <div class="mock-tree-row" data-kind="bookmark" style="padding-left: 28px">
                  <span class="mock-tree-caret"></span>
                  <span class="mock-check"></span>
                  <span class="mock-tree-icon">${icon(Icons.gemini)}</span>
                  <span class="mock-tree-label-stack"><span class="mock-tree-label-line"><span class="mock-tree-title">Reader width and export behavior</span><span class="mock-tree-subtitle">Apr 22</span></span></span>
                  <span class="mock-tree-actions"><button class="icon-btn">${icon(Icons.link)}</button><button class="icon-btn">${icon(Icons.copy)}</button><button class="icon-btn">${icon(Icons.edit)}</button><button class="icon-btn">${icon(Icons.move)}</button><button class="icon-btn">${icon(Icons.trash)}</button></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  </section>
</div>`,
    };
}

function settingsInfoPage(): PageSpec {
    return {
        id: 'settings-info',
        group: 'bookmarks tabs',
        title: 'Settings and information tabs',
        description: 'Settings, changelog, about, FAQ, and sponsor surfaces in one style sample.',
        html: `
<div class="mock-overlay-stage">
  <div class="mock-overlay-backdrop"></div>
  <section class="mock-bookmarks-window" role="dialog" aria-label="Extension preferences">
    <header class="mock-panel-header">
      <div class="mock-dialog-title-group">
        <h4 class="panel-title">Settings</h4>
        <span class="meta">Preferences and information pages stay inside the bookmarks panel shell</span>
      </div>
      <button class="icon-btn" aria-label="Close">${icon(Icons.x)}</button>
    </header>
    <div class="mock-bookmarks-shell">
      <nav class="mock-bookmarks-sidebar" aria-label="Bookmarks tabs">
        <button class="mock-bookmarks-tab">${icon(Icons.bookmark)} Bookmarks</button>
        <button class="mock-bookmarks-tab" data-active="true">${icon(Icons.settings)} Settings</button>
        <button class="mock-bookmarks-tab">${icon(Icons.fileText)} Changelog</button>
        <button class="mock-bookmarks-tab">${icon(Icons.info)} About</button>
        <button class="mock-bookmarks-tab">${icon(Icons.messageSquareText)} FAQ</button>
        <button class="mock-bookmarks-tab">${icon(Icons.coffee)} Support</button>
      </nav>
      <section class="mock-bookmarks-body">
        <div class="mock-settings-scroll">
          <div class="mock-settings-content">
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.globe)} Platforms</h4>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>${icon(Icons.chatgpt)} ChatGPT</strong><p>Enable AI-MarkDone on ChatGPT conversations.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>${icon(Icons.gemini)} Gemini</strong><p>Enable reader, bookmark, and export actions on Gemini.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>${icon(Icons.claude)} Claude</strong><p>Enable AI-MarkDone on Claude workspace pages.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <p class="mock-settings-notice">Some platform entries are kept for compatibility while the runtime adapter matrix evolves.</p>
            </section>
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.settings)} Toolbar & Page Actions</h4>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Save Messages</strong><p>Show the save/export messages action in the injected toolbar.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Word Count</strong><p>Show words and characters beside message actions.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Save context only</strong><p>Limit bookmark saves to the selected conversation context.</p></span><span class="mock-toggle-switch" data-checked="false"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Formula click copy</strong><p>Copy Markdown source when clicking rendered formulas.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Formula asset actions</strong><p>Copy PNG, Save PNG</p></span><button class="icon-btn">${icon(Icons.settings)}</button></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>PNG export width</strong><p>Choose the width used by Copy as PNG and batch PNG export.</p></span><span class="mock-settings-control-pair"><span class="mock-inline-select">Tablet ${icon(Icons.chevronDown)}</span><span class="mock-number-field">768</span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>PNG pixel ratio</strong><p>Scale exported images for sharper sharing assets.</p></span><span class="mock-number-field">2</span></div>
            </section>
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.bookOpen)} Reader</h4>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Render code blocks in Reader</strong><p>Use the shared Markdown theme for code blocks inside the Reader panel.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Prompt position</strong><p>Place dynamic annotation prompts at the bottom of the Reader.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Annotation prompts</strong><p>3 prompts configured</p></span><button class="icon-btn">${icon(Icons.settings)}</button></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Annotation template</strong><p>Default Markdown template</p></span><button class="icon-btn">${icon(Icons.settings)}</button></div>
            </section>
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.chatgpt)} ChatGPT Directory</h4>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Enable directory rail</strong><p>Show right-side directory marks for discovered user turns.</p></span><span class="mock-toggle-switch"><span class="mock-toggle-knob"></span></span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Directory mode</strong><p>Choose compact preview or expanded directory behavior.</p></span><span class="mock-inline-select">Preview ${icon(Icons.chevronDown)}</span></div>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Prompt labels</strong><p>Show head and tail text for longer prompt labels.</p></span><span class="mock-toggle-switch" data-checked="false"><span class="mock-toggle-knob"></span></span></div>
            </section>
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.languages)} Language</h4>
              <div class="mock-settings-row"><span class="mock-settings-label"><strong>Language</strong><p>Follow browser language or override extension UI language.</p></span><span class="mock-inline-select">Automatic ${icon(Icons.chevronDown)}</span></div>
            </section>
            <section class="mock-settings-card">
              <h4 class="mock-settings-card-title">${icon(Icons.database)} Data & Storage</h4>
              <div class="mock-storage-info">
                <div class="mock-storage-header"><span class="meta">Storage used</span><span class="meta">32%</span></div>
                <div class="mock-storage-track"><span class="mock-storage-fill"></span></div>
              </div>
              <div class="mock-backup-row"><span class="mock-settings-label"><strong>Backup before major changes</strong><p>Export all bookmarks before large cleanup or migration work.</p></span><button class="btn">${icon(Icons.download)} Export all</button></div>
            </section>
            <section class="mock-advanced-toggle">
              <strong>Advanced settings</strong>
              <span>Reader width and other low-frequency controls live behind this collapsed entry.</span>
            </section>
          </div>
        </div>
      </section>
    </div>
  </section>
</div>`,
    };
}

function saveDialogPage(): PageSpec {
    return {
        id: 'save-dialogs',
        group: 'dialogs',
        title: 'Bookmark save and message export dialogs',
        description: 'Two main save workflows shown together for alignment.',
        html: `
<div class="mock-dialog-stage">
  <div class="mock-dialog-pair">
    <section class="mock-dialog-window" role="dialog" aria-label="Save bookmark">
      <header class="mock-dialog-header">
        <h4 class="dialog-title">Save Bookmark</h4>
        <button class="icon-btn" aria-label="Close">${icon(Icons.x)}</button>
      </header>
      <div class="mock-dialog-body">
        <label class="mock-field-block"><span class="field-label">Title</span><input class="mock-text-input" value="Design system baseline" /></label>
        <section class="mock-field-block">
          <div class="row"><span class="field-label">Folder</span><button class="icon-btn">${icon(Icons.folderPlus)}</button></div>
          <div class="mock-picker-tree">
            <div class="mock-picker-row" data-active="true">${icon(Icons.chevronDown)}<span class="mock-tree-main"><span class="mock-tree-title">Product research</span><span class="meta">12 saved turns</span></span><span class="mock-check" data-active="true">${icon(Icons.check)}</span></div>
            <div class="mock-picker-row" data-depth="1">${icon(Icons.folderOpen)}<span class="mock-tree-main"><span class="mock-tree-title">Style system</span><span class="meta">8 saved turns</span></span><button class="icon-btn">${icon(Icons.folderPlus)}</button></div>
            <div class="mock-picker-row">${icon(Icons.chevronRight)}<span class="mock-tree-main"><span class="mock-tree-title">Release notes</span><span class="meta">4 saved turns</span></span><button class="icon-btn">${icon(Icons.moreHorizontal)}</button></div>
          </div>
        </section>
      </div>
      <footer class="mock-dialog-footer">
        <span class="meta">Current folder: Product research</span>
        <span class="mock-button-row"><button class="btn">Cancel</button><button class="btn-primary">Save</button></span>
      </footer>
    </section>
    <section class="mock-dialog-window" data-size="compact" role="dialog" aria-label="Save messages">
      <header class="mock-dialog-header">
        <h4 class="dialog-title">Save Messages</h4>
        <button class="icon-btn" aria-label="Close">${icon(Icons.x)}</button>
      </header>
      <div class="mock-dialog-body">
        <section class="mock-field-block">
          <span class="field-label">Select messages</span>
          <div class="mock-message-grid">
            <button class="mock-message-chip" data-active="true"><span class="mock-check" data-active="true">${icon(Icons.check)}</span>User prompt</button>
            <button class="mock-message-chip" data-active="true"><span class="mock-check" data-active="true">${icon(Icons.check)}</span>AI response</button>
            <button class="mock-message-chip"><span class="mock-check"></span>Follow-up</button>
            <button class="mock-message-chip"><span class="mock-check"></span>Code sample</button>
          </div>
        </section>
        <section class="mock-field-block">
          <span class="field-label">Format</span>
          <div class="mock-segmented">
            <button class="toolbar-btn" data-active="true">${icon(Icons.fileText)} Markdown</button>
            <button class="toolbar-btn">${icon(Icons.fileText)} PDF</button>
            <button class="toolbar-btn">${icon(Icons.image)} PNG</button>
          </div>
        </section>
        <div class="mock-progress-panel">
          <span class="mock-tree-title">Preparing export preview</span>
          <span class="meta">2 of 4 messages selected</span>
          <div class="mock-progress-track"><span class="mock-progress-fill" style="width: 42%"></span></div>
        </div>
      </div>
      <footer class="mock-dialog-footer">
        <span class="mock-button-row"><button class="btn">Select all</button><button class="btn">Deselect all</button></span>
        <span class="mock-button-row"><span class="meta">2 selected</span><button class="btn">Cancel</button><button class="btn-primary">Save</button></span>
      </footer>
    </section>
  </div>
</div>`,
    };
}

function sendSurfacesPage(): PageSpec {
    return {
        id: 'send-surfaces',
        group: 'send workflow',
        title: 'Send popover and modal',
        description: 'Prompt composition surfaces with pending sync state and action density.',
        html: `
<div class="mock-send-stage">
  <div class="mock-send-pair">
    <section class="mock-send-anchor" aria-label="Anchored send popover example">
      <div class="mock-send-popover">
        <header class="mock-send-head">
          <h4 class="dialog-title">Send to ChatGPT</h4>
          <span class="mock-button-row"><button class="icon-btn">${icon(Icons.messageSquarePlus)}</button><span class="mock-send-resize"></span><button class="icon-btn">${icon(Icons.x)}</button></span>
        </header>
        <div class="mock-dialog-body">
          <textarea class="mock-send-input">Continue from the selected reader section and summarize the migration risk in three bullets.</textarea>
        </div>
        <footer class="mock-send-foot">
          <span class="meta">Ready to insert into composer</span>
          <span class="mock-button-row"><button class="btn">Insert</button><button class="btn-primary">${icon(Icons.send)} Send</button></span>
        </footer>
      </div>
      <div class="mock-send-toolbar">
        <div class="aimd-injected-toolbar">
          <button class="aimd-toolbar-button">${icon(Icons.bookOpen)}</button>
          <button class="aimd-toolbar-button" data-active="true">${icon(Icons.send)}</button>
        </div>
      </div>
    </section>
    <section class="mock-send-modal-stage" aria-label="Send modal example">
      <article class="mock-send-modal-window" role="dialog" aria-label="Send prompt modal">
        <header class="mock-send-modal-head">
          <h4 class="dialog-title">Send to ChatGPT</h4>
          <button class="icon-btn">${icon(Icons.x)}</button>
        </header>
        <div class="mock-send-modal-body">
          <textarea class="mock-send-input">Summarize the design-system migration risks and propose a staged rollout that keeps Shadow DOM injection stable.</textarea>
        </div>
        <footer class="mock-send-modal-foot">
          <span class="meta">Composer sync pending</span>
          <span class="mock-button-row"><button class="btn">Cancel</button><button class="btn-primary">${icon(Icons.send)} Send</button></span>
        </footer>
      </article>
    </section>
  </div>
</div>`,
    };
}

function progressPage(): PageSpec {
    return {
        id: 'progress-transient',
        group: 'transient surfaces',
        title: 'Progress, popover, and modal states',
        description: 'Task progress, hover popovers, alerts, confirmations, and destructive states.',
        html: `
<div class="mock-toolbar-progress-stage">
  <div class="mock-progress-toolbar-wrap">
    <section class="mock-task-progress" aria-label="Export progress">
      <div class="mock-task-progress__body">
        <span class="mock-task-progress__label">Exporting selected messages</span>
        <button class="btn">Cancel</button>
      </div>
      <div class="mock-task-progress__track"><span class="mock-task-progress__fill" style="width: 68%"></span></div>
      <span class="meta">Rendering PNG assets · 68%</span>
    </section>
    <div class="mock-progress-toolbar">
      <button class="aimd-toolbar-button">${icon(Icons.bookmark)}</button>
      <button class="aimd-toolbar-button">${icon(Icons.copy)}</button>
      <button class="aimd-toolbar-button">${icon(Icons.bookOpen)}</button>
      <button class="aimd-toolbar-button" data-active="true">${icon(Icons.image)}</button>
      <span class="aimd-toolbar-stats"><span>1276 Words</span><span>3578 Chars</span></span>
    </div>
  </div>
  <div class="mock-transient-stack">
    <article class="mock-confirm-small">
      <span class="mock-setting-main"><span class="mock-setting-title">Delete selected bookmarks?</span><span class="meta">Confirmation stays compact and focused on the destructive choice.</span></span>
      <span class="mock-button-row"><button class="btn">Cancel</button><button class="btn-danger">Delete</button></span>
    </article>
    <article class="mock-toast">
      <span class="mock-setting-main"><span class="mock-setting-title">Formula asset copied</span><span class="meta">Small transient feedback, not a full task panel.</span></span>
      ${icon(Icons.copy)}
    </article>
  </div>
</div>`,
    };
}

function getPageSpecs(): PageSpec[] {
    return [
        popupPage(),
        hostRuntimePage(),
        readerPage(),
        bookmarksPage(),
        settingsInfoPage(),
        saveDialogPage(),
        sendSurfacesPage(),
        progressPage(),
    ];
}

function renderSuite(theme: Theme): string {
    const pages = getPageSpecs();
    return `
<article class="page-system" data-theme="${theme}">
  <header class="suite-header">
    <div class="suite-copy">
      <span class="suite-kicker">AI-MarkDone page system</span>
      <h2 class="suite-title">${theme === 'dark' ? 'Dark' : 'Light'} page-level baseline</h2>
      <p class="suite-description">All major extension pages and runtime surfaces are represented as static examples before production style refactoring starts.</p>
    </div>
    <span class="theme-pill">${icon(Icons.eye)} ${theme}</span>
  </header>
  <section class="page-grid">
    ${pages.map(wrapFrame).join('')}
  </section>
</article>`;
}

export function mountPageSystemShowcase(root: HTMLElement, theme: Theme = 'light'): void {
    root.replaceChildren();
    const host = document.createElement('div');
    host.className = 'aimd-page-system-showcase-host';
    host.setAttribute('data-aimd-theme', theme);
    const shadow = host.attachShadow({ mode: 'open' });
    ensureStyle(shadow, getTokenCss(theme), { id: `aimd-page-system-tokens-${theme}` });
    ensureStyle(shadow, getPageSystemCss(), { id: 'aimd-page-system-showcase-base', cache: 'shared' });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSuite(theme);
    shadow.append(...Array.from(wrapper.childNodes));
    root.appendChild(host);
}

const stage = document.getElementById('page-system-stage');
if (stage) {
    mountPageSystemShowcase(stage);
}
