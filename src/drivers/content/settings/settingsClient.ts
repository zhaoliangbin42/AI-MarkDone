import type { SettingsCategory } from '../../../contracts/protocol';
import type { AppSettings } from '../../../core/settings/types';
import { browser } from '../../shared/browser';
import { sendExtRequest } from '../../shared/rpc';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS } from '../../../contracts/storage';
import { loadAndNormalize } from '../../../services/settings/settingsService';

export type SettingsSnapshot = {
    settings: AppSettings;
};

type Listener = (snap: SettingsSnapshot) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

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
        const res = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:getAll',
        } as any);
        if (!res?.ok) return null;
        const settings = (res.data as any)?.settings;
        const normalized = normalizeAppSettings(settings);
        if (!normalized) return null;
        this.cache = normalized;
        this.emit();
        return normalized;
    }

    async getCategory(category: SettingsCategory): Promise<unknown | null> {
        const res = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:getCategory',
            payload: { category },
        } as any);
        if (!res?.ok) return null;
        return (res.data as any)?.value ?? null;
    }

    async setCategory(category: SettingsCategory, value: unknown): Promise<boolean> {
        const res = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:setCategory',
            payload: { category, value },
        } as any);
        if (!res?.ok) return false;
        // Refresh is best-effort; storage.onChanged should also cover updates.
        void this.refresh();
        return true;
    }

    async reset(): Promise<boolean> {
        const res = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'settings:reset',
        } as any);
        if (!res?.ok) return false;
        void this.refresh();
        return true;
    }

    private emit(): void {
        if (!this.cache) return;
        const snap: SettingsSnapshot = { settings: this.cache };
        this.listeners.forEach((l) => l(snap));
    }
}
