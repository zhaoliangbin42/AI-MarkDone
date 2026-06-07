export type BridgeWireDetail<T extends object> = T | string;

export function encodeBridgeRequest<T extends object>(
    payload: T,
    useStringTransport: boolean,
): BridgeWireDetail<T> {
    return useStringTransport ? JSON.stringify(payload) : payload;
}

export function encodeBridgeResponse<T extends object>(
    payload: T,
    requestWasString: boolean,
): BridgeWireDetail<T> {
    return requestWasString ? JSON.stringify(payload) : payload;
}

export function decodeBridgeDetail<T extends object>(detail: unknown): T | null {
    if (typeof detail === 'string') {
        try {
            const parsed = JSON.parse(detail) as unknown;
            return parsed && typeof parsed === 'object' ? parsed as T : null;
        } catch {
            return null;
        }
    }
    return detail && typeof detail === 'object' ? detail as T : null;
}
