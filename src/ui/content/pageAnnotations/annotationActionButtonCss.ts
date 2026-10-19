/** Shared action-button appearance for selection and composer annotations. */
export function getAnnotationActionButtonCss(): string {
    return `
.annotation-action-button {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-1);
  min-width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
  background: transparent;
  color: var(--aimd-text-secondary);
  cursor: pointer;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.annotation-action-button:hover:not(:disabled) {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}

.annotation-action-button:active:not(:disabled) {
  background: var(--aimd-button-icon-active);
}

.annotation-action-button:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.annotation-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.annotation-action-button .aimd-icon,
.annotation-action-button .aimd-icon svg {
  display: block;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  color: currentColor;
}

.annotation-action-button--composer {
  padding: 0 var(--aimd-space-2);
  border-color: var(--aimd-workspace-border);
  background: var(--aimd-workspace-card);
  box-shadow: none;
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .annotation-action-button { transition: none; }
}
`;
}
