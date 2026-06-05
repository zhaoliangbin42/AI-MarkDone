export const NAVIGATION_HIGHLIGHT_DURATION_MS = 1000;
export const NAVIGATION_HIGHLIGHT_OUTLINE = '1px dashed color-mix(in srgb, var(--aimd-interactive-primary) 50%, transparent)';

const activeHighlights = new WeakMap<HTMLElement, symbol>();

export function highlightNavigationTarget(element: HTMLElement): void {
    const token = Symbol('navigation-highlight');
    activeHighlights.set(element, token);
    element.dataset.aimdHighlight = '1';
    element.style.outline = NAVIGATION_HIGHLIGHT_OUTLINE;
    element.style.outlineOffset = '2px';
    window.setTimeout(() => {
        if (activeHighlights.get(element) !== token) return;
        activeHighlights.delete(element);
        if (element.dataset.aimdHighlight !== '1') return;
        delete element.dataset.aimdHighlight;
        element.style.outline = '';
        element.style.outlineOffset = '';
    }, NAVIGATION_HIGHLIGHT_DURATION_MS);
}
