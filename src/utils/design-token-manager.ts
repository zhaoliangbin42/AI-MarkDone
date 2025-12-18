/**
 * Design Token Manager
 * 
 * Manages design tokens injection into Shadow DOM components.
 * Automatically generates CSS variable inheritance code from design-tokens.css.
 * 
 * @see /src/styles/design-tokens.css - Global design tokens source
 * 
 * @example
 * ```typescript
 * // In Shadow DOM component
 * const css = DesignTokenManager.generateInjectionCSS();
 * // Returns: --gray-50: var(--gray-50); --gray-100: var(--gray-100); ...
 * ```
 */
export class DesignTokenManager {
    /**
     * Get complete list of all design tokens to inject
     */
    static getTokenList(): string[] {
        return [
            // Neutral Colors (Gray Scale)
            ...this.generateRange('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),

            // Primary Colors (Material Blue)
            ...this.generateRange('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800]),

            // Material Design 3 - Surface Colors
            'md-surface',
            'md-surface-variant',
            'md-surface-container',
            'md-surface-container-high',
            'md-on-surface',
            'md-on-surface-variant',

            // Material Design 3 - Primary Container
            'md-primary-container',
            'md-on-primary-container',

            // Material Design 3 - Outline
            'md-outline',
            'md-outline-variant',

            // Semantic Colors - Success
            ...this.generateRange('success', [50, 100, 500, 600, 700]),

            // Semantic Colors - Warning
            ...this.generateRange('warning', [50, 100, 500, 600, 700]),

            // Semantic Colors - Danger
            ...this.generateRange('danger', [50, 100, 500, 600, 700]),

            // Platform Colors
            'chatgpt-light',
            'chatgpt-dark',
            'chatgpt-icon',
            'gemini-light',
            'gemini-dark',
            'gemini-icon',

            // Spacing (8px Grid System)
            ...this.generateRange('space', [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]),

            // Typography - Font Families
            'font-sans',
            'font-mono',

            // Typography - Font Sizes
            'text-xs',
            'text-sm',
            'text-base',
            'text-lg',
            'text-xl',
            'text-2xl',
            'text-3xl',

            // Typography - Font Weights
            'font-normal',
            'font-medium',
            'font-semibold',
            'font-bold',

            // Typography - Line Heights
            'leading-tight',
            'leading-normal',
            'leading-relaxed',

            // Border Radius
            'radius-none',
            'radius-extra-small',
            'radius-small',
            'radius-medium',
            'radius-large',
            'radius-extra-large',
            'radius-full',

            // Shadows (Material Design 3 Elevation)
            'shadow-none',
            'elevation-0',
            'elevation-1',
            'elevation-2',
            'elevation-3',
            'elevation-4',
            'elevation-5',
            'shadow-xs',
            'shadow-sm',
            'shadow-md',
            'shadow-lg',
            'shadow-xl',
            'shadow-2xl',
            'shadow-focus',

            // Icon Sizes
            'icon-xs',
            'icon-sm',
            'icon-md',
            'icon-lg',
            'icon-xl',

            // Animation & Transitions - Duration
            'duration-fast',
            'duration-base',
            'duration-slow',
            'duration-slower',

            // Animation & Transitions - Easing
            'ease-in',
            'ease-out',
            'ease-in-out',
            'ease-bounce',

            // Z-Index Scale
            'z-dropdown',
            'z-sticky',
            'z-fixed',
            'z-modal-backdrop',
            'z-modal',
            'z-popover',
            'z-tooltip',
        ];
    }

    /**
     * Generate range of tokens with numeric suffixes
     * 
     * @param prefix - Token prefix (e.g., 'gray', 'primary')
     * @param values - Array of numeric values (e.g., [50, 100, 200])
     * @returns Array of token names (e.g., ['gray-50', 'gray-100', 'gray-200'])
     * 
     * @example
     * ```typescript
     * generateRange('gray', [50, 100, 200])
     * // Returns: ['gray-50', 'gray-100', 'gray-200']
     * ```
     */
    private static generateRange(prefix: string, values: number[]): string[] {
        return values.map(v => `${prefix}-${v}`);
    }

    /**
     * Generate CSS variable injection code for Shadow DOM
     * 
     * Creates CSS that inherits all design tokens from the global :root scope
     * into the Shadow DOM :host scope.
     * 
     * @returns CSS string with variable inheritance declarations
     * 
     * @example
     * ```typescript
     * const css = `
     *   :host {
     *     ${DesignTokenManager.generateInjectionCSS()}
     *   }
     * `;
     * // Injects all tokens into Shadow DOM
     * ```
     */
    static generateInjectionCSS(): string {
        const tokens = this.getTokenList();
        return tokens
            .map(token => `--${token}: var(--${token});`)
            .join('\n            ');
    }

    /**
     * Generate CSS variable injection code with categorization
     * 
     * Same as generateInjectionCSS() but with category comments for better readability
     * 
     * @returns CSS string with categorized variable inheritance declarations
     */
    static generateCategorizedInjectionCSS(): string {
        const categories = {
            'NEUTRAL COLORS': this.generateRange('gray', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
            'PRIMARY COLORS': this.generateRange('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800]),
            'MATERIAL DESIGN 3': [
                'md-surface', 'md-surface-variant', 'md-surface-container',
                'md-surface-container-high', 'md-on-surface', 'md-on-surface-variant',
                'md-primary-container', 'md-on-primary-container',
                'md-outline', 'md-outline-variant',
            ],
            'SEMANTIC COLORS': [
                ...this.generateRange('success', [50, 100, 500, 600, 700]),
                ...this.generateRange('warning', [50, 100, 500, 600, 700]),
                ...this.generateRange('danger', [50, 100, 500, 600, 700]),
            ],
            'PLATFORM COLORS': [
                'chatgpt-light', 'chatgpt-dark', 'chatgpt-icon',
                'gemini-light', 'gemini-dark', 'gemini-icon',
            ],
            'SPACING': this.generateRange('space', [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]),
            'TYPOGRAPHY': [
                'font-sans', 'font-mono',
                'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl',
                'font-normal', 'font-medium', 'font-semibold', 'font-bold',
                'leading-tight', 'leading-normal', 'leading-relaxed',
            ],
            'BORDER RADIUS': [
                'radius-none', 'radius-extra-small', 'radius-small',
                'radius-medium', 'radius-large', 'radius-extra-large', 'radius-full',
            ],
            'SHADOWS': [
                'shadow-none', 'elevation-0', 'elevation-1', 'elevation-2', 'elevation-3',
                'elevation-4', 'elevation-5', 'shadow-xs', 'shadow-sm', 'shadow-md',
                'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-focus',
            ],
            'ICON SIZES': ['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl'],
            'ANIMATION': [
                'duration-fast', 'duration-base', 'duration-slow', 'duration-slower',
                'ease-in', 'ease-out', 'ease-in-out', 'ease-bounce',
            ],
            'Z-INDEX': [
                'z-dropdown', 'z-sticky', 'z-fixed',
                'z-modal-backdrop', 'z-modal', 'z-popover', 'z-tooltip',
            ],
        };

        const lines: string[] = [];

        for (const [category, tokens] of Object.entries(categories)) {
            lines.push(`/* ${category} */`);
            for (const token of tokens) {
                lines.push(`--${token}: var(--${token});`);
            }
            lines.push('');
        }

        return lines.join('\n            ');
    }
}
