import type { Theme } from '../core/types/theme';

export type UserThemeOverrides = {
    accentColor?: string;
    baseFontScale?: number;
};

function clampNumber(value: number | undefined, min: number, max: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: string | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return null;
}

export function normalizeUserThemeOverrides(overrides: UserThemeOverrides = {}): UserThemeOverrides {
    const accentColor = normalizeHexColor(overrides.accentColor);
    const fontScale = clampNumber(overrides.baseFontScale, 0.75, 1.25);
    const normalized: UserThemeOverrides = {};

    if (accentColor) normalized.accentColor = accentColor;
    if (fontScale !== null) normalized.baseFontScale = fontScale;
    return normalized;
}

function getUserThemeOverrideCss(overrides: UserThemeOverrides): string {
    const declarations: string[] = [];
    const normalized = normalizeUserThemeOverrides(overrides);
    const { accentColor, baseFontScale: fontScale } = normalized;

    if (accentColor) {
        declarations.push(`  --aimd-sys-color-accent: ${accentColor};`);
        declarations.push(`  --aimd-sys-color-accent-hover: color-mix(in srgb, ${accentColor} 82%, var(--aimd-sys-color-text-primary));`);
        declarations.push(`  --aimd-sys-color-accent-soft: color-mix(in srgb, ${accentColor} 14%, transparent);`);
        declarations.push(`  --aimd-sys-color-accent-flash: color-mix(in srgb, ${accentColor} 30%, transparent);`);
        declarations.push(`  --aimd-sys-color-focus-ring: color-mix(in srgb, ${accentColor} 35%, transparent);`);
        declarations.push(`  --aimd-sys-color-state-info-border: color-mix(in srgb, ${accentColor} 35%, transparent);`);
    }

    if (fontScale) {
        declarations.push(`  --aimd-sys-type-label-small-size: calc(var(--aimd-ref-type-size-075) * ${fontScale});`);
        declarations.push(`  --aimd-sys-type-label-medium-size: calc(var(--aimd-ref-type-size-100) * ${fontScale});`);
        declarations.push(`  --aimd-sys-type-body-medium-size: calc(var(--aimd-ref-type-size-200) * ${fontScale});`);
        declarations.push(`  --aimd-sys-type-title-medium-size: calc(var(--aimd-ref-type-size-300) * ${fontScale});`);
    }

    return declarations.length ? `${declarations.join('\n')}\n` : '';
}

export function getSystemTokenCss(theme: Theme, overrides: UserThemeOverrides = {}): string {
    const isDark = theme === 'dark';

    return `
:host {
  --aimd-sys-color-surface: var(--aimd-ref-color-neutral-0);
  --aimd-sys-color-surface-subtle: var(--aimd-ref-color-neutral-50);
  --aimd-sys-color-surface-elevated: var(--aimd-ref-color-neutral-0);
  --aimd-sys-color-surface-hover: ${isDark ? 'var(--aimd-ref-color-neutral-alpha-16)' : 'var(--aimd-ref-color-neutral-alpha-12)'};
  --aimd-sys-color-surface-pressed: ${isDark ? 'var(--aimd-ref-color-neutral-alpha-22)' : 'var(--aimd-ref-color-neutral-alpha-18)'};
  --aimd-sys-color-text-primary: var(--aimd-ref-color-neutral-900);
  --aimd-sys-color-text-secondary: var(--aimd-ref-color-neutral-700);
  --aimd-sys-color-border-default: ${isDark ? 'var(--aimd-ref-color-neutral-alpha-16)' : 'var(--aimd-ref-color-neutral-alpha-12)'};
  --aimd-sys-color-border-subtle: ${isDark ? 'var(--aimd-ref-color-neutral-alpha-12)' : 'var(--aimd-ref-color-neutral-alpha-08)'};
  --aimd-sys-color-border-strong: ${isDark ? 'var(--aimd-ref-color-neutral-alpha-22)' : 'var(--aimd-ref-color-neutral-alpha-16)'};
  --aimd-sys-color-interactive-hover-layer: ${isDark ? 'var(--aimd-ref-color-white-alpha-16)' : 'var(--aimd-ref-color-black-alpha-06)'};
  --aimd-sys-color-accent: var(--aimd-ref-color-brand-600);
  --aimd-sys-color-accent-hover: var(--aimd-ref-color-brand-700);
  --aimd-sys-color-white: var(--aimd-ref-color-neutral-white);
  --aimd-sys-color-on-accent: var(--aimd-ref-color-neutral-white);
  --aimd-sys-color-accent-soft: var(--aimd-ref-color-brand-alpha-12);
  --aimd-sys-color-accent-flash: var(--aimd-ref-color-brand-alpha-28);
  --aimd-sys-color-focus-ring: var(--aimd-ref-color-brand-alpha-35);
  --aimd-sys-color-state-info-border: var(--aimd-ref-color-brand-alpha-35);
  --aimd-sys-color-state-success-border: var(--aimd-ref-color-green-alpha-35);
  --aimd-sys-color-state-error-border: var(--aimd-ref-color-red-alpha-35);
  --aimd-sys-color-overlay: var(--aimd-ref-color-black-alpha-35);
  --aimd-sys-color-warning: var(--aimd-ref-color-warning);
  --aimd-sys-color-danger: var(--aimd-ref-color-danger);
  --aimd-sys-color-success: var(--aimd-ref-color-success);
  --aimd-sys-color-link: var(--aimd-sys-color-accent);
  --aimd-sys-color-link-hover: var(--aimd-sys-color-accent-hover);
  --aimd-sys-color-bookmark-marker-gradient: linear-gradient(90deg, var(--aimd-ref-color-bookmark-rainbow-rose) 0%, var(--aimd-ref-color-bookmark-rainbow-amber) 22%, var(--aimd-ref-color-bookmark-rainbow-emerald) 48%, var(--aimd-ref-color-bookmark-rainbow-sky) 72%, var(--aimd-ref-color-bookmark-rainbow-violet) 100%);
  --aimd-sys-color-bookmark-marker-glow: ${isDark ? 'color-mix(in srgb, var(--aimd-ref-color-bookmark-rainbow-sky) 34%, transparent)' : 'color-mix(in srgb, var(--aimd-ref-color-bookmark-rainbow-violet) 22%, transparent)'};

  --aimd-sys-shadow-xs: var(--aimd-ref-shadow-xs);
  --aimd-sys-shadow-sm: var(--aimd-ref-shadow-sm);
  --aimd-sys-shadow-lg: var(--aimd-ref-shadow-lg);
  --aimd-sys-shadow-xl: var(--aimd-ref-shadow-xl);
  --aimd-sys-shadow-focus: var(--aimd-ref-shadow-focus);
  --aimd-sys-shadow-field-inset: inset 0 1px 0 color-mix(in srgb, var(--aimd-sys-color-surface) 72%, transparent);
  --aimd-sys-shadow-panel: var(--aimd-ref-shadow-500);
  --aimd-sys-shadow-interactive-halo: 0 0 0 3px color-mix(in srgb, var(--aimd-sys-color-accent) 10%, transparent);
  --aimd-sys-shadow-bookmark-marker: 0 0 0 2px var(--aimd-sys-color-bookmark-marker-glow);
  --aimd-sys-shadow-bookmark-marker-strong: 0 0 0 3px var(--aimd-sys-color-bookmark-marker-glow);

  --aimd-sys-type-label-small-size: var(--aimd-ref-type-size-075);
  --aimd-sys-type-label-medium-size: var(--aimd-ref-type-size-100);
  --aimd-sys-type-body-medium-size: var(--aimd-ref-type-size-200);
  --aimd-sys-type-title-medium-size: var(--aimd-ref-type-size-300);
  --aimd-sys-type-title-large-size: 18px;
  --aimd-sys-type-family-sans: ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol";
  --aimd-sys-type-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --aimd-sys-type-label-line-height: var(--aimd-ref-type-line-100);
  --aimd-sys-type-body-line-height: var(--aimd-ref-type-line-200);
  --aimd-sys-type-reading-line-height: var(--aimd-ref-type-line-300);
  --aimd-sys-type-weight-medium: var(--aimd-ref-type-weight-500);
  --aimd-sys-type-weight-semibold: var(--aimd-ref-type-weight-600);

  --aimd-sys-shape-corner-xs: 4px;
  --aimd-sys-shape-corner-sm: var(--aimd-ref-radius-150);
  --aimd-sys-shape-corner-md: var(--aimd-ref-radius-200);
  --aimd-sys-shape-corner-xl: 14px;
  --aimd-sys-shape-corner-2xl: 18px;
  --aimd-sys-shape-corner-full: var(--aimd-ref-radius-full);

  --aimd-sys-space-1: var(--aimd-ref-space-100);
  --aimd-sys-space-2: var(--aimd-ref-space-200);
  --aimd-sys-space-3: var(--aimd-ref-space-300);
  --aimd-sys-space-4: var(--aimd-ref-space-400);
  --aimd-sys-space-5: calc(var(--aimd-ref-space-400) + var(--aimd-ref-space-100));
  --aimd-sys-space-6: calc(var(--aimd-ref-space-400) + var(--aimd-ref-space-200));

  --aimd-sys-size-control-icon-toolbar: var(--aimd-ref-size-300);
  --aimd-sys-size-control-compact: var(--aimd-ref-size-300);
  --aimd-sys-size-control-compact-relaxed: var(--aimd-ref-size-320);
  --aimd-sys-size-control-icon-panel: var(--aimd-ref-size-320);
  --aimd-sys-size-control-icon-panel-nav: var(--aimd-ref-size-320);
  --aimd-sys-size-control-glyph-panel: var(--aimd-ref-size-160);
  --aimd-sys-size-control-action-panel: var(--aimd-ref-size-360);
  --aimd-sys-size-panel-header-height: var(--aimd-ref-size-720);
  --aimd-sys-size-panel-header-height-compact: var(--aimd-ref-size-640);
  --aimd-sys-size-panel-footer-min-height: var(--aimd-ref-size-640);
  --aimd-sys-size-panel-max-width: var(--aimd-ref-size-900);
  --aimd-sys-size-panel-height: var(--aimd-ref-size-fluid-viewport-82);
  --aimd-sys-size-panel-wide-max-width: 1180px;
  --aimd-sys-size-panel-wide-max-height: 820px;
  --aimd-sys-space-panel-header-padding-block: var(--aimd-ref-space-300);
  --aimd-sys-space-panel-header-padding-inline: var(--aimd-ref-space-400);
  --aimd-sys-space-panel-header-padding-block-compact: var(--aimd-ref-space-200);
  --aimd-sys-space-panel-header-padding-inline-compact: var(--aimd-ref-space-300);
  --aimd-sys-space-panel-header-gap: var(--aimd-ref-space-300);
  --aimd-sys-space-panel-action-gap: var(--aimd-ref-space-200);
  --aimd-sys-space-panel-footer-padding-block: var(--aimd-ref-space-200);
  --aimd-sys-space-panel-footer-padding-inline: var(--aimd-ref-space-400);
  --aimd-sys-space-panel-footer-padding-block-compact: var(--aimd-ref-space-200);
  --aimd-sys-space-panel-footer-padding-inline-compact: var(--aimd-ref-space-300);
  --aimd-sys-space-panel-footer-gap: var(--aimd-ref-space-300);
  --aimd-sys-type-panel-title-size: var(--aimd-sys-type-title-large-size);
  --aimd-sys-type-panel-title-size-compact: var(--aimd-sys-type-title-medium-size);
  --aimd-sys-type-panel-title-weight: var(--aimd-sys-type-weight-semibold);
  --aimd-sys-type-modal-title-size: var(--aimd-sys-type-title-large-size);
  --aimd-sys-type-modal-title-weight: var(--aimd-sys-type-weight-semibold);
  --aimd-sys-type-panel-title-line-height: 1.1;

  --aimd-sys-motion-duration-fast: var(--aimd-ref-motion-duration-fast);
  --aimd-sys-motion-duration-enter: var(--aimd-ref-motion-duration-enter);
  --aimd-sys-motion-easing-standard: var(--aimd-ref-motion-easing-standard);
  --aimd-sys-motion-easing-emphasis: cubic-bezier(0.16, 1, 0.3, 1);

  --aimd-sys-z-base: var(--aimd-ref-z-base);
  --aimd-sys-z-panel: var(--aimd-ref-z-panel);
  --aimd-sys-z-tooltip: var(--aimd-ref-z-tooltip);

${getUserThemeOverrideCss(overrides)}
}
`;
}
