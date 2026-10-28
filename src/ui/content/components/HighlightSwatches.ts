import { t } from './i18n';

import { HIGHLIGHT_COLORS, type HighlightColor } from '../../../contracts/highlights';
export { HIGHLIGHT_COLORS, type HighlightColor } from '../../../contracts/highlights';

export function createHighlightSwatches(params: {
    document?: Document;
    selected?: HighlightColor;
    onSelect: (color: HighlightColor) => void;
}): HTMLElement {
    const doc = params.document ?? document;
    const group = doc.createElement('span');
    group.className = 'aimd-highlight-swatches';
    for (const color of HIGHLIGHT_COLORS) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'aimd-highlight-swatch';
        button.dataset.color = color;
        button.dataset.action = 'highlight-selection';
        button.setAttribute('aria-label', color === 'blue' ? t('highlightColorBlue') : color === 'yellow' ? t('highlightColorYellow') : t('highlightColorRed'));
        button.setAttribute('aria-pressed', String(params.selected === color));
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => params.onSelect(color));
        group.append(button);
    }
    return group;
}

export function getHighlightSwatchesCss(): string {
    return `
.aimd-highlight-swatches { display: inline-flex; align-items: center; gap: var(--aimd-space-1); }
.aimd-highlight-swatch { appearance: none; cursor: pointer; flex: none; width: var(--aimd-space-5); height: var(--aimd-space-5); border-radius: var(--aimd-radius-full); border: 1px solid var(--aimd-border-subtle); }
.aimd-highlight-swatch[data-color="blue"] { background: var(--aimd-highlight-blue); }
.aimd-highlight-swatch[data-color="yellow"] { background: var(--aimd-highlight-yellow); }
.aimd-highlight-swatch[data-color="red"] { background: var(--aimd-highlight-red); }
.aimd-highlight-swatch:hover, .aimd-highlight-swatch:focus-visible, .aimd-highlight-swatch[aria-pressed="true"] { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
`;
}
