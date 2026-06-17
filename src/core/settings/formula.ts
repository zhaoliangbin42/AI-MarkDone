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
};

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
};
