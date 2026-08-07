import type { Bookmark } from '../../core/bookmarks/types';

export type CanonicalBookmarkTurnRef = Readonly<{
    position: number;
    assistantMessageId: string;
}>;

export type ConversationBookmarkResolution =
    | Readonly<{
        kind: 'matched';
        position: number;
        resolvedBy: 'identity' | 'position';
    }>
    | Readonly<{
        kind: 'identity-conflict';
        bookmarkPosition: number;
        canonicalPosition: number;
        messageId: string;
    }>
    | Readonly<{
        kind: 'unavailable';
    }>;

function normalizeMessageId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function readBookmarkPosition(bookmark: Bookmark): number | null {
    return typeof bookmark.position === 'number'
        && Number.isInteger(bookmark.position)
        && bookmark.position > 0
        ? bookmark.position
        : null;
}

/**
 * Resolve one persisted bookmark without changing the persisted record.
 *
 * `messageId` is the typed identity. Position is only a compatibility field:
 * it is accepted when the bookmark has no identity or when the current source
 * proves that the stored identity is no longer present. If an identity is
 * present in the current source but its stored position disagrees, fail
 * closed instead of highlighting a different turn.
 */
export function resolveConversationBookmark(
    bookmark: Bookmark,
    turns: readonly CanonicalBookmarkTurnRef[],
): ConversationBookmarkResolution {
    if (bookmark.kind === 'page') return { kind: 'unavailable' };
    const bookmarkPosition = readBookmarkPosition(bookmark);
    if (bookmarkPosition === null) return { kind: 'unavailable' };

    const messageId = normalizeMessageId(bookmark.messageId);
    if (!messageId) {
        return turns.some((turn) => turn.position === bookmarkPosition)
            ? { kind: 'matched', position: bookmarkPosition, resolvedBy: 'position' }
            : { kind: 'unavailable' };
    }

    const identityTurn = turns.find((turn) => turn.assistantMessageId === messageId);
    if (identityTurn) {
        if (identityTurn.position !== bookmarkPosition) {
            return {
                kind: 'identity-conflict',
                bookmarkPosition,
                canonicalPosition: identityTurn.position,
                messageId,
            };
        }
        return { kind: 'matched', position: identityTurn.position, resolvedBy: 'identity' };
    }

    // Compatibility for records whose message identity belongs to an older
    // branch or legacy producer. The source has proved that this identity is
    // absent, so position is the only remaining legacy coordinate.
    return turns.some((turn) => turn.position === bookmarkPosition)
        ? { kind: 'matched', position: bookmarkPosition, resolvedBy: 'position' }
        : { kind: 'unavailable' };
}

export function resolveConversationBookmarkPositions(
    bookmarks: readonly Bookmark[],
    currentUrl: string,
    turns: readonly CanonicalBookmarkTurnRef[],
    isSamePageUrl: (a: string, b: string) => boolean,
): ReadonlySet<number> {
    const resolved = new Set<number>();
    for (const bookmark of bookmarks) {
        if (bookmark.kind === 'page' || !isSamePageUrl(bookmark.url, currentUrl)) continue;
        const result = resolveConversationBookmark(bookmark, turns);
        if (result.kind === 'matched') resolved.add(result.position);
    }
    return resolved;
}
