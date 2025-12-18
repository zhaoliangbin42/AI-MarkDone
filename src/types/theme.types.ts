/**
 * Theme Type Definitions
 * 
 * Provides TypeScript type safety for the design token system.
 * Ensures compile-time checking of token names and theme configurations.
 */

/**
 * Theme mode - light or dark
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Design token categories
 */
export type TokenCategory =
    | 'colors'
    | 'spacing'
    | 'typography'
    | 'radius'
    | 'shadows'
    | 'animation'
    | 'zIndex';

/**
 * All available design tokens
 * 
 * Union type of all token names from design-tokens.css
 * Provides autocomplete and type checking
 */
export type DesignToken =
    // Neutral Colors
    | 'gray-50' | 'gray-100' | 'gray-200' | 'gray-300' | 'gray-400'
    | 'gray-500' | 'gray-600' | 'gray-700' | 'gray-800' | 'gray-900'

    // Primary Colors
    | 'primary-50' | 'primary-100' | 'primary-200' | 'primary-300' | 'primary-400'
    | 'primary-500' | 'primary-600' | 'primary-700' | 'primary-800'

    // Material Design 3
    | 'md-surface' | 'md-surface-variant' | 'md-surface-container'
    | 'md-surface-container-high' | 'md-on-surface' | 'md-on-surface-variant'
    | 'md-primary-container' | 'md-on-primary-container'
    | 'md-outline' | 'md-outline-variant'

    // Semantic Colors
    | 'success-50' | 'success-100' | 'success-500' | 'success-600' | 'success-700'
    | 'warning-50' | 'warning-100' | 'warning-500' | 'warning-600' | 'warning-700'
    | 'danger-50' | 'danger-100' | 'danger-500' | 'danger-600' | 'danger-700'

    // Platform Colors
    | 'chatgpt-light' | 'chatgpt-dark' | 'chatgpt-icon'
    | 'gemini-light' | 'gemini-dark' | 'gemini-icon'

    // Spacing
    | 'space-0' | 'space-1' | 'space-2' | 'space-3' | 'space-4'
    | 'space-5' | 'space-6' | 'space-8' | 'space-10' | 'space-12'
    | 'space-16' | 'space-20' | 'space-24'

    // Typography
    | 'font-sans' | 'font-mono'
    | 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl' | 'text-3xl'
    | 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold'
    | 'leading-tight' | 'leading-normal' | 'leading-relaxed'

    // Border Radius
    | 'radius-none' | 'radius-extra-small' | 'radius-small'
    | 'radius-medium' | 'radius-large' | 'radius-extra-large' | 'radius-full'

    // Shadows
    | 'shadow-none' | 'elevation-0' | 'elevation-1' | 'elevation-2' | 'elevation-3'
    | 'elevation-4' | 'elevation-5' | 'shadow-xs' | 'shadow-sm' | 'shadow-md'
    | 'shadow-lg' | 'shadow-xl' | 'shadow-2xl' | 'shadow-focus'

    // Icon Sizes
    | 'icon-xs' | 'icon-sm' | 'icon-md' | 'icon-lg' | 'icon-xl'

    // Animation
    | 'duration-fast' | 'duration-base' | 'duration-slow' | 'duration-slower'
    | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-bounce'

    // Z-Index
    | 'z-dropdown' | 'z-sticky' | 'z-fixed'
    | 'z-modal-backdrop' | 'z-modal' | 'z-popover' | 'z-tooltip';

/**
 * Theme tokens - mapping of token names to CSS values
 */
export interface ThemeTokens {
    // Colors
    colors: {
        gray: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
        primary: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800, string>;
    };

    // Semantic
    semantic: {
        surface: {
            default: string;
            variant: string;
            container: string;
            containerHigh: string;
        };
        text: {
            primary: string;
            secondary: string;
            muted: string;
        };
        border: {
            default: string;
            light: string;
        };
    };

    // Spacing
    spacing: Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24, string>;

    // Typography
    typography: {
        fontFamily: {
            sans: string;
            mono: string;
        };
        fontSize: {
            xs: string;
            sm: string;
            base: string;
            lg: string;
            xl: string;
            '2xl': string;
            '3xl': string;
        };
        fontWeight: {
            normal: string;
            medium: string;
            semibold: string;
            bold: string;
        };
    };

    // Border Radius
    radius: {
        none: string;
        extraSmall: string;
        small: string;
        medium: string;
        large: string;
        extraLarge: string;
        full: string;
    };
}

/**
 * Component theme configuration
 * 
 * Used for component-specific theme overrides
 */
export interface ComponentTheme {
    mode: ThemeMode;
    tokens: Partial<ThemeTokens>;
}
