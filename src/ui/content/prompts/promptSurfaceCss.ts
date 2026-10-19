import { COMPOSER_SUGGESTION_LIST_CSS } from '../components/ComposerSuggestionList';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import { getSurfaceMaterialCss } from '../components/styles/surfaceMaterialCss';

export function getPromptSurfaceCss(): string {
    return `
:host {
  box-sizing: border-box;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
*, *::before, *::after { box-sizing: border-box; }
${COMPOSER_SUGGESTION_LIST_CSS}
.prompt-popover {
  width: 100%;
  max-height: var(--_prompt-popover-max-height, min(520px, calc(100vh - var(--aimd-space-4) * 2)));
  min-height: 0;
  display: grid;
  overflow: hidden;
}
.prompt-popover--autocomplete { grid-template-rows: minmax(0, 1fr) auto; max-height: min(240px, var(--_prompt-popover-max-height, calc(100vh - var(--aimd-space-4) * 2))); }
.prompt-popover--manager { grid-template-rows: auto auto minmax(0, 1fr); }
.prompt-popover--editor { grid-template-rows: auto minmax(0, 1fr) auto; }
.prompt-list {
  display: grid;
  align-content: start;
  gap: var(--aimd-space-1);
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--aimd-space-2);
}
.prompt-autocomplete-hint {
  margin: 0;
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border-top: 1px solid var(--aimd-workspace-border);
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
  overflow-wrap: anywhere;
}
.prompt-candidate-empty {
  display: grid;
  justify-items: start;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-sm);
}
.prompt-candidate-empty p { margin: 0; }
.prompt-manager-body.flat-workflow__body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.prompt-manager-body .manager-list {
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-block: 0;
}
.prompt-editor-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.prompt-editor-body > * { flex: none; }
.prompt-row,
.manager-row__main {
  all: unset;
  box-sizing: border-box;
  min-width: 0;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.prompt-row { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.prompt-row__main { min-width: 0; display: grid; gap: var(--aimd-space-1); }
.manager-row__heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--aimd-space-1) var(--aimd-space-2);
}
.prompt-row__title,
.manager-row__title {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-medium);
  font-family: var(--aimd-font-family-sans);
  line-height: var(--aimd-leading-normal);
}
.manager-row__title { flex: 1 1 auto; }
.prompt-row__content,
.manager-row__content {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
}
.prompt-trigger-summary,
.prompt-row__trigger {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-font-size-xs);
  font-family: var(--aimd-font-family-mono);
}
.manager-row__actions,
.prompt-enabled-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
}
.manager-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-3);
  padding-top: var(--aimd-space-2);
  margin-top: var(--aimd-space-3);
  border-top: 1px solid var(--aimd-border-subtle);
}
.manager-row__state {
  flex: none;
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
}
.prompt-enabled-toggle {
  min-height: var(--aimd-size-control-action-panel);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  white-space: nowrap;
  cursor: pointer;
}
.prompt-enabled-toggle input { margin: 0; }
.prompt-header,
.prompt-toolbar,
.prompt-footer {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4) var(--aimd-space-5);
}
.prompt-header {
  justify-content: space-between;
  border-bottom: 1px solid var(--aimd-workspace-border);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.prompt-header:active { cursor: grabbing; }
.prompt-header button { touch-action: auto; user-select: auto; }
.prompt-header__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-width: 0;
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: var(--aimd-leading-normal);
}
.prompt-header__title svg,
.icon-btn svg,
.primary-btn svg,
.secondary-btn svg,
.prompt-options-summary svg {
  flex: none;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.prompt-toolbar { padding-bottom: 0; background: var(--aimd-workspace-surface); }
.prompt-search,
.field input,
.field textarea {
  width: 100%;
  min-width: 0;
  font: inherit;
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.prompt-search { flex: 1; font-size: var(--aimd-font-size-sm); }
.manager-row {
  position: relative;
  min-width: 0;
  padding: var(--aimd-space-3) var(--aimd-space-4);
}
.manager-row + .manager-row { border-top: 1px solid var(--aimd-border-subtle); }
.manager-row__main {
  width: 100%;
  padding: var(--aimd-space-1) calc(var(--aimd-size-control-action-panel) * 3) var(--aimd-space-1) 0;
}
.prompt-options-summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-action-panel);
  min-width: 0;
  padding-block: var(--aimd-space-2);
  list-style: none;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
  user-select: none;
}
.prompt-options-summary::-webkit-details-marker { display: none; }
.prompt-options-summary:hover { color: var(--aimd-text-primary); }
.prompt-options-summary:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
details[open] > .prompt-options-summary > svg { transform: rotate(180deg); }
.manager-row__summary {
  position: absolute;
  top: var(--aimd-space-3);
  right: var(--aimd-space-4);
}
.prompt-trigger-summary { flex: 1; text-align: end; }
.prompt-trigger-summary[hidden] { display: none; }
.icon-btn,
.primary-btn,
.secondary-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-font-size-sm);
  line-height: var(--aimd-leading-normal);
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.icon-btn {
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
}
.primary-btn,
.secondary-btn {
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.icon-btn:active,
.primary-btn:active,
.secondary-btn:active { transform: scale(0.96); }
.prompt-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--aimd-workspace-border);
}
.prompt-footer .primary-btn { min-width: calc(var(--aimd-size-control-action-panel) * 2); }
.field {
  display: grid;
  gap: var(--aimd-space-2);
  min-width: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  line-height: var(--aimd-leading-normal);
}
.field > span { font-weight: var(--aimd-font-medium); }
.field textarea {
  resize: vertical;
  min-height: calc(var(--aimd-space-6) * 5);
  max-height: min(320px, calc(var(--_prompt-popover-max-height, 630px) - 220px));
  overflow-y: auto;
  line-height: var(--aimd-leading-reading);
}
.prompt-editor-options { border-top: 1px solid var(--aimd-border-subtle); }
.prompt-editor-options__body {
  display: grid;
  gap: var(--aimd-space-3);
  padding-top: var(--aimd-space-3);
}
.placeholder-row {
  display: flex;
  justify-content: flex-start;
  margin-inline: calc(-1 * var(--aimd-space-3));
}
.prompt-status,
.prompt-empty {
  flex: none;
  padding: var(--aimd-space-3) var(--aimd-space-2);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-sm);
  line-height: var(--aimd-leading-normal);
  overflow-wrap: anywhere;
}
.prompt-empty { padding-block: var(--aimd-space-6); text-align: center; }
.prompt-status--error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  flex-wrap: wrap;
}
@media (max-width: 420px) {
  .prompt-header,
  .prompt-toolbar,
  .prompt-footer { gap: var(--aimd-space-2); padding-inline: var(--aimd-space-4); }
  .manager-row { padding-inline: var(--aimd-space-3); }
  .manager-row__summary { right: var(--aimd-space-3); }
}
@media (prefers-reduced-motion: reduce) {
  .prompt-row,
  .manager-row__main,
  .icon-btn,
  .primary-btn,
  .secondary-btn { transition: none; }
}
${getSurfaceMaterialCss()}
${getFlatWorkflowCss()}
`;
}
