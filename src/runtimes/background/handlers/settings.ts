import type { ExtRequest, ExtResponse, SettingsCategory } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS } from '../../../contracts/storage';
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
    if (message.startsWith('Invalid category:')) return { code: 'INVALID_REQUEST', message };
    return { code: 'INTERNAL_ERROR', message };
}

async function loadStoredSettings(): Promise<unknown> {
    const raw = await syncStoragePort.get(LEGACY_STORAGE_KEYS.appSettingsKey);
    return raw[LEGACY_STORAGE_KEYS.appSettingsKey];
}

async function persistSettings(next: unknown): Promise<void> {
    await syncStoragePort.set({ [LEGACY_STORAGE_KEYS.appSettingsKey]: next });
}

export async function handleSettingsRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('settings:')) return null;

    switch (request.type) {
        case 'settings:getAll': {
            const stored = await loadStoredSettings();
            const normalized = loadAndNormalize(stored);
            return { response: ok(request.id, request.type, planGetAll(normalized)) };
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
    }
}

