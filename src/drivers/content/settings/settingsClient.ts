import type { SettingsCategory } from '../../../contracts/protocol';
import type { AppSettings } from '../../../core/settings/types';
import { browser } from '../../shared/browser';
import { sendExtRequest } from '../../shared/rpc';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS } from '../../../contracts/storage';

export type SettingsSnapshot = {
    settings: AppSettings;
};

type Listener = (snap: SettingsSnapshot) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isAppSettings(value: unknown): value is AppSettings {
    if (!isRecord(value)) return false;
    if (value.version !== 3) return false;
    return typeof (value as any).platforms === 'object' && typeof (value as any).behavior === 'object';
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
            if (!isAppSettings(next)) return;
            this.cache = next;
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
        if (!isAppSettings(settings)) return null;
        this.cache = settings;
        this.emit();
        return settings;
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

