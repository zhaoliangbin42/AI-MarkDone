(() => {
    const approvedAccentColors = new Set(['#2563eb', '#059669', '#7c3aed', '#e11d48', '#d97706']);

    const normalizeHexColor = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
        const normalized = trimmed.toLowerCase();
        return approvedAccentColors.has(normalized) ? normalized : null;
    };

    const applyAccentColor = (accentColor) => {
        const color = normalizeHexColor(accentColor);
        if (!color) return;
        const root = document.documentElement;
        root.style.setProperty('--aimd-interactive-primary', color);
        root.style.setProperty('--aimd-interactive-primary-hover', `color-mix(in srgb, ${color} 82%, var(--aimd-text-primary))`);
        root.style.setProperty('--aimd-interactive-selected', `color-mix(in srgb, ${color} 14%, transparent)`);
    };

    const resolvePopupLocale = (language, i18n) => {
        if (language === 'en' || language === 'zh_CN') return language;
        const uiLanguage = i18n?.getUILanguage?.() ?? '';
        return uiLanguage.toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
    };

    const loadLocaleCatalog = async (locale) => {
        const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;
        const url = runtime?.getURL?.(`_locales/${locale}/messages.json`)
            ?? `/_locales/${locale}/messages.json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Locale catalog unavailable: ${locale}`);
        return await response.json();
    };

    const localizePopup = async (language = 'auto') => {
        const i18n = globalThis.browser?.i18n ?? globalThis.chrome?.i18n;
        if (!i18n?.getMessage) return;
        const locale = resolvePopupLocale(language, i18n);
        let catalog = null;
        if (language !== 'auto') {
            try {
                catalog = await loadLocaleCatalog(locale);
            } catch {
                catalog = null;
            }
        }
        const getMessage = (key) => catalog?.[key]?.message ?? i18n.getMessage(key);
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.getAttribute('data-i18n');
            const value = key ? getMessage(key) : '';
            if (value) element.textContent = value;
        });
        document.querySelectorAll('[data-i18n-attr]').forEach((element) => {
            const binding = element.getAttribute('data-i18n-attr') ?? '';
            const separator = binding.indexOf(':');
            if (separator <= 0) return;
            const attribute = binding.slice(0, separator);
            const key = binding.slice(separator + 1);
            const value = getMessage(key);
            if (value) element.setAttribute(attribute, value);
        });
        document.documentElement.lang = locale === 'zh_CN' ? 'zh-CN' : 'en';
    };

    const colorScheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const applyColorScheme = () => {
        document.documentElement.setAttribute('data-aimd-theme', colorScheme?.matches ? 'dark' : 'light');
    };

    void localizePopup();
    applyColorScheme();
    colorScheme?.addEventListener?.('change', applyColorScheme);

    const storage = globalThis.browser?.storage ?? globalThis.chrome?.storage;
    const result = storage?.sync?.get?.('app_settings', (next) => {
        const settings = next?.app_settings;
        applyAccentColor(settings?.appearance?.accentColor);
        void localizePopup(settings?.language);
    });

    result?.then?.((next) => {
        const settings = next?.app_settings;
        applyAccentColor(settings?.appearance?.accentColor);
        void localizePopup(settings?.language);
    });
})();
