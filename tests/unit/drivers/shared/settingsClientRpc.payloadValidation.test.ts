import { beforeEach, describe, expect, it, vi } from 'vitest';

let responseData: unknown;
const sendExtRequestMock = vi.fn(async (request: any) => ({
    kind: 'response' as const,
    response: {
        v: request.v,
        id: request.id,
        type: request.type,
        ok: true as const,
        data: responseData,
    },
}));

vi.mock('@/drivers/shared/rpc', () => ({
    sendExtRequest: (request: any) => sendExtRequestMock(request),
}));

describe('settingsClientRpc payload validation', () => {
    beforeEach(() => {
        responseData = undefined;
        sendExtRequestMock.mockClear();
    });

    it('rejects missing settings data and mismatched category acknowledgements', async () => {
        const { settingsClientRpc } = await import('@/drivers/shared/clients/settingsClientRpc');

        responseData = {};
        await expect(settingsClientRpc.getAll()).resolves.toMatchObject({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
        });

        responseData = { category: 'behavior', value: {} };
        await expect(settingsClientRpc.getCategory('reader')).resolves.toMatchObject({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
        });
        await expect(settingsClientRpc.setCategory('reader', {})).resolves.toMatchObject({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
        });

        responseData = { reset: false };
        await expect(settingsClientRpc.reset()).resolves.toMatchObject({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
        });
    });

    it('returns only decoded settings payloads', async () => {
        const { settingsClientRpc } = await import('@/drivers/shared/clients/settingsClientRpc');

        responseData = { settings: { version: 4 } };
        await expect(settingsClientRpc.getAll()).resolves.toEqual({
            ok: true,
            data: { settings: { version: 4 } },
        });

        responseData = { category: 'reader', value: { codeRendering: false } };
        await expect(settingsClientRpc.getCategory('reader')).resolves.toEqual({
            ok: true,
            data: { category: 'reader', value: { codeRendering: false } },
        });
        await expect(settingsClientRpc.setCategory('reader', {})).resolves.toEqual({
            ok: true,
            data: { category: 'reader' },
        });

        responseData = { reset: true };
        await expect(settingsClientRpc.reset()).resolves.toEqual({
            ok: true,
            data: { reset: true },
        });
    });
});
