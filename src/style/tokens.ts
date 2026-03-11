import type { Theme } from '../core/types/theme';
import { getReferenceTokenCss } from './reference-tokens';
import { getSystemTokenCss } from './system-tokens';

function swapScope(css: string, scope: string): string {
    return css.replace(/:host/g, scope);
}

export function getTokenCss(theme: Theme): string {
    return `${getReferenceTokenCss(theme)}\n${getSystemTokenCss(theme)}`;
}

export function getPageTokenCss(): string {
    const light = swapScope(getTokenCss('light'), ':root[data-aimd-theme="light"]');
    const dark = swapScope(getTokenCss('dark'), ':root[data-aimd-theme="dark"]');
    return `${light}\n${dark}`;
}
