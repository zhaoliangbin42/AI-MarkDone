import type { Theme } from '../../../core/types/theme';
import { getPanelChromeCss } from '../components/styles/panelChromeCss';

export function getSaveMessagesDialogCss(_theme: Theme): string {
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

${getPanelChromeCss()}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window--dialog {
  width: min(600px, calc(100vw - var(--aimd-space-6)));
}

.panel-window--save {
  width: min(600px, calc(100vw - var(--aimd-space-6)));
  max-height: min(82vh, 720px);
}

.panel-header__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.panel-header__meta h2 {
  font-size: var(--aimd-text-2xl);
  font-weight: var(--aimd-font-semibold);
}

.icon-btn:focus-visible,
.secondary-btn:focus-visible,
.segmented button:focus-visible,
.message-chip:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.dialog-body {
  flex: 1;
  overflow: auto;
  padding: 22px;
}

.section-label {
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.message-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--aimd-space-2);
  margin-bottom: var(--aimd-space-5);
}

.message-chip {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  min-width: 36px;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--aimd-radius-md);
  border: 1px solid var(--aimd-border-default);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--aimd-text-xs);
  color: var(--aimd-text-primary);
  background: transparent;
}

.message-chip:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);
}

.message-chip[data-active="1"] {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}

.message-chip[data-active="1"]:hover {
  background: var(--aimd-interactive-primary-hover);
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  overflow: hidden;
}

.segmented button {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-4);
  font-size: var(--aimd-text-sm);
  color: var(--aimd-text-secondary);
  border-right: 1px solid var(--aimd-border-default);
}

.segmented button:last-child {
  border-right: none;
}

.segmented button:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);
  color: var(--aimd-text-primary);
}

.segmented button[data-active="1"] {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.segmented button[data-active="1"]:hover {
  background: var(--aimd-interactive-primary-hover);
}

.segmented .aimd-icon,
.segmented .aimd-icon svg {
  width: 16px;
  height: 16px;
}

.panel-footer--between {
  justify-content: space-between;
}

.button-row,
.footer-cluster {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
}

.secondary-btn--primary {
  font-weight: var(--aimd-font-semibold);
}

.counter {
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .panel-window--dialog,
  .panel-window--save {
    width: min(600px, calc(100vw - var(--aimd-space-4)));
    max-height: calc(100vh - var(--aimd-space-4));
  }

  .dialog-body {
    padding: var(--aimd-space-4);
  }

  .panel-footer--between {
    flex-direction: column;
    align-items: stretch;
  }

  .button-row,
  .footer-cluster {
    justify-content: space-between;
  }
}
`;
}
