import { COMPOSER_SUGGESTION_LIST_CSS } from '../components/ComposerSuggestionList';
import { getSurfaceMaterialCss } from '../components/styles/surfaceMaterialCss';

export function getPromptSurfaceCss(): string {
    return `
:host {
  box-sizing: border-box;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
* { box-sizing: border-box; }
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
.prompt-manager-body { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
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
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-top: 1px solid var(--aimd-workspace-border);
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
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
.manager-list {
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: var(--aimd-space-1);
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--aimd-space-2);
}
.prompt-editor-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: var(--aimd-space-3);
}
.prompt-row,
.manager-row__main {
  all: unset;
  box-sizing: border-box;
  min-width: 0;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.prompt-row { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.prompt-row:active,
.manager-row__main:active { transform: scale(0.99); }
.prompt-row__main,
.manager-row__main { min-width: 0; }
.prompt-row__title,
.manager-row__title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
}
.prompt-row__content,
.manager-row__content,
.manager-row__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.prompt-row__trigger {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  font-family: var(--aimd-font-family-mono);
}
.prompt-enabled-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  white-space: nowrap;
}
.prompt-header,
.prompt-toolbar,
.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.prompt-header {
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
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
}
.prompt-header__title svg,
.icon-btn svg,
.primary-btn svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.prompt-search,
.field input,
.field textarea {
  width: 100%;
  min-width: 0;
  font: inherit;
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.prompt-search { flex: 1; }
.manager-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--aimd-space-1);
}
.prompt-drag-handle { cursor: grab; }
.prompt-drag-handle:active { cursor: grabbing; }
.manager-row[data-dragging="1"] { opacity: 0.72; }
.manager-row[data-dragging="1"] .prompt-drag-handle {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-selected);
}
.icon-btn,
.primary-btn,
.secondary-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-1);
  font-size: var(--aimd-font-size-xs);
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.icon-btn {
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
}
.primary-btn,
.secondary-btn { padding: var(--aimd-space-2) var(--aimd-space-3); }
.icon-btn:active,
.primary-btn:active,
.secondary-btn:active { transform: scale(0.96); }
.prompt-footer { border-top: 1px solid var(--aimd-workspace-border); }
.field {
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-3) var(--aimd-space-3) 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.field textarea {
  resize: vertical;
  min-height: 132px;
  max-height: min(320px, calc(var(--_prompt-popover-max-height, 630px) - 220px));
  overflow-y: auto;
}
.placeholder-row {
  display: grid;
  justify-content: start;
  padding: var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.prompt-status,
.prompt-empty {
  flex: none;
  padding: var(--aimd-space-2) var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  overflow-wrap: anywhere;
}
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
  .prompt-footer { gap: var(--aimd-space-1); padding: var(--aimd-space-2); }
  .prompt-enabled-toggle > span,
  .primary-btn > span { display: none; }
}
${getSurfaceMaterialCss()}
`;
}
