import { DEFAULT_SETTINGS } from '../../core/settings/types';
import { normalizeFormulaAssetFontSizePx } from '../../core/settings/formula';

export function resolveFormulaSettings(settings: typeof DEFAULT_SETTINGS.formula | undefined): typeof DEFAULT_SETTINGS.formula {
    return {
        ...DEFAULT_SETTINGS.formula,
        ...settings,
        copyMarkdownDelimiters: settings?.copyMarkdownDelimiters ?? DEFAULT_SETTINGS.formula.copyMarkdownDelimiters,
        assetFontSizePx: normalizeFormulaAssetFontSizePx(settings?.assetFontSizePx),
        assetActions: {
            ...DEFAULT_SETTINGS.formula.assetActions,
            ...settings?.assetActions,
        },
    };
}

export function shouldEnableFormulaInteractions(settings: typeof DEFAULT_SETTINGS.formula): boolean {
    return Boolean(
        settings.clickCopyMarkdown
        || settings.assetActions.copyPng
        || settings.assetActions.copySvg
        || settings.assetActions.copyMathml
        || settings.assetActions.savePng
        || settings.assetActions.saveSvg
    );
}
