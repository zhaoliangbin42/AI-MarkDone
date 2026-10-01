import { createIcon } from './Icon';
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

export function createFormulaAssetActionButton(item: ReturnType<typeof createFormulaAssetActionItems>[number]): HTMLButtonElement {
    const button=document.createElement('button');button.type='button';button.className='annotation-action-button';button.dataset.action=item.id;button.setAttribute('aria-label',item.label);button.title=item.label;button.append(createIcon(item.icon),document.createTextNode(item.displayLabel));button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',item.onClick);return button;
}
export function getFormulaAssetActionRowCss(): string { return `
.formula-export-actions { display: flex; flex-wrap: wrap; gap: var(--aimd-space-1); padding: var(--aimd-space-2); border-top: 1px solid var(--aimd-workspace-border); }
.formula-export-actions button { padding-inline: var(--aimd-space-2); font-size: var(--aimd-font-size-xs); }
`; }
