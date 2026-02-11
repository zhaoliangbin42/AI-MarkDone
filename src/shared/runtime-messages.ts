export const RUNTIME_ACTION_OPEN_BOOKMARK_PANEL = 'openBookmarkPanel' as const;
export const RUNTIME_TYPE_PING = 'ping' as const;

export type RuntimeStatus = 'ok' | 'unknown action' | 'untrusted sender';

