/** Shared Settings-style presentation; each surface retains layout and lifecycle ownership. */
export function getFlatWorkflowCss(): string {
    return `
.flat-workflow {
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
:where(.flat-workflow) :where(input, textarea, select) { font-family: inherit; }

:where(.flat-workflow__body) {
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-5);
  min-width: 0;
  min-height: 0;
  padding: var(--aimd-space-5);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--aimd-workspace-surface);
}

:where(.flat-workflow__section) {
  min-width: 0;
  padding: var(--aimd-space-4) var(--aimd-space-5);
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: none;
}

:where(.flat-workflow__section-title) {
  margin: 0 0 var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
}

:where(.flat-workflow__row) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  align-items: center;
  gap: var(--aimd-space-4);
  min-width: 0;
  padding-block: var(--aimd-space-4);
}
:where(.flat-workflow__row + .flat-workflow__row) {
  border-top: 1px solid var(--aimd-border-subtle);
}
:where(.flat-workflow__row:first-child) { padding-top: 0; }
:where(.flat-workflow__row:last-child) { padding-bottom: 0; }
:where(.flat-workflow__row > *) { min-width: 0; }

:where(.flat-workflow__field) { display: grid; gap: var(--aimd-space-2); min-width: 0; }
:where(.flat-workflow__input) { width: 100%; min-width: 0; padding: var(--aimd-space-3); font: inherit; }
:where(.flat-workflow__description) {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
  overflow-wrap: anywhere;
}

:where(.flat-workflow__toolbar),
:where(.flat-workflow__actions) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  min-width: 0;
}
:where(.flat-workflow__actions) { justify-content: flex-end; }

:where(.flat-workflow__list) {
  min-width: 0;
  min-height: 0;
  padding: 0;
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-2xl);
}
:where(.flat-workflow__item) {
  min-width: 0;
  padding: var(--aimd-space-4);
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
:where(.flat-workflow__item + .flat-workflow__item) { border-top: 1px solid var(--aimd-border-subtle); }
:where(.flat-workflow__quote) {
  margin: 0;
  padding: var(--aimd-space-3) var(--aimd-space-4);
  border: 0;
  border-inline-start: var(--aimd-space-1) solid var(--aimd-workspace-border);
  border-radius: 0;
  background: var(--aimd-workspace-surface);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-reading);
  overflow-wrap: anywhere;
  box-shadow: none;
}

:where(.flat-workflow__tabs) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--aimd-space-4);
  padding: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--aimd-workspace-border);
  border-radius: 0;
  box-shadow: none;
}
:where(.flat-workflow__tab) {
  cursor: pointer;
  min-height: var(--aimd-size-control-action-panel);
  padding: var(--aimd-space-2) 0;
  background: transparent;
  color: var(--aimd-text-secondary);
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
  box-shadow: none;
}
:where(.flat-workflow__tab:is([data-active="1"], [aria-selected="true"], [aria-pressed="true"])) {
  color: var(--aimd-interactive-primary);
  border-bottom-color: var(--aimd-interactive-primary);
}
:where(.flat-workflow__tab:focus-visible) { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }

:host .flat-workflow :is(.aimd-material-field, .aimd-field-shell, .aimd-field-control--standalone, .mock-modal__input, .search-field, .flat-workflow__input, input[type="text"], input[type="search"], textarea, select) {
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-xl);
  box-shadow: none;
}
:host .flat-workflow :is(.aimd-field-shell, .search-field) .aimd-field-control {
  border: 0;
  background: transparent;
  box-shadow: none;
}
:host .flat-workflow :is(.aimd-material-field, .aimd-field-shell, .aimd-field-control--standalone, .mock-modal__input, .search-field, .flat-workflow__input, input[type="text"], input[type="search"], textarea, select):is(:focus, :focus-visible, :focus-within) {
  border-color: var(--aimd-focus-ring);
  box-shadow: none;
}
:host .flat-workflow :is(input, textarea, select)[aria-invalid="true"] { border-color: var(--aimd-interactive-danger); }
:host .flat-workflow :is(.aimd-material-button, .secondary-btn, .primary-btn, .studio-btn, .mock-modal__button, .settings-select-trigger, .settings-stepper-field, .icon-btn, .aimd-material-choice),
:host .flat-workflow :is(.aimd-material-button, .secondary-btn, .primary-btn, .studio-btn, .mock-modal__button, .settings-select-trigger, .settings-stepper-field, .icon-btn, .aimd-material-choice):is(:hover, :active, :focus-visible, [data-active="1"], [aria-pressed="true"], [aria-selected="true"]) {
  box-shadow: none;
}
:host .flat-workflow .aimd-material-segmented { background: transparent; box-shadow: none; }
:host .flat-workflow :is(.panel-header, .panel-footer, .mock-modal__head, .mock-modal__footer) {
  background: var(--aimd-workspace-surface);
  border-color: var(--aimd-workspace-border);
}
:host .flat-workflow :is(.flat-workflow__tabs, .flat-workflow__tab, .flat-workflow__quote, .flat-workflow__item) { box-shadow: none; }
:host .flat-workflow .flat-workflow__tab { background: transparent; border-radius: 0; }
:host .flat-workflow .picker-tree {
  background: var(--aimd-workspace-card);
  box-shadow: none;
}
:host .flat-workflow .library-folder-picker__root[data-selected="true"] { box-shadow: none; }

@media (max-width: 560px) {
  :where(.flat-workflow__body) { padding: var(--aimd-space-4); gap: var(--aimd-space-4); }
  :where(.flat-workflow__section) { padding: var(--aimd-space-3); }
  :where(.flat-workflow__row) { grid-template-columns: minmax(0, 1fr); gap: var(--aimd-space-2); }
  :where(.flat-workflow__item) { padding: var(--aimd-space-3); }
}
`;
}
