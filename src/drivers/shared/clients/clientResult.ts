import type { ExtRequest, ProtocolErrorCode } from '../../../contracts/protocol';
import {
    sendExtRequest,
    type RpcOptions,
} from '../rpc';
import type {
    RpcCallResult,
    RpcTransportFailure,
    RpcTransportFailureCode,
} from '../rpc';

export type RuntimeClientFailure =
    | {
        kind: 'protocol';
        code: ProtocolErrorCode;
        message: string;
    }
    | ({ kind: 'transport' } & RpcTransportFailure);

export type RuntimeClientErrorCode = ProtocolErrorCode | RpcTransportFailureCode;

export type RuntimeClientResult<T> =
    | { ok: true; data: T }
    | {
        ok: false;
        errorCode: RuntimeClientErrorCode;
        message: string;
        failure: RuntimeClientFailure;
    };

export function toRuntimeClientResult<T>(call: RpcCallResult, fallbackMessage = 'Request failed'): RuntimeClientResult<T> {
    if (call.kind === 'transport-failure') {
        return {
            ok: false,
            errorCode: call.failure.code,
            message: call.failure.message,
            failure: { kind: 'transport', ...call.failure },
        };
    }

    const response = call.response;
    if (response.ok) return { ok: true, data: (response.data ?? null) as T };
    return {
        ok: false,
        errorCode: response.error.code,
        message: response.error.message || fallbackMessage,
        failure: {
            kind: 'protocol',
            code: response.error.code,
            message: response.error.message || fallbackMessage,
        },
    };
}

export async function requestRuntimeClient<T>(
    request: ExtRequest,
    options?: RpcOptions,
): Promise<RuntimeClientResult<T>> {
    return toRuntimeClientResult<T>(await sendExtRequest(request, options));
}

export function createProtocolClientFailure(
    code: ProtocolErrorCode,
    message: string,
): Extract<RuntimeClientResult<never>, { ok: false }> {
    return {
        ok: false,
        errorCode: code,
        message,
        failure: { kind: 'protocol', code, message },
    };
}

export function createInvalidResponseClientFailure(
    message: string,
): Extract<RuntimeClientResult<never>, { ok: false }> {
    return {
        ok: false,
        errorCode: 'INVALID_RESPONSE',
        message,
        failure: {
            kind: 'transport',
            code: 'INVALID_RESPONSE',
            message,
            delivery: 'unknown',
        },
    };
}

export class RuntimeClientRequestError extends Error {
    readonly failure: RuntimeClientFailure;

    constructor(failure: RuntimeClientFailure) {
        super(failure.message);
        this.name = 'RuntimeClientRequestError';
        this.failure = failure;
    }
}

export function unwrapRuntimeClientResult<T>(result: RuntimeClientResult<T>): T {
    if (result.ok) return result.data;
    throw new RuntimeClientRequestError(result.failure);
}
