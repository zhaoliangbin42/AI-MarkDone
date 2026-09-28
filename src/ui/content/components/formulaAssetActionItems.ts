import { copyIcon, downloadIcon } from '../../../assets/icons';
import { targetSurfacePolicy } from '../../../config/targetSurface';
import type { FormulaAssetActionSettings } from '../../../core/settings/formula';
import type { FormulaAssetAction } from '../../../services/math/formulaAssetActions';
import { t } from './i18n';

export function createFormulaAssetActionItems(
    onAction: (action: FormulaAssetAction) => void,
    enabled?: FormulaAssetActionSettings,
) {
    return ([
        ['copyPng', 'copy_png', 'formulaCopyAsPng', 'PNG', copyIcon],
        ['copySvg', 'copy_svg', 'formulaCopyAsSvg', 'SVG', copyIcon],
        ['copyMathml', 'copy_mathml', 'formulaCopyAsMathml', 'MathML', copyIcon],
        ['savePng', 'save_png', 'formulaSaveAsPng', 'PNG', downloadIcon],
        ['saveSvg', 'save_svg', 'formulaSaveAsSvg', 'SVG', downloadIcon],
    ] as const).filter(([key, action]) => (!enabled || enabled[key])
        && (targetSurfacePolicy.binaryClipboardCopyActions || (action !== 'copy_png' && action !== 'copy_svg')))
        .map(([, action, labelKey, displayLabel, icon]) => ({
            id: action.replace('_', '_formula_'),
            label: t(labelKey) === labelKey ? `${action.startsWith('copy') ? 'Copy' : 'Save'} as ${displayLabel}` : t(labelKey),
            displayLabel, icon,
            showLabel: true, onClick: () => onAction(action),
        }));
}
