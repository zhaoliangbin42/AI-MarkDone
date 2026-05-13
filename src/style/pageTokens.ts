import { getPageTokenCss, type UserThemeOverrides } from './tokens';

const STYLE_ID = 'aimd-page-token-vars';

/**
 * Expose `--aimd-*` tokens to the host page DOM (non-Shadow elements).
 *
 * Why:
 * - Some behaviors (e.g. math click highlight / tooltip) touch page DOM directly.
 * - We still want them to use design tokens rather than hard-coded colors/sizes.
 */
export function ensurePageTokens(overrides: UserThemeOverrides = {}): void {
    if (typeof document === 'undefined') return;
    const css = getPageTokenCss(overrides);
    const existing = document.getElementById(STYLE_ID);
    if (existing instanceof HTMLStyleElement) {
        existing.textContent = css;
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;

    (document.head || document.documentElement).appendChild(style);
}
