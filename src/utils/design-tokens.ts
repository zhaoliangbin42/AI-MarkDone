/**
 * Design Tokens Utility - Two-Tier Architecture
 * 
 * Architecture:
 * - Layer 1: Primitive Tokens (Base colors - immutable)
 * - Layer 2: Semantic Tokens (Context-aware mappings - mode-specific)
 * 
 * Manages CSS custom properties (design tokens) for Shadow DOM components.
 * Provides isolated tokens for light and dark modes without polluting global scope.
 * 
 * @see /docs/design_system.md - Design system specification
 * @see /docs/design_tokens_reference.md - Quick reference
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
     * Get primitive color tokens (Layer 1)
     * These are base colors that NEVER change - globally unique
     * @returns CSS custom properties string
     */
    static getPrimitiveTokens(): string {
        return `
            /* ============================================
               PRIMITIVE TOKENS - Base Colors (Immutable)
               ============================================ */
            
            /* Neutral Colors (Gray) - 10 levels */
            --color-gray-50: #F9FAFB;
            --color-gray-100: #F3F4F6;
            --color-gray-200: #E5E7EB;
            --color-gray-300: #D1D5DB;
            --color-gray-400: #9CA3AF;
            --color-gray-500: #6B7280;
            --color-gray-600: #4B5563;
            --color-gray-700: #374151;
            --color-gray-800: #1F2937;
            --color-gray-900: #111827;

            /* Blue (Primary) - 10 levels */
            --color-blue-50: #E3F2FD;
            --color-blue-100: #BBDEFB;
            --color-blue-200: #90CAF9;
            --color-blue-300: #64B5F6;
            --color-blue-400: #42A5F5;
            --color-blue-500: #2196F3;
            --color-blue-600: #1976D2;
            --color-blue-700: #1565C0;
            --color-blue-800: #0D47A1;
            --color-blue-900: #0A3A7F;

            /* Green - 10 levels */
            --color-green-50: #F0FDF4;
            --color-green-100: #DCFCE7;
            --color-green-200: #BBF7D0;
            --color-green-300: #86EFAC;
            --color-green-400: #4ADE80;
            --color-green-500: #22C55E;
            --color-green-600: #16A34A;
            --color-green-700: #15803D;
            --color-green-800: #166534;
            --color-green-900: #14532D;

            /* Purple - 10 levels */
            --color-purple-50: #FAF5FF;
            --color-purple-100: #F3E8FF;
            --color-purple-200: #E9D5FF;
            --color-purple-300: #D8B4FE;
            --color-purple-400: #C084FC;
            --color-purple-500: #A855F7;
            --color-purple-600: #9333EA;
            --color-purple-700: #7E22CE;
            --color-purple-800: #6B21A8;
            --color-purple-900: #581C87;

            /* Red - 10 levels */
            --color-red-50: #FEF2F2;
            --color-red-100: #FEE2E2;
            --color-red-200: #FECACA;
            --color-red-300: #FCA5A5;
            --color-red-400: #F87171;
            --color-red-500: #EF4444;
            --color-red-600: #DC2626;
            --color-red-700: #B91C1C;
            --color-red-800: #991B1B;
            --color-red-900: #7F1D1D;

            /* Amber - 10 levels */
            --color-amber-50: #FFFBEB;
            --color-amber-100: #FEF3C7;
            --color-amber-200: #FDE68A;
            --color-amber-300: #FCD34D;
            --color-amber-400: #FBBF24;
            --color-amber-500: #F59E0B;
            --color-amber-600: #D97706;
            --color-amber-700: #B45309;
            --color-amber-800: #92400E;
            --color-amber-900: #78350F;

            /* Special Colors */
            --color-white: #FFFFFF;
            --color-black: #000000;

            /* Dark Mode Specific Grays */
            --color-gray-dark-50: #18181B;
            --color-gray-dark-100: #27272A;
            --color-gray-dark-200: #3F3F46;
            --color-gray-dark-300: #52525B;
            --color-gray-dark-400: #A1A1AA;
            --color-gray-dark-500: #D4D4D8;
            --color-gray-dark-600: #E4E4E7;
            --color-gray-dark-700: #F4F4F5;
            --color-gray-dark-800: #FAFAFA;
            --color-gray-dark-900: #FFFFFF;
        `;
    }

    /**
     * Get light mode semantic tokens (Layer 2)
     * These reference primitive tokens based on light mode context
     * @returns CSS custom properties string
     */
    static getLightSemanticTokens(): string {
        return `
            /* ============================================
               SEMANTIC TOKENS - Light Mode
               ============================================ */

            /* Background Colors */
            --bg-primary: var(--color-white);
            --bg-secondary: var(--color-gray-50);
            --bg-tertiary: var(--color-gray-100);
            --bg-surface: var(--color-white);
            --bg-surface-elevated: var(--color-gray-50);
            --bg-modal: var(--color-white);
            --bg-overlay: rgba(0, 0, 0, 0.5);

            /* Text Colors */
            --text-primary: var(--color-gray-900);
            --text-secondary: var(--color-gray-500);
            --text-tertiary: var(--color-gray-400);
            --text-link: var(--color-blue-600);
            --text-link-hover: var(--color-blue-700);
            --text-on-primary: var(--color-white);
            --text-disabled: var(--color-gray-300);

            /* Border Colors */
            --border-default: var(--color-gray-200);
            --border-subtle: var(--color-gray-100);
            --border-strong: var(--color-gray-300);
            --border-interactive: var(--color-blue-500);
            --border-focus: var(--color-blue-300);
            --border-error: var(--color-red-500);

            /* Interactive Colors */
            --interactive-primary: var(--color-blue-600);
            --interactive-primary-hover: var(--color-blue-700);
            --interactive-selected: rgba(59, 130, 246, 0.12);
            --interactive-secondary: var(--color-gray-100);
            --interactive-secondary-hover: var(--color-gray-200);
            --interactive-hover: var(--color-gray-100);
            --interactive-active: var(--color-gray-200);
            --interactive-disabled: var(--color-gray-300);

            /* Semantic States */
            --success: var(--color-green-600);
            --success-bg: var(--color-green-50);
            --warning: var(--color-amber-600);
            --warning-bg: var(--color-amber-50);
            --error: var(--color-red-600);
            --error-bg: var(--color-red-50);
            --info: var(--color-blue-600);
            --info-bg: var(--color-blue-50);

            /* Platform Colors */
            --platform-chatgpt-bg: var(--color-green-100);
            --platform-chatgpt-text: var(--color-green-800);
            --platform-gemini-bg: var(--color-blue-100);
            --platform-gemini-text: var(--color-blue-800);

            /* Legacy Support - Backward Compatible (will be phased out) */
            --gray-50: var(--color-gray-50);
            --gray-100: var(--color-gray-100);
            --gray-200: var(--color-gray-200);
            --gray-300: var(--color-gray-300);
            --gray-400: var(--color-gray-400);
            --gray-500: var(--color-gray-500);
            --gray-600: var(--color-gray-600);
            --gray-700: var(--color-gray-700);
            --gray-800: var(--color-gray-800);
            --gray-900: var(--color-gray-900);

            --primary-50: var(--color-blue-50);
            --primary-100: var(--color-blue-100);
            --primary-200: var(--color-blue-200);
            --primary-300: var(--color-blue-300);
            --primary-400: var(--color-blue-400);
            --primary-500: var(--color-blue-500);
            --primary-600: var(--color-blue-600);
            --primary-700: var(--color-blue-700);
            --primary-800: var(--color-blue-800);

            --success-50: var(--color-green-50);
            --success-100: var(--color-green-100);
            --success-500: var(--color-green-500);
            --success-600: var(--color-green-600);
            --success-700: var(--color-green-700);

            --warning-50: var(--color-amber-50);
            --warning-100: var(--color-amber-100);
            --warning-500: var(--color-amber-500);
            --warning-600: var(--color-amber-600);
            --warning-700: var(--color-amber-700);

            --danger-50: var(--color-red-50);
            --danger-100: var(--color-red-100);
            --danger-500: var(--color-red-500);
            --danger-600: var(--color-red-600);
            --danger-700: var(--color-red-700);

            /* Material Design 3 - Surface Colors */
            --md-surface: var(--color-white);
            --md-surface-variant: #F5F5F5;
            --md-surface-container: #FAFAFA;
            --md-surface-container-high: #EEEEEE;
            --md-on-surface: #1C1B1F;
            --md-on-surface-variant: #49454F;
            --md-primary-container: var(--color-blue-50);
            --md-on-primary-container: var(--color-blue-800);
            --md-outline: #E0E0E0;
            --md-outline-variant: #EEEEEE;

            /* Platform Legacy */
            --chatgpt-light: #D1FAE5;
            --chatgpt-dark: #065F46;
            --chatgpt-icon: #10A37F;
            --gemini-light: #DBEAFE;
            --gemini-dark: #1E40AF;
            --gemini-icon: #4285F4;

            /* Component-Specific */
            --modal-tree-bg: var(--bg-secondary);
            --modal-tree-item-hover: var(--interactive-hover);
            --modal-tree-item-text: var(--text-primary);
            --modal-tree-item-icon: var(--color-gray-600);

            /* Button Tokens - Primary */
            --button-primary-bg: var(--color-blue-600);
            --button-primary-hover: var(--color-blue-700);
            --button-primary-active: var(--color-blue-800);
            --button-primary-text: var(--color-white);
            --button-primary-text-hover: var(--color-white);
            --button-primary-disabled: var(--color-gray-300);
            --button-primary-disabled-text: var(--color-gray-500);

            /* Button Tokens - Secondary */
            --button-secondary-bg: transparent;
            --button-secondary-hover: var(--color-gray-100);
            --button-secondary-active: var(--color-gray-200);
            --button-secondary-text: var(--color-blue-600);
            --button-secondary-text-hover: var(--color-blue-700);
            --button-secondary-border: var(--color-gray-300);
            --button-secondary-disabled: var(--color-gray-200);
            --button-secondary-disabled-text: var(--color-gray-400);

            /* Button Tokens - Danger */
            --button-danger-bg: var(--color-red-600);
            --button-danger-hover: var(--color-red-700);
            --button-danger-active: var(--color-red-800);
            --button-danger-text: var(--color-white);
            --button-danger-text-hover: var(--color-white);
            --button-danger-disabled: var(--color-red-300);
            --button-danger-disabled-text: var(--color-red-100);

            /* Button Tokens - Warning */
            --button-warning-bg: var(--color-amber-500);
            --button-warning-hover: var(--color-amber-600);
            --button-warning-active: var(--color-amber-700);
            --button-warning-text: var(--color-white);
            --button-warning-text-hover: var(--color-white);
            --button-warning-disabled: var(--color-amber-300);

            /* Button Tokens - Ghost (Transparent) */
            --button-ghost-bg: transparent;
            --button-ghost-hover: var(--interactive-hover);
            --button-ghost-active: var(--interactive-active);
            --button-ghost-text: var(--text-primary);
            --button-ghost-text-hover: var(--text-primary);

            /* Button Tokens - Icon */
            --button-icon-bg: transparent;
            --button-icon-hover: var(--color-gray-100);
            --button-icon-active: var(--color-gray-200);
            --button-icon-text: var(--color-gray-600);
            --button-icon-text-hover: var(--color-gray-900);

            /* Button Tokens - Close */
            --button-close-bg: transparent;
            --button-close-hover: var(--color-gray-100);
            --button-close-active: var(--color-gray-200);
            --button-close-text: var(--color-gray-500);
            --button-close-text-hover: var(--color-gray-900);
        `;
    }

    /**
     * Get dark mode semantic tokens (Layer 2)
     * These reference primitive tokens based on dark mode context
     * @returns CSS custom properties string
     */
    static getDarkSemanticTokens(): string {
        return `
            /* ============================================
               SEMANTIC TOKENS - Dark Mode
               ============================================ */

            /* Background Colors */
            --bg-primary: var(--color-gray-dark-50);
            --bg-secondary: var(--color-gray-dark-100);
            --bg-tertiary: var(--color-gray-dark-200);
            --bg-surface: #121212;
            --bg-surface-elevated: #1E1E1E;
            --bg-modal: #121212;
            --bg-overlay: rgba(0, 0, 0, 0.65);

            /* Text Colors */
            --text-primary: var(--color-white);
            --text-secondary: var(--color-gray-dark-500);
            --text-tertiary: var(--color-gray-dark-400);
            --text-link: var(--color-blue-400);
            --text-link-hover: var(--color-blue-300);
            --text-on-primary: var(--color-white);
            --text-disabled: var(--color-gray-dark-300);

            /* Border Colors */
            --border-default: var(--color-gray-dark-200);
            --border-subtle: var(--color-gray-dark-100);
            --border-strong: var(--color-gray-dark-300);
            --border-interactive: var(--color-blue-400);
            --border-focus: var(--color-blue-200);
            --border-error: var(--color-red-400);

            /* Interactive Colors */
            --interactive-primary: var(--color-blue-400);
            --interactive-primary-hover: var(--color-blue-500);
            --interactive-selected: rgba(59, 130, 246, 0.2);
            --interactive-secondary: var(--color-gray-dark-100);
            --interactive-secondary-hover: var(--color-gray-dark-200);
            --interactive-hover: var(--color-gray-dark-100);
            --interactive-active: var(--color-gray-dark-200);
            --interactive-disabled: var(--color-gray-dark-300);

            /* Semantic States */
            --success: var(--color-green-400);
            --success-bg: var(--color-green-900);
            --warning: var(--color-amber-400);
            --warning-bg: var(--color-amber-900);
            --error: var(--color-red-400);
            --error-bg: var(--color-red-900);
            --info: var(--color-blue-400);
            --info-bg: var(--color-blue-900);

            /* Platform Colors */
            --platform-chatgpt-bg: var(--color-green-900);
            --platform-chatgpt-text: var(--color-green-200);
            --platform-gemini-bg: var(--color-blue-900);
            --platform-gemini-text: var(--color-blue-200);

            /* Legacy Support - Backward Compatible (will be phased out) */
            --gray-50: var(--color-gray-dark-50);
            --gray-100: var(--color-gray-dark-100);
            --gray-200: var(--color-gray-dark-200);
            --gray-300: var(--color-gray-dark-300);
            --gray-400: var(--color-gray-dark-400);
            --gray-500: var(--color-gray-dark-500);
            --gray-600: var(--color-gray-dark-600);
            --gray-700: var(--color-gray-dark-700);
            --gray-800: var(--color-gray-dark-800);
            --gray-900: var(--color-gray-dark-900);

            --primary-50: var(--color-blue-50);
            --primary-100: var(--color-blue-100);
            --primary-200: var(--color-blue-200);
            --primary-300: var(--color-blue-300);
            --primary-400: var(--color-blue-400);
            --primary-500: var(--color-blue-500);
            --primary-600: var(--color-blue-600);
            --primary-700: var(--color-blue-700);
            --primary-800: var(--color-blue-800);

            --success-50: var(--color-green-50);
            --success-100: var(--color-green-100);
            --success-500: var(--color-green-500);
            --success-600: var(--color-green-600);
            --success-700: var(--color-green-700);

            --warning-50: var(--color-amber-50);
            --warning-100: var(--color-amber-100);
            --warning-500: var(--color-amber-500);
            --warning-600: var(--color-amber-600);
            --warning-700: var(--color-amber-700);

            --danger-50: var(--color-red-50);
            --danger-100: var(--color-red-100);
            --danger-500: var(--color-red-500);
            --danger-600: var(--color-red-600);
            --danger-700: var(--color-red-700);

            /* Material Design 3 - Surface Colors (Dark) */
            --md-surface: #121212;
            --md-surface-variant: #1E1E1E;
            --md-surface-container: #2C2C2C;
            --md-surface-container-high: #3A3A3A;
            --md-on-surface: #E3E3E3;
            --md-on-surface-variant: #CAC4D0;
            --md-primary-container: #004A77;
            --md-on-primary-container: #C5E7FF;
            --md-outline: #938F99;
            --md-outline-variant: #49454F;

            /* Platform Legacy */
            --chatgpt-light: #065F46;
            --chatgpt-dark: #10B981;
            --chatgpt-icon: #34D399;
            --gemini-light: #1E40AF;
            --gemini-dark: #60A5FA;
            --gemini-icon: #93C5FD;

            /* Component-Specific */
            --modal-tree-bg: var(--color-gray-dark-50);
            --modal-tree-item-hover: var(--color-gray-dark-100);
            --modal-tree-item-text: var(--color-gray-dark-900);
            --modal-tree-item-icon: var(--color-gray-dark-400);

            /* Button Tokens - Primary */
            --button-primary-bg: var(--color-blue-400);
            --button-primary-hover: var(--color-blue-500);
            --button-primary-active: var(--color-blue-600);
            --button-primary-text: var(--color-white);
            --button-primary-text-hover: var(--color-white);
            --button-primary-disabled: var(--color-gray-dark-300);
            --button-primary-disabled-text: var(--color-gray-dark-500);

            /* Button Tokens - Secondary */
            --button-secondary-bg: transparent;
            --button-secondary-hover: var(--color-gray-dark-100);
            --button-secondary-active: var(--color-gray-dark-200);
            --button-secondary-text: var(--color-blue-400);
            --button-secondary-text-hover: var(--color-blue-300);
            --button-secondary-border: var(--color-gray-dark-300);
            --button-secondary-disabled: var(--color-gray-dark-200);
            --button-secondary-disabled-text: var(--color-gray-dark-400);

            /* Button Tokens - Danger */
            --button-danger-bg: var(--color-red-500);
            --button-danger-hover: var(--color-red-600);
            --button-danger-active: var(--color-red-700);
            --button-danger-text: var(--color-white);
            --button-danger-text-hover: var(--color-white);
            --button-danger-disabled: var(--color-red-dark-300);
            --button-danger-disabled-text: var(--color-red-dark-100);

            /* Button Tokens - Warning */
            --button-warning-bg: var(--color-amber-500);
            --button-warning-hover: var(--color-amber-600);
            --button-warning-active: var(--color-amber-700);
            --button-warning-text: var(--color-gray-900);
            --button-warning-text-hover: var(--color-gray-900);
            --button-warning-disabled: var(--color-amber-dark-300);

            /* Button Tokens - Ghost (Transparent) */
            --button-ghost-bg: transparent;
            --button-ghost-hover: var(--interactive-hover);
            --button-ghost-active: var(--interactive-active);
            --button-ghost-text: var(--text-primary);
            --button-ghost-text-hover: var(--text-primary);

            /* Button Tokens - Icon */
            --button-icon-bg: transparent;
            --button-icon-hover: var(--color-gray-dark-100);
            --button-icon-active: var(--color-gray-dark-200);
            --button-icon-text: var(--color-gray-dark-400);
            --button-icon-text-hover: var(--color-white);

            /* Button Tokens - Close */
            --button-close-bg: transparent;
            --button-close-hover: var(--color-gray-dark-100);
            --button-close-active: var(--color-gray-dark-200);
            --button-close-text: var(--color-gray-dark-400);
            --button-close-text-hover: var(--color-white);
        `;
    }

    /**
     * Get non-color tokens (spacing, typography, etc.)
     * These are mode-independent
     * @returns CSS custom properties string
     */
    static getCommonTokens(): string {
        return `
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

            /* Aliases */
            --white: var(--color-white);
            --black: var(--color-black);
        `;
    }

    /**
     * Get mode-specific shadow tokens
     * @param isDark Whether dark mode is active
     * @returns CSS custom properties string
     */
    static getShadowTokens(isDark: boolean): string {
        if (isDark) {
            return `
                /* Dark Mode Shadows */
                --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3);
                --shadow-sm: 0 1px 5px rgba(0, 0, 0, 0.4), 0 2px 2px rgba(0, 0, 0, 0.28);
                --shadow-md: 0 3px 5px rgba(0, 0, 0, 0.4), 0 1px 18px rgba(0, 0, 0, 0.24);
                --shadow-lg: 0 2px 4px rgba(0, 0, 0, 0.4), 0 4px 5px rgba(0, 0, 0, 0.28);
                --shadow-xl: 0 8px 10px rgba(0, 0, 0, 0.28), 0 3px 14px rgba(0, 0, 0, 0.24);
                --shadow-2xl: 0 24px 38px rgba(0, 0, 0, 0.28), 0 9px 46px rgba(0, 0, 0, 0.24);
                --shadow-focus: 0 0 0 3px rgba(90, 202, 249, 0.2);

                --elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
                --elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2);
                --elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
                --elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
                --elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.15);

                --glass-bg: rgba(30, 30, 30, 0.7);
                --glass-border: rgba(255, 255, 255, 0.1);
                --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            `;
        } else {
            return `
                /* Light Mode Shadows */
                --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                --shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.1);

                --elevation-0: 0 0 0 0 rgba(0, 0, 0, 0);
                --elevation-1: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                --elevation-2: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --elevation-3: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                --elevation-4: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

                --glass-bg: rgba(255, 255, 255, 0.7);
                --glass-border: rgba(255, 255, 255, 0.18);
                --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            `;
        }
    }

    /**
     * Get complete token set for current mode
     * Combines primitive tokens + semantic tokens + common tokens
     * @deprecated Use getCompleteTokens() instead
     */
    static getLightTokens(): string {
        return this.getCompleteTokens(false);
    }

    /**
     * Get complete token set for current mode
     * Combines primitive tokens + semantic tokens + common tokens
     * @deprecated Use getCompleteTokens() instead
     */
    static getDarkTokens(): string {
        return this.getCompleteTokens(true);
    }

    /**
     * Get complete token set for specified mode
     * Combines: Primitive Tokens + Semantic Tokens + Common Tokens + Shadows
     * @param isDark Whether to get dark mode tokens
     * @returns Complete CSS custom properties string
     */
    static getCompleteTokens(isDark: boolean): string {
        const primitiveTokens = this.getPrimitiveTokens();
        const semanticTokens = isDark ? this.getDarkSemanticTokens() : this.getLightSemanticTokens();
        const commonTokens = this.getCommonTokens();
        const shadowTokens = this.getShadowTokens(isDark);

        return `
            ${primitiveTokens}
            ${semanticTokens}
            ${commonTokens}
            ${shadowTokens}
        `;
    }
}
