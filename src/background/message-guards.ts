const RUNTIME_TYPE_PING = 'ping' as const;

export type ContentToBackgroundMessage = { type: typeof RUNTIME_TYPE_PING };

type RuntimeSenderLike = { id?: string | null } | null | undefined;

export function isContentToBackgroundMessage(message: unknown): message is ContentToBackgroundMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as Record<string, unknown>).type === RUNTIME_TYPE_PING
    );
}

export function isTrustedExtensionSender(sender: RuntimeSenderLike, runtimeId: string | undefined): boolean {
    if (!runtimeId || !sender?.id) return false;
    return sender.id === runtimeId;
}
