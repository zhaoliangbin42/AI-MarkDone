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

    const storage = globalThis.browser?.storage ?? globalThis.chrome?.storage;
    const result = storage?.sync?.get?.('app_settings', (next) => {
        applyAccentColor(next?.app_settings?.appearance?.accentColor);
    });

    result?.then?.((next) => {
        applyAccentColor(next?.app_settings?.appearance?.accentColor);
    });
})();
