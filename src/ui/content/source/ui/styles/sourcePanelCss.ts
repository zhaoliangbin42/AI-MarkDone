import { getPanelChromeCss } from '../../../components/styles/panelChromeCss';

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

${getPanelChromeCss()}

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window--source {
  width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-6)));
  height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-6)));
  max-height: calc(100vh - var(--aimd-space-6));
}

.panel-header__meta,
.panel-header__meta--reader {
  display: flex;
  align-items: center;
  min-width: 0;
}

.panel-header__meta h2 {
  font-size: var(--aimd-text-2xl);
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
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

  .source-body {
    padding: var(--aimd-space-4);
  }
}
`;
}
