import type { ReaderItem } from './types';

type ReaderIdentityField = 'userMessageId' | 'roundId' | 'assistantMessageId' | 'messageId';

const TYPED_IDENTITY_FIELDS: readonly ReaderIdentityField[] = [
    'userMessageId',
    'roundId',
    'assistantMessageId',
    'messageId',
];

function normalizeIdentity(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function findUniqueMatch(items: readonly ReaderItem[], getValue: (item: ReaderItem) => unknown, value: string): number {
    const matches: number[] = [];
    items.forEach((item, index) => {
        if (normalizeIdentity(getValue(item)) === value) matches.push(index);
    });
    return matches.length === 1 ? matches[0]! : -1;
}

function clampIndex(index: number, itemCount: number): number {
    return Math.max(0, Math.min(index, Math.max(0, itemCount - 1)));
}

/** Resolves the same semantic Reader item after a canonical snapshot is replaced. */
export function resolveReaderReplacementIndex(
    current: ReaderItem | null,
    items: readonly ReaderItem[],
    fallbackIndex: number,
): number {
    if (!current) return clampIndex(fallbackIndex, items.length);

    let hasTypedIdentity = false;
    for (const field of TYPED_IDENTITY_FIELDS) {
        const value = normalizeIdentity(current.meta?.[field]);
        if (!value) continue;
        hasTypedIdentity = true;
        const match = findUniqueMatch(items, (item) => item.meta?.[field], value);
        if (match >= 0) return match;
    }

    // A canonical item must not be rebound through a reused position or a derived UI id.
    if (hasTypedIdentity) return clampIndex(fallbackIndex, items.length);

    const id = normalizeIdentity(current.id);
    if (id) {
        const match = findUniqueMatch(items, (item) => item.id, id);
        if (match >= 0) return match;
    }

    const position = Number(current.meta?.position ?? 0);
    if (Number.isInteger(position) && position > 0) {
        const matches = items
            .map((item, index) => item.meta?.position === position ? index : -1)
            .filter((index) => index >= 0);
        if (matches.length === 1) return matches[0]!;
    }

    return clampIndex(fallbackIndex, items.length);
}
