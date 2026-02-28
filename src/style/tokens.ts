import type { Theme } from '../core/types/theme';

export function getTokenCss(theme: Theme): string {
    const isDark = theme === 'dark';
    const bg = isDark ? '#1E1E1E' : '#FFFFFF';
    const bg2 = isDark ? '#2D2D2D' : '#F6F7F9';
    const text = isDark ? '#F3F4F6' : '#111827';
    const text2 = isDark ? '#D1D5DB' : '#374151';
    const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    const primary = '#2563eb';
    const primaryHover = '#1d4ed8';
    const textOnPrimary = '#ffffff';
    const highlight = isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)';
    const flash = isDark ? 'rgba(37, 99, 235, 0.36)' : 'rgba(37, 99, 235, 0.28)';
    const successBorder = 'rgba(16,185,129,0.35)';
    const errorBorder = 'rgba(239,68,68,0.35)';
    const fontSizeXs = '12px';

    return `
:host {
  --aimd-bg-primary: ${bg};
  --aimd-bg-secondary: ${bg2};
  --aimd-text-primary: ${text};
  --aimd-text-secondary: ${text2};
  --aimd-border-default: ${border};
  --aimd-interactive-primary: ${primary};
  --aimd-interactive-primary-hover: ${primaryHover};
  --aimd-text-on-primary: ${textOnPrimary};
  --aimd-interactive-highlight: ${highlight};
  --aimd-interactive-flash: ${flash};
  --aimd-state-success-border: ${successBorder};
  --aimd-state-error-border: ${errorBorder};
  --aimd-font-size-xs: ${fontSizeXs};
  --aimd-radius-lg: 8px;
  --aimd-space-2: 8px;
  --aimd-space-3: 12px;
  --aimd-space-4: 16px;
  --aimd-z-base: 1;
  --aimd-z-panel: 9000;
  --aimd-z-tooltip: 10000;
}
`;
}

export function getPageTokenCss(): string {
    const light = getTokenCss('light').replace(':host', ':root[data-aimd-theme="light"]');
    const dark = getTokenCss('dark').replace(':host', ':root[data-aimd-theme="dark"]');
    return `${light}\n${dark}`;
}
