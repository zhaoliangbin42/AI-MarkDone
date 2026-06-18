export type FormulaAssetActionSettings = {
    copyPng: boolean;
    copySvg: boolean;
    copyMathml: boolean;
    savePng: boolean;
    saveSvg: boolean;
};

export type FormulaSettings = {
    clickCopyMarkdown: boolean;
    copyMarkdownDelimiters: boolean;
    assetActions: FormulaAssetActionSettings;
    assetFontSizePx: number;
};

export const DEFAULT_FORMULA_ASSET_FONT_SIZE_PX = 36;
export const MIN_FORMULA_ASSET_FONT_SIZE_PX = 16;
export const MAX_FORMULA_ASSET_FONT_SIZE_PX = 72;
export const FORMULA_ASSET_FONT_SIZE_STEP_PX = 1;

export function normalizeFormulaAssetFontSizePx(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return DEFAULT_FORMULA_ASSET_FONT_SIZE_PX;
    const clamped = Math.min(MAX_FORMULA_ASSET_FONT_SIZE_PX, Math.max(MIN_FORMULA_ASSET_FONT_SIZE_PX, numeric));
    return Math.round(clamped / FORMULA_ASSET_FONT_SIZE_STEP_PX) * FORMULA_ASSET_FONT_SIZE_STEP_PX;
}

export const DEFAULT_FORMULA_SETTINGS: FormulaSettings = {
    clickCopyMarkdown: true,
    copyMarkdownDelimiters: true,
    assetActions: {
        copyPng: false,
        copySvg: false,
        copyMathml: false,
        savePng: false,
        saveSvg: false,
    },
    assetFontSizePx: DEFAULT_FORMULA_ASSET_FONT_SIZE_PX,
};
