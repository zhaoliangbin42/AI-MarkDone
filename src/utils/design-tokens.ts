/**
 * Design Tokens Utility
 * 
 * Manages CSS custom properties (design tokens) for Shadow DOM components.
 * Provides isolated tokens for light and dark modes without polluting global scope.
 * 
 * @see /docs/design_system.md - Design system specification
 * @see /docs/shadow-dom-css-migration.md - Migration guide
 * 
 * Best Practices Reference:
 * - Shoelace: https://shoelace.style/getting-started/themes
 * - Lit: https://lit.dev/docs/components/styles/
 */

export class DesignTokens {
    /**
     * Detect if dark mode is currently active
     * Checks both document class and system preference
     */
    static isDarkMode(): boolean {
        // Check document class (ChatGPT/Gemini pattern)
        if (document.documentElement.classList.contains('dark')) {
            return true;
        }

        // Fallback to system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return true;
        }

        return false;
    }

    /**
     * Get all design tokens for light mode
     * Returns CSS custom properties ready to inject into :host selector
     */
    static getLightTokens(): string {
        return `
            /* ============================================
               NEUTRAL COLORS (Gray Scale)
               ============================================ */
            
            /* Lightest - Backgrounds, subtle dividers */
            --gray-50: #F9FAFB;
            
            /* Hover states, disabled backgrounds */
            --gray-100: #F3F4F6;
            
            /* Borders, dividers */
            --gray-200: #E5E7EB;
            
            /* Inactive borders */
            --gray-300: #D1D5DB;
            
            /* Placeholder text, tertiary icons */
            --gray-400: #9CA3AF;
            
            /* Secondary text, default icons */
            --gray-500: #6B7280;
            
            /* Primary text hover */
            --gray-600: #4B5563;
            
            /* Headings, emphasized text */
            --gray-700: #374151;
            
            /* Dark backgrounds */
            --gray-800: #1F2937;
            
            /* Primary text, headings */
            --gray-900: #111827;


            /* ============================================
               PRIMARY COLORS (Material Blue)
               ============================================ */
            
            /* Material Design 3 - Primary Scale */
            --primary-50: #E3F2FD;
            --primary-100: #BBDEFB;
            --primary-200: #90CAF9;
            --primary-300: #64B5F6;
            --primary-400: #42A5F5;
            --primary-500: #2196F3;
            --primary-600: #1976D2;
            --primary-700: #1565C0;
            --primary-800: #0D47A1;
            
            /* Material Design 3 - Surface Colors */
            --md-surface: #FFFFFF;
            --md-surface-variant: #F5F5F5;
            --md-surface-container: #FAFAFA;
            --md-surface-container-high: #EEEEEE;
            --md-on-surface: #1C1B1F;
            --md-on-surface-variant: #49454F;
            
            /* Material Design 3 - Primary Container */
            --md-primary-container: #E3F2FD;
            --md-on-primary-container: #0D47A1;
            
            /* Material Design 3 - Outline */
            --md-outline: #E0E0E0;
            --md-outline-variant: #EEEEEE;


            /* ============================================
               SEMANTIC COLORS
               ============================================ */
            
            /* Success (Green) */
            --success-50: #F0FDF4;
            --success-100: #DCFCE7;
            --success-500: #22C55E;
            --success-600: #16A34A;
            --success-700: #15803D;
            
            /* Warning (Amber) */
            --warning-50: #FFFBEB;
            --warning-100: #FEF3C7;
            --warning-500: #F59E0B;
            --warning-600: #D97706;
            --warning-700: #B45309;
            
            /* Danger (Red) */
            --danger-50: #FEF2F2;
            --danger-100: #FEE2E2;
            --danger-500: #EF4444;
            --danger-600: #DC2626;
            --danger-700: #B91C1C;


            /* ============================================
               PLATFORM COLORS
               ============================================ */
            
            /* ChatGPT */
            --chatgpt-light: #D1FAE5;
            --chatgpt-dark: #065F46;
            --chatgpt-icon: #10A37F;
            
            /* Gemini */
            --gemini-light: #DBEAFE;
            --gemini-dark: #1E40AF;
            --gemini-icon: #4285F4;


            /* ============================================
               SPACING SCALE (8px Grid)
               ============================================ */
            
            --space-0: 0px;
            --space-1: 4px;
            --space-2: 8px;
            --space-3: 12px;
            --space-4: 16px;
            --space-5: 20px;
            --space-6: 24px;
            --space-8: 32px;
            --space-10: 40px;
            --space-12: 48px;
            --space-16: 64px;
            --space-20: 80px;
            --space-24: 96px;


            /* ============================================
               TYPOGRAPHY
               ============================================ */
            
            /* Font Families */
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
                "Courier New", monospace;
            
            /* Font Sizes */
            --text-xs: 12px;
            --text-sm: 13px;
            --text-base: 14px;
            --text-lg: 16px;
            --text-xl: 18px;
            --text-2xl: 20px;
            --text-3xl: 24px;
            
            /* Font Weights */
            --font-normal: 400;
            --font-medium: 500;
            --font-semibold: 600;
            --font-bold: 700;
            
            /* Line Heights */
            --leading-tight: 1.25;
            --leading-normal: 1.5;
            --leading-relaxed: 1.75;


            /* ============================================
               BORDER RADIUS
               ============================================ */
            
            --radius-none: 0px;
            --radius-sm: 6px;
            --radius-small: 6px;
            --radius-md: 8px;
            --radius-medium: 8px;
            --radius-lg: 12px;
            --radius-large: 12px;
            --radius-xl: 16px;
            --radius-full: 9999px;


            /* ============================================
               SHADOWS
               ============================================ */
            
            --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
                         0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                         0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
                         0 4px 6px -2px rgba(0, 0, 0, 0.05);
            --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                         0 10px 10px -5px rgba(0, 0, 0, 0.04);
            --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            --shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.1);


            /* ============================================
               ANIMATIONS
               ============================================ */
            
            /* Durations */
            --duration-fast: 150ms;
            --duration-base: 200ms;
            --duration-slow: 300ms;
            --duration-slower: 500ms;
            
            /* Easing Functions */
            --ease-in: cubic-bezier(0.4, 0, 1, 1);
            --ease-out: cubic-bezier(0, 0, 0.2, 1);
            --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
            --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);


            /* ============================================
               ELEVATION LEVELS
               ============================================ */
            
            --elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
            --elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            --elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);


            /* ============================================
               Z-INDEX SCALE
               ============================================ */
            
            --z-dropdown: 1000;
            --z-sticky: 1020;
            --z-fixed: 1030;
            --z-modal-backdrop: 1040;
            --z-modal: 1050;
            --z-popover: 1060;
            --z-tooltip: 1070;


            /* ============================================
               GLASSMORPHISM
               ============================================ */
            
            --glass-bg: rgba(255, 255, 255, 0.7);
            --glass-border: rgba(255, 255, 255, 0.18);
            --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);


            /* ============================================
               CONVENIENCE ALIASES
               ============================================ */
            
            --white: #FFFFFF;
            --black: #000000;
        `;
    }

    /**
     * Get all design tokens for dark mode
     * Returns CSS custom properties ready to inject into :host selector
     */
    static getDarkTokens(): string {
        return `
            /* ============================================
               NEUTRAL COLORS (Dark Mode)
               ============================================ */
            
            /* Darkest - Backgrounds, subtle dividers */
            --gray-50: #18181B;
            
            /* Elevated surfaces */
            --gray-100: #27272A;
            
            /* Borders, dividers */
            --gray-200: #3F3F46;
            
            /* Inactive borders */
            --gray-300: #52525B;
            
            /* Tertiary text, icons */
            --gray-400: #A1A1AA;
            
            /* Secondary text, default icons */
            --gray-500: #D4D4D8;
            
            /* Primary text hover */
            --gray-600: #E4E4E7;
            
            /* Emphasized text */
            --gray-700: #F4F4F5;
            
            /* High contrast backgrounds */
            --gray-800: #FAFAFA;
            
            /* Primary text, headings */
            --gray-900: #FFFFFF;


            /* ============================================
               PRIMARY COLORS (Dark Mode - Blue)
               ============================================ */
            
            --primary-50: #0D47A1;
            --primary-100: #1565C0;
            --primary-200: #1976D2;
            --primary-300: #42A5F5;
            --primary-400: #64B5F6;
            --primary-500: #90CAF9;
            --primary-600: #BBDEFB;
            --primary-700: #E3F2FD;
            --primary-800: #E3F2FD;


            /* ============================================
               MATERIAL DESIGN 3 - SURFACE COLORS (Dark)
               ============================================ */
            
            --md-surface: #121212;
            --md-surface-variant: #1E1E1E;
            --md-surface-container: #2C2C2C;
            --md-surface-container-high: #3A3A3A;
            --md-on-surface: #E3E3E3;
            --md-on-surface-variant: #CAC4D0;


            /* ============================================
               MATERIAL DESIGN 3 - PRIMARY CONTAINER (Dark)
               ============================================ */
            
            --md-primary-container: #004A77;
            --md-on-primary-container: #C5E7FF;


            /* ============================================
               MATERIAL DESIGN 3 - OUTLINE (Dark)
               ============================================ */
            
            --md-outline: #938F99;
            --md-outline-variant: #49454F;


            /* ============================================
               SEMANTIC COLORS (Dark Mode)
               ============================================ */
            
            /* Success (Green) */
            --success-50: #15803D;
            --success-100: #16A34A;
            --success-500: #4ADE80;
            --success-600: #86EFAC;
            --success-700: #BBF7D0;
            
            /* Warning (Amber) */
            --warning-50: #B45309;
            --warning-100: #D97706;
            --warning-500: #FCD34D;
            --warning-600: #FDE68A;
            --warning-700: #FEF3C7;
            
            /* Danger (Red) */
            --danger-50: #B91C1C;
            --danger-100: #DC2626;
            --danger-500: #F87171;
            --danger-600: #FCA5A5;
            --danger-700: #FECACA;


            /* ============================================
               PLATFORM COLORS (Dark Mode)
               ============================================ */
            
            /* ChatGPT */
            --chatgpt-light: #065F46;
            --chatgpt-dark: #10B981;
            --chatgpt-icon: #34D399;
            
            /* Gemini */
            --gemini-light: #1E40AF;
            --gemini-dark: #60A5FA;
            --gemini-icon: #93C5FD;


            /* ============================================
               SPACING SCALE (8px Grid) - Same as light mode
               ============================================ */
            
            --space-0: 0px;
            --space-1: 4px;
            --space-2: 8px;
            --space-3: 12px;
            --space-4: 16px;
            --space-5: 20px;
            --space-6: 24px;
            --space-8: 32px;
            --space-10: 40px;
            --space-12: 48px;
            --space-16: 64px;
            --space-20: 80px;
            --space-24: 96px;


            /* ============================================
               TYPOGRAPHY - Same as light mode
               ============================================ */
            
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
                "Courier New", monospace;
            
            --text-xs: 12px;
            --text-sm: 13px;
            --text-base: 14px;
            --text-lg: 16px;
            --text-xl: 18px;
            --text-2xl: 20px;
            --text-3xl: 24px;
            
            --font-normal: 400;
            --font-medium: 500;
            --font-semibold: 600;
            --font-bold: 700;
            
            --leading-tight: 1.25;
            --leading-normal: 1.5;
            --leading-relaxed: 1.75;


            /* ============================================
               BORDER RADIUS - Same as light mode
               ============================================ */
            
            --radius-none: 0px;
            --radius-sm: 6px;
            --radius-small: 6px;
            --radius-md: 8px;
            --radius-medium: 8px;
            --radius-lg: 12px;
            --radius-large: 12px;
            --radius-xl: 16px;
            --radius-full: 9999px;


            /* ============================================
               SHADOWS (Dark Mode - Enhanced)
               ============================================ */
            
            --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3);
            --shadow-sm: 0 1px 5px rgba(0, 0, 0, 0.4), 0 2px 2px rgba(0, 0, 0, 0.28);
            --shadow-md: 0 3px 5px rgba(0, 0, 0, 0.4), 0 1px 18px rgba(0, 0, 0, 0.24);
            --shadow-lg: 0 2px 4px rgba(0, 0, 0, 0.4), 0 4px 5px rgba(0, 0, 0, 0.28);
            --shadow-xl: 0 8px 10px rgba(0, 0, 0, 0.28), 0 3px 14px rgba(0, 0, 0, 0.24);
            --shadow-2xl: 0 24px 38px rgba(0, 0, 0, 0.28), 0 9px 46px rgba(0, 0, 0, 0.24);
            --shadow-focus: 0 0 0 3px rgba(90, 202, 249, 0.2);


            /* ============================================
               ANIMATIONS - Same as light mode
               ============================================ */
            
            --duration-fast: 150ms;
            --duration-base: 200ms;
            --duration-slow: 300ms;
            --duration-slower: 500ms;
            
            --ease-in: cubic-bezier(0.4, 0, 1, 1);
            --ease-out: cubic-bezier(0, 0, 0.2, 1);
            --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
            --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);


            /* ============================================
               ELEVATION LEVELS (Dark Mode)
               ============================================ */
            
            --elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
            --elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2);
            --elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
            --elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
            --elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.15);


            /* ============================================
               Z-INDEX SCALE - Same as light mode
               ============================================ */
            
            --z-dropdown: 1000;
            --z-sticky: 1020;
            --z-fixed: 1030;
            --z-modal-backdrop: 1040;
            --z-modal: 1050;
            --z-popover: 1060;
            --z-tooltip: 1070;


            /* ============================================
               GLASSMORPHISM (Dark Mode)
               ============================================ */
            
            --glass-bg: rgba(30, 30, 30, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
            --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);


            /* ============================================
               CONVENIENCE ALIASES
               ============================================ */
            
            --white: #FFFFFF;
            --black: #000000;
        `;
    }
}
