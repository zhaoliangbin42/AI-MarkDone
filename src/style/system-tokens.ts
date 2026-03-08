export function getSystemTokenCss(): string {
    return `
:host {
  --aimd-sys-color-surface: var(--aimd-ref-color-neutral-0);
  --aimd-sys-color-surface-subtle: var(--aimd-ref-color-neutral-50);
  --aimd-sys-color-surface-elevated: var(--aimd-ref-color-neutral-0);
  --aimd-sys-color-surface-frosted: color-mix(in srgb, var(--aimd-sys-color-surface) 82%, transparent);
  --aimd-sys-color-surface-quiet: var(--aimd-ref-color-neutral-alpha-06);
  --aimd-sys-color-surface-hover: var(--aimd-ref-color-neutral-alpha-12);
  --aimd-sys-color-surface-pressed: var(--aimd-ref-color-neutral-alpha-18);
  --aimd-sys-color-text-primary: var(--aimd-ref-color-neutral-900);
  --aimd-sys-color-text-secondary: var(--aimd-ref-color-neutral-700);
  --aimd-sys-color-text-secondary-muted: var(--aimd-ref-color-neutral-500);
  --aimd-sys-color-border-default: var(--aimd-ref-color-neutral-alpha-12);
  --aimd-sys-color-outline-soft: color-mix(in srgb, var(--aimd-sys-color-text-primary) 14%, transparent);
  --aimd-sys-color-border-subtle: var(--aimd-ref-color-neutral-alpha-08);
  --aimd-sys-color-border-quiet: var(--aimd-ref-color-neutral-alpha-16);
  --aimd-sys-color-interactive-hover-layer: var(--aimd-ref-color-black-alpha-06);
  --aimd-sys-color-interactive-pressed-layer: var(--aimd-ref-color-black-alpha-10);
  --aimd-sys-color-accent: var(--aimd-ref-color-brand-600);
  --aimd-sys-color-accent-hover: var(--aimd-ref-color-brand-700);
  --aimd-sys-color-on-accent: var(--aimd-ref-color-neutral-white);
  --aimd-sys-color-accent-soft: var(--aimd-ref-color-brand-alpha-12);
  --aimd-sys-color-accent-flash: var(--aimd-ref-color-brand-alpha-28);
  --aimd-sys-color-focus-ring: var(--aimd-ref-color-brand-alpha-35);
  --aimd-sys-color-state-info-border: var(--aimd-ref-color-brand-alpha-35);
  --aimd-sys-color-state-success-border: var(--aimd-ref-color-green-alpha-35);
  --aimd-sys-color-state-error-border: var(--aimd-ref-color-red-alpha-35);
  --aimd-sys-color-overlay: var(--aimd-ref-color-black-alpha-35);
  --aimd-sys-shadow-panel: var(--aimd-ref-shadow-500);
  --aimd-sys-shadow-floating: var(--aimd-ref-shadow-300);
  --aimd-sys-shadow-popover: var(--aimd-ref-shadow-500);

  --aimd-sys-type-label-small-size: var(--aimd-ref-type-size-075);
  --aimd-sys-type-label-medium-size: var(--aimd-ref-type-size-100);
  --aimd-sys-type-body-medium-size: var(--aimd-ref-type-size-200);
  --aimd-sys-type-title-medium-size: var(--aimd-ref-type-size-300);
  --aimd-sys-type-label-line-height: var(--aimd-ref-type-line-100);
  --aimd-sys-type-body-line-height: var(--aimd-ref-type-line-200);
  --aimd-sys-type-reading-line-height: var(--aimd-ref-type-line-300);
  --aimd-sys-type-weight-medium: var(--aimd-ref-type-weight-500);
  --aimd-sys-type-weight-semibold: var(--aimd-ref-type-weight-600);

  --aimd-sys-shape-corner-sm: var(--aimd-ref-radius-150);
  --aimd-sys-shape-corner-md: var(--aimd-ref-radius-200);
  --aimd-sys-shape-corner-lg: var(--aimd-ref-radius-300);
  --aimd-sys-shape-corner-xl: var(--aimd-ref-radius-400);
  --aimd-sys-shape-corner-full: var(--aimd-ref-radius-full);
  --aimd-sys-shape-corner-compact: var(--aimd-ref-radius-250);

  --aimd-sys-space-1: var(--aimd-ref-space-100);
  --aimd-sys-space-2: var(--aimd-ref-space-200);
  --aimd-sys-space-3: var(--aimd-ref-space-300);
  --aimd-sys-space-4: var(--aimd-ref-space-400);
  --aimd-sys-space-compact-gap: var(--aimd-ref-space-100);
  --aimd-sys-space-compact-padding: var(--aimd-ref-space-100);

  --aimd-sys-size-icon-sm: var(--aimd-ref-size-160);
  --aimd-sys-size-icon-md: var(--aimd-ref-size-260);
  --aimd-sys-size-control-compact-tight: var(--aimd-ref-size-280);
  --aimd-sys-size-control-compact: var(--aimd-ref-size-300);
  --aimd-sys-size-control-compact-relaxed: var(--aimd-ref-size-320);
  --aimd-sys-size-panel-width: var(--aimd-ref-size-fluid-viewport-92);
  --aimd-sys-size-panel-max-width: var(--aimd-ref-size-900);
  --aimd-sys-size-panel-height: var(--aimd-ref-size-fluid-viewport-82);
  --aimd-sys-size-panel-source-max-height: var(--aimd-ref-size-220);
  --aimd-sys-space-panel-top: var(--aimd-ref-size-fluid-viewport-10);

  --aimd-sys-motion-duration-fast: var(--aimd-ref-motion-duration-fast);
  --aimd-sys-motion-duration-enter: var(--aimd-ref-motion-duration-enter);
  --aimd-sys-motion-easing-standard: var(--aimd-ref-motion-easing-standard);

  --aimd-sys-z-base: var(--aimd-ref-z-base);
  --aimd-sys-z-panel: var(--aimd-ref-z-panel);
  --aimd-sys-z-tooltip: var(--aimd-ref-z-tooltip);

  /* Stable export layer for current UI and non-UI consumers. */
  --aimd-bg-primary: var(--aimd-sys-color-surface);
  --aimd-bg-secondary: var(--aimd-sys-color-surface-subtle);
  --aimd-text-primary: var(--aimd-sys-color-text-primary);
  --aimd-text-secondary: var(--aimd-sys-color-text-secondary);
  --aimd-border-default: var(--aimd-sys-color-border-default);
  --aimd-interactive-primary: var(--aimd-sys-color-accent);
  --aimd-interactive-primary-hover: var(--aimd-sys-color-accent-hover);
  --aimd-text-on-primary: var(--aimd-sys-color-on-accent);
  --aimd-interactive-highlight: var(--aimd-sys-color-accent-soft);
  --aimd-interactive-flash: var(--aimd-sys-color-accent-flash);
  --aimd-state-success-border: var(--aimd-sys-color-state-success-border);
  --aimd-state-error-border: var(--aimd-sys-color-state-error-border);
  --aimd-focus-ring: var(--aimd-sys-color-focus-ring);
  --aimd-overlay-bg: var(--aimd-sys-color-overlay);
  --aimd-shadow-panel: var(--aimd-sys-shadow-panel);
  --aimd-font-size-xs: var(--aimd-sys-type-label-small-size);
  --aimd-font-size-sm: var(--aimd-sys-type-label-medium-size);
  --aimd-radius-md: var(--aimd-sys-shape-corner-sm);
  --aimd-radius-lg: var(--aimd-sys-shape-corner-md);
  --aimd-space-1: var(--aimd-sys-space-1);
  --aimd-space-2: var(--aimd-sys-space-2);
  --aimd-space-3: var(--aimd-sys-space-3);
  --aimd-space-4: var(--aimd-sys-space-4);
  --aimd-size-icon-md: var(--aimd-sys-size-icon-md);
  --aimd-panel-top: var(--aimd-sys-space-panel-top);
  --aimd-panel-width: var(--aimd-sys-size-panel-width);
  --aimd-panel-max-width: var(--aimd-sys-size-panel-max-width);
  --aimd-panel-height: var(--aimd-sys-size-panel-height);
  --aimd-panel-source-max-height: var(--aimd-sys-size-panel-source-max-height);
  --aimd-z-base: var(--aimd-sys-z-base);
  --aimd-z-panel: var(--aimd-sys-z-panel);
  --aimd-z-tooltip: var(--aimd-sys-z-tooltip);
}
:host([data-aimd-theme="dark"]) {
  --aimd-sys-color-surface-frosted: color-mix(in srgb, var(--aimd-sys-color-surface) 26%, transparent);
  --aimd-sys-color-outline-soft: color-mix(in srgb, var(--aimd-sys-color-text-primary) 22%, transparent);
  --aimd-sys-color-interactive-hover-layer: var(--aimd-ref-color-white-alpha-10);
  --aimd-sys-color-interactive-pressed-layer: var(--aimd-ref-color-white-alpha-16);
}
`;
}
