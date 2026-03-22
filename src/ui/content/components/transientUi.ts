export const TRANSIENT_ROOT_ATTR = 'data-aimd-transient-root';

export function markTransientRoot<T extends HTMLElement>(element: T): T {
    element.setAttribute(TRANSIENT_ROOT_ATTR, '1');
    return element;
}

export function eventWithinTransientRoot(event: Event): boolean {
    const path = (event.composedPath?.() ?? []) as EventTarget[];
    return path.some((entry) => entry instanceof HTMLElement && entry.hasAttribute(TRANSIENT_ROOT_ATTR));
}
