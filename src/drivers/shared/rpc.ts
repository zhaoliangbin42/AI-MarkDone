import { isExtResponseForRequest, type ExtRequest, type ExtResponse } from '../../contracts/protocol';
import { browser } from './browser';

export type RpcOptions = {
    timeoutMs?: number;
};

export type RpcTransportFailureCode =
    | 'RUNTIME_UNAVAILABLE'
    | 'CONTEXT_INVALIDATED'
    | 'RECEIVER_UNAVAILABLE'
    | 'REQUEST_TIMEOUT'
    | 'INVALID_RESPONSE'
    | 'TRANSPORT_FAILED';

export type RpcTransportFailure = {
    code: RpcTransportFailureCode;
    message: string;
    delivery: 'not-sent' | 'unknown';
};

export type RpcCallResult =
    | { kind: 'response'; response: ExtResponse }
    | { kind: 'transport-failure'; failure: RpcTransportFailure };

function transportFailure(
    code: RpcTransportFailureCode,
    message: string,
    delivery: RpcTransportFailure['delivery'],
): RpcCallResult {
    return {
        kind: 'transport-failure',
        failure: { code, message, delivery },
    };
}

function classifyTransportError(error: unknown): RpcTransportFailure {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/extension context invalidated/i.test(message)) {
        return { code: 'CONTEXT_INVALIDATED', message: message || 'Extension context invalidated', delivery: 'not-sent' };
    }
    if (/receiving end does not exist|could not establish connection/i.test(message)) {
        return { code: 'RECEIVER_UNAVAILABLE', message: message || 'Extension receiver is unavailable', delivery: 'not-sent' };
    }
    return { code: 'TRANSPORT_FAILED', message: message || 'sendMessage failed', delivery: 'unknown' };
}

export async function sendExtRequest<T extends ExtRequest>(request: T, options?: RpcOptions): Promise<RpcCallResult> {
    const timeoutMs = options?.timeoutMs ?? 8000;

    const send = async (): Promise<RpcCallResult> => {
        try {
            const runtime: any = (browser as any)?.runtime;
            if (!runtime?.sendMessage) {
                return transportFailure('RUNTIME_UNAVAILABLE', 'runtime.sendMessage is unavailable', 'not-sent');
            }
            const res = await runtime.sendMessage(request);
            if (!isExtResponseForRequest(res, request)) {
                return transportFailure('INVALID_RESPONSE', 'Invalid response', 'unknown');
            }
            return { kind: 'response', response: res };
        } catch (e) {
            return { kind: 'transport-failure', failure: classifyTransportError(e) };
        }
    };

    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    try {
        const timeout = new Promise<RpcCallResult>((resolve) => {
            timer = globalThis.setTimeout(() => resolve(
                transportFailure('REQUEST_TIMEOUT', 'Request timed out', 'unknown'),
            ), timeoutMs);
        });
        return await Promise.race([send(), timeout]);
    } finally {
        if (timer !== null) globalThis.clearTimeout(timer);
    }
}
