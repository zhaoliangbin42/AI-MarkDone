export const TRANSIENT_ROOT_ATTR = 'data-aimd-transient-root';

export type TransientOutsideDismissBoundaryHandle = {
    detach(): void;
};

type TransientOutsideDismissBoundaryRoot = HTMLElement | null | undefined;

type TransientOutsideDismissBoundaryParams = {
    eventTarget: EventTarget;
    roots?: readonly TransientOutsideDismissBoundaryRoot[] | (() => readonly TransientOutsideDismissBoundaryRoot[]);
    onDismiss: (event: Event) => void;
};

export function markTransientRoot<T extends HTMLElement>(element: T): T {
    element.setAttribute(TRANSIENT_ROOT_ATTR, '1');
    return element;
}

export function eventWithinTransientRoot(event: Event): boolean {
    const path = (event.composedPath?.() ?? []) as EventTarget[];
    return path.some((entry) => entry instanceof HTMLElement && entry.hasAttribute(TRANSIENT_ROOT_ATTR));
}

export function installTransientOutsideDismissBoundary(
    params: TransientOutsideDismissBoundaryParams,
): TransientOutsideDismissBoundaryHandle {
    let pointerDownStartedInside = false;

    const getRoots = (): HTMLElement[] => {
        const roots = typeof params.roots === 'function' ? params.roots() : (params.roots ?? []);
        return roots.filter((root): root is HTMLElement => Boolean(root));
    };

    const eventWithinConfiguredRoot = (event: Event): boolean => {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        const roots = getRoots();
        return roots.some((root) => path.includes(root) || path.some((entry) => entry instanceof Node && root.contains(entry)));
    };

    const eventStartedInside = (event: Event): boolean => {
        return eventWithinTransientRoot(event) || eventWithinConfiguredRoot(event);
    };

    const onPointerDown = (event: Event): void => {
        pointerDownStartedInside = eventStartedInside(event);
    };

    const onClick = (event: Event): void => {
        const clickLandedInside = eventStartedInside(event);
        if (!pointerDownStartedInside && !clickLandedInside) {
            params.onDismiss(event);
        }
        pointerDownStartedInside = false;
    };

    params.eventTarget.addEventListener('pointerdown', onPointerDown, { capture: true });
    params.eventTarget.addEventListener('click', onClick, { capture: true });

    return {
        detach() {
            params.eventTarget.removeEventListener('pointerdown', onPointerDown, { capture: true } as any);
            params.eventTarget.removeEventListener('click', onClick, { capture: true } as any);
        },
    };
}
