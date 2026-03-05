import { browser } from '../../../drivers/shared/browser';

export type I18nKey = string;

export type UiLocale = 'auto' | 'en' | 'zh_CN';

type LocaleCatalog = Record<string, string>;
type LocaleMessagesJson = Record<string, { message?: string }>;

let activeLocale: UiLocale = 'auto';
let activeCatalog: LocaleCatalog | null = null;
let activeEffectiveLocale: Exclude<UiLocale, 'auto'> | null = null;
const loadedCatalogs = new Map<Exclude<UiLocale, 'auto'>, LocaleCatalog>();
const listeners = new Set<(locale: UiLocale) => void>();

function applySubstitutions(template: string, substitutions?: string | string[]): string {
    if (!substitutions) return template;
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    let out = template;
    // Chrome i18n uses $1..$9 style replacements.
    subs.forEach((value, idx) => {
        const token = `$${idx + 1}`;
        out = out.split(token).join(value);
    });
    return out;
}

function detectAutoLocale(): Exclude<UiLocale, 'auto'> {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh_CN';
    return 'en';
}

async function loadJson(url: string): Promise<LocaleMessagesJson> {
    // Prefer fetch (simple + cacheable); fall back to XHR for environments where fetch on extension URLs is blocked.
    try {
        const res = await fetch(url);
        if (res.ok) return (await res.json()) as LocaleMessagesJson;
    } catch {
        // ignore
    }

    return await new Promise<LocaleMessagesJson>((resolve, reject) => {
        const Xhr = (globalThis as any).XMLHttpRequest as any;
        if (!Xhr) return reject(new Error('XMLHttpRequest unavailable'));
        const xhr = new Xhr();
        xhr.open('GET', url, true);
        xhr.responseType = 'json';
        xhr.onload = () => {
            const ok = xhr.status >= 200 && xhr.status < 300;
            if (!ok) return reject(new Error(`XHR failed (${xhr.status})`));
            resolve((xhr.response ?? {}) as LocaleMessagesJson);
        };
        xhr.onerror = () => reject(new Error('XHR failed'));
        xhr.send();
    });
}

async function loadCatalog(locale: Exclude<UiLocale, 'auto'>): Promise<LocaleCatalog> {
    const existing = loadedCatalogs.get(locale);
    if (existing) return existing;

    const url = browser.runtime.getURL(`_locales/${locale}/messages.json`);
    const json = await loadJson(url);
    const catalog: LocaleCatalog = {};
    for (const [key, entry] of Object.entries(json)) {
        if (entry && typeof entry.message === 'string') {
            catalog[key] = entry.message;
        }
    }
    loadedCatalogs.set(locale, catalog);
    return catalog;
}

export function getLocale(): UiLocale {
    return activeLocale;
}

export function getEffectiveLocale(): Exclude<UiLocale, 'auto'> | null {
    return activeEffectiveLocale;
}

export function subscribeLocaleChange(listener: (locale: UiLocale) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function setLocale(locale: UiLocale): Promise<void> {
    const effective: Exclude<UiLocale, 'auto'> = locale === 'auto' ? detectAutoLocale() : locale;
    const localeChanged = locale !== activeLocale;
    const effectiveChanged = effective !== activeEffectiveLocale;
    // Ensure we still load catalogs on first run (activeCatalog is null) and when auto-locale resolves differently.
    if (!localeChanged && !effectiveChanged && activeCatalog) return;

    activeLocale = locale;
    activeEffectiveLocale = effective;

    try {
        activeCatalog = await loadCatalog(effective);
    } catch {
        activeCatalog = null;
    }

    // a11y: reflect effective language on the top-level document.
    try {
        document.documentElement.setAttribute('lang', effective === 'zh_CN' ? 'zh-CN' : 'en');
    } catch {
        // ignore
    }
    listeners.forEach((l) => l(activeLocale));
}

export function t(key: I18nKey, substitutions?: string | string[]): string {
    if (activeCatalog && key in activeCatalog) {
        return applySubstitutions(activeCatalog[key] || key, substitutions);
    }
    try {
        const value = browser.i18n.getMessage(key, substitutions as any);
        return value || key;
    } catch {
        return key;
    }
}
