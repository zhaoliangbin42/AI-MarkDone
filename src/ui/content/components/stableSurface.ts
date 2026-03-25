function createElementFromHtml<T extends HTMLElement>(html: string): T | null {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild as T | null;
}

function syncAttributes(target: HTMLElement, source: HTMLElement): void {
    const nextAttributeNames = new Set(source.getAttributeNames());
    const preservedAttributeNames = new Set(['data-motion-state', 'data-motion-runtime']);

    for (const attributeName of target.getAttributeNames()) {
        if (!nextAttributeNames.has(attributeName) && !preservedAttributeNames.has(attributeName)) {
            target.removeAttribute(attributeName);
        }
    }

    for (const attributeName of source.getAttributeNames()) {
        const value = source.getAttribute(attributeName);
        if (value === null) continue;
        target.setAttribute(attributeName, value);
    }

    target.className = source.className;
}

export function ensureBackdropElement(root: HTMLElement, className: string): { element: HTMLElement; isNew: boolean } {
    const existing = root.querySelector<HTMLElement>(`.${className.split(' ').join('.')}`);
    if (existing) {
        return { element: existing, isNew: false };
    }

    const backdrop = document.createElement('div');
    backdrop.className = className;
    root.replaceChildren(backdrop);
    return { element: backdrop, isNew: true };
}

export function ensureStableElementFromHtml<T extends HTMLElement>(
    root: HTMLElement,
    selector: string,
    html: string,
): { element: T; isNew: boolean } {
    const next = createElementFromHtml<T>(html);
    if (!next) {
        throw new Error(`Failed to create surface element for selector "${selector}"`);
    }

    const existing = root.querySelector<T>(selector);
    if (!existing) {
        root.replaceChildren(next);
        return { element: next, isNew: true };
    }

    syncAttributes(existing, next);
    existing.innerHTML = next.innerHTML;
    return { element: existing, isNew: false };
}
