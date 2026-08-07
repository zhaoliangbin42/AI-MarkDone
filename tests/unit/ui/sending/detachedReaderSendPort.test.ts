import { describe, expect, it, vi } from 'vitest';

const sendExtRequest = vi.fn();

vi.mock('@/drivers/shared/clients/clientResult', () => ({
    requestRuntimeClient: sendExtRequest,
    createInvalidResponseClientFailure: (message: string) => ({
        ok: false,
        failure: {
            kind: 'transport',
            code: 'INVALID_RESPONSE',
            message,
            delivery: 'unknown',
        },
    }),
    RuntimeClientRequestError: class RuntimeClientRequestError extends Error {
        constructor(failure: { message: string }) {
            super(failure.message);
        }
    },
}));

describe('createDetachedReaderSendPort', () => {
    it('preserves a transport failure instead of returning an empty draft', async () => {
        const { createDetachedReaderSendPort } = await import('@/ui/content/sending/detachedReaderSendPort');
        sendExtRequest.mockResolvedValue({
            ok: false,
            errorCode: 'CONTEXT_INVALIDATED',
            message: 'Extension context invalidated.',
            failure: {
                kind: 'transport',
                code: 'CONTEXT_INVALIDATED',
                message: 'Extension context invalidated.',
                delivery: 'not-sent',
            },
        });

        const port = createDetachedReaderSendPort('session-1');

        await expect(port.readDraft?.()).rejects.toThrow('Extension context invalidated.');
        await expect(port.submit('send text')).resolves.toEqual({
            ok: false,
            message: 'Extension context invalidated.',
        });
    });

    it('implements the full SendPort contract through readerSession intents', async () => {
        const { createDetachedReaderSendPort } = await import('@/ui/content/sending/detachedReaderSendPort');
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'readerSession:draft' && typeof request.payload.text !== 'string') {
                return { ok: true, data: { text: 'source draft' } };
            }
            if (request.type === 'readerSession:draft') return { ok: true, data: { written: true } };
            if (request.type === 'readerSession:beforeSend') return { ok: true, data: { ready: true } };
            return { ok: true, data: { sent: true } };
        });

        const port = createDetachedReaderSendPort('session-1');

        await expect(port.readDraft?.()).resolves.toBe('source draft');
        await port.writeDraft?.('edited draft');
        await port.beforeSubmit?.();
        await expect(port.submit('send text')).resolves.toEqual({ ok: true });

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:draft',
            payload: { sessionId: 'session-1' },
        }), { timeoutMs: 4000 });
        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:draft',
            payload: { sessionId: 'session-1', text: 'edited draft' },
        }), { timeoutMs: 4000 });
        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:beforeSend',
            payload: { sessionId: 'session-1' },
        }), { timeoutMs: 4000 });
        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:send',
            payload: { sessionId: 'session-1', text: 'send text' },
        }), { timeoutMs: 12000 });
    });

    it('rejects malformed success payloads instead of treating them as empty or acknowledged', async () => {
        const { createDetachedReaderSendPort } = await import('@/ui/content/sending/detachedReaderSendPort');
        sendExtRequest.mockResolvedValue({ ok: true, data: {} });
        const port = createDetachedReaderSendPort('session-1');

        await expect(port.readDraft?.()).rejects.toThrow('Invalid readerSession:draft response payload');
        await expect(port.writeDraft?.('edited draft')).rejects.toThrow('Invalid readerSession:draft response payload');
        await expect(port.beforeSubmit?.()).rejects.toThrow('Invalid readerSession:beforeSend response payload');
        await expect(port.submit('send text')).resolves.toEqual({
            ok: false,
            message: 'Invalid readerSession:send response payload',
        });
    });
});
