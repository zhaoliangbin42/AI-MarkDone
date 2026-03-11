import type { Theme } from '../../../core/types/theme';

export function getSaveMessagesDialogCss(_theme: Theme): string {
    // Theme is handled via `getTokenCss(theme)` injected by the caller.
    return `
:host {
  font-family: var(--aimd-font-family-sans);
  --aimd-dlg-surface: var(--aimd-bg-primary);
  --aimd-dlg-text: var(--aimd-text-primary);
  --aimd-dlg-muted: var(--aimd-text-secondary);
  --aimd-dlg-outline: color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  --aimd-dlg-hover: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent);
  --aimd-dlg-pressed: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent);
  --aimd-dlg-focus: color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  --aimd-dlg-primary: var(--aimd-interactive-primary);
  --aimd-dlg-primary-hover: var(--aimd-interactive-primary-hover);
  --aimd-dlg-on-primary: var(--aimd-text-on-primary);
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

/* Overlay */
.overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-overlay-bg);
  z-index: var(--aimd-z-panel);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Panel */
.panel {
  width: min(560px, calc(100vw - 32px));
  max-height: min(82vh, 720px);
  background: var(--aimd-dlg-surface);
  color: var(--aimd-dlg-text);
  border: 1px solid var(--aimd-dlg-outline);
  border-radius: 16px;
  box-shadow: var(--aimd-shadow-panel);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 12px 14px;
  border-bottom: 1px solid var(--aimd-dlg-outline);
}
.title {
  font-size: var(--aimd-font-size-sm);
  font-weight: 650;
  letter-spacing: 0.2px;
}
.icon {
  all: unset;
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: color-mix(in srgb, var(--aimd-dlg-text) 82%, transparent);
}
.icon svg { width: 18px; height: 18px; display: block; }
.icon:hover { background: var(--aimd-dlg-hover); }
.icon:active { background: var(--aimd-dlg-pressed); }
.icon:focus-visible { outline: 2px solid var(--aimd-dlg-focus); outline-offset: 2px; }

/* Body */
.body {
  flex: 1;
  overflow: auto;
  padding: 14px;
  display: grid;
  gap: 14px;
}

.section { display: grid; gap: 8px; }
.label {
  font-size: var(--aimd-font-size-xs);
  font-weight: 600;
  color: var(--aimd-dlg-muted);
}

/* Grid selector */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.msg-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  min-width: 36px;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--aimd-dlg-outline);
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--aimd-dlg-text);
  background: transparent;
}
.msg-btn:hover { background: var(--aimd-dlg-hover); border-color: color-mix(in srgb, var(--aimd-dlg-outline) 70%, var(--aimd-dlg-primary) 30%); }
.msg-btn[data-selected="1"] {
  background: var(--aimd-dlg-primary);
  border-color: transparent;
  color: var(--aimd-dlg-on-primary);
}
.msg-btn[data-selected="1"]:hover { background: var(--aimd-dlg-primary-hover); }
.msg-btn:focus-visible { outline: 2px solid var(--aimd-dlg-focus); outline-offset: 2px; }

/* Format segmented */
.seg {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border: 1px solid var(--aimd-dlg-outline);
  border-radius: 12px;
  overflow: hidden;
}
.seg-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--aimd-dlg-muted);
  border-right: 1px solid var(--aimd-dlg-outline);
}
.seg-btn:last-child { border-right: none; }
.seg-btn svg { width: 16px; height: 16px; }
.seg-btn:hover { background: var(--aimd-dlg-hover); color: var(--aimd-dlg-text); }
.seg-btn[data-active="1"] {
  background: var(--aimd-dlg-primary);
  color: var(--aimd-dlg-on-primary);
}
.seg-btn[data-active="1"]:hover { background: var(--aimd-dlg-primary-hover); }
.seg-btn:focus-visible { outline: 2px solid var(--aimd-dlg-focus); outline-offset: -2px; }

/* Footer */
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 12px 14px;
  border-top: 1px solid var(--aimd-dlg-outline);
}
.left-actions { display: flex; gap: 8px; }
.btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--aimd-dlg-outline);
  background: transparent;
  color: var(--aimd-dlg-text);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn:hover { background: var(--aimd-dlg-hover); }
.btn:active { background: var(--aimd-dlg-pressed); }
.btn:focus-visible { outline: 2px solid var(--aimd-dlg-focus); outline-offset: 2px; }
.btn[disabled] { opacity: 0.55; cursor: not-allowed; }

.btn--primary {
  background: var(--aimd-dlg-primary);
  border-color: transparent;
  color: var(--aimd-dlg-on-primary);
  font-weight: 650;
}
.btn--primary:hover { background: var(--aimd-dlg-primary-hover); }
.count { font-size: 12px; color: var(--aimd-dlg-muted); white-space: nowrap; }
`;
}
