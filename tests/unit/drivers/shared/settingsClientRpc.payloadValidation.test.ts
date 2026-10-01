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

    it('keeps old-runtime reads compatible and decodes only explicit capability fields', async () => {
        const { settingsClientRpc } = await import('@/drivers/shared/clients/settingsClientRpc');
        responseData = { settings: { version: 5 } };
        expect(await settingsClientRpc.getAll()).toEqual({ ok: true, data: { settings: { version: 5 } } });
        const capabilities = { appVersion: '6.0.0', settingsVersion: 5, settingsFileFormatVersion: 1, buttonsPreferences: true };
        responseData = { settings: { version: 5 }, capabilities: { ...capabilities, extra: 'excluded' } };
        expect(await settingsClientRpc.getAll()).toEqual({ ok: true, data: { settings: { version: 5 }, capabilities } });
        responseData = { settings: { version: 5 }, capabilities: { ...capabilities, buttonsPreferences: 'true' } };
        expect(await settingsClientRpc.getAll()).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });
});

it('validates configuration files and never exposes arbitrary current-setting values in a preview', async () => {
    const {settingsClientRpc}=await import('@/drivers/shared/clients/settingsClientRpc');
    const file={format:'ai-markdone-settings',formatVersion:1,appVersion:'6.0.0',exportedAt:'2026-09-30T00:00:00.000Z',settings:{behavior:{showWordCount:false}}};
    responseData={file};const exported=await settingsClientRpc.exportSettings();expect(exported.ok).toBe(true);expect(JSON.stringify(exported)).not.toContain('secret');
    const preview={file,changes:[{path:'behavior.showWordCount',before:true,after:false}],ignoredCount:0,fingerprint:'a'.repeat(64)};
    responseData={preview};expect((await settingsClientRpc.previewImport('file')).ok).toBe(true);
    responseData={preview:{...preview,changes:[{path:'behavior.showWordCount',before:'secret',after:false}]}};
    expect(await settingsClientRpc.previewImport('file')).toMatchObject({ok:false,errorCode:'INVALID_RESPONSE'});
    responseData={preview:{...preview,changes:[{path:'behavior.showWordCount',before:true,after:true}]}};
    expect(await settingsClientRpc.previewImport('file')).toMatchObject({ok:false,errorCode:'INVALID_RESPONSE'});
    responseData={applied:'true'};expect(await settingsClientRpc.applyImport('file','a'.repeat(64),['behavior'])).toMatchObject({ok:false,errorCode:'INVALID_RESPONSE'});
    responseData={file:null};expect(await settingsClientRpc.getRecovery()).toEqual({ok:true,data:{file:null}});
});
