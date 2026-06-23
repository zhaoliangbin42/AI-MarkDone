import { PROTOCOL_VERSION, createRequestId } from '../../../contracts/protocol';
import { sendExtRequest } from '../../../drivers/shared/rpc';
import type { SendPort } from './SendPopover';

export function createDetachedReaderSendPort(sessionId: string): SendPort {
    return {
        readDraft: async () => {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:draft',
                payload: { sessionId },
            }, { timeoutMs: 4000 });
            if (!response.ok || !response.data || typeof response.data !== 'object') return '';
            const text = (response.data as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
        },
        writeDraft: async (text) => {
            await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:draft',
                payload: { sessionId, text },
            }, { timeoutMs: 4000 });
        },
        beforeSubmit: () => {
            void sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:beforeSend',
                payload: { sessionId },
            }, { timeoutMs: 4000 });
        },
        submit: async (text) => {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'readerSession:send',
                payload: { sessionId, text },
            }, { timeoutMs: 12000 });
            return response.ok
                ? { ok: true }
                : { ok: false, message: response.error.message };
        },
    };
}
