import { getPanelChromeCss } from '../components/styles/panelChromeCss';
import { getWorkflowDialogChromeCss } from '../components/styles/workflowDialogChromeCss';
import { getSurfaceMaterialCss } from '../components/styles/surfaceMaterialCss';

export function getSaveMessagesDialogCss(): string {
    return `
:host { font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; }

${getPanelChromeCss()}
${getWorkflowDialogChromeCss()}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window--save {
  width: min(560px, calc(100vw - var(--aimd-space-6)));
  max-height: min(82vh, 720px);
}

.panel-window--save > .panel-header {
  min-height: 0;
  padding: var(--aimd-space-5) var(--aimd-space-6);
}

.panel-window--save .dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-5);
  padding: var(--aimd-space-5) var(--aimd-space-6);
  background: var(--aimd-workspace-surface);
}

.export-section { min-width: 0; }
.export-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  margin-bottom: var(--aimd-space-3);
}
.export-section-heading h3 {
  margin: 0;
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
  color: var(--aimd-text-secondary);
}

/* Match Settings' grouped rows, without recessed controls. */
.settings-card {
  flex: 0 0 auto;
  min-width: 0;
  padding: 0 var(--aimd-space-5);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-2xl);
}
.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 60%);
  align-items: center;
  gap: var(--aimd-space-4);
  min-width: 0;
  padding-block: var(--aimd-space-4);
}
.settings-item + .settings-item {
  border-top: 1px solid color-mix(in srgb, var(--aimd-workspace-border) 65%, transparent);
}
.settings-label { min-width: 0; }
.settings-label strong {
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
}
.settings-row > [data-role] { min-width: 0; }

.message-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  padding-block: var(--aimd-space-4);
}
.message-chip {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--aimd-size-control-action-panel);
  height: var(--aimd-size-control-action-panel);
  padding-inline: var(--aimd-space-2);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-lg);
  font-size: var(--aimd-text-sm);
  font-variant-numeric: tabular-nums;
  color: var(--aimd-text-secondary);
}
.message-chip[data-active="1"] {
  color: var(--aimd-interactive-primary);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 40%, var(--aimd-workspace-border));
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}
.message-chip:hover:not(:disabled) { background: var(--aimd-interactive-hover); }
.message-chip:disabled { cursor: not-allowed; opacity: var(--aimd-opacity-disabled); }
.message-chip:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
.button-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--aimd-space-1);
  padding-block: var(--aimd-space-2);
  margin-inline: calc(-1 * var(--aimd-space-2));
  border-top: 1px solid var(--aimd-border-subtle);
}

.settings-select-shell { position: relative; min-width: 0; width: 100%; }
.settings-select-shell[data-open="1"] { z-index: var(--aimd-z-tooltip); }
.settings-select-trigger {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  width: 100%;
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  font-size: var(--aimd-text-sm);
}
.settings-select-trigger__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.settings-select-trigger__caret { display: flex; flex: none; color: var(--aimd-text-secondary); }
.settings-select-trigger__caret svg,
.settings-option-check svg { width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); }
.settings-select-shell[data-open="1"] .settings-select-trigger__caret { transform: rotate(180deg); }
.settings-select-menu {
  display: none;
  position: absolute;
  inset: auto 0 auto auto;
  bottom: calc(100% + var(--aimd-space-2));
  min-width: 100%;
  width: max-content;
  max-width: min(320px, calc(100vw - var(--aimd-space-6)));
  padding: var(--aimd-space-2);
  gap: var(--aimd-space-1);
  z-index: var(--aimd-z-tooltip);
}
.settings-select-menu[data-open="1"] { display: grid; }
.settings-select-option {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}
.settings-select-option > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.settings-select-option:hover { background: var(--aimd-interactive-hover); }
.settings-select-option[data-selected="1"] {
  color: var(--aimd-interactive-primary);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
}
.settings-select-option:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: -2px; }
.settings-option-check { display: flex; flex: none; visibility: hidden; }
.settings-select-option[data-selected="1"] .settings-option-check { visibility: visible; }

/* This surface uses the flat Settings treatment; other dialogs keep their materials. */
:host .panel-window--save .settings-select-trigger,
:host .panel-window--save .secondary-btn,
:host .panel-window--save .settings-select-trigger:is(:hover, :active),
:host .panel-window--save .secondary-btn:is(:hover, :active) { box-shadow: none; }

.export-result { color: var(--aimd-text-secondary); }
.progress-panel,
.progress-row { display: grid; gap: var(--aimd-space-2); }
.progress-panel { gap: var(--aimd-space-3); }
.progress-label { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); }
.progress-track {
  position: relative;
  height: var(--aimd-space-1);
  overflow: hidden;
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-workspace-border);
}
.progress-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--aimd-interactive-primary); }
.panel-window--save > .panel-footer { justify-content: flex-end; padding: var(--aimd-space-4) var(--aimd-space-6); }
.footer-cluster { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: var(--aimd-space-3); min-width: 0; }
.secondary-btn--primary {
  min-height: var(--aimd-size-control-action-panel);
  min-width: calc(var(--aimd-size-control-action-panel) * 2);
  padding-inline: var(--aimd-space-5);
  font-size: var(--aimd-text-sm);
}
.counter { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (max-width: 560px) {
  .panel-window--save { width: calc(100vw - var(--aimd-space-4)); max-height: calc(100vh - var(--aimd-space-4)); }
  .panel-window--save > .panel-header,
  .panel-window--save > .panel-footer,
  .panel-window--save .dialog-body { padding: var(--aimd-space-4); }
  .settings-card { padding-inline: var(--aimd-space-3); }
  .settings-row { grid-template-columns: minmax(0, 1fr); gap: var(--aimd-space-2); }
}
${getSurfaceMaterialCss()}
`;
}
