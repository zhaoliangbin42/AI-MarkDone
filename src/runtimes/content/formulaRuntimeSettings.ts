import { DEFAULT_SETTINGS } from '../../core/settings/types';
import { normalizeFormulaAssetFontSizePx } from '../../core/settings/formula';
import { normalizeFormulaSourceFormat } from '../../core/math/formulaSourceFormat';

export function resolveFormulaSettings(settings: typeof DEFAULT_SETTINGS.formula | undefined): typeof DEFAULT_SETTINGS.formula {
    return {
        ...DEFAULT_SETTINGS.formula,
        ...settings,
        clickCopyFormulaFormat: normalizeFormulaSourceFormat(settings?.clickCopyFormulaFormat),
        markdownCopyFormulaFormat: normalizeFormulaSourceFormat(settings?.markdownCopyFormulaFormat),
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
