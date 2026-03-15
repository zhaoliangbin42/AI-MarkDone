export function getSourcePanelCss(): string {
    return `
:host {
  font-family: var(--aimd-font-family-sans);
}

*, *::before, *::after {
  box-sizing: border-box;
}

button, input, select, textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-6)));
  height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-6)));
  max-height: calc(100vh - var(--aimd-space-6));
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-window--source {
  width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-6)));
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: 72px;
  padding: var(--aimd-space-4) var(--aimd-space-5);
  border-bottom: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-primary);
}

.panel-header__meta,
.panel-header__meta--reader {
  display: flex;
  align-items: center;
  min-width: 0;
}

.panel-header__meta h2 {
  margin: 0;
  font-size: var(--aimd-text-2xl);
  line-height: 1.1;
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
}

.panel-header__actions {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
}

.icon-btn {
  all: unset;
  box-sizing: border-box;
  width: 42px;
  height: 42px;
  border-radius: var(--aimd-radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--aimd-text-primary);
  border: 1px solid transparent;
}

.icon-btn:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);
}

.icon-btn:active {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 92%, var(--aimd-interactive-hover));
}

.icon-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.icon-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-btn .aimd-icon,
.icon-btn .aimd-icon svg {
  width: 18px;
  height: 18px;
}

.source-body {
  flex: 1;
  min-height: 0;
  padding: var(--aimd-space-5);
  overflow: auto;
}

.source-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  line-height: 1.7;
  color: var(--aimd-text-primary);
}

@media (max-width: 900px) {
  .panel-window,
  .panel-window--source {
    width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-4)));
    height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-4)));
    max-height: calc(100vh - var(--aimd-space-4));
  }

  .panel-header {
    padding: var(--aimd-space-4);
    min-height: 64px;
  }

  .source-body {
    padding: var(--aimd-space-4);
  }
}
`;
}
