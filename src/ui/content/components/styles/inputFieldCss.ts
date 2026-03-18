export function getInputFieldCss(): string {
    return `
.aimd-field-shell,
.aimd-field-control,
.aimd-field-control--standalone {
  transition:
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.aimd-field-shell:focus-within {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  box-shadow: var(--aimd-shadow-focus);
}

.aimd-field-control {
  outline: none;
}

.aimd-field-control::placeholder {
  opacity: 1;
  color: var(--aimd-text-secondary);
  transition:
    opacity var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.aimd-field-control:focus::placeholder,
.aimd-field-control:focus-visible::placeholder {
  opacity: 0;
}

.aimd-field-control--standalone:focus,
.aimd-field-control--standalone:focus-visible {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
  box-shadow: var(--aimd-shadow-focus);
}
`;
}
