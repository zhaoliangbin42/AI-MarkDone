import type { SettingsCategory } from '../../../contracts/protocol';
import type { AppSettings } from '../../../core/settings/types';
import { browser } from '../../shared/browser';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    type RuntimeClientResult,
} from '../../shared/clients/clientResult';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS } from '../../../contracts/storage';
import { loadAndNormalize } from '../../../core/settings/migrations';
import { isRecord } from '../../shared/clients/payloadValidation';

export type SettingsSnapshot = {
    settings: AppSettings;
};

type Listener = (snap: SettingsSnapshot) => void;

function normalizeAppSettings(value: unknown): AppSettings | null {
    if (!isRecord(value)) return null;
    const version = (value as any).version;
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4) return null;
    return loadAndNormalize(value);
}

export class SettingsClient {
    private cache: AppSettings | null = null;
    private listeners = new Set<Listener>();
    private initialized = false;

    init(): void {
        if (this.initialized) return;
        this.initialized = true;

        browser.storage.onChanged.addListener((changes: any, areaName: string) => {
            if (areaName !== 'sync') return;
            const change = changes?.[LEGACY_STORAGE_KEYS.appSettingsKey];
            const next = change?.newValue;
            const normalized = normalizeAppSettings(next);
            if (!normalized) return;
            this.cache = normalized;
            this.emit();
        });

        void this.refresh();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        if (this.cache) listener({ settings: this.cache });
        return () => this.listeners.delete(listener);
    }

    getCached(): AppSettings | null {
        return this.cache;
    }

    async refresh(): Promise<AppSettings | null> {
        const res = await requestRuntimeClient<{ settings?: unknown }>({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:getAll',
        } as any);
        if (!res.ok) return null;
        const settings = res.data?.settings;
        const normalized = normalizeAppSettings(settings);
        if (!normalized) return null;
        this.cache = normalized;
        this.emit();
        return normalized;
    }

    async getCategory(category: SettingsCategory): Promise<unknown | null> {
        const res = await this.getCategoryResult(category);
        return res.ok ? res.data : null;
    }

    async getCategoryResult(category: SettingsCategory): Promise<RuntimeClientResult<unknown>> {
        const res = await requestRuntimeClient<{ category?: unknown; value?: unknown }>({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:getCategory',
            payload: { category },
        } as any);
        if (!res.ok) return res;
        if (
            !isRecord(res.data)
            || res.data.category !== category
            || !Object.prototype.hasOwnProperty.call(res.data, 'value')
        ) {
            return createInvalidResponseClientFailure('Invalid settings category response');
        }
        return { ok: true, data: res.data.value };
    }

    async setCategory(category: SettingsCategory, value: unknown): Promise<boolean> {
        const res = await this.setCategoryResult(category, value);
        return res.ok;
    }

    async setCategoryResult(category: SettingsCategory, value: unknown): Promise<RuntimeClientResult<unknown>> {
        const res = await requestRuntimeClient<{ category?: unknown }>({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:setCategory',
            payload: { category, value },
        } as any);
        if (!res.ok) return res;
        if (!isRecord(res.data) || res.data.category !== category) {
            return createInvalidResponseClientFailure('Invalid settings write response');
        }
        // Refresh is best-effort; storage.onChanged should also cover updates.
        void this.refresh();
        return res;
    }

    async reset(): Promise<boolean> {
        const res = await requestRuntimeClient({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:reset',
        } as any);
        if (!res.ok) return false;
        void this.refresh();
        return true;
    }

    private emit(): void {
        if (!this.cache) return;
        const snap: SettingsSnapshot = { settings: this.cache };
        this.listeners.forEach((l) => l(snap));
    }
}
