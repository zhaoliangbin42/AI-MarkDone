import { getInputFieldCss } from '../../../components/styles/inputFieldCss';
import { getPanelChromeCss } from '../../../components/styles/panelChromeCss';

export function getBookmarksPanelCss(): string {
    return `
:host {
  font-family: var(--aimd-font-family-sans);
  --_bookmarks-panel-edge-offset: var(--aimd-space-6);
  --_bookmarks-panel-edge-offset-mobile: calc(var(--aimd-space-3) + var(--aimd-space-4));
  --_bookmarks-panel-shell-width: min(var(--aimd-panel-wide-max-width), 100%);
  --_bookmarks-panel-shell-width-clamped: min(var(--aimd-panel-wide-max-width), calc(100vw - var(--_bookmarks-panel-edge-offset)));
  --_bookmarks-panel-shell-height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset)));
  --_bookmarks-panel-shell-height-mobile: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset-mobile)));
  --_bookmarks-backdrop-bg: color-mix(in srgb, var(--aimd-bg-primary) 74%, transparent);
  --_bookmarks-shell-border: color-mix(in srgb, var(--aimd-border-strong) 78%, var(--aimd-bg-primary));
  --_bookmarks-shell-surface-top: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  --_bookmarks-shell-surface-bottom: color-mix(in srgb, var(--aimd-bg-secondary) 92%, transparent);
  --_bookmarks-sidebar-width: 220px;
  --_bookmarks-sidebar-gap: var(--aimd-space-2);
  --_bookmarks-sidebar-padding: var(--aimd-space-5);
  --_bookmarks-toolbar-gap: var(--aimd-space-3);
  --_bookmarks-toolbar-padding-inline: var(--aimd-space-5);
  --_bookmarks-toolbar-padding-top: calc(var(--aimd-space-4) + var(--aimd-space-1));
  --_bookmarks-toolbar-padding-bottom: var(--aimd-space-2);
  --_bookmarks-control-height: 44px;
  --_bookmarks-tree-actions-width: calc(var(--aimd-size-control-icon-panel) * 4 + (calc(var(--aimd-space-1) + var(--aimd-space-1) / 2) * 3) + (var(--aimd-space-2) * 2));
  --_bookmarks-control-surface: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  --_bookmarks-control-border: color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  --_bookmarks-control-inset-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-interactive-hover) 82%, transparent);
  --_bookmarks-control-inline-padding: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  --_bookmarks-card-radius: calc(var(--aimd-radius-2xl) + var(--aimd-space-1));
  --_bookmarks-card-radius-lg: calc(var(--aimd-radius-2xl) + var(--aimd-space-2) / 2);
  --_bookmarks-card-radius-xl: calc(var(--aimd-radius-2xl) + var(--aimd-space-3) / 2);
  --_bookmarks-batch-radius: calc(var(--aimd-radius-2xl) + var(--aimd-space-2) / 4);
  --_bookmarks-focus-ring-subtle: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
  --_bookmarks-focus-ring-strong: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 16%, transparent);
  --_bookmarks-inline-menu-z: var(--aimd-z-tooltip);
  --_bookmarks-tree-actions-z: calc(var(--aimd-z-base) + 1);
  --_bookmarks-batch-z: calc(var(--_bookmarks-tree-actions-z) + 1);
  --_bookmarks-celebration-z: calc(var(--aimd-z-base) + 3);
  --_bookmarks-mobile-tab-strip-gap: var(--aimd-space-1);
  --_bookmarks-mobile-tab-strip-padding: var(--aimd-space-1);
  --_bookmarks-mobile-tab-strip-surface: color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent);
}
* { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }
button { cursor: pointer; }
${getInputFieldCss()}
${getPanelChromeCss()}

/* Panel shell */
.aimd-scroll {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.aimd-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.aimd-icon svg {
  width: 16px;
  height: 16px;
  display: block;
}

.panel-stage__overlay,
.aimd-panel-overlay {
  position: fixed;
  inset: 0;
  background: var(--_bookmarks-backdrop-bg);
  backdrop-filter: var(--aimd-overlay-backdrop);
  -webkit-backdrop-filter: var(--aimd-overlay-backdrop);
  z-index: var(--aimd-z-base);
}

.panel-window,
.aimd-panel {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  z-index: var(--aimd-z-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--aimd-radius-2xl);
  color: var(--aimd-text-primary);
  overscroll-behavior: contain;
}

.panel-window {
  width: min(var(--aimd-panel-wide-max-width), 100%);
  max-height: 100%;
  background: linear-gradient(
    180deg,
    var(--_bookmarks-shell-surface-top),
    color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-panel);
}

.panel-window--bookmarks,
.aimd-panel {
  width: min(var(--aimd-panel-wide-max-width), calc(100vw - var(--_bookmarks-panel-edge-offset)));
  max-width: min(var(--aimd-panel-wide-max-width), calc(100vw - var(--_bookmarks-panel-edge-offset)));
  height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset)));
  max-height: calc(100vh - var(--_bookmarks-panel-edge-offset));
  border: 1px solid var(--_bookmarks-shell-border);
  background: linear-gradient(
    180deg,
    var(--_bookmarks-shell-surface-top),
    var(--_bookmarks-shell-surface-bottom)
  );
  box-shadow: var(--aimd-shadow-panel);
}

.aimd-panel-header,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-header-gap);
  min-height: var(--aimd-panel-header-height);
  padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);
  background: color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
}

.panel-header__meta,
.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-panel-action-gap);
  min-width: 0;
}

.panel-header__meta { flex: 1 1 auto; }

.aimd-panel-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-panel-title-size-compact);
  line-height: var(--aimd-panel-title-line-height);
  letter-spacing: -0.04em;
  font-weight: var(--aimd-panel-title-weight);
  color: var(--aimd-text-primary);
}

.icon-btn,
.tab-btn,
.tree-main,
.studio-btn,
.primary-btn,
.secondary-btn {
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out),
    transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.icon-btn {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  color: var(--aimd-text-secondary);
}

.icon-btn:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.icon-btn[data-active="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
  color: var(--aimd-interactive-primary);
}

.icon-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn--danger {
  color: var(--aimd-color-danger);
}

.icon-btn--danger:hover {
  background: var(--aimd-feedback-danger-bg);
  border-color: color-mix(in srgb, var(--aimd-color-danger) 28%, var(--aimd-border-default));
}

.bookmarks-shell {
  display: grid;
  grid-template-columns: var(--_bookmarks-sidebar-width) minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.bookmarks-sidebar {
  display: grid;
  align-content: start;
  gap: var(--_bookmarks-sidebar-gap);
  padding: var(--_bookmarks-sidebar-padding);
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 32%, transparent);
  overflow: auto;
}

/* Navigation tabs */
.bookmarks-body,
.tab-panel {
  min-height: 0;
  height: 100%;
}

.aimd-settings,
.aimd-sponsor {
  min-height: 0;
  height: 100%;
  position: relative;
}

.tab-panel {
  display: none;
}

.tab-panel[data-active="1"] {
  display: flex;
  flex-direction: column;
}

.tab-btn {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  min-height: 50px;
  padding: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2) var(--aimd-space-4);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid transparent;
  color: var(--aimd-text-secondary);
  text-align: left;
  cursor: pointer;
}

.tab-btn:hover {
  background: var(--aimd-button-secondary-hover);
  color: var(--aimd-text-primary);
}

.tab-btn[data-active="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  color: var(--aimd-text-primary);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 20%, transparent);
}

.tab-btn span:last-child {
  font-size: var(--aimd-text-base);
  font-weight: 500;
}

.bookmarks-tab-content {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

/* Bookmark tree toolbar */
.toolbar-row--bookmarks {
  display: flex;
  align-items: center;
  gap: var(--_bookmarks-toolbar-gap);
  flex-wrap: nowrap;
  padding: var(--_bookmarks-toolbar-padding-top) var(--_bookmarks-toolbar-padding-inline) var(--_bookmarks-toolbar-padding-bottom);
  background: transparent;
}

.search-field {
  border-radius: var(--aimd-radius-xl);
  border: 1px solid var(--_bookmarks-control-border);
  background: var(--_bookmarks-control-surface);
  color: var(--aimd-text-primary);
  box-shadow: var(--_bookmarks-control-inset-shadow);
}

.search-field {
  flex: 1 1 auto;
  min-width: 0;
  height: var(--_bookmarks-control-height);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: var(--aimd-text-sm);
}

.search-field input {
  all: unset;
  width: 100%;
  min-width: 0;
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--_bookmarks-sidebar-gap);
  flex: 0 0 auto;
}

.platform-dropdown {
  position: relative;
  flex: 0 0 auto;
}

.platform-dropdown__trigger {
  all: unset;
  box-sizing: border-box;
  width: var(--_bookmarks-sidebar-width);
  height: var(--_bookmarks-control-height);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid var(--_bookmarks-control-border);
  background: var(--_bookmarks-control-surface);
  color: var(--aimd-text-primary);
  box-shadow: var(--_bookmarks-control-inset-shadow);
  cursor: pointer;
}

.platform-dropdown__trigger:hover,
.platform-dropdown[data-open="1"] .platform-dropdown__trigger {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  background: var(--aimd-button-secondary-hover);
}

.platform-dropdown__value {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.platform-dropdown__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-text-sm);
}

.platform-dropdown__caret {
  display: inline-flex;
  color: var(--aimd-text-secondary);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.platform-dropdown[data-open="1"] .platform-dropdown__caret {
  transform: rotate(180deg);
}

.platform-dropdown__menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: var(--aimd-z-tooltip);
  min-width: 100%;
  padding: 8px;
  display: none;
  gap: 4px;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
}

.platform-dropdown__menu[data-open="1"] {
  display: grid;
}

.platform-dropdown__option {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: var(--aimd-space-3) var(--aimd-space-3);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  cursor: pointer;
}

.platform-dropdown__option:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 88%, var(--aimd-surface-hover));
}

.platform-dropdown__option[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
  color: var(--aimd-interactive-primary);
}

.platform-option-icon,
.platform-option-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

/* Bookmark tree */
.tree-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--aimd-space-4) calc(var(--aimd-space-4) + var(--aimd-space-1) / 2) 96px;
}

.tree-node {
  display: grid;
}

.tree-item {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 20px 18px 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-1) var(--aimd-space-2);
  padding-right: var(--_bookmarks-tree-actions-width);
  border-radius: var(--aimd-radius-xl);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-item + .tree-item {
  margin-top: 2px;
}

.tree-item:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 20%, transparent);
}

.tree-item[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 16%, transparent);
}

.tree-caret,
.tree-caret-slot,
.tree-icon-slot {
  display: inline-flex;
  width: 20px;
  height: 20px;
}

.tree-caret,
.tree-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
  cursor: pointer;
  flex: 0 0 auto;
}

.tree-caret {
  background: transparent;
  border: none;
  padding: 0;
  border-radius: var(--aimd-radius-md);
}

.tree-caret[disabled] {
  opacity: 0.35;
  cursor: default;
}

.tree-check {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-text-secondary) 22%, transparent);
  border-radius: var(--aimd-radius-sm);
  background: var(--aimd-bg-primary);
  box-shadow: var(--aimd-shadow-xs);
  display: grid;
  place-items: center;
  justify-self: center;
  transition:
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-check::before {
  content: '';
  width: 9px;
  height: 5px;
  border-left: 2px solid transparent;
  border-bottom: 2px solid transparent;
  transform: translateY(-1px) rotate(-45deg) scale(0);
  transform-origin: center;
  transition:
    transform var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-check:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 40%, var(--aimd-border-default));
  box-shadow: var(--_bookmarks-focus-ring-subtle);
}

.tree-check:checked {
  border-color: var(--aimd-interactive-primary);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, var(--aimd-bg-primary));
}

.tree-check:checked::before {
  border-left-color: var(--aimd-interactive-primary);
  border-bottom-color: var(--aimd-interactive-primary);
  transform: translateY(-1px) rotate(-45deg) scale(1);
}

.tree-check:focus-visible {
  outline: none;
  border-color: var(--aimd-interactive-primary);
  box-shadow: var(--_bookmarks-focus-ring-strong);
}

.tree-check[data-indeterminate="1"]::before {
  width: 8px;
  height: 2px;
  border: 0;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-interactive-primary);
  transform: scale(1);
}

.tree-main {
  all: unset;
  box-sizing: border-box;
  position: relative;
  z-index: var(--aimd-z-base);
  width: 100%;
  min-width: 0;
  padding: calc(var(--aimd-space-1) + var(--aimd-space-1) / 2) 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--_bookmarks-sidebar-gap);
  border-radius: var(--aimd-radius-lg);
  text-align: left;
  cursor: pointer;
}

.tree-main--folder .tree-label,
.tree-main--bookmark .tree-label-row,
.tree-main--bookmark .tree-label {
  width: 100%;
  text-align: left;
}

.tree-label-row {
  display: grid;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.tree-title-meta {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 12px;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: 1.45;
  text-align: left;
}

.tree-label--folder {
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
}

.tree-label--bookmark {
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.tree-subtitle,
.status-line,
.counter {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
}

.tree-main--bookmark .tree-subtitle {
  white-space: nowrap;
  text-align: right;
}

.tree-item:hover .tree-main--bookmark .tree-subtitle,
.tree-item:focus-within .tree-main--bookmark .tree-subtitle,
.tree-item[data-selected="1"] .tree-main--bookmark .tree-subtitle {
  opacity: 0;
}

.tree-folder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.tree-count {
  min-width: 18px;
  justify-self: end;
  text-align: right;
  font-size: var(--aimd-text-xs);
  color: var(--aimd-text-secondary);
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-actions {
  position: absolute;
  top: 50%;
  right: var(--aimd-space-2);
  z-index: var(--_bookmarks-tree-actions-z);
  display: inline-flex;
  align-items: center;
  gap: calc(var(--aimd-space-1) + var(--aimd-space-1) / 2);
  opacity: 0;
  pointer-events: none;
  background: transparent;
  border: none;
  box-shadow: none;
  transform: translateY(-50%) translateX(6px);
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-item:hover .tree-actions,
.tree-item:focus-within .tree-actions,
.tree-item[data-selected="1"] .tree-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0);
}

.tree-item:hover .tree-count,
.tree-item:focus-within .tree-count,
.tree-item[data-selected="1"] .tree-count {
  opacity: 0;
  pointer-events: none;
}

.tree-children {
  display: none;
}

.tree-children[data-expanded="1"] {
  display: grid;
}

.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--_bookmarks-sidebar-gap);
  min-height: 320px;
  margin: 24px 20px 0;
  padding: 32px;
  border: 1px dashed color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  border-radius: var(--_bookmarks-card-radius);
  text-align: center;
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 82%, transparent);
  color: var(--aimd-text-secondary);
}

.empty-actions {
  display: inline-flex;
  gap: var(--_bookmarks-sidebar-gap);
  margin-top: var(--_bookmarks-sidebar-gap);
}

.studio-btn {
  all: unset;
  box-sizing: border-box;
  height: 36px;
  padding: 0 var(--_bookmarks-control-inline-padding);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: transparent;
  color: var(--aimd-text-primary);
  cursor: pointer;
}

.studio-btn:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  background: var(--aimd-button-secondary-hover);
}

.studio-btn--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}

.studio-btn--secondary {
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
}

.batch-bar {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 18px;
  z-index: var(--_bookmarks-batch-z);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  padding: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2) var(--aimd-space-4);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  border-radius: var(--_bookmarks-batch-radius);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
  opacity: 0;
  pointer-events: none;
  transform: translateY(18px);
  transition: opacity 220ms var(--aimd-ease-in-out), transform 220ms var(--aimd-ease-in-out);
}

.batch-bar[data-active="1"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.batch-label {
  min-width: 0;
  font-size: var(--aimd-text-sm);
  color: var(--aimd-text-secondary);
}

.batch-actions {
  display: inline-flex;
  gap: 6px;
}

.aimd-panel-footer,
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px 18px;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent);
}

.settings-panel,
.changelog-panel,
.about-panel,
.faq-panel,
.sponsor-panel,
.feedback-panel {
  min-width: 0;
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

.settings-panel-scroll,
.changelog-panel-scroll,
.about-panel-scroll,
.faq-panel-scroll,
.sponsor-panel-scroll,
.feedback-panel-scroll {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  height: 100%;
}

.settings-panel-scroll {
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-inline-end: var(--aimd-space-3);
}

.settings-grid {
  width: min(760px, 100%);
  max-width: 100%;
  min-width: 0;
  margin: 0 auto;
  display: grid;
  gap: var(--aimd-space-4);
}

.settings-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  position: relative;
  display: grid;
  gap: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  padding: calc(var(--aimd-space-4) + var(--aimd-space-1) / 2);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
}

.settings-card:has(.settings-select-shell[data-open="1"]) {
  z-index: var(--_bookmarks-inline-menu-z);
}

.settings-section {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
}

.settings-section-body {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
}

.settings-data-card {
  display: grid;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: var(--aimd-space-4);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
  border-radius: var(--aimd-radius-lg);
  background: color-mix(in srgb, var(--aimd-bg-primary) 82%, var(--aimd-bg-surface));
}

.settings-data-card[data-role="settings-google-drive-backup-card"] {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--aimd-interactive-primary) 5%, transparent),
      transparent 44%
    ),
    color-mix(in srgb, var(--aimd-bg-primary) 84%, var(--aimd-bg-surface));
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 16%, var(--aimd-border-default));
}

.settings-data-card__title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--_bookmarks-settings-title-size);
  line-height: 1.45;
  font-weight: var(--_bookmarks-item-title-weight);
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: var(--_bookmarks-sidebar-gap);
  margin: 0;
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
}

.toggle-row,
.settings-row {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  gap: var(--aimd-space-3);
  padding: calc(var(--aimd-space-2) + var(--aimd-space-1) / 2) 0;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 46%, transparent);
}

.settings-card > .card-title + .toggle-row,
.settings-card > .card-title + .settings-row {
  border-top: none;
}

.settings-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.settings-label strong {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--aimd-space-1);
  min-width: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.45;
  font-weight: var(--aimd-font-medium);
}

.settings-label__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  flex: 0 0 auto;
  color: var(--aimd-text-primary);
}

.settings-label__icon .aimd-icon,
.settings-label__icon .aimd-icon svg {
  width: 100%;
  height: 100%;
}

.settings-label p,
.settings-item-warning-text {
  margin: 4px 0 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-xs);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.settings-notice {
  margin: 8px 0 0;
  padding: 10px var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 54%, transparent);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.6;
}

.sponsor-section-note,
.qr-card-label,
.qr-card-label-link {
  margin: 4px 0 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--aimd-text-on-primary) 6%, transparent),
    0 4px 10px color-mix(in srgb, var(--aimd-bg-primary) 22%, transparent);
  padding: 3px;
  flex: 0 0 48px;
  justify-self: end;
}

.toggle-switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.toggle-switch[data-checked="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary-hover) 82%, var(--aimd-text-on-primary) 18%);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary-hover) 76%, var(--aimd-text-on-primary) 16%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--aimd-text-on-primary) 24%, transparent),
    0 8px 18px color-mix(in srgb, var(--aimd-interactive-primary) 26%, transparent);
}

.toggle-knob {
  width: 22px;
  height: 22px;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  box-shadow: var(--aimd-shadow-sm);
  transform: translateX(0);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.toggle-switch[data-checked="1"] .toggle-knob {
  transform: translateX(20px);
}

.settings-select-shell {
  position: relative;
  min-width: min(148px, 100%);
  width: max-content;
  max-width: min(320px, 100%);
  justify-self: end;
}

.settings-select-shell[data-open="1"] {
  z-index: calc(var(--_bookmarks-inline-menu-z) + 1);
}

.settings-select-trigger {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: 100%;
  max-width: 100%;
  height: 44px;
  padding: 0 var(--_bookmarks-control-inline-padding);
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  box-shadow: var(--_bookmarks-control-inset-shadow);
}

.settings-select-trigger:hover,
.settings-select-shell[data-open="1"] .settings-select-trigger {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
}

.settings-select-trigger__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-trigger__caret {
  display: inline-flex;
  color: var(--aimd-text-secondary);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.settings-select-shell[data-open="1"] .settings-select-trigger__caret {
  transform: rotate(180deg);
}

.settings-select-menu {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: var(--_bookmarks-inline-menu-z);
  min-width: 100%;
  width: max-content;
  max-width: min(320px, calc(100vw - var(--aimd-space-6)));
  padding: 8px;
  gap: 4px;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
}

.settings-select-menu[data-open="1"] {
  display: grid;
}

.settings-select-option {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: var(--aimd-space-3) var(--aimd-space-3);
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  text-align: left;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  cursor: pointer;
}

.settings-select-option span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-option:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 88%, var(--aimd-surface-hover));
}

.settings-select-option[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
  color: var(--aimd-interactive-primary);
}

.settings-option-check {
  display: inline-flex;
  opacity: 0;
}

.settings-select-option[data-selected="1"] .settings-option-check {
  opacity: 1;
}

.settings-export-width-controls {
  min-width: 0;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  justify-self: end;
  max-width: 100%;
  white-space: nowrap;
}

.settings-export-width-controls .settings-export-width-preset {
  flex: 0 0 auto;
  min-width: 0;
  width: fit-content;
  justify-self: auto;
}

.settings-export-width-controls .settings-export-width-value {
  flex: 0 0 auto;
  min-width: 0;
  width: 88px;
  max-width: none;
  justify-self: auto;
}

.settings-export-pixel-ratio-value {
  min-width: 0;
  width: 88px;
  max-width: none;
}

.settings-export-width-preset .settings-select-trigger {
  width: fit-content;
  min-width: 120px;
}

.settings-number-field {
  min-width: min(148px, 100%);
  width: 180px;
  max-width: min(320px, 100%);
  height: 44px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  box-shadow: var(--_bookmarks-control-inset-shadow);
  overflow: hidden;
  justify-self: end;
}

.settings-number-field:hover,
.settings-number-field:focus-within {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
}

.settings-number-field[data-disabled="1"] {
  background: color-mix(in srgb, var(--aimd-bg-surface) 90%, var(--aimd-bg-secondary));
  border-color: color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  box-shadow: none;
}

.settings-number {
  all: unset;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  padding: 0 14px;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
}

.settings-number:disabled {
  cursor: not-allowed;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
}

.settings-number::-webkit-outer-spin-button,
.settings-number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.settings-number-stepper {
  width: 38px;
  border-left: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  display: grid;
  grid-template-rows: 1fr 1fr;
}

.settings-number-step {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
  cursor: pointer;
}

.settings-number-step + .settings-number-step {
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.settings-number-step:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 88%, var(--aimd-surface-hover));
}

.settings-stepper-field {
  width: 148px;
  height: 40px;
  display: grid;
  grid-template-columns: 40px minmax(48px, 1fr) 40px;
  align-items: center;
  justify-self: end;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  box-shadow: var(--_bookmarks-control-inset-shadow);
  overflow: hidden;
}

.settings-stepper-button {
  all: unset;
  box-sizing: border-box;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  cursor: pointer;
}

.settings-stepper-button + .settings-stepper-value,
.settings-stepper-value + .settings-stepper-button {
  border-left: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.settings-stepper-button:hover:not(:disabled),
.settings-stepper-button:focus-visible {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 88%, var(--aimd-surface-hover));
}

.settings-stepper-button:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: -2px;
}

.settings-stepper-button:disabled {
  cursor: not-allowed;
  color: color-mix(in srgb, var(--aimd-text-secondary) 62%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 48%, transparent);
}

.settings-stepper-value {
  min-width: 0;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  white-space: nowrap;
}

.settings-color-row {
  align-items: center;
}

.settings-color-swatches {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
  flex-wrap: nowrap;
}

.settings-color-swatch {
  all: unset;
  box-sizing: border-box;
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  min-width: var(--aimd-size-control-icon-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--aimd-radius-full);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 76%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 92%, var(--aimd-bg-primary));
  cursor: pointer;
  box-shadow: var(--_bookmarks-control-inset-shadow);
}

.settings-color-swatch:hover,
.settings-color-swatch:focus-visible {
  border-color: color-mix(in srgb, var(--_settings-accent-color) 54%, var(--aimd-border-strong));
  background: color-mix(in srgb, var(--_settings-accent-color) 8%, var(--aimd-bg-surface));
}

.settings-color-swatch:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.settings-color-swatch[data-selected="1"] {
  border-color: color-mix(in srgb, var(--_settings-accent-color) 72%, var(--aimd-border-strong));
  background: color-mix(in srgb, var(--_settings-accent-color) 12%, var(--aimd-bg-surface));
  box-shadow:
    var(--_bookmarks-control-inset-shadow),
    0 0 0 3px color-mix(in srgb, var(--_settings-accent-color) 16%, transparent);
}

.settings-color-swatch__preview {
  width: 18px;
  height: 18px;
  border-radius: var(--aimd-radius-full);
  background: var(--_settings-accent-color);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--aimd-color-white) 54%, transparent),
    0 1px 2px color-mix(in srgb, var(--aimd-text-primary) 18%, transparent);
}

.reader-settings-trigger {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  min-width: var(--aimd-size-control-icon-panel);
  padding: 0;
  justify-self: end;
}

.reader-settings-summary {
  white-space: normal;
  overflow-wrap: anywhere;
}

.settings-advanced {
  display: grid;
  gap: var(--aimd-space-3);
}

.settings-advanced-toggle {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-1);
  width: 100%;
  padding: var(--aimd-space-4);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-interactive-selected) 74%, var(--aimd-bg-surface));
  color: var(--aimd-text-primary);
}

.settings-advanced-toggle:hover,
.settings-advanced-toggle:focus-visible {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-interactive-selected) 88%, var(--aimd-bg-surface));
}

.settings-advanced-toggle:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.settings-advanced-toggle__label {
  font-size: var(--aimd-text-sm);
  line-height: 1.35;
  font-weight: var(--aimd-font-semibold);
}

.settings-advanced-toggle__hint {
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
  color: var(--aimd-text-secondary);
}

.settings-advanced-body {
  display: grid;
  gap: var(--aimd-space-3);
}

.settings-advanced-section {
  display: grid;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 78%, transparent);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 58%, transparent);
}

.settings-advanced-section__title {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.3;
  font-weight: var(--aimd-font-semibold);
  text-transform: uppercase;
}

.reader-settings-popover-layer {
  position: absolute;
  inset: 0;
  padding: var(--aimd-space-4);
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: var(--_bookmarks-inline-menu-z);
}

.panel-window--reader-settings {
  position: relative;
  inset: auto;
  transform: none;
  pointer-events: auto;
  width: min(920px, calc(100% - var(--aimd-space-6)));
  max-width: 90%;
  max-height: 90%;
}

.dialog-body--reader-settings {
  display: grid;
  gap: var(--aimd-space-4);
  min-height: 0;
  overflow: auto;
  padding: calc(var(--aimd-space-5) + var(--aimd-space-1));
}

.panel-footer--reader-settings {
  justify-content: flex-end;
}

.reader-settings-dialog__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
}

.reader-settings-dialog__title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--aimd-interactive-primary);
}

.reader-prompt-settings {
  overflow: hidden;
}

.reader-prompt-settings__back {
  margin-inline-end: var(--aimd-space-1);
}

.reader-prompt-settings__back .aimd-icon {
  transform: rotate(180deg);
}

.reader-prompt-settings__list {
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-2);
  min-height: 220px;
}

.reader-prompt-settings__row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid transparent;
  background: transparent;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.reader-prompt-settings__row:hover,
.reader-prompt-settings__row:focus-within {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 20%, transparent);
}

.reader-prompt-settings__row[data-dragging="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, var(--aimd-bg-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 28%, transparent);
  z-index: var(--aimd-z-base);
}

.reader-prompt-settings__row-main {
  all: unset;
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
  cursor: pointer;
}

.reader-prompt-settings__row-title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.reader-prompt-settings__row-content {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reader-prompt-settings__row-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
}

.reader-prompt-settings__drag {
  cursor: grab;
  touch-action: none;
  color: var(--aimd-text-secondary);
}

.reader-prompt-settings__drag:hover {
  color: var(--aimd-text-primary);
}

.reader-prompt-settings__drag:active,
.reader-prompt-settings__row[data-dragging="1"] .reader-prompt-settings__drag {
  cursor: grabbing;
}

.reader-prompt-settings__footer {
  display: flex;
  justify-content: flex-end;
}

.reader-settings-popover__field {
  display: grid;
  gap: var(--aimd-space-2);
}

.reader-settings-popover__field-label {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.reader-settings-popover__input,
.reader-settings-popover__textarea,
.reader-settings-template__editor,
.reader-settings-template__preview {
  width: 100%;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  line-height: 1.5;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 72%, transparent);
}

.reader-settings-popover__textarea {
  min-height: 160px;
  resize: vertical;
}

.reader-settings-template__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
}

.reader-settings-template__menu-shell {
  position: relative;
  display: inline-flex;
}

.reader-settings-template__menu {
  position: absolute;
  top: calc(100% + var(--aimd-space-2));
  left: 0;
  z-index: var(--_bookmarks-inline-menu-z);
  min-width: 220px;
  display: none;
  flex-direction: column;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2);
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
}

.reader-settings-template__menu[data-open="1"] {
  display: flex;
}

.reader-settings-template__menu-item {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  color: var(--aimd-text-primary);
  cursor: pointer;
}

.reader-settings-template__menu-item:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
}

.reader-settings-template__menu-item .aimd-icon {
  color: var(--aimd-text-secondary);
}

.reader-settings-template__editor {
  min-height: 220px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;
}

.reader-settings-template__editor:focus-visible,
.reader-settings-popover__input:focus-visible,
.reader-settings-popover__textarea:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

.reader-settings-template__editor:empty::before {
  content: attr(data-placeholder);
  color: var(--aimd-text-secondary);
}

.reader-settings-template__hint {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
  white-space: pre-wrap;
}

.reader-settings-template__preview {
  margin: 0;
  min-height: 180px;
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.formula-asset-settings {
  width: min(520px, calc(100% - var(--aimd-space-6)));
}

.formula-asset-settings__list {
  display: grid;
  gap: var(--aimd-space-2);
}

.formula-asset-settings__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-3);
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
}

.formula-asset-settings__label {
  min-width: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.reader-comment-template-editor__token {
  display: inline-flex;
  align-items: center;
  margin: 0 0.2em;
  padding: 0 var(--aimd-space-2);
  min-height: 1.75em;
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, var(--aimd-bg-surface));
  color: var(--aimd-interactive-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 24%, transparent);
  font-size: 0.95em;
  font-weight: var(--aimd-font-medium);
  vertical-align: baseline;
  user-select: none;
}

.settings-storage-info {
  margin-top: 2px;
  display: grid;
  gap: 10px;
}

.storage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.storage-label,
.storage-value {
  font-size: var(--aimd-text-sm);
  color: var(--aimd-text-secondary);
}

.storage-value {
  color: var(--aimd-text-primary);
  font-variant-numeric: tabular-nums;
}

.storage-progress-track {
  width: 100%;
  height: 8px;
  border-radius: var(--aimd-radius-full);
  overflow: hidden;
  background: color-mix(in srgb, var(--aimd-border-default) 40%, transparent);
}

.storage-progress-bar {
  width: 0%;
  height: 100%;
  background: var(--aimd-interactive-primary);
}

.storage-progress-bar.warning { background: var(--aimd-color-warning); }
.storage-progress-bar.critical { background: var(--aimd-color-danger); }

.cloud-backup-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--aimd-space-4);
  min-width: 0;
  padding-top: var(--aimd-space-1);
}

.cloud-backup-row__info {
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.cloud-backup-row__status {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 52%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 86%, transparent);
  color: var(--aimd-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-backup-row__status::before {
  content: "";
  flex: 0 0 auto;
  width: var(--aimd-space-2);
  height: var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-text-secondary) 42%, transparent);
}

.cloud-backup-row__status--connected {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 22%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, var(--aimd-bg-surface));
  color: color-mix(in srgb, var(--aimd-interactive-primary) 72%, var(--aimd-text-primary));
}

.cloud-backup-row__status--connected::before {
  background: var(--aimd-interactive-primary);
}

.cloud-backup-row__status--error {
  border-color: color-mix(in srgb, var(--aimd-color-warning) 28%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-color-warning) 10%, var(--aimd-bg-surface));
  color: color-mix(in srgb, var(--aimd-color-warning) 68%, var(--aimd-text-primary));
}

.cloud-backup-row__status--error::before {
  background: var(--aimd-color-warning);
}

.cloud-backup-row__actions,
.cloud-backup-settings-modal__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
}

.cloud-backup-row__button {
  flex: 0 0 auto;
}

@media (max-width: 560px) {
  .cloud-backup-row {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .cloud-backup-row__actions {
    justify-content: flex-start;
  }
}

.cloud-backup-settings-modal {
  display: grid;
  gap: var(--aimd-space-3);
}

.cloud-backup-settings-modal > p {
  margin: 0;
  color: var(--aimd-text-secondary);
  line-height: var(--aimd-line-height-normal);
}

.cloud-backup-settings-modal__privacy {
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 14%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-interactive-primary) 6%, var(--aimd-bg-surface));
}

.cloud-backup-settings-modal__status-card {
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 60%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 72%, var(--aimd-bg-surface));
}

.cloud-backup-progress {
  display: grid;
  gap: var(--aimd-space-3);
}

.cloud-backup-progress__status {
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
  color: var(--aimd-text-primary);
}

.cloud-backup-progress__budget {
  margin: 0;
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-line-height-normal);
  color: var(--aimd-text-secondary);
}

.cloud-backup-progress__steps {
  display: grid;
  gap: var(--aimd-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.cloud-backup-progress__steps li {
  position: relative;
  padding-left: calc(var(--aimd-space-4) + var(--aimd-space-1));
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
  color: var(--aimd-text-secondary);
}

.cloud-backup-progress__steps li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.65em;
  width: var(--aimd-space-2);
  height: var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-text-secondary) 38%, transparent);
}

.cloud-backup-progress__steps li[data-active="1"] {
  color: var(--aimd-interactive-primary);
  font-weight: var(--aimd-font-medium);
}

.cloud-backup-progress__steps li[data-active="1"]::before {
  background: var(--aimd-interactive-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
}

.cloud-backup-snapshot-list {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
  max-height: min(360px, 48vh);
  overflow-y: auto;
  overflow-x: hidden;
}

.cloud-backup-snapshot-option {
  all: unset;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--aimd-size-control-glyph-panel) minmax(0, 1fr);
  align-items: center;
  gap: var(--aimd-space-3);
  min-width: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 92%, var(--aimd-bg-primary));
  cursor: pointer;
}

.cloud-backup-snapshot-option:hover {
  background: var(--aimd-button-secondary-hover);
}

.cloud-backup-snapshot-option[data-selected="1"] {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 54%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, var(--aimd-bg-surface));
}

.cloud-backup-snapshot-radio {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  border-radius: var(--aimd-radius-full);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 78%, transparent);
  background: var(--aimd-bg-primary);
}

.cloud-backup-snapshot-option[data-selected="1"] .cloud-backup-snapshot-radio {
  border: 5px solid var(--aimd-interactive-primary);
}

.cloud-backup-snapshot-content {
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.cloud-backup-snapshot-time,
.cloud-backup-snapshot-name,
.cloud-backup-snapshot-size {
  display: block;
  min-width: 0;
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
}

.cloud-backup-snapshot-time {
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.cloud-backup-snapshot-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
}

.cloud-backup-snapshot-size {
  color: var(--aimd-text-tertiary);
}

.cloud-backup-manager-list {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
  max-height: min(420px, 52vh);
  overflow-y: auto;
  overflow-x: hidden;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
}

.cloud-backup-manager-list[data-state="loading"],
.cloud-backup-manager-list[data-state="empty"],
.cloud-backup-manager-list[data-state="error"] {
  align-items: center;
  justify-items: center;
  min-height: 128px;
  padding: var(--aimd-space-4);
  border-radius: var(--aimd-radius-lg);
  border: 1px dashed color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 68%, var(--aimd-bg-surface));
  text-align: center;
}

.cloud-backup-manager-list[data-state="error"] {
  border-color: color-mix(in srgb, var(--aimd-color-warning) 38%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-color-warning) 8%, var(--aimd-bg-surface));
  color: color-mix(in srgb, var(--aimd-color-warning) 70%, var(--aimd-text-primary));
}

.cloud-backup-manager-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--aimd-space-3);
  align-items: center;
  min-width: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 92%, var(--aimd-bg-primary));
}

.cloud-backup-manager-item:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 18%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-interactive-primary));
}

.cloud-backup-manager-info {
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.cloud-backup-manager-info strong,
.cloud-backup-manager-name,
.cloud-backup-manager-size {
  display: block;
  min-width: 0;
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
}

.cloud-backup-manager-info strong {
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.cloud-backup-manager-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
}

.cloud-backup-manager-size {
  color: var(--aimd-text-tertiary);
}

.cloud-backup-manager-trash {
  align-self: center;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .cloud-backup-manager-item {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .cloud-backup-manager-trash {
    justify-self: start;
  }
}

.settings-backup-warning {
  margin-top: var(--aimd-space-2);
}

.primary-btn,
.secondary-btn {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 18px;
  border-radius: var(--aimd-radius-full);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-line-height-normal);
  font-weight: var(--aimd-font-medium);
  cursor: pointer;
}

.secondary-btn:hover {
  background: var(--aimd-button-secondary-hover);
}

.primary-btn {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.primary-btn:hover,
.studio-btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.secondary-btn {
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
}

.secondary-btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}

.secondary-btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.secondary-btn--primary:active {
  background: var(--aimd-interactive-primary-hover);
}

.secondary-btn--danger {
  color: color-mix(in srgb, var(--aimd-color-danger) 78%, var(--aimd-text-primary));
  border-color: color-mix(in srgb, var(--aimd-color-danger) 28%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-color-danger) 6%, var(--aimd-bg-surface));
}

.secondary-btn--danger:hover {
  background: color-mix(in srgb, var(--aimd-color-danger) 10%, var(--aimd-bg-surface));
}

.support-content,
.info-shell,
.sponsor-shell {
  width: min(680px, 100%);
  margin: 0 auto;
  display: grid;
  gap: var(--aimd-space-5);
  padding-bottom: var(--aimd-space-4);
}

.aimd-info-tab {
  position: relative;
}

.info-hero {
  display: grid;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-6);
  border-radius: var(--_bookmarks-card-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 68%, transparent);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent), transparent 42%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent),
      color-mix(in srgb, var(--aimd-bg-primary) 88%, var(--aimd-bg-secondary))
    );
}

.info-eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 28px;
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, var(--aimd-bg-surface));
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-medium);
  letter-spacing: 0.01em;
}

.info-hero__title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-panel-title-size);
  line-height: 1.2;
  font-weight: 600;
}

.info-section {
  display: grid;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
}

.info-section__head {
  display: grid;
  gap: var(--aimd-space-2);
}

.info-section__title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
  line-height: 1.35;
}

.info-section__intro,
.info-copy {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.7;
}

.info-copy-stack {
  display: grid;
  gap: var(--aimd-space-3);
}

.changelog-notice-modal {
  display: grid;
  gap: var(--aimd-space-4);
}

.changelog-notice-modal__date {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-tertiary) 92%, transparent);
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
}

.changelog-notice-modal__content {
  display: grid;
  gap: var(--aimd-space-3);
}

.changelog-notice-modal__sections {
  display: grid;
  gap: var(--aimd-space-4);
}

.changelog-entry-section {
  display: grid;
  gap: var(--aimd-space-2);
}

.changelog-entry-section__title {
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
  line-height: 1.35;
}

.changelog-entry-section__body {
  display: grid;
  gap: var(--aimd-space-3);
}

.info-mark {
  color: var(--aimd-interactive-primary);
  font-weight: var(--aimd-font-semibold);
}

.info-profile-card {
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent), transparent 42%),
    color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
}

.info-profile {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: var(--aimd-space-4);
  align-items: center;
}

.info-profile__avatar-frame {
  width: 112px;
  height: 112px;
  border-radius: var(--aimd-radius-full);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-sm);
}

.info-profile__avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.info-profile__bio {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.65;
}

.mappamory-promo-card {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(220px, 1.08fr);
  gap: var(--aimd-space-5);
  align-items: center;
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-sm);
}

.mappamory-promo-card__content {
  min-width: 0;
  display: grid;
  gap: var(--aimd-space-3);
  align-content: center;
}

.mappamory-promo-card__eyebrow {
  width: fit-content;
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.mappamory-promo-card__title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-xl);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.25;
}

.mappamory-promo-card__copy {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.65;
}

.mappamory-promo-card__social-link {
  width: fit-content;
  max-width: 100%;
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: 1.45;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.mappamory-promo-card__social-link:hover {
  text-decoration: underline;
}

.mappamory-promo-card__button {
  justify-self: start;
}

.mappamory-promo-card__media {
  min-width: 0;
  padding: var(--aimd-space-2);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.mappamory-promo-card__image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: calc(var(--_bookmarks-card-radius) - var(--aimd-space-1));
}

.about-website-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--aimd-space-4);
  align-items: center;
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-sm);
}

.about-website-card__content {
  min-width: 0;
  display: grid;
  gap: var(--aimd-space-2);
}

.about-website-card__title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.about-website-card__copy {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
}

.about-website-card__button {
  white-space: nowrap;
}

.support-contact-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--aimd-space-4);
  align-items: center;
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 24%, var(--aimd-border-default));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-interactive-primary)),
      color-mix(in srgb, var(--aimd-bg-primary) 94%, var(--aimd-bg-secondary))
    );
}

.support-contact-card__content {
  min-width: 0;
  display: grid;
  gap: var(--aimd-space-2);
}

.support-contact-card__eyebrow {
  width: fit-content;
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.support-contact-card__title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.support-contact-card__copy {
  margin: 0;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
}

.support-contact-card__email {
  min-width: 0;
  width: fit-content;
  max-width: 100%;
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.support-contact-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--aimd-space-2);
}

.support-contact-card__button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-4);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
}

.support-contact-card__button:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 92%, var(--aimd-bg-primary));
}

.support-contact-card__button--email {
  border-color: transparent;
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.support-contact-card__button--email:hover {
  background: var(--aimd-interactive-primary-hover);
}

.support-contact-card__button-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.support-contact-card__button-icon svg {
  display: block;
}

.info-media {
  margin: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.info-media__image {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: calc(var(--_bookmarks-card-radius) - var(--aimd-space-1));
}

.info-list {
  margin: 0;
  padding-left: 1.15rem;
  display: grid;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-primary);
}

.info-copy + .info-list,
.info-copy + .info-list--cards {
  margin-top: var(--aimd-space-2);
}

.info-list li {
  color: color-mix(in srgb, var(--aimd-text-primary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.65;
}

.info-list--cards {
  padding-left: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.info-list-card {
  padding: var(--aimd-space-4);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
}

.info-disclosure-list {
  display: grid;
  gap: var(--aimd-space-3);
}

.info-disclosure {
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  overflow: hidden;
}

.info-disclosure__trigger {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  cursor: pointer;
}

.info-disclosure__trigger:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 92%, var(--aimd-bg-primary));
}

.info-disclosure__meta {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.info-disclosure__title {
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-medium);
}

.info-disclosure__title--single {
  text-align: left;
}

.info-disclosure__date {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
}

.info-disclosure__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
}

.info-disclosure__body {
  display: none;
  padding: 0 var(--aimd-space-4) var(--aimd-space-4);
}

.info-disclosure__summary {
  margin-bottom: var(--aimd-space-4);
  padding-bottom: var(--aimd-space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 62%, transparent);
}

.info-disclosure__lead {
  display: grid;
  gap: var(--aimd-space-4);
  margin-bottom: var(--aimd-space-4);
}

.info-disclosure[data-open="1"] .info-disclosure__body {
  display: block;
}

.sponsor-celebration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: var(--_bookmarks-card-radius-xl);
  z-index: var(--_bookmarks-celebration-z);
}

.sponsor-burst-piece {
  position: absolute;
  width: 9px;
  height: 16px;
  border-radius: var(--aimd-radius-full);
  background: var(--piece-color, var(--aimd-interactive-primary));
  transform: translate(-50%, -50%) rotate(var(--piece-rotate, 0deg));
  opacity: 0;
  animation: sponsor-burst 900ms var(--aimd-ease-out) forwards;
}

@keyframes sponsor-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--piece-rotate, 0deg)) scale(0.45);
  }
  100% {
    opacity: 0;
    transform:
      translate(
        calc(-50% + var(--piece-x, 0px)),
        calc(-50% + var(--piece-y, 0px))
      )
      rotate(calc(var(--piece-rotate, 0deg) + 42deg))
      scale(1);
  }
}

.sponsor-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sponsor-brand-badge {
  width: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-5));
  height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-5));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--aimd-radius-2xl) + var(--aimd-space-1));
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent), transparent 72%),
    color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.sponsor-brand-mark {
  width: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
  height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
  flex: none;
}

.support-section,
.sponsor-card {
  display: grid;
  gap: var(--aimd-space-4);
  justify-items: center;
  text-align: center;
  padding: var(--aimd-space-6);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent),
      color-mix(in srgb, var(--aimd-bg-primary) 90%, var(--aimd-bg-secondary))
    );
}

.sponsor-card--donate {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 32%, var(--aimd-border-strong));
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent), transparent 62%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent),
      color-mix(in srgb, var(--aimd-bg-primary) 90%, var(--aimd-bg-secondary))
    );
}

.sponsor-section-head {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: var(--aimd-space-3);
}

.sponsor-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--aimd-size-control-icon-panel) + var(--aimd-space-4));
  height: calc(var(--aimd-size-control-icon-panel) + var(--aimd-space-4));
  border-radius: calc(var(--aimd-radius-2xl) + var(--aimd-space-1));
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
}

.sponsor-section-icon .aimd-icon,
.sponsor-section-icon .aimd-icon svg {
  width: calc(var(--aimd-size-control-glyph-panel) + var(--aimd-space-2));
  height: calc(var(--aimd-size-control-glyph-panel) + var(--aimd-space-2));
}

.sponsor-section-icon--warm {
  color: var(--aimd-interactive-primary);
}

.sponsor-section-copy {
  display: grid;
  gap: var(--aimd-space-1);
  justify-items: center;
  max-width: 100%;
}

.sponsor-section-label {
  font-size: var(--aimd-text-base);
  line-height: 1.35;
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.sponsor-section-body {
  margin: 0;
  max-width: 34ch;
  color: color-mix(in srgb, var(--aimd-text-secondary) 92%, transparent);
  font-size: var(--aimd-text-sm);
  line-height: 1.65;
}

.sponsor-action-row {
  display: flex;
  justify-content: center;
}

.sponsor-cta-button {
  min-width: 220px;
}

.qr-cards-row,
.sponsor-qr-grid {
  width: 100%;
  display: grid;
  gap: var(--aimd-space-4);
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.qr-card,
.sponsor-qr-card {
  display: grid;
  gap: var(--aimd-space-3);
  justify-items: center;
  text-align: center;
  padding: var(--aimd-space-4);
  border-radius: var(--_bookmarks-card-radius);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 95%, var(--aimd-bg-primary));
}

.sponsor-qr-meta {
  display: grid;
  gap: var(--aimd-space-1);
  justify-items: center;
}

.sponsor-qr-meta strong {
  font-size: var(--aimd-text-base);
  font-weight: 500;
  color: var(--aimd-text-primary);
}

.sponsor-thanks-list {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.sponsor-thanks-item {
  min-width: 0;
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sponsor-thanks-item:first-child {
  border-top: 0;
}

.sponsor-thanks-item:nth-child(2) {
  border-top: 0;
}

.qr-image-wrapper,
.sponsor-qr-frame {
  width: min(100%, 240px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  justify-self: center;
  overflow: hidden;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
}

.sponsor-qr-frame--card {
  width: 100%;
  max-width: 240px;
  aspect-ratio: 0.75;
}

.social-follow-card {
  display: grid;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-5);
  border-radius: var(--_bookmarks-card-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
}

.social-follow-card__frame {
  width: min(100%, 420px);
  justify-self: center;
  border-radius: var(--_bookmarks-card-radius);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
  box-shadow: var(--aimd-shadow-sm);
}

.social-follow-card__image {
  display: block;
  width: 100%;
  height: auto;
}

@media (max-width: 720px) {
  .info-profile {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .support-contact-card {
    grid-template-columns: 1fr;
  }

  .mappamory-promo-card {
    grid-template-columns: 1fr;
  }

  .support-contact-card__actions {
    justify-content: stretch;
  }

  .support-contact-card__button {
    flex: 1 1 160px;
  }

  .mappamory-promo-card__button {
    justify-self: stretch;
  }
}

.qr-image,
.sponsor-qr-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

@media (max-width: 980px) {
  .aimd-panel-header,
  .panel-header {
    min-height: var(--aimd-panel-header-height-compact);
    padding: var(--aimd-panel-header-padding-block-compact) var(--aimd-panel-header-padding-inline-compact);
  }

  .aimd-panel {
    width: min(var(--aimd-panel-wide-max-width), calc(100vw - var(--_bookmarks-panel-edge-offset-mobile)));
    height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset-mobile)));
    max-height: calc(100vh - var(--_bookmarks-panel-edge-offset-mobile));
  }

  .bookmarks-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .bookmarks-sidebar {
    display: grid;
    width: 100%;
    position: relative;
    border-right: none;
    border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--_bookmarks-mobile-tab-strip-gap);
    padding: var(--aimd-space-3) var(--aimd-space-4);
    background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
    overflow: hidden;
  }

  .bookmarks-sidebar::before {
    content: '';
    position: absolute;
    inset: var(--aimd-space-3) var(--aimd-space-4);
    border-radius: var(--aimd-radius-2xl);
    background: var(--_bookmarks-mobile-tab-strip-surface);
    border: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
    pointer-events: none;
  }

  .tab-btn {
    position: relative;
    z-index: var(--aimd-z-base);
    min-width: 0;
    min-height: 46px;
    padding: var(--aimd-space-3) var(--aimd-space-2);
    justify-content: center;
    border-radius: var(--aimd-radius-xl);
    text-align: center;
  }

  .tab-btn span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-row--bookmarks {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(132px, var(--_bookmarks-sidebar-width));
    align-items: center;
    gap: var(--_bookmarks-toolbar-gap);
  }

  .platform-dropdown__trigger {
    width: 100%;
  }

  .toolbar-row--bookmarks > .toolbar-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .toolbar-row--bookmarks > .platform-dropdown {
    min-width: 0;
  }

  .batch-bar {
    left: 14px;
    right: 14px;
    bottom: 14px;
    flex-wrap: wrap;
  }

  .qr-cards-row,
  .sponsor-qr-grid {
    grid-template-columns: 1fr;
  }

  .sponsor-thanks-list {
    grid-template-columns: 1fr;
  }

  .sponsor-thanks-item:nth-child(2) {
    border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  }

  .sponsor-card {
    padding: var(--aimd-space-5);
  }

  .about-website-card,
  .support-contact-card {
    grid-template-columns: 1fr;
  }

  .about-website-card__button {
    width: 100%;
    min-width: 0;
  }

  .sponsor-action-row {
    justify-content: center;
  }

  .sponsor-cta-button {
    width: 100%;
    min-width: 0;
  }
}
`;
}
