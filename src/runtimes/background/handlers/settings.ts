import type { ExtRequest, ExtResponse, SettingsCategory } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import { browser } from '../../../drivers/shared/browser';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import { createSettingsFile, mergePortableSettings, parseSettingsFile } from '../../../core/settings/portableSettings';
import { fingerprintSettings, previewSettingsImport } from '../../../services/settings/settingsTransfer';
import type { ProtocolErrorCode } from '../../../contracts/protocol';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { syncStoragePort } from '../../../drivers/background/storage/syncStoragePort';
import { loadAndNormalize, planGetAll, planGetCategory, planReset, planSetCategory } from '../../../services/settings/settingsService';

type HandlerResult = { response: ExtResponse };

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return {
        v: PROTOCOL_VERSION,
        id,
        ok: false,
        type,
        error: { code, message },
    };
}

function toErrorCode(error: unknown): { code: ProtocolErrorCode; message: string } {
    const message = error instanceof Error ? error.message : String(error);
    if (message==='SETTINGS_SCHEMA_UNSUPPORTED' || message==='SETTINGS_FILE_UNSUPPORTED' || message==='SETTINGS_FILE_NEWER_VERSION') return {code:'SCHEMA_UNSUPPORTED',message};
    if (message.startsWith('SETTINGS_FILE_')) return { code: 'INVALID_IMPORT', message };
    if (message === 'CONFLICT') return { code: 'CONFLICT', message };
    if (/quota/i.test(message)) return { code: 'QUOTA_EXCEEDED', message: 'QUOTA_EXCEEDED' };
    if (message.startsWith('Invalid category:')) return { code: 'INVALID_REQUEST', message };
    return { code: 'INTERNAL_ERROR', message };
}

async function loadStoredSettings(): Promise<unknown> {
    const raw = await syncStoragePort.get(LEGACY_STORAGE_KEYS.appSettingsKey);
    const stored=raw[LEGACY_STORAGE_KEYS.appSettingsKey];
    if(stored!=null && (typeof stored!=='object'||Array.isArray(stored)||![1,2,3,4,5].includes((stored as {version:number}).version)))throw new Error('SETTINGS_SCHEMA_UNSUPPORTED');
    return stored;
}

async function persistSettings(next: unknown): Promise<void> {
    await syncStoragePort.set({ [LEGACY_STORAGE_KEYS.appSettingsKey]: next });
}

export async function handleSettingsRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('settings:')) return null;

    try { switch (request.type) {
        case 'settings:export': {
            try {
                const current = loadAndNormalize(await loadStoredSettings());
                return { response: ok(request.id, request.type, { file: createSettingsFile(current, browser.runtime.getManifest().version) }) };
            } catch(error) {const mapped=toErrorCode(error);return {response:err(request.id,request.type,mapped.code,mapped.message)};}
        }
        case 'settings:previewImport': {
            try {
                const current = loadAndNormalize(await loadStoredSettings());
                const preview = await previewSettingsImport(current, request.payload?.fileText,browser.runtime.getManifest().version);
                return { response: ok(request.id, request.type, { preview }) };
            } catch (error) {
                const mapped = toErrorCode(error);
                return { response: err(request.id, request.type, mapped.code, mapped.message) };
            }
        }
        case 'settings:getRecovery': {
            try {
                const saved = (await localStoragePort.get(STORAGE_KEYS.settingsRecoveryV1))[STORAGE_KEYS.settingsRecoveryV1];
                // Validate the recovery with the same whitelist as a file; never
                // return arbitrary objects inserted under this key.
                const file = saved ? parseSettingsFile(JSON.stringify(saved),browser.runtime.getManifest().version).file : null;
                return { response: ok(request.id, request.type, { file }) };
            } catch(error) {const mapped=toErrorCode(error);return {response:err(request.id,request.type,mapped.code,mapped.message)};}
        }
        case 'settings:applyImport': {
            return backgroundStorageQueue.enqueue(async () => {
                try {
                    const { file } = parseSettingsFile(request.payload?.fileText,browser.runtime.getManifest().version);
                    const current = loadAndNormalize(await loadStoredSettings());
                    if (request.payload?.expectedFingerprint !== await fingerprintSettings(current)) throw new Error('CONFLICT');
                    const categories = request.payload?.categories;
                    if (!Array.isArray(categories) || categories.length > 11 || categories.some(category => typeof category !== 'string' || !isTransferCategory(category))) {
                        return { response: err(request.id, request.type, 'INVALID_REQUEST', 'SETTINGS_CATEGORIES_INVALID') };
                    }
                    const next = mergePortableSettings(current, file.settings, categories);
                    const nextFingerprint = await fingerprintSettings(next);
                    if (nextFingerprint === await fingerprintSettings(current)) return { response: ok(request.id, request.type, { applied: false }) };
                    await syncStoragePort.assertValueFits(LEGACY_STORAGE_KEYS.appSettingsKey, next);
                    await localStoragePort.set({ [STORAGE_KEYS.settingsRecoveryV1]: createSettingsFile(current, browser.runtime.getManifest().version) });
                    await persistSettings(next);
                    if (await fingerprintSettings(loadAndNormalize(await loadStoredSettings())) !== nextFingerprint) throw new Error('CONFLICT');
                    return { response: ok(request.id, request.type, { applied: true }) };
                } catch (error) {
                    const mapped = toErrorCode(error);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        case 'settings:getAll': {
            const stored = await loadStoredSettings();
            const normalized = loadAndNormalize(stored);
            return { response: ok(request.id, request.type, {...planGetAll(normalized),capabilities:{appVersion:browser.runtime.getManifest().version,settingsVersion:5,settingsFileFormatVersion:1,buttonsPreferences:true}}) };
        }
        case 'settings:getCategory': {
            const stored = await loadStoredSettings();
            const normalized = loadAndNormalize(stored);
            try {
                const result = planGetCategory(normalized, request.payload?.category);
                return { response: ok(request.id, request.type, result) };
            } catch (e) {
                const mapped = toErrorCode(e);
                return { response: err(request.id, request.type, mapped.code, mapped.message) };
            }
        }
        case 'settings:setCategory': {
            return backgroundStorageQueue.enqueue(async () => {
                try {
                    const stored = await loadStoredSettings();
                    const normalized = loadAndNormalize(stored);
                    const category = request.payload.category as SettingsCategory;
                    const plan = planSetCategory(normalized, category, request.payload.value);
                    await persistSettings(plan.next);
                    return { response: ok(request.id, request.type, { category }) };
                } catch (e) {
                    const mapped = toErrorCode(e);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        case 'settings:reset': {
            return backgroundStorageQueue.enqueue(async () => {
                try {
                    await loadStoredSettings();
                    const plan = planReset();
                    await persistSettings(plan.next);
                    return { response: ok(request.id, request.type, { reset: true }) };
                } catch (e) {
                    const mapped = toErrorCode(e);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        default:
            return { response: err(request.id, request.type, 'UNKNOWN_TYPE', 'Unknown settings request') };
    } } catch(error) { const mapped=toErrorCode(error);return {response:err(request.id,request.type,mapped.code,mapped.message)}; }
}

function isTransferCategory(value: string): boolean {
    return ['platforms', 'behavior', 'reader', 'content', 'formula', 'export', 'chatgptDirectory', 'chatgptBehavior', 'appearance', 'bookmarks', 'language'].includes(value);
}
