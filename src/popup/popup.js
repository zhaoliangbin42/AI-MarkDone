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

    const localizePopup = () => {
        const i18n = globalThis.browser?.i18n ?? globalThis.chrome?.i18n;
        if (!i18n?.getMessage) return;
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.getAttribute('data-i18n');
            const value = key ? i18n.getMessage(key) : '';
            if (value) element.textContent = value;
        });
        document.querySelectorAll('[data-i18n-attr]').forEach((element) => {
            const binding = element.getAttribute('data-i18n-attr') ?? '';
            const separator = binding.indexOf(':');
            if (separator <= 0) return;
            const attribute = binding.slice(0, separator);
            const key = binding.slice(separator + 1);
            const value = i18n.getMessage(key);
            if (value) element.setAttribute(attribute, value);
        });
        const uiLanguage = i18n.getUILanguage?.();
        if (uiLanguage) document.documentElement.lang = uiLanguage;
    };

    const colorScheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const applyColorScheme = () => {
        document.documentElement.setAttribute('data-aimd-theme', colorScheme?.matches ? 'dark' : 'light');
    };

    localizePopup();
    applyColorScheme();
    colorScheme?.addEventListener?.('change', applyColorScheme);

    const storage = globalThis.browser?.storage ?? globalThis.chrome?.storage;
    const result = storage?.sync?.get?.('app_settings', (next) => {
        applyAccentColor(next?.app_settings?.appearance?.accentColor);
    });

    result?.then?.((next) => {
        applyAccentColor(next?.app_settings?.appearance?.accentColor);
    });
})();
