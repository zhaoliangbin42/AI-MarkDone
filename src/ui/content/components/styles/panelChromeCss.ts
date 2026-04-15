import { getSharedBackdropMotionCss } from './sharedBackdropMotionCss';
import { getPanelMotionCss } from './panelMotionCss';

export function getPanelChromeCss(): string {
    return `
${getSharedBackdropMotionCss()}
${getPanelMotionCss()}
.panel-window {
  position: fixed;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-header-gap);
  min-height: var(--aimd-panel-header-height);
  padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);
  border-bottom: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-primary);
}

.panel-header__meta {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-header-gap);
  min-width: 0;
}

.panel-header__actions {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-action-gap);
}

.panel-header__title,
.panel-header__meta h2,
.aimd-panel-title {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-panel-title-size);
  font-weight: var(--aimd-panel-title-weight);
  color: var(--aimd-text-primary);
  line-height: var(--aimd-panel-title-line-height);
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: var(--aimd-panel-footer-gap);
  min-height: var(--aimd-panel-footer-min-height);
  padding: var(--aimd-panel-footer-padding-block) var(--aimd-panel-footer-padding-inline);
  border-top: 1px solid var(--aimd-border-default);
}

.panel-footer--between {
  justify-content: space-between;
}

.panel-icon-btn,
.icon-btn,
.panel-nav-btn,
.nav-btn,
.panel-secondary-btn,
.secondary-btn {
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out),
    transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.panel-icon-btn,
.icon-btn,
.panel-nav-btn,
.nav-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--aimd-radius-full);
  border: 1px solid transparent;
  background: transparent;
}

.panel-icon-btn,
.icon-btn {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  color: var(--aimd-button-icon-text);
}

.panel-nav-btn,
.nav-btn {
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
  color: var(--aimd-button-icon-text);
}

.panel-icon-btn:hover,
.icon-btn:hover,
.panel-nav-btn:hover,
.nav-btn:hover {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.panel-icon-btn:active,
.icon-btn:active,
.panel-nav-btn:active,
.nav-btn:active {
  background: var(--aimd-button-icon-active);
  color: var(--aimd-button-icon-text-hover);
}

.panel-icon-btn:focus-visible,
.icon-btn:focus-visible,
.panel-nav-btn:focus-visible,
.nav-btn:focus-visible,
.panel-secondary-btn:focus-visible,
.secondary-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.panel-icon-btn:disabled,
.icon-btn:disabled,
.panel-nav-btn:disabled,
.nav-btn:disabled,
.panel-secondary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.panel-icon-btn .aimd-icon,
.panel-icon-btn .aimd-icon svg,
.icon-btn .aimd-icon,
.icon-btn .aimd-icon svg,
.panel-nav-btn .aimd-icon,
.panel-nav-btn .aimd-icon svg,
.nav-btn .aimd-icon,
.nav-btn .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}

.panel-secondary-btn,
.secondary-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-button-label-size);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
}

.panel-secondary-btn--compact,
.secondary-btn--compact {
  min-height: var(--aimd-size-control-compact);
  padding: 0 var(--aimd-space-2);
  font-size: var(--aimd-button-label-size-compact);
}

.panel-secondary-btn:hover,
.secondary-btn:hover {
  background: var(--aimd-button-secondary-hover);
}

.panel-secondary-btn:active,
.secondary-btn:active {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 78%, var(--aimd-button-icon-active));
}

.panel-secondary-btn--primary,
.secondary-btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
  font-weight: var(--aimd-font-semibold);
}

.panel-secondary-btn--primary:hover,
.secondary-btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.panel-secondary-btn--primary:active,
.secondary-btn--primary:active {
  background: var(--aimd-interactive-primary-hover);
}

.panel-secondary-btn--ghost,
.secondary-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--aimd-text-secondary);
}

.panel-secondary-btn--ghost:hover,
.secondary-btn--ghost:hover {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.panel-secondary-btn--ghost:active,
.secondary-btn--ghost:active {
  background: var(--aimd-button-icon-active);
}

.panel-secondary-btn--danger,
.secondary-btn--danger {
  color: var(--aimd-interactive-danger);
}

.panel-secondary-btn--danger:hover,
.secondary-btn--danger:hover {
  background: var(--aimd-feedback-danger-bg);
  border-color: color-mix(in srgb, var(--aimd-color-danger) 28%, var(--aimd-border-default));
  color: var(--aimd-interactive-danger);
}

.panel-secondary-btn--danger:active,
.secondary-btn--danger:active {
  background: color-mix(in srgb, var(--aimd-color-danger) 18%, transparent);
  border-color: color-mix(in srgb, var(--aimd-color-danger) 34%, var(--aimd-border-default));
}

@media (max-width: 900px) {
  .panel-header {
    min-height: var(--aimd-panel-header-height-compact);
    padding: var(--aimd-panel-header-padding-block-compact) var(--aimd-panel-header-padding-inline-compact);
  }

  .panel-footer {
    padding: var(--aimd-panel-footer-padding-block-compact) var(--aimd-panel-footer-padding-inline-compact);
  }
}
`;
}
