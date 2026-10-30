import type { Theme } from '../core/types/theme';

export function getReferenceTokenCss(theme: Theme): string {
    const isDark = theme === 'dark';

    return `
:host {
  --aimd-ref-reader-solarized-canvas: #002b36;
  --aimd-ref-reader-solarized-surface: #073642;
  --aimd-ref-reader-solarized-text: #93a1a1;
  --aimd-ref-reader-solarized-muted: #93a1a1;
  --aimd-ref-reader-solarized-rule: #586e75;
  --aimd-ref-reader-solarized-accent: #2aa198;
  --aimd-ref-reader-nord-canvas: #2e3440;
  --aimd-ref-reader-nord-surface: #3b4252;
  --aimd-ref-reader-nord-text: #eceff4;
  --aimd-ref-reader-nord-muted: #d8dee9;
  --aimd-ref-reader-nord-rule: #4c566a;
  --aimd-ref-reader-nord-accent: #88c0d0;
  --aimd-ref-reader-nord-keyword: #81a1c1;
  --aimd-ref-reader-nord-string: #a3be8c;
  --aimd-ref-reader-nord-number: #b48ead;
  --aimd-ref-reader-dracula-canvas: #282a36;
  --aimd-ref-reader-dracula-surface: #44475a;
  --aimd-ref-reader-dracula-text: #f8f8f2;
  --aimd-ref-reader-dracula-muted: #c0c1cd;
  --aimd-ref-reader-dracula-rule: #6272a4;
  --aimd-ref-reader-dracula-accent: #bd93f9;
  --aimd-ref-reader-dracula-keyword: #ff79c6;
  --aimd-ref-reader-dracula-string: #f1fa8c;
  --aimd-ref-reader-dracula-number: #bd93f9;
  --aimd-ref-reader-day-canvas: #ffffff;
  --aimd-ref-reader-day-surface: #f6f8fa;
  --aimd-ref-reader-day-text: #1f2328;
  --aimd-ref-reader-day-muted: #59636e;
  --aimd-ref-reader-day-rule: #d1d9e0;
  --aimd-ref-reader-day-accent: #0969da;
  --aimd-ref-reader-paper-canvas: #fdf6e3;
  --aimd-ref-reader-paper-surface: #eee8d5;
  --aimd-ref-reader-paper-text: #52666d;
  --aimd-ref-reader-paper-muted: #52666d;
  --aimd-ref-reader-paper-rule: #d6cfb8;
  --aimd-ref-reader-paper-accent: #2176a5;
  --aimd-ref-reader-night-canvas: #0d1117;
  --aimd-ref-reader-night-surface: #161b22;
  --aimd-ref-reader-night-text: #e6edf3;
  --aimd-ref-reader-night-muted: #9da7b3;
  --aimd-ref-reader-night-rule: #30363d;
  --aimd-ref-reader-night-accent: #79c0ff;
  --aimd-ref-color-neutral-black: #000000;
  --aimd-ref-color-highlight-blue: ${isDark ? '#344B63' : '#DCE9F6'};
  --aimd-ref-color-highlight-yellow: ${isDark ? '#554D32' : '#F5EBBF'};
  --aimd-ref-color-highlight-red: ${isDark ? '#593E42' : '#F2DCD9'};
  --aimd-ref-shadow-workspace: ${isDark ? '0 28px 76px #080c16b3, 0 6px 20px #080c1680' : '0 28px 76px #263a5940, 0 6px 20px #263a5926'};
  --aimd-ref-workspace-surface: ${isDark ? '#242830' : '#F7F8FA'};
  --aimd-ref-workspace-sidebar: ${isDark ? '#20242C' : '#EEF1F6'};
  --aimd-ref-workspace-card: ${isDark ? '#2D323C' : '#FFFFFF'};
  --aimd-ref-workspace-border: ${isDark ? '#5A657A80' : '#B8C3D280'};
  --aimd-ref-workspace-edge: ${isDark ? '#AABADB24' : '#FFFFFFD9'};
  --aimd-ref-workspace-scrim: ${isDark ? '#060B1666' : '#24365338'};
  --aimd-ref-workspace-raised: ${isDark ? '3px 4px 12px #090E193D, -2px -2px 7px #75839C14' : '3px 4px 12px #485C771A, -2px -2px 7px #FFFFFFCC'};
  --aimd-ref-workspace-inset: ${isDark ? 'inset 2px 3px 7px #090E1952, inset -2px -2px 6px #75839C12' : 'inset 2px 3px 7px #485C7714, inset -2px -2px 6px #FFFFFFBF'};
  --aimd-ref-shadow-picker-selection: ${isDark ? 'inset 0 0 0 1px #5A657A80' : 'inset 0 0 0 1px #B8C3D280'};
  --aimd-ref-opacity-disabled: 0.48;
  --aimd-ref-color-neutral-0: ${isDark ? '#1E1E1E' : '#FFFFFF'};
  --aimd-ref-color-neutral-50: ${isDark ? '#2D2D2D' : '#F6F7F9'};
  --aimd-ref-color-neutral-900: ${isDark ? '#F3F4F6' : '#111827'};
  --aimd-ref-color-neutral-700: ${isDark ? '#D1D5DB' : '#374151'};
  --aimd-ref-color-neutral-alpha-08: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
  --aimd-ref-color-neutral-alpha-12: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};
  --aimd-ref-color-neutral-alpha-16: ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)'};
  --aimd-ref-color-neutral-alpha-18: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'};
  --aimd-ref-color-neutral-alpha-22: ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'};
  --aimd-ref-color-black-alpha-06: rgba(0,0,0,0.06);
  --aimd-ref-color-white-alpha-16: rgba(255,255,255,0.16);
  --aimd-ref-color-brand-600: #3b5bdb;
  --aimd-ref-color-brand-700: #304bc0;
  --aimd-ref-color-neutral-white: #ffffff;
  --aimd-ref-color-brand-alpha-12: ${isDark ? 'rgba(59, 91, 219, 0.18)' : 'rgba(59, 91, 219, 0.12)'};
  --aimd-ref-color-brand-alpha-28: ${isDark ? 'rgba(59, 91, 219, 0.36)' : 'rgba(59, 91, 219, 0.28)'};
  --aimd-ref-color-brand-alpha-35: rgba(59,91,219,0.35);
  --aimd-ref-color-bookmark-rainbow-rose: #f43f5e;
  --aimd-ref-color-bookmark-rainbow-amber: #f59e0b;
  --aimd-ref-color-bookmark-rainbow-emerald: #10b981;
  --aimd-ref-color-bookmark-rainbow-sky: #0ea5e9;
  --aimd-ref-color-bookmark-rainbow-violet: #8b5cf6;
  --aimd-ref-color-green-alpha-35: rgba(16,185,129,0.35);
  --aimd-ref-color-red-alpha-35: rgba(239,68,68,0.35);
  --aimd-ref-color-black-alpha-35: ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)'};
  --aimd-ref-color-warning: ${isDark ? '#fbbf24' : '#f59e0b'};
  --aimd-ref-color-danger: #ef4444;
  --aimd-ref-color-success: #10b981;
  --aimd-ref-shadow-500: ${isDark ? '0 18px 50px rgba(0,0,0,0.55)' : '0 18px 50px rgba(0,0,0,0.25)'};
  --aimd-ref-shadow-xs: ${isDark ? '0 1px 2px rgba(0,0,0,0.55)' : '0 1px 2px rgba(0,0,0,0.12)'};
  --aimd-ref-shadow-sm: ${isDark ? '0 6px 16px rgba(0,0,0,0.52)' : '0 4px 12px rgba(0,0,0,0.12)'};
  --aimd-ref-shadow-lg: ${isDark ? '0 14px 34px rgba(0,0,0,0.68)' : '0 22px 56px rgba(148,163,184,0.24)'};
  --aimd-ref-shadow-focus: ${isDark ? '0 0 0 2px rgba(26,115,232,0.38)' : '0 0 0 2px rgba(59,130,246,0.20)'};

  --aimd-ref-type-size-075: 12px;
  --aimd-ref-type-size-100: 13px;
  --aimd-ref-type-size-200: 16px;
  --aimd-ref-type-size-300: 16px;
  --aimd-ref-type-line-100: 1.25;
  --aimd-ref-type-line-200: 1.5;
  --aimd-ref-type-line-300: 1.65;
  --aimd-ref-type-weight-500: 500;
  --aimd-ref-type-weight-600: 600;

  --aimd-ref-radius-150: 6px;
  --aimd-ref-radius-200: 8px;
  --aimd-ref-radius-full: 999px;

  --aimd-ref-space-100: 4px;
  --aimd-ref-space-200: 8px;
  --aimd-ref-space-300: 12px;
  --aimd-ref-space-400: 16px;

  --aimd-ref-size-160: 16px;
  --aimd-ref-size-300: 30px;
  --aimd-ref-size-320: 32px;
  --aimd-ref-size-360: 36px;
  --aimd-ref-size-640: 64px;
  --aimd-ref-size-720: 72px;
  --aimd-ref-size-900: 900px;
  --aimd-ref-size-fluid-viewport-82: 82vh;

  --aimd-ref-motion-duration-fast: 150ms;
  --aimd-ref-motion-duration-enter: 200ms;
  --aimd-ref-motion-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);

  --aimd-ref-z-base: 1;
  --aimd-ref-z-panel: 9000;
  --aimd-ref-z-tooltip: 10000;
}
`;
}
