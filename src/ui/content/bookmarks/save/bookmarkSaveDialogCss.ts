import type { Theme } from '../../../../core/types/theme';

export function getBookmarkSaveDialogCss(theme: Theme): string {
    const isDark = theme === 'dark';

    return `
:host {
  font-family: var(--aimd-font-family-sans);
}

* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; color: inherit; }

.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--aimd-space-4) * 2);
  background: color-mix(in srgb, #000 42%, transparent);
}

.panel {
  width: min(640px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 24px));
  display: flex;
  flex-direction: column;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 16px;
  box-shadow: 0 18px 56px color-mix(in srgb, #000 36%, transparent);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--aimd-space-4) * 2) calc(var(--aimd-space-4) * 2);
  border-bottom: 1px solid var(--aimd-border-default);
}

.title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon:hover { background: ${isDark ? 'color-mix(in srgb, #fff 10%, transparent)' : 'color-mix(in srgb, #000 6%, transparent)'}; }
.icon:active { background: ${isDark ? 'color-mix(in srgb, #fff 16%, transparent)' : 'color-mix(in srgb, #000 10%, transparent)'}; }
.icon:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon svg { width: 18px; height: 18px; }

.icon.icon-sm {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}
.icon.icon-sm svg { width: 16px; height: 16px; }

.body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--aimd-space-4) * 2);
  padding: calc(var(--aimd-space-4) * 2);
  overflow: auto;
  overscroll-behavior: contain;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-2);
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--aimd-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--aimd-border-default);
  background: ${isDark ? 'color-mix(in srgb, #fff 6%, transparent)' : 'color-mix(in srgb, #000 3.5%, transparent)'};
  color: var(--aimd-text-primary);
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}
.input:focus { border-color: color-mix(in srgb, var(--aimd-interactive-primary) 65%, var(--aimd-border-default)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 18%, transparent); }
.input[aria-invalid="true"] { border-color: color-mix(in srgb, #d93025 65%, var(--aimd-border-default)); box-shadow: 0 0 0 3px color-mix(in srgb, #d93025 16%, transparent); }

.input.input-compact {
  padding: 8px 10px;
  font-size: 13px;
  border-radius: 10px;
}

.error {
  font-size: 12px;
  color: ${isDark ? 'color-mix(in srgb, #ff8a80 70%, #fff)' : '#d93025'};
}

.folders-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
}

.folders-actions {
  display: inline-flex;
  gap: var(--aimd-space-2);
}

.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  background: transparent;
  color: var(--aimd-text-primary);
  font-size: 13px;
  cursor: pointer;
}
.btn:hover { background: ${isDark ? 'color-mix(in srgb, #fff 10%, transparent)' : 'color-mix(in srgb, #000 6%, transparent)'}; }
.btn:active { background: ${isDark ? 'color-mix(in srgb, #fff 16%, transparent)' : 'color-mix(in srgb, #000 10%, transparent)'}; }
.btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.btn[disabled] { opacity: 0.55; cursor: not-allowed; }

.btn-primary {
  border-color: transparent;
  background: var(--aimd-interactive-primary);
  color: white;
}
.btn-primary:hover { filter: brightness(1.03); }
.btn-primary:active { filter: brightness(0.98); }

.tree {
  border: 1px solid var(--aimd-border-default);
  border-radius: 12px;
  background: ${isDark ? 'color-mix(in srgb, #fff 4%, transparent)' : 'color-mix(in srgb, #000 2%, transparent)'};
  overflow: auto;
  max-height: 320px;
  overscroll-behavior: contain;
}

.hint {
  margin-top: var(--aimd-space-2);
  font-size: 12px;
  color: var(--aimd-text-secondary);
}

.empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--aimd-text-secondary);
  font-size: 13px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 6px 10px;
  padding-right: 78px; /* reserve space for hover actions + check (no layout shift) */
  cursor: pointer;
  user-select: none;
  position: relative;
}
.row:hover { background: ${isDark ? 'color-mix(in srgb, #fff 8%, transparent)' : 'color-mix(in srgb, #000 4.5%, transparent)'}; }
.row[data-selected="1"] { background: color-mix(in srgb, var(--aimd-interactive-primary) 16%, transparent); }

.caret {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.caret:hover { background: ${isDark ? 'color-mix(in srgb, #fff 10%, transparent)' : 'color-mix(in srgb, #000 6%, transparent)'}; }
.caret svg { width: 14px; height: 14px; }

.folder-icon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--aimd-text-secondary); }
.folder-icon svg { width: 16px; height: 16px; }

.name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--aimd-text-primary);
}

.row-actions {
  display: inline-flex;
  gap: var(--aimd-space-1);
  align-items: center;
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
}
.row:hover .row-actions,
.row:focus-within .row-actions,
.row[data-selected="1"] .row-actions { opacity: 1; pointer-events: auto; }

.check {
  color: var(--aimd-interactive-primary);
  font-weight: 700;
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.check svg { width: 16px; height: 16px; }

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: calc(var(--aimd-space-4) * 2);
  border-top: 1px solid var(--aimd-border-default);
}

.status {
  font-size: 12px;
  color: var(--aimd-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
  min-width: 0;
}

.footer-actions {
  display: inline-flex;
  gap: var(--aimd-space-2);
  flex: 0 0 auto;
}

.inline-wrap {
  padding: 6px 10px;
}

.inline-editor {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: 0;
  height: 36px;
}

.inline-message {
  font-size: 12px;
  color: var(--aimd-text-secondary);
  margin-top: 4px;
}
.inline-message[data-kind="error"] {
  color: ${isDark ? 'color-mix(in srgb, #ff8a80 70%, #fff)' : '#d93025'};
}

/* Root-folder modal layer (within the dialog shadow) */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--aimd-space-4) * 2);
  background: color-mix(in srgb, #000 55%, transparent);
}

.modal {
  width: min(420px, calc(100vw - 48px));
  background: var(--aimd-bg-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 14px;
  box-shadow: 0 18px 56px color-mix(in srgb, #000 44%, transparent);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--aimd-border-default);
}

.modal-title {
  font-size: 13px;
  font-weight: 600;
}

.modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-2);
}

.modal-actions {
  padding: 12px 16px 16px 16px;
  display: flex;
  gap: var(--aimd-space-2);
  justify-content: flex-end;
}
`;
}
