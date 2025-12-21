/**
 * Theme Configuration - AI-MarkDone
 * 
 * This file contains configurable theme settings.
 * You can easily switch themes or customize gradient colors here.
 * 
 * Version: 1.0.0
 * Last Updated: 2025-12-16
 */

export interface ThemeGradient {
    name: string;
    description: string;
    startColor: string;  // Gradient start color
    endColor: string;    // Gradient end color
    angle: number;       // Gradient angle in degrees (default: 135)
}

export interface ThemeColors {
    // Primary color scale (derived from gradient start color)
    primary50: string;
    primary100: string;
    primary200: string;
    primary300: string;
    primary400: string;
    primary500: string;  // Main color (gradient start)
    primary600: string;  // Hover state
    primary700: string;  // Active state
    primary800: string;
}

export interface Theme {
    name: string;
    gradient: ThemeGradient;
    colors: ThemeColors;
}

/**
 * Available Themes
 */
export const THEMES: Record<string, Theme> = {
    // Default: Pink to Yellow Gradient
    gradient: {
        name: 'Gradient (Pink to Yellow)',
        gradient: {
            name: 'Sunset Gradient',
            description: 'Soft pink to pale yellow - warm and elegant',
            startColor: '#d9a7c7',
            endColor: '#fffcdc',
            angle: 135
        },
        colors: {
            primary50: '#fffcf5',
            primary100: '#fffcdc',
            primary200: '#f7e6ee',
            primary300: '#eed1e1',
            primary400: '#e4bcd4',
            primary500: '#d9a7c7',  // Main gradient start color
            primary600: '#c794b8',  // Darker for hover
            primary700: '#b581a9',  // Even darker for active
            primary800: '#a36e9a'
        }
    },

    // Alternative: Blue Theme (original)
    blue: {
        name: 'Blue',
        gradient: {
            name: 'Blue Gradient',
            description: 'Classic blue gradient',
            startColor: '#3B82F6',
            endColor: '#DBEAFE',
            angle: 135
        },
        colors: {
            primary50: '#EFF6FF',
            primary100: '#DBEAFE',
            primary200: '#BFDBFE',
            primary300: '#93C5FD',
            primary400: '#60A5FA',
            primary500: '#3B82F6',
            primary600: '#2563EB',
            primary700: '#1D4ED8',
            primary800: '#1E40AF'
        }
    }
};

/**
 * Active Theme
 * 
 * Change this value to switch themes:
 * - 'gradient' for pink-to-yellow gradient (default)
 * - 'blue' for classic blue theme
 * 
 * Or add your own custom theme to the THEMES object above!
 */
export const ACTIVE_THEME: keyof typeof THEMES = 'gradient';

/**
 * Get the current active theme
 */
export function getActiveTheme(): Theme {
    return THEMES[ACTIVE_THEME];
}

/**
 * Generate CSS gradient string
 */
export function getGradientCSS(gradient: ThemeGradient, opacity: number = 1): string {
    if (opacity < 1) {
        // Convert hex to rgba for opacity
        const startRgba = hexToRgba(gradient.startColor, opacity);
        const endRgba = hexToRgba(gradient.endColor, opacity);
        return `linear-gradient(${gradient.angle}deg, ${startRgba} 0%, ${endRgba} 100%)`;
    }
    return `linear-gradient(${gradient.angle}deg, ${gradient.startColor} 0%, ${gradient.endColor} 100%)`;
}

/**
 * Helper: Convert hex to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Quick Customization Guide:
 * 
 * 1. To change gradient colors:
 *    - Edit THEMES.gradient.gradient.startColor
 *    - Edit THEMES.gradient.gradient.endColor
 * 
 * 2. To change gradient angle:
 *    - Edit THEMES.gradient.gradient.angle (0-360)
 *    - Common angles: 90 (vertical), 135 (diagonal), 180 (horizontal)
 * 
 * 3. To switch to blue theme:
 *    - Change ACTIVE_THEME to 'blue'
 * 
 * 4. To create a custom theme:
 *    - Copy the 'gradient' theme structure
 *    - Change the colors
 *    - Add it to THEMES object
 *    - Update ACTIVE_THEME to your theme name
 */
