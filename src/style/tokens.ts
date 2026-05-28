import type { Theme } from '../core/types/theme';
import { getReferenceTokenCss } from './reference-tokens';
import { getSystemTokenCss, type UserThemeOverrides } from './system-tokens';

export type { UserThemeOverrides } from './system-tokens';

function swapScope(css: string, scope: string): string {
    return css.replace(/:host/g, scope);
}

export function getTokenCss(theme: Theme, overrides: UserThemeOverrides = {}): string {
    return `${getReferenceTokenCss(theme)}\n${getSystemTokenCss(theme, overrides)}`;
}

export function getPageTokenCss(overrides: UserThemeOverrides = {}): string {
    const base = swapScope(getTokenCss('light', overrides), ':root');
    const light = swapScope(getTokenCss('light', overrides), ':root[data-aimd-theme="light"]');
    const dark = swapScope(getTokenCss('dark', overrides), ':root[data-aimd-theme="dark"]');
    return `${base}\n${light}\n${dark}`;
}
