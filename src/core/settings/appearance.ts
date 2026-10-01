import type { ThemeAccentColor } from './types';

export function normalizeAccentHex(value: unknown): ThemeAccentColor | null {
    return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value.trim())
        ? value.trim().toLowerCase() as ThemeAccentColor : null;
}

export function parseAccentRgb(value: string): ThemeAccentColor | null {
    return normalizeAccentHex(`#${value.trim().replace(/#/g, '')}`);
}

export function formatAccentRgb(value: ThemeAccentColor | null): string {
    return value?.slice(1).toUpperCase() ?? '';
}
