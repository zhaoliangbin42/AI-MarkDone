import { getInputFieldCss } from './inputFieldCss';
import { getSharedBackdropMotionCss } from './sharedBackdropMotionCss';
import { getModalMotionCss } from './modalMotionCss';

export function getModalHostShellCss(): string {
    return `
${getInputFieldCss()}
.mock-modal-host {
  position: fixed;
  inset: 0;
  z-index: var(--aimd-z-tooltip);
  pointer-events: none;
}

.mock-modal-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--aimd-space-5);
  background: color-mix(in srgb, var(--aimd-overlay-bg) 48%, transparent);
  backdrop-filter: var(--aimd-overlay-backdrop);
  -webkit-backdrop-filter: var(--aimd-overlay-backdrop);
  pointer-events: auto;
}

.mock-modal {
  --_modal-accent: var(--aimd-interactive-primary);
  --_modal-accent-soft: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  --_modal-accent-border: color-mix(in srgb, var(--aimd-interactive-primary) 24%, var(--aimd-border-default));
  width: min(520px, calc(100% - 40px));
  max-width: min(520px, calc(100% - 40px));
  max-height: min(680px, calc(100% - 40px));
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent);
  box-shadow: var(--aimd-shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mock-modal[data-kind="info"] {
  --_modal-accent: var(--aimd-interactive-primary);
  --_modal-accent-soft: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  --_modal-accent-border: color-mix(in srgb, var(--aimd-state-info-border) 72%, transparent);
}

.mock-modal[data-kind="warning"] {
  --_modal-accent: var(--aimd-color-warning);
  --_modal-accent-soft: color-mix(in srgb, var(--aimd-color-warning) 14%, transparent);
  --_modal-accent-border: color-mix(in srgb, var(--aimd-color-warning) 26%, var(--aimd-border-default));
}

.mock-modal[data-kind="error"] {
  --_modal-accent: var(--aimd-state-error-border);
  --_modal-accent-soft: color-mix(in srgb, var(--aimd-state-error-border) 14%, transparent);
  --_modal-accent-border: color-mix(in srgb, var(--aimd-state-error-border) 32%, var(--aimd-border-default));
}

.mock-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-header-gap);
  padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 90%, transparent);
}

.mock-modal__title-wrap,
.mock-modal__title-copy,
.mock-modal__kind-icon,
.mock-modal__footer {
  display: flex;
}

.mock-modal__title-wrap {
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.mock-modal__title-copy {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.mock-modal__title-copy strong {
  font-size: var(--aimd-modal-title-size);
  font-weight: var(--aimd-modal-title-weight);
  line-height: var(--aimd-panel-title-line-height);
  color: var(--_modal-accent);
}

.mock-modal__kind-icon {
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--aimd-radius-lg);
  color: var(--_modal-accent);
  background: var(--_modal-accent-soft);
  border: 1px solid var(--_modal-accent-border);
  flex: 0 0 auto;
}

.mock-modal__kind-icon .aimd-icon,
.mock-modal__kind-icon .aimd-icon svg,
.mock-modal__close .aimd-icon,
.mock-modal__close .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}

.mock-modal__close,
.mock-modal__button {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
}

.mock-modal__close {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-button-icon-text);
  border: 1px solid transparent;
  flex: 0 0 auto;
}

.mock-modal__close:hover {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.mock-modal__close:active {
  background: var(--aimd-button-icon-active);
  color: var(--aimd-button-icon-text-hover);
}

.mock-modal__button--secondary:hover {
  background: var(--aimd-button-secondary-hover);
}

.mock-modal__button--secondary:active {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 78%, var(--aimd-button-icon-active));
}

.mock-modal__content {
  display: grid;
  gap: 14px;
  padding: 20px;
  overflow: auto;
  min-height: 0;
}

.mock-modal__message {
  margin: 0;
  white-space: pre-wrap;
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
  color: var(--aimd-text-secondary);
}

.merge-section {
  display: grid;
  gap: 14px;
  padding: 14px;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 56%, transparent);
}

.merge-section__heading {
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.merge-summary,
.merge-entry__top {
  display: flex;
  align-items: center;
}

.merge-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.merge-summary-item {
  min-width: 0;
  padding: 12px 14px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, transparent);
  display: grid;
  gap: 4px;
}

.merge-summary-item__label,
.merge-entry p {
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.5;
  color: var(--aimd-text-secondary);
}

.merge-summary-item strong,
.merge-entry__top strong {
  font-size: var(--aimd-text-base);
  line-height: 1.35;
  color: var(--aimd-text-primary);
}

.merge-entry-list {
  display: grid;
  gap: 10px;
}

.merge-entry {
  padding: 14px 16px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  display: grid;
  gap: 8px;
}

.merge-entry__top {
  justify-content: space-between;
  gap: 12px;
}

.merge-entry-status {
  padding: 2px 8px;
  border-radius: var(--aimd-radius-full);
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-secondary);
}

.merge-entry-status[data-status="duplicate"] {
  color: var(--aimd-color-warning);
  border-color: color-mix(in srgb, var(--aimd-color-warning) 26%, transparent);
  background: color-mix(in srgb, var(--aimd-color-warning) 10%, transparent);
}

.merge-entry-status[data-status="rename"] {
  color: var(--aimd-interactive-primary);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 22%, transparent);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}

.merge-entry-status[data-status="import"] {
  color: var(--aimd-state-success-text);
  border-color: color-mix(in srgb, var(--aimd-state-success-border) 22%, transparent);
  background: color-mix(in srgb, var(--aimd-state-success-border) 10%, transparent);
}

@media (max-width: 560px) {
  .merge-summary {
    grid-template-columns: 1fr;
  }
}

.mock-modal__input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  outline: none;
}

.mock-modal__error {
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-color-danger);
}

.mock-modal__footer {
  justify-content: flex-end;
  gap: var(--aimd-panel-footer-gap);
  padding: var(--aimd-panel-footer-padding-block) var(--aimd-panel-footer-padding-inline);
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 86%, transparent);
}

.mock-modal__button {
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 16px;
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--aimd-text-sm);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
}

.mock-modal__button--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}

.mock-modal__button--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.mock-modal__button--primary:active {
  background: var(--aimd-interactive-primary-hover);
}

.mock-modal__button--danger {
  border-color: color-mix(in srgb, var(--aimd-color-danger) 34%, transparent);
  color: var(--aimd-color-danger);
}

.mock-modal__button--danger:hover {
  background: var(--aimd-feedback-danger-bg);
}

.mock-modal__button--danger:active {
  background: color-mix(in srgb, var(--aimd-color-danger) 16%, transparent);
}

.mock-modal__close:focus-visible,
.mock-modal__button:focus-visible,
.mock-modal__input:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
`;
}

export function getModalHostCss(): string {
    return `
${getSharedBackdropMotionCss()}
${getModalMotionCss()}
${getModalHostShellCss()}
`;
}
