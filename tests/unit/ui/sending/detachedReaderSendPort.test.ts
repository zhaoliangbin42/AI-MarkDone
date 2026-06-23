import { describe, expect, it, vi } from 'vitest';

const sendExtRequest = vi.fn();

vi.mock('@/drivers/shared/rpc', () => ({
    sendExtRequest,
}));

describe('createDetachedReaderSendPort', () => {
    it('implements the full SendPort contract through readerSession intents', async () => {
        const { createDetachedReaderSendPort } = await import('@/ui/content/sending/detachedReaderSendPort');
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'readerSession:draft' && typeof request.payload.text !== 'string') {
                return { ok: true, data: { text: 'source draft' } };
            }
            return { ok: true, data: {} };
        });

        const port = createDetachedReaderSendPort('session-1');

        await expect(port.readDraft?.()).resolves.toBe('source draft');
        await port.writeDraft?.('edited draft');
        port.beforeSubmit?.();
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
});
