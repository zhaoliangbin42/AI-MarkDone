import { version as buildVersion } from '../../../../package.json';
import type { ExtRequest, SettingsCategory } from '../../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    type RuntimeClientResult,
} from './clientResult';
import { isRecord } from './payloadValidation';
import type { SettingsFile, SettingsImportPreview, SettingsRuntimeCapabilities } from '../../../contracts/settingsTransfer';
import { parseSettingsFile, PORTABLE_SETTINGS_FIELDS, isPortablePreferenceValue, readPreferencePath } from '../../../core/settings/portableSettings';

export type Result<T> = RuntimeClientResult<T>;

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest =
        payload === undefined
            ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
            : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    return requestRuntimeClient(req);
}

export const settingsClientRpc = {
    async exportSettings(): Promise<Result<{ file: SettingsFile }>> {
        const result = await call('settings:export');
        if (!result.ok) return result;
        const file = decodeFile(isRecord(result.data) ? result.data.file : undefined);
        return file ? { ok: true, data: { file } } : createInvalidResponseClientFailure('Invalid settings export response');
    },
    async previewImport(fileText: string): Promise<Result<{ preview: SettingsImportPreview }>> {
        const result = await call('settings:previewImport', { fileText });
        if (!result.ok) return result;
        const preview = isRecord(result.data) ? result.data.preview : undefined;
        const file = isRecord(preview) ? decodeFile(preview.file) : null;
        if (!file || !isRecord(preview) || typeof preview.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(preview.fingerprint)
            || preview.ignoredCount !== 0
            || !Array.isArray(preview.changes) || preview.changes.length > Object.keys(PORTABLE_SETTINGS_FIELDS).length
            || preview.changes.some(change => !isRecord(change) || typeof change.path !== 'string'
                || !isPortablePreferenceValue(change.path, change.after)
                || (change.before !== undefined && !isPortablePreferenceValue(change.path, change.before))
                || JSON.stringify(change.after) !== JSON.stringify(readPreferencePath(file.settings, change.path)))) {
            return createInvalidResponseClientFailure('Invalid settings import preview response');
        }
        return { ok: true, data: { preview: { ...preview, file } as SettingsImportPreview } };
    },
    async applyImport(fileText: string, expectedFingerprint: string, categories: string[]): Promise<Result<{ applied: boolean }>> {
        const result = await call('settings:applyImport', { fileText, expectedFingerprint, categories });
        if (!result.ok) return result;
        return isRecord(result.data) && typeof result.data.applied === 'boolean'
            ? { ok: true, data: { applied: result.data.applied } }
            : createInvalidResponseClientFailure('Invalid settings import response');
    },
    async getRecovery(): Promise<Result<{ file: SettingsFile | null }>> {
        const result = await call('settings:getRecovery');
        if (!result.ok) return result;
        if (!isRecord(result.data)) return createInvalidResponseClientFailure('Invalid settings recovery response');
        const file = result.data.file === null ? null : decodeFile(result.data.file);
        return file || result.data.file === null ? { ok: true, data: { file } }
            : createInvalidResponseClientFailure('Invalid settings recovery response');
    },
    async getAll(): Promise<Result<{ settings: unknown; capabilities?:SettingsRuntimeCapabilities }>> {
        const result = await call('settings:getAll');
        if (!result.ok) return result;
        if (!isRecord(result.data) || !Object.prototype.hasOwnProperty.call(result.data, 'settings')) {
            return createInvalidResponseClientFailure('Invalid settings:getAll response payload');
        }
        const capabilities=result.data.capabilities;
        if(capabilities!==undefined&&(!isRecord(capabilities)||typeof capabilities.appVersion!=='string'||!Number.isInteger(capabilities.settingsVersion)||!Number.isInteger(capabilities.settingsFileFormatVersion)||typeof capabilities.buttonsPreferences!=='boolean'))return createInvalidResponseClientFailure('Invalid settings capabilities');
        return {ok:true,data:{settings:result.data.settings,...(capabilities?{capabilities:{appVersion:(capabilities as SettingsRuntimeCapabilities).appVersion,settingsVersion:(capabilities as SettingsRuntimeCapabilities).settingsVersion,settingsFileFormatVersion:(capabilities as SettingsRuntimeCapabilities).settingsFileFormatVersion,buttonsPreferences:(capabilities as SettingsRuntimeCapabilities).buttonsPreferences}}:{})}};
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

function decodeFile(value: unknown): SettingsFile | null {
    try { return parseSettingsFile(JSON.stringify(value),buildVersion).file; } catch { return null; }
}
