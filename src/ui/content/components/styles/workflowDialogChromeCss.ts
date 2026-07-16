/**
 * Shared layout contract for short-lived workflow dialogs.
 *
 * Existing panel, field, button, and nested-modal Modules keep their visual
 * ownership. This layer only owns the scroll and state contract shared by the
 * Bookmark Save and Save Messages workflows.
 */
export function getWorkflowDialogChromeCss(): string {
    return `
.workflow-dialog {
  min-width: 0;
  min-height: 0;
}

.workflow-dialog > .panel-header,
.workflow-dialog > .panel-footer {
  flex: 0 0 auto;
}

.workflow-dialog__body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.workflow-dialog__status {
  min-width: 0;
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.workflow-dialog__status[data-tone="muted"] {
  color: var(--aimd-text-secondary);
}

.workflow-dialog__status[data-tone="error"] {
  color: var(--aimd-interactive-danger);
}

.workflow-dialog__actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--aimd-panel-footer-gap);
}

@media (max-width: 560px), (max-height: 568px) {
  .workflow-dialog > .panel-footer {
    flex-wrap: wrap;
  }

  .workflow-dialog__actions {
    flex: 1 1 auto;
  }
}
`;
}
