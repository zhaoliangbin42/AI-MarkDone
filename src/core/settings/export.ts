export type PngExportWidthPreset = 'mobile' | 'tablet' | 'desktop' | 'custom';

export type ExportSettings = {
    pngWidthPreset: PngExportWidthPreset;
    pngCustomWidth: number;
};

export const DEFAULT_PNG_EXPORT_WIDTH = 800;
export const MIN_PNG_EXPORT_WIDTH = 360;
export const MAX_PNG_EXPORT_WIDTH = 1200;
export const PNG_EXPORT_WIDTH_STEP = 20;

export const PNG_EXPORT_WIDTH_PRESETS: Record<Exclude<PngExportWidthPreset, 'custom'>, number> = {
    mobile: 390,
    tablet: 640,
    desktop: DEFAULT_PNG_EXPORT_WIDTH,
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
    pngWidthPreset: 'desktop',
    pngCustomWidth: DEFAULT_PNG_EXPORT_WIDTH,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function normalizePngExportWidthPreset(value: unknown): PngExportWidthPreset {
    return value === 'mobile' || value === 'tablet' || value === 'desktop' || value === 'custom'
        ? value
        : DEFAULT_EXPORT_SETTINGS.pngWidthPreset;
}

export function normalizePngCustomWidth(value: unknown): number {
    const raw = typeof value === 'number'
        ? value
        : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
    if (!Number.isFinite(raw)) return DEFAULT_EXPORT_SETTINGS.pngCustomWidth;
    const normalized = Math.round(raw / PNG_EXPORT_WIDTH_STEP) * PNG_EXPORT_WIDTH_STEP;
    return Math.min(MAX_PNG_EXPORT_WIDTH, Math.max(MIN_PNG_EXPORT_WIDTH, normalized));
}

export function normalizeExportSettings(value: unknown): ExportSettings {
    const record = isRecord(value) ? value : {};
    return {
        pngWidthPreset: normalizePngExportWidthPreset(record.pngWidthPreset),
        pngCustomWidth: normalizePngCustomWidth(record.pngCustomWidth),
    };
}

export function resolvePngExportWidth(settings: ExportSettings): number {
    if (settings.pngWidthPreset === 'custom') return normalizePngCustomWidth(settings.pngCustomWidth);
    return PNG_EXPORT_WIDTH_PRESETS[settings.pngWidthPreset];
}
