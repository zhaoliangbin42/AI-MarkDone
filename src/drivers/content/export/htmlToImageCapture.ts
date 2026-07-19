// html-to-image caches this list on first use. Message cards and formula frames own
// complete scoped stylesheets, while original inline styles survive cloneNode().
// Copying host computed styles would be slower and would freeze scroll/size values
// that are inappropriate for a static image.
export const BITMAP_CAPTURE_STYLE_PROPERTIES: string[] = [];

export function removeNonVisualBitmapMarkup(root: HTMLElement): void {
    // KaTeX renders a hidden MathML accessibility tree beside the visible HTML tree.
    // A bitmap cannot expose that tree, so cloning it only multiplies capture work.
    for (const mathMl of Array.from(root.querySelectorAll<HTMLElement>('.katex-mathml'))) {
        mathMl.remove();
    }
}

export function fitWideBitmapFormulaBlocks(root: HTMLElement): void {
    for (const display of Array.from(root.querySelectorAll<HTMLElement>('.katex-display'))) {
        const formula = display.querySelector<HTMLElement>('.katex');
        if (!formula) continue;
        const availableWidth = Math.max(1, display.clientWidth);
        const bounds = formula.getBoundingClientRect();
        const formulaWidth = Math.max(formula.scrollWidth, bounds.width);
        if (formulaWidth <= availableWidth) continue;

        const scale = availableWidth / formulaWidth;
        const formulaHeight = Math.max(formula.scrollHeight, bounds.height);
        formula.style.display = 'inline-block';
        formula.style.transform = `scale(${scale})`;
        formula.style.transformOrigin = 'top left';
        display.style.width = '100%';
        display.style.height = `${Math.ceil(formulaHeight * scale)}px`;
        display.style.overflow = 'hidden';
        display.style.textAlign = 'left';
    }
}
