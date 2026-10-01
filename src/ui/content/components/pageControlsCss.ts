/** Shared page-control appearance for side-effect-free settings previews. */
export function getChatGPTPageControlsCss(): string { return `.aimd-chatgpt-message-stepper {
  --_page-control-size: var(--aimd-size-control-icon-toolbar);
  --_page-control-gap: calc(var(--aimd-space-1) / 2);
  --_page-control-glyph: calc(var(--aimd-size-control-glyph-panel) + var(--aimd-space-1) / 2);
  position: fixed;
  right: var(--aimd-space-2);
  bottom: calc(var(--aimd-space-3) / 2);
  z-index: var(--aimd-z-panel);
  display: inline-flex;
  align-items: center;
  padding: calc(var(--aimd-space-1) / 4);
  max-width: calc(100vw - var(--aimd-space-2) * 2);
  box-sizing: border-box;
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-workspace-border);
  background: color-mix(in srgb, var(--aimd-bg-surface) 78%, transparent);
  box-shadow: var(--aimd-workspace-raised);
  -webkit-backdrop-filter: blur(var(--aimd-space-4)) saturate(1.5);
  backdrop-filter: blur(var(--aimd-space-4)) saturate(1.5);
  pointer-events: auto;
  font-family: var(--aimd-font-family-sans);
}
.aimd-chatgpt-message-stepper__actions {
  order: 1;
  display: flex;
  align-items: center;
  gap: var(--_page-control-gap);
  max-width: 0;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  transform: translateX(var(--aimd-space-3));
  transition: max-width calc(var(--aimd-duration-base) * 2) var(--aimd-ease-out),
    opacity var(--aimd-duration-base) var(--aimd-ease-out),
    transform calc(var(--aimd-duration-base) * 2) var(--aimd-ease-out),
    visibility var(--aimd-duration-base);
}
.aimd-chatgpt-message-stepper[data-expanded="1"] .aimd-chatgpt-message-stepper__actions,
.aimd-chatgpt-message-stepper[data-has-pins="1"] .aimd-chatgpt-message-stepper__actions {
  max-width: calc(var(--_page-control-size) * 5 + var(--_page-control-gap) * 4);
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
  overflow-x: auto;
  scrollbar-width: none;
}
.aimd-chatgpt-message-stepper__slot { display: inline-flex; flex: none; }
.aimd-chatgpt-message-stepper__slot[hidden] { display: none; }
.aimd-chatgpt-message-stepper__actions::-webkit-scrollbar { display: none; }
.aimd-chatgpt-message-stepper .aimd-chatgpt-message-stepper__trigger {
  order: 2;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-bg-surface) 60%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .aimd-chatgpt-message-stepper__actions { transition: none; }
}
@supports not (backdrop-filter: blur(1px)) {
  .aimd-chatgpt-message-stepper { background: var(--aimd-bg-surface); }
}
.aimd-chatgpt-message-stepper[data-visible="0"] {
  display: none;
}
.aimd-chatgpt-message-stepper__button {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--_page-control-size);
  height: var(--_page-control-size);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  background: transparent;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-chatgpt-message-stepper__button:hover:not(:disabled),
.aimd-chatgpt-message-stepper__button:focus-visible:not(:disabled) {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-button-icon-hover);
}
.aimd-chatgpt-message-stepper__button[data-active="1"],
.aimd-chatgpt-message-stepper__button[data-active="1"]:hover:not(:disabled) {
  color: color-mix(in srgb, var(--aimd-interactive-primary) 60%, var(--aimd-text-primary));
  background: var(--aimd-interactive-selected);
}
.aimd-chatgpt-message-stepper__button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}
.aimd-chatgpt-message-stepper__button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.aimd-chatgpt-message-stepper__button[data-active="1"] {
  color: var(--aimd-interactive-primary);
}
.aimd-chatgpt-message-stepper__button[data-running="1"] {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-button-icon-hover);
}
.aimd-chatgpt-message-stepper__button[hidden] {
  display: none;
}
.aimd-chatgpt-message-stepper__icon,
.aimd-chatgpt-message-stepper__icon svg,
.aimd-chatgpt-message-stepper__icon img {
  width: var(--_page-control-glyph);
  height: var(--_page-control-glyph);
}
.aimd-chatgpt-message-stepper__icon img { object-fit: contain; }
.aimd-chatgpt-message-stepper__settings { display: none; }
.aimd-chatgpt-message-stepper__settings svg { width: var(--_page-control-glyph); height: var(--_page-control-glyph); }
.aimd-chatgpt-message-stepper[data-expanded="1"] .aimd-chatgpt-message-stepper__trigger>.aimd-chatgpt-message-stepper__icon { display: none; }
.aimd-chatgpt-message-stepper[data-expanded="1"] .aimd-chatgpt-message-stepper__settings { display: inline-flex; }
.aimd-chatgpt-message-stepper__icon[data-direction="left"] {
  transform: scaleX(-1);
}
`; }
