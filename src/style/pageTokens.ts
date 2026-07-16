import { createAppearanceSnapshot } from './appearance';
import { AppearanceScope } from './appearanceScope';
import type { UserThemeOverrides } from './tokens';

const pageScopes = new WeakMap<Document, AppearanceScope>();

/**
 * Expose `--aimd-*` tokens to the host page DOM (non-Shadow elements).
 *
 * Why:
 * - Some behaviors (e.g. math click highlight / tooltip) touch page DOM directly.
 * - We still want them to use design tokens rather than hard-coded colors/sizes.
 */
export function ensurePageTokens(overrides: UserThemeOverrides = {}): void {
    if (typeof document === 'undefined') return;
    let scope = pageScopes.get(document);
    if (!scope) {
        scope = AppearanceScope.forPage(document);
        pageScopes.set(document, scope);
    }
    scope.apply(createAppearanceSnapshot('light', overrides));
}
