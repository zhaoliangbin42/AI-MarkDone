import type { Theme } from '../core/types/theme';
import { normalizeUserThemeOverrides, type UserThemeOverrides } from './system-tokens';

export type AppearanceSnapshot = Readonly<{
    theme: Theme;
    overrides: Readonly<UserThemeOverrides>;
    fingerprint: string;
}>;

function createFingerprint(theme: Theme, overrides: UserThemeOverrides): string {
    const entries = Object.entries(overrides).sort(([left], [right]) => left.localeCompare(right));
    return JSON.stringify([theme, entries]);
}

export function createAppearanceSnapshot(
    theme: Theme,
    overrides: UserThemeOverrides = {},
): AppearanceSnapshot {
    const normalizedOverrides = Object.freeze(normalizeUserThemeOverrides(overrides));
    return Object.freeze({
        theme,
        overrides: normalizedOverrides,
        fingerprint: createFingerprint(theme, normalizedOverrides),
    });
}

export function areAppearanceSnapshotsEqual(
    left: AppearanceSnapshot,
    right: AppearanceSnapshot,
): boolean {
    return left.fingerprint === right.fingerprint;
}
