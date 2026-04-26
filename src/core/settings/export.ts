export type PngExportWidthPreset = 'mobile' | 'tablet' | 'desktop' | 'custom';

export type ExportSettings = {
    pngWidthPreset: PngExportWidthPreset;
    pngCustomWidth: number;
    pngPixelRatio: number;
};

export const DEFAULT_PNG_EXPORT_WIDTH = 800;
export const MIN_PNG_EXPORT_WIDTH = 360;
export const MAX_PNG_EXPORT_WIDTH = 1200;
export const PNG_EXPORT_WIDTH_STEP = 20;
export const DEFAULT_PNG_EXPORT_PIXEL_RATIO = 2;
export const MIN_PNG_EXPORT_PIXEL_RATIO = 1;
export const MAX_PNG_EXPORT_PIXEL_RATIO = 3;
export const PNG_EXPORT_PIXEL_RATIO_STEP = 0.5;

export const PNG_EXPORT_WIDTH_PRESETS: Record<Exclude<PngExportWidthPreset, 'custom'>, number> = {
    mobile: 390,
    tablet: 640,
    desktop: DEFAULT_PNG_EXPORT_WIDTH,
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
    pngWidthPreset: 'desktop',
    pngCustomWidth: DEFAULT_PNG_EXPORT_WIDTH,
    pngPixelRatio: DEFAULT_PNG_EXPORT_PIXEL_RATIO,
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

export function normalizePngPixelRatio(value: unknown): number {
    const raw = typeof value === 'number'
        ? value
        : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
    if (!Number.isFinite(raw)) return DEFAULT_EXPORT_SETTINGS.pngPixelRatio;
    const normalized = Math.round(raw / PNG_EXPORT_PIXEL_RATIO_STEP) * PNG_EXPORT_PIXEL_RATIO_STEP;
    return Math.min(MAX_PNG_EXPORT_PIXEL_RATIO, Math.max(MIN_PNG_EXPORT_PIXEL_RATIO, normalized));
}

export function normalizeExportSettings(value: unknown): ExportSettings {
    const record = isRecord(value) ? value : {};
    return {
        pngWidthPreset: normalizePngExportWidthPreset(record.pngWidthPreset),
        pngCustomWidth: normalizePngCustomWidth(record.pngCustomWidth),
        pngPixelRatio: normalizePngPixelRatio(record.pngPixelRatio),
    };
}

export function resolvePngExportWidth(settings: ExportSettings): number {
    if (settings.pngWidthPreset === 'custom') return normalizePngCustomWidth(settings.pngCustomWidth);
    return PNG_EXPORT_WIDTH_PRESETS[settings.pngWidthPreset];
}

export function resolvePngExportPixelRatio(settings: ExportSettings): number {
    return normalizePngPixelRatio(settings.pngPixelRatio);
}
