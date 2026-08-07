import { PROTOCOL_VERSION, createRequestId } from '../../../contracts/protocol';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    RuntimeClientRequestError,
} from '../../../drivers/shared/clients/clientResult';
import { isRecord } from '../../../drivers/shared/clients/payloadValidation';
import type { SendPort } from './SendPopover';

function invalidResponse(message: string): RuntimeClientRequestError {
    const result = createInvalidResponseClientFailure(message);
    return new RuntimeClientRequestError(result.failure);
}

function requireAck(data: unknown, field: string, type: string): void {
    if (!isRecord(data) || data[field] !== true) {
        throw invalidResponse(`Invalid ${type} response payload`);
    }
}

export function createDetachedReaderSendPort(sessionId: string): SendPort {
    return {
        readDraft: async () => {
            const response = await requestRuntimeClient<{ text?: unknown }>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:draft',
                payload: { sessionId },
            }, { timeoutMs: 4000 });
            if (!response.ok) throw new RuntimeClientRequestError(response.failure);
            const text = response.data?.text;
            if (typeof text !== 'string') throw invalidResponse('Invalid readerSession:draft response payload');
            return text;
        },
        writeDraft: async (text) => {
            const response = await requestRuntimeClient({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:draft',
                payload: { sessionId, text },
            }, { timeoutMs: 4000 });
            if (!response.ok) throw new RuntimeClientRequestError(response.failure);
            requireAck(response.data, 'written', 'readerSession:draft');
        },
        beforeSubmit: async () => {
            const response = await requestRuntimeClient({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:beforeSend',
                payload: { sessionId },
            }, { timeoutMs: 4000 });
            if (!response.ok) throw new RuntimeClientRequestError(response.failure);
            requireAck(response.data, 'ready', 'readerSession:beforeSend');
        },
        submit: async (text) => {
            const response = await requestRuntimeClient({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:send',
                payload: { sessionId, text },
            }, { timeoutMs: 12000 });
            if (!response.ok) return { ok: false, message: response.message };
            return isRecord(response.data) && response.data.sent === true
                ? { ok: true }
                : { ok: false, message: 'Invalid readerSession:send response payload' };
        },
    };
}
