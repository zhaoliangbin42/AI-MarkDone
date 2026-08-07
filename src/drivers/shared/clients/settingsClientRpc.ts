import type { ExtRequest, SettingsCategory } from '../../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    type RuntimeClientResult,
} from './clientResult';
import { isRecord } from './payloadValidation';

export type Result<T> = RuntimeClientResult<T>;

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest =
        payload === undefined
            ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
            : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    return requestRuntimeClient(req);
}

export const settingsClientRpc = {
    async getAll(): Promise<Result<{ settings: unknown }>> {
        const result = await call('settings:getAll');
        if (!result.ok) return result;
        if (!isRecord(result.data) || !Object.prototype.hasOwnProperty.call(result.data, 'settings')) {
            return createInvalidResponseClientFailure('Invalid settings:getAll response payload');
        }
        return { ok: true, data: { settings: result.data.settings } };
    },
    async getCategory(category: SettingsCategory): Promise<Result<{ category: SettingsCategory; value: unknown }>> {
        const result = await call('settings:getCategory', { category });
        if (!result.ok) return result;
        if (
            !isRecord(result.data)
            || result.data.category !== category
            || !Object.prototype.hasOwnProperty.call(result.data, 'value')
        ) {
            return createInvalidResponseClientFailure('Invalid settings:getCategory response payload');
        }
        return { ok: true, data: { category, value: result.data.value } };
    },
    async setCategory(category: SettingsCategory, value: unknown): Promise<Result<{ category: SettingsCategory }>> {
        const result = await call('settings:setCategory', { category, value });
        if (!result.ok) return result;
        return isRecord(result.data) && result.data.category === category
            ? { ok: true, data: { category } }
            : createInvalidResponseClientFailure('Invalid settings:setCategory response payload');
    },
    async reset(): Promise<Result<{ reset: true }>> {
        const result = await call('settings:reset');
        if (!result.ok) return result;
        return isRecord(result.data) && result.data.reset === true
            ? { ok: true, data: { reset: true } }
            : createInvalidResponseClientFailure('Invalid settings:reset response payload');
    },
};
