export const PROTOCOL_VERSION = 1 as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type RequestId = string;

export type ProtocolErrorCode =
    | 'UNKNOWN_TYPE'
    | 'UNTRUSTED_SENDER'
    | 'INVALID_REQUEST'
    | 'INTERNAL_ERROR';

export type ExtRequest =
    | { v: ProtocolVersion; id: RequestId; type: 'ping' }
    | { v: ProtocolVersion; id: RequestId; type: 'ui:toggle_toolbar' };

export type ExtResponse =
    | { v: ProtocolVersion; id: RequestId; ok: true; type: ExtRequest['type']; data?: unknown }
    | { v: ProtocolVersion; id: RequestId; ok: false; type: ExtRequest['type']; error: { code: ProtocolErrorCode; message: string } };

export function createRequestId(): RequestId {
    const rand = Math.random().toString(16).slice(2);
    return `req_${Date.now().toString(16)}_${rand}`;
}

export function isExtRequest(value: unknown): value is ExtRequest {
    if (typeof value !== 'object' || value === null) return false;
    const rec = value as Record<string, unknown>;
    if (rec.v !== PROTOCOL_VERSION) return false;
    if (typeof rec.id !== 'string' || rec.id.length < 6) return false;
    const type = rec.type;
    return type === 'ping' || type === 'ui:toggle_toolbar';
}

