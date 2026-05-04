export type FormulaAssetActionSettings = {
    copyPng: boolean;
    copySvg: boolean;
    savePng: boolean;
    saveSvg: boolean;
};

export type FormulaSettings = {
    clickCopyMarkdown: boolean;
    assetActions: FormulaAssetActionSettings;
};

export const DEFAULT_FORMULA_SETTINGS: FormulaSettings = {
    clickCopyMarkdown: true,
    assetActions: {
        copyPng: true,
        copySvg: true,
        savePng: true,
        saveSvg: true,
    },
};

