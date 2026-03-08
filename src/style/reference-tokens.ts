import type { Theme } from '../core/types/theme';

export function getReferenceTokenCss(theme: Theme): string {
    const isDark = theme === 'dark';

    return `
:host {
  --aimd-ref-color-neutral-0: ${isDark ? '#1E1E1E' : '#FFFFFF'};
  --aimd-ref-color-neutral-50: ${isDark ? '#2D2D2D' : '#F6F7F9'};
  --aimd-ref-color-neutral-500: ${isDark ? '#9CA3AF' : '#6B7280'};
  --aimd-ref-color-neutral-900: ${isDark ? '#F3F4F6' : '#111827'};
  --aimd-ref-color-neutral-700: ${isDark ? '#D1D5DB' : '#374151'};
  --aimd-ref-color-neutral-alpha-06: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
  --aimd-ref-color-neutral-alpha-08: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
  --aimd-ref-color-neutral-alpha-12: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};
  --aimd-ref-color-neutral-alpha-16: ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)'};
  --aimd-ref-color-neutral-alpha-18: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'};
  --aimd-ref-color-black-alpha-06: rgba(0,0,0,0.06);
  --aimd-ref-color-black-alpha-10: rgba(0,0,0,0.10);
  --aimd-ref-color-white-alpha-10: rgba(255,255,255,0.10);
  --aimd-ref-color-white-alpha-16: rgba(255,255,255,0.16);
  --aimd-ref-color-brand-600: #2563eb;
  --aimd-ref-color-brand-700: #1d4ed8;
  --aimd-ref-color-neutral-white: #ffffff;
  --aimd-ref-color-brand-alpha-12: ${isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)'};
  --aimd-ref-color-brand-alpha-28: ${isDark ? 'rgba(37, 99, 235, 0.36)' : 'rgba(37, 99, 235, 0.28)'};
  --aimd-ref-color-brand-alpha-35: rgba(37,99,235,0.35);
  --aimd-ref-color-green-alpha-35: rgba(16,185,129,0.35);
  --aimd-ref-color-red-alpha-35: rgba(239,68,68,0.35);
  --aimd-ref-color-black-alpha-35: ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)'};
  --aimd-ref-shadow-300: ${isDark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 10px 24px rgba(0,0,0,0.18)'};
  --aimd-ref-shadow-500: ${isDark ? '0 18px 50px rgba(0,0,0,0.55)' : '0 18px 50px rgba(0,0,0,0.25)'};

  --aimd-ref-type-size-075: 12px;
  --aimd-ref-type-size-100: 13px;
  --aimd-ref-type-size-200: 14px;
  --aimd-ref-type-size-300: 16px;
  --aimd-ref-type-line-100: 1.25;
  --aimd-ref-type-line-200: 1.5;
  --aimd-ref-type-line-300: 1.65;
  --aimd-ref-type-weight-500: 500;
  --aimd-ref-type-weight-600: 600;

  --aimd-ref-radius-150: 6px;
  --aimd-ref-radius-200: 8px;
  --aimd-ref-radius-250: 10px;
  --aimd-ref-radius-300: 12px;
  --aimd-ref-radius-400: 16px;
  --aimd-ref-radius-full: 999px;

  --aimd-ref-space-100: 4px;
  --aimd-ref-space-200: 8px;
  --aimd-ref-space-300: 12px;
  --aimd-ref-space-400: 16px;

  --aimd-ref-size-260: 26px;
  --aimd-ref-size-160: 16px;
  --aimd-ref-size-280: 28px;
  --aimd-ref-size-300: 30px;
  --aimd-ref-size-320: 32px;
  --aimd-ref-size-220: 220px;
  --aimd-ref-size-900: 900px;
  --aimd-ref-size-fluid-viewport-92: 92vw;
  --aimd-ref-size-fluid-viewport-82: 82vh;
  --aimd-ref-size-fluid-viewport-10: 10vh;

  --aimd-ref-motion-duration-fast: 150ms;
  --aimd-ref-motion-duration-enter: 200ms;
  --aimd-ref-motion-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);

  --aimd-ref-z-base: 1;
  --aimd-ref-z-panel: 9000;
  --aimd-ref-z-tooltip: 10000;
}
`;
}
