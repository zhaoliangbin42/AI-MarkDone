import type { Theme } from '../../../../core/types/theme';
import { getInputFieldCss } from '../../components/styles/inputFieldCss';
import { getModalHostShellCss } from '../../components/styles/modalHostCss';
import { getPanelChromeCss } from '../../components/styles/panelChromeCss';

export function getBookmarkSaveDialogCss(_theme: Theme): string {
    return `
:host {
  font-family: var(--aimd-font-family-sans);
}

*, *::before, *::after {
  box-sizing: border-box;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

${getInputFieldCss()}
${getPanelChromeCss()}
${getModalHostShellCss()}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window--dialog,
.panel-window--bookmark-save {
  width: min(660px, calc(100vw - var(--aimd-space-6)));
  max-height: min(720px, calc(100vh - var(--aimd-space-6)));
}

.panel-header__meta,
.panel-header__meta--reader {
  display: flex;
  align-items: center;
  min-width: 0;
}

.tree-caret:hover {
  background: var(--aimd-button-icon-hover);
}

.icon-btn:focus-visible,
.secondary-btn:focus-visible,
.picker-main:focus-visible,
.text-input:focus-visible,
.tree-caret:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.tree-folder-icon .aimd-icon,
.tree-folder-icon .aimd-icon svg,
.picker-check .aimd-icon,
.picker-check .aimd-icon svg,
.tree-caret .aimd-icon,
.tree-caret .aimd-icon svg {
  width: 16px;
  height: 16px;
}

.dialog-body {
  flex: 1;
  overflow: auto;
  padding: calc(var(--aimd-space-5) + var(--aimd-space-2));
}

.dialog-body--bookmark-save {
  display: grid;
  gap: var(--aimd-space-5);
}

.field-block {
  display: grid;
  gap: var(--aimd-space-2);
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
}

.field-label {
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.text-input {
  width: 100%;
  border: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 42%, transparent);
  color: var(--aimd-text-primary);
  border-radius: var(--aimd-radius-lg);
  padding: 10px 12px;
  min-height: 44px;
  outline: none;
}

.text-input--bookmark-save-title {
  min-height: 46px;
}

.text-input--inline {
  min-height: 40px;
}

.text-input[aria-invalid="true"] {
  border-color: var(--aimd-interactive-danger);
}

.picker-tree {
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 34%, transparent);
  overflow: auto;
  max-height: 320px;
  overscroll-behavior: contain;
}

.picker-node {
  display: block;
}

.picker-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: 40px;
  padding: 6px 10px;
}

.picker-row[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 16%, transparent);
}

.picker-row:hover {
  background: var(--aimd-button-secondary-hover);
}

.picker-row[data-selected="1"]:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 86%, var(--aimd-button-secondary-hover));
}

.tree-caret {
  all: unset;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border-radius: var(--aimd-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tree-caret[disabled] {
  opacity: 0.45;
  cursor: default;
}

.picker-main {
  all: unset;
  box-sizing: border-box;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  cursor: pointer;
}

.tree-folder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
}

.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-text-sm);
}

.picker-check {
  color: var(--aimd-interactive-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-children[data-expanded="0"] {
  display: none;
}

.inline-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--aimd-space-2);
  padding: 8px 10px;
}

.help-text,
.error-text {
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
}

.help-text {
  color: var(--aimd-text-secondary);
  padding: 12px 10px;
}

.help-text--inline,
.error-text--inline {
  padding: 0 10px 8px;
}

.error-text {
  color: var(--aimd-interactive-danger);
}

.panel-footer--bookmark-save {
  justify-content: flex-end;
}

.button-row {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
}

.secondary-btn--primary {
  font-weight: var(--aimd-font-semibold);
}

.mock-modal-overlay {
  background: color-mix(in srgb, var(--aimd-overlay-bg) 48%, transparent);
}

.mock-modal {
  width: min(420px, calc(100vw - 48px));
}

.mock-modal__title-copy strong {
  font-size: var(--aimd-modal-title-size);
  font-weight: var(--aimd-modal-title-weight);
}

.mock-modal__title-wrap {
  gap: var(--aimd-space-3);
}

.mock-modal__kind-icon {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
}

.mock-modal__content {
  gap: var(--aimd-space-3);
}

@media (max-width: 900px) {
  .panel-window--dialog,
  .panel-window--bookmark-save {
    width: min(660px, calc(100vw - var(--aimd-space-4)));
    max-height: calc(100vh - var(--aimd-space-4));
  }

  .dialog-body {
    padding: var(--aimd-space-4);
  }
}
`;
}
