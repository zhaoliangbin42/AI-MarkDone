import type { ExtRequest, ProtocolErrorCode, SettingsCategory } from '../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../contracts/protocol';
import { sendExtRequest } from '../../drivers/shared/rpc';

export type Result<T> = { ok: true; data: T } | { ok: false; errorCode: ProtocolErrorCode; message: string };

function toResult<T>(res: any): Result<T> {
    if (!res || typeof res !== 'object') return { ok: false, errorCode: 'INTERNAL_ERROR', message: 'Invalid response' };
    if (res.ok) return { ok: true, data: (res.data ?? null) as T };
    const code = res.error?.code as ProtocolErrorCode | undefined;
    const msg = (res.error?.message as string | undefined) || 'Request failed';
    return { ok: false, errorCode: code || 'INTERNAL_ERROR', message: msg };
}

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest = payload === undefined
        ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
        : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    const res = await sendExtRequest(req as any);
    return toResult(res as any);
}

export const settingsRemoteApi = {
    async getAll(): Promise<Result<{ settings: unknown }>> {
        return call('settings:getAll');
    },
    async getCategory(category: SettingsCategory): Promise<Result<{ category: SettingsCategory; value: unknown }>> {
        return call('settings:getCategory', { category });
    },
    async setCategory(category: SettingsCategory, value: unknown): Promise<Result<{ category: SettingsCategory }>> {
        return call('settings:setCategory', { category, value });
    },
    async reset(): Promise<Result<{ reset: true }>> {
        return call('settings:reset');
    },
};

