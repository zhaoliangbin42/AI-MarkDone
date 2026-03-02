import { browser } from '../../../drivers/shared/browser';

export type I18nKey = string;

export type UiLocale = 'auto' | 'en' | 'zh_CN';

type LocaleCatalog = Record<string, string>;
type LocaleMessagesJson = Record<string, { message?: string }>;

let activeLocale: UiLocale = 'auto';
let activeCatalog: LocaleCatalog | null = null;
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

async function loadCatalog(locale: Exclude<UiLocale, 'auto'>): Promise<LocaleCatalog> {
    const existing = loadedCatalogs.get(locale);
    if (existing) return existing;

    const url = browser.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load locale catalog: ${locale}`);
    }
    const json = (await res.json()) as LocaleMessagesJson;
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

export function subscribeLocaleChange(listener: (locale: UiLocale) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function setLocale(locale: UiLocale): Promise<void> {
    if (locale === activeLocale) return;
    activeLocale = locale;
    if (locale === 'auto') {
        activeCatalog = null;
        listeners.forEach((l) => l(activeLocale));
        return;
    }
    try {
        activeCatalog = await loadCatalog(locale);
    } catch {
        activeCatalog = null;
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
