import { getInputFieldCss } from '../../../components/styles/inputFieldCss';
import { getSurfaceMaterialCss } from '../../../components/styles/surfaceMaterialCss';
import { getFlatWorkflowCss } from '../../../components/styles/flatWorkflowCss';

export function getSendPopoverCss(): string {
    return `
${getInputFieldCss()}
.send-popover {
  --_send-popover-arrow-size: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  --_send-popover-offset: calc(var(--aimd-space-2) + var(--aimd-space-1) / 2);
  position: absolute;
  left: 0;
  bottom: calc(100% + var(--_send-popover-offset));
  padding: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-3);
  min-width: 0;
  min-height: 0;
  max-width: min(680px, calc(100vw - var(--aimd-space-4)));
  max-height: min(520px, calc(100vh - var(--aimd-space-4) * 2));
  overflow: hidden;
  z-index: var(--aimd-z-tooltip);
  color: var(--aimd-text-primary);
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
  flex: 0 0 auto;
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
  padding-right: calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
}

.send-popover__input {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--aimd-space-3) calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  font-size: var(--aimd-text-sm);
  line-height: 1.45;
  outline: none;
  overflow: auto;
  resize: none;
}

.send-popover__foot {
  flex: 0 0 auto;
  justify-content: flex-end;
  align-items: flex-end;
  flex-wrap: wrap;
  row-gap: calc(var(--aimd-space-2) + var(--aimd-space-1) / 2);
  column-gap: var(--aimd-space-3);
  margin-top: auto;
}

@media (max-width: 560px), (max-height: 568px) {
  .send-popover {
    padding: var(--aimd-space-3);
    gap: var(--aimd-space-2);
  }

  .send-popover__foot .button-row {
    flex-wrap: nowrap;
  }
}

.send-popover__foot .status-line {
  flex: 1 1 100%;
  min-height: 18px;
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.send-popover__foot .status-line:empty {
  display: none;
}

.send-popover__foot .status-line[data-tone="error"] {
  color: var(--aimd-interactive-danger);
}

.send-popover__foot .button-row {
  flex: 0 0 auto;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--aimd-space-3);
  margin-inline-start: auto;
}

.send-popover :where(.icon-btn, .studio-btn) {
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
  flex: 0 0 auto;
}

.send-popover .icon-btn:focus-visible,
.send-popover .studio-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.send-popover .studio-btn {
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 calc(var(--aimd-space-3) + var(--aimd-space-1) / 2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-text-sm);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
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
  top: var(--aimd-space-2);
  right: var(--aimd-space-2);
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  cursor: nesw-resize;
  color: color-mix(in srgb, var(--aimd-text-secondary) 88%, transparent);
  z-index: calc(var(--aimd-z-base) + 1);
  transition: none;
}

.send-popover__resize-grip {
  position: relative;
  display: block;
  width: calc(var(--_send-popover-arrow-size) - var(--aimd-space-1));
  height: calc(var(--_send-popover-arrow-size) - var(--aimd-space-1));
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
${getSurfaceMaterialCss()}
${getFlatWorkflowCss()}
`;
}
