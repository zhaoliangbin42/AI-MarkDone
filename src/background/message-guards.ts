const RUNTIME_TYPE_PING = 'ping' as const;

export type ContentToBackgroundMessage = { type: typeof RUNTIME_TYPE_PING };

type RuntimeSenderLike = { id?: string | null } | null | undefined;
type TabLike = { id?: number | null } | null | undefined;
type RuntimeSenderWithTabLike = RuntimeSenderLike & { tab?: TabLike };

export function isContentToBackgroundMessage(message: unknown): message is ContentToBackgroundMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as Record<string, unknown>).type === RUNTIME_TYPE_PING
    );
}

export function isTrustedExtensionSender(sender: RuntimeSenderWithTabLike, runtimeId: string | undefined): boolean {
    if (!runtimeId || !sender?.id) return false;
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') return false;
    return sender.id === runtimeId;
}
