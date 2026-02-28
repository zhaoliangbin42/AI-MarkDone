import { getPageTokenCss } from './tokens';

const STYLE_ID = 'aimd-page-token-vars';

/**
 * Expose `--aimd-*` tokens to the host page DOM (non-Shadow elements).
 *
 * Why:
 * - Some behaviors (e.g. math click highlight / tooltip) touch page DOM directly.
 * - We still want them to use design tokens rather than hard-coded colors/sizes.
 */
export function ensurePageTokens(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = getPageTokenCss();

    (document.head || document.documentElement).appendChild(style);
}

