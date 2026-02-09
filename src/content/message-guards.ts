const RUNTIME_ACTION_OPEN_BOOKMARK_PANEL = 'openBookmarkPanel' as const;

export type BackgroundToContentMessage = { action: typeof RUNTIME_ACTION_OPEN_BOOKMARK_PANEL };

type RuntimeSenderLike = { id?: string | null } | null | undefined;

export function isBackgroundToContentMessage(request: unknown): request is BackgroundToContentMessage {
    return (
        typeof request === 'object' &&
        request !== null &&
        (request as Record<string, unknown>).action === RUNTIME_ACTION_OPEN_BOOKMARK_PANEL
    );
}

export function isTrustedBackgroundSender(sender: RuntimeSenderLike, runtimeId: string | undefined): boolean {
    if (!runtimeId || !sender?.id) return false;
    return sender.id === runtimeId;
}
