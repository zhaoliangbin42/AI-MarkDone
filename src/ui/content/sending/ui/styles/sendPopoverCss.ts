import { getInputFieldCss } from '../../../components/styles/inputFieldCss';

export function getSendPopoverCss(): string {
    return `
${getInputFieldCss()}
.send-popover {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  padding: 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
  min-height: 220px;
  max-width: min(680px, calc(100vw - 80px));
  max-height: min(520px, calc(100vh - 120px));
  overflow: hidden;
  z-index: var(--aimd-z-tooltip);
  color: var(--aimd-text-primary);
}

.send-popover::after {
  content: '';
  position: absolute;
  left: 18px;
  bottom: -7px;
  width: 14px;
  height: 14px;
  transform: rotate(45deg);
  background: inherit;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
}

.send-popover__head,
.send-popover__foot,
.send-popover__head-actions,
.send-popover__foot .button-row {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-footer-gap);
}

.send-popover__head {
  justify-content: space-between;
}

.send-popover__head strong {
  font-size: var(--aimd-panel-title-size-compact);
  line-height: var(--aimd-panel-title-line-height);
  font-weight: var(--aimd-panel-title-weight);
}

.send-popover__head-actions {
  gap: var(--aimd-panel-action-gap);
  margin-left: auto;
  padding-right: 14px;
}

.send-popover__input {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.45;
  outline: none;
  overflow: auto;
  resize: none;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 72%, transparent);
}

.send-popover__input::placeholder {
  color: var(--aimd-text-secondary);
}

.send-popover__input:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 36%, var(--aimd-border-default));
}

.send-popover__foot {
  flex: 0 0 auto;
  justify-content: flex-end;
  align-items: flex-end;
  flex-wrap: wrap;
  row-gap: 10px;
  column-gap: var(--aimd-space-3);
  margin-top: auto;
}

.send-popover__foot .status-line {
  flex: 1 1 100%;
  min-height: 18px;
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.send-popover__foot .button-row {
  flex: 0 0 auto;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--aimd-space-3);
  margin-inline-start: auto;
}

.send-popover .icon-btn,
.send-popover .studio-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
}

.send-popover .icon-btn {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid transparent;
  color: var(--aimd-text-secondary);
  background: transparent;
  flex: 0 0 auto;
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    transform var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.send-popover .icon-btn:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 32%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 90%, var(--aimd-sys-color-surface-hover));
  color: var(--aimd-button-icon-text-hover);
}

.send-popover .icon-btn:focus-visible,
.send-popover .studio-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.send-popover .studio-btn {
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  font-size: var(--aimd-text-sm);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
}

.send-popover .studio-btn:hover,
.send-popover .send-popover__input:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 32%, var(--aimd-border-default));
}

.send-popover .studio-btn:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-sys-color-surface-hover));
}

.send-popover .studio-btn:active {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 78%, var(--aimd-button-icon-active));
}

.send-popover .studio-btn--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}

.send-popover .studio-btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.send-popover .studio-btn--primary:active {
  background: var(--aimd-interactive-primary-hover);
}

.send-popover .studio-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--aimd-text-secondary);
}

.send-popover .studio-btn--ghost:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 90%, var(--aimd-sys-color-surface-hover));
  color: var(--aimd-button-icon-text-hover);
}

.send-popover .studio-btn[disabled],
.send-popover .icon-btn[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.send-popover .aimd-icon,
.send-popover .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.send-popover__resize-handle,
.send-popover__resize-handle:hover,
.send-popover__resize-handle:focus-visible,
.send-popover__resize-handle:active {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  cursor: nesw-resize;
  color: color-mix(in srgb, var(--aimd-text-secondary) 88%, transparent);
  z-index: 2;
  transition: none;
}

.send-popover__resize-grip {
  position: relative;
  display: block;
  width: 10px;
  height: 10px;
  transform: rotate(-90deg);
  opacity: 0.96;
}

.send-popover__resize-grip::before,
.send-popover__resize-grip::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, transparent 0 40%, currentColor 40% 48%, transparent 48% 60%, currentColor 60% 68%, transparent 68% 80%, currentColor 80% 88%, transparent 88% 100%);
}
`;
}
