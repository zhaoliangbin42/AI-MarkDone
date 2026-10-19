export function getKeyboardSettingsCss(): string {
    return `
:host { display: block; min-width: 0; color-scheme: light; }
:host([hidden]), [hidden] { display: none; }
:host([data-aimd-theme="dark"]) { color-scheme: dark; }
.keyboard-settings { min-width: 0; color: var(--aimd-text-primary); font: var(--aimd-text-sm) var(--aimd-font-family-sans); }
.keyboard-settings h4 { margin: 0 0 var(--aimd-space-2); color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-medium); }
.keyboard-settings strong { font-weight: var(--aimd-font-medium); }
.keyboard-settings p { margin: 0; line-height: var(--aimd-leading-normal); }
.keyboard-settings button { cursor: pointer; font: inherit; }
.keyboard-settings button:disabled { cursor: default; opacity: var(--aimd-opacity-disabled); }
.keyboard-settings button:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
.keyboard-overview, .keyboard-overview-label { display: flex; align-items: center; gap: var(--aimd-space-3); }
.keyboard-overview { justify-content: space-between; flex-wrap: wrap; padding-bottom: var(--aimd-space-5); }
.keyboard-overview-label { min-width: 0; }
.keyboard-caption { font-size: var(--aimd-text-xs); color: var(--aimd-text-secondary); overflow-wrap: anywhere; }
.keyboard-section { margin-bottom: var(--aimd-space-5); }
.keyboard-list { min-width: 0; }
.keyboard-row + .keyboard-row { border-top: 1px solid var(--aimd-border-subtle); }
.keyboard-row-summary { min-height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-5)); display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--aimd-space-4); padding-block: var(--aimd-space-3); }
.keyboard-row-label { display: grid; min-width: 0; gap: var(--aimd-space-1); overflow-wrap: anywhere; }
.keyboard-row-actions { display: flex; align-items: center; gap: var(--aimd-space-2); }
.keyboard-binding { appearance: none; display: inline-flex; align-items: center; justify-content: flex-end; min-height: var(--aimd-size-control-icon-panel); border: 1px solid transparent; border-radius: var(--aimd-radius-md); padding: var(--aimd-space-1) var(--aimd-space-2); background: transparent; color: var(--aimd-text-primary); white-space: nowrap; }
.keyboard-binding:hover, .keyboard-text-button:hover { background: var(--aimd-interactive-hover); }
.keyboard-binding[data-unset="true"] { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); }
.keyboard-binding[data-off="true"] { opacity: var(--aimd-opacity-disabled); }
.keyboard-keys { display: inline-flex; align-items: center; justify-content: center; gap: var(--aimd-space-1); }
.keyboard-settings kbd { display: inline-flex; align-items: center; justify-content: center; min-width: var(--aimd-space-6); min-height: var(--aimd-space-6); padding: 0 var(--aimd-space-2); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-sm); background: var(--aimd-workspace-surface); font: var(--aimd-font-medium) var(--aimd-text-xs) var(--aimd-font-family-sans); line-height: var(--aimd-leading-normal); }
.keyboard-text-button { appearance: none; border: 0; background: transparent; color: var(--aimd-text-secondary); padding: var(--aimd-space-2); border-radius: var(--aimd-radius-md); font-size: var(--aimd-text-xs); white-space: nowrap; }
.keyboard-switch { appearance: none; flex: none; width: calc(var(--aimd-space-6) + var(--aimd-space-3)); height: calc(var(--aimd-space-5) + var(--aimd-space-1)); border: 1px solid var(--aimd-border-strong); border-radius: var(--aimd-radius-full); padding: var(--aimd-space-1); background: var(--aimd-bg-secondary); transition: background var(--aimd-duration-fast) var(--aimd-ease-out); }
.keyboard-switch::before { content: ''; display: block; width: calc(var(--aimd-space-4) - 2px); height: calc(var(--aimd-space-4) - 2px); border-radius: var(--aimd-radius-full); background: var(--aimd-text-secondary); transition: transform var(--aimd-duration-fast) var(--aimd-ease-out); }
.keyboard-switch[aria-checked="true"] { background: var(--aimd-interactive-primary); border-color: var(--aimd-interactive-primary); }
.keyboard-switch[aria-checked="true"]::before { transform: translateX(var(--aimd-space-3)); background: var(--aimd-text-on-primary); }
.keyboard-status-pill { color: var(--aimd-text-secondary); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-full); padding: var(--aimd-space-1) var(--aimd-space-2); font-size: var(--aimd-text-xs); font-weight: normal; white-space: nowrap; }
.keyboard-recorder, .keyboard-reset { margin-bottom: var(--aimd-space-4); padding: var(--aimd-space-4); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-lg); background: var(--aimd-workspace-surface); display: grid; gap: var(--aimd-space-3); animation: keyboard-enter var(--aimd-duration-fast) var(--aimd-ease-out); }
.keyboard-capture { display: flex; align-items: center; justify-content: center; min-height: calc(var(--aimd-space-6) * 3); border: 1px dashed var(--aimd-border-strong); border-radius: var(--aimd-radius-lg); background: var(--aimd-workspace-card); outline: 0; color: var(--aimd-text-secondary); }
.keyboard-capture:focus { border-style: solid; border-color: var(--aimd-focus-ring); box-shadow: var(--aimd-shadow-focus); }
.keyboard-capture kbd { font-size: var(--aimd-text-base); min-height: var(--aimd-size-control-icon-panel); min-width: var(--aimd-size-control-icon-panel); }
.keyboard-recorder-message { font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-normal); overflow-wrap: anywhere; }
.keyboard-recorder-message[data-level="conflict"], .keyboard-recorder-message[data-level="blocked"] { color: var(--aimd-color-danger); }
.keyboard-recorder-actions { display: flex; justify-content: flex-end; gap: var(--aimd-space-2); flex-wrap: wrap; }
.keyboard-primary { padding: var(--aimd-space-2) var(--aimd-space-4); border-radius: var(--aimd-radius-lg); background: var(--aimd-interactive-primary); color: var(--aimd-text-on-primary); border: 1px solid var(--aimd-interactive-primary); }
.keyboard-auto-row { display: flex; justify-content: space-between; align-items: center; gap: var(--aimd-space-4); padding-block: var(--aimd-space-3); }
.keyboard-auto-row > div { display: grid; gap: var(--aimd-space-1); }
.keyboard-notice { min-height: var(--aimd-space-5); margin-top: var(--aimd-space-2); }
@keyframes keyboard-enter { from { opacity: 0; transform: translateY(calc(-1 * var(--aimd-space-1))); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 560px) { .keyboard-row-summary { grid-template-columns: minmax(0,1fr); gap: var(--aimd-space-2); } .keyboard-row-actions { justify-content: space-between; flex-wrap: wrap; } .keyboard-binding { justify-content: flex-start; } .keyboard-recorder { padding: var(--aimd-space-3); } }
@media (prefers-reduced-motion: reduce) { .keyboard-recorder, .keyboard-reset { animation: none; } .keyboard-switch, .keyboard-switch::before { transition: none; } }
`;
}

export function getKeyboardSettingsTabsCss(): string {
    return `
.settings-controls { min-width: 0; }
.settings-controls-tabs { display: flex; gap: var(--aimd-space-5); margin-bottom: var(--aimd-space-5); border-bottom: 1px solid var(--aimd-workspace-border); }
.settings-controls-tabs button { padding: var(--aimd-space-2) 0 var(--aimd-space-3); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--aimd-text-secondary); font: inherit; cursor: pointer; }
.settings-controls-tabs button[aria-selected="true"] { color: var(--aimd-interactive-primary); border-color: var(--aimd-interactive-primary); }
.settings-controls-tabs button:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
.settings-controls > [hidden] { display: none; }
`;
}
