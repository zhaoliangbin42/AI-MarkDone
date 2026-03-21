const DEFAULT_INPUT_BOUNDARY_EVENT_TYPES = [
    'keydown',
    'keyup',
    'keypress',
    'beforeinput',
    'input',
    'change',
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'paste',
    'focus',
    'focusin',
    'mousedown',
    'click',
] as const;

export function installInputEventBoundary(
    root: HTMLElement,
    eventTypes: readonly string[] = DEFAULT_INPUT_BOUNDARY_EVENT_TYPES,
): () => void {
    const stopEvent = (event: Event) => {
        event.stopPropagation();
    };

    for (const type of eventTypes) {
        root.addEventListener(type, stopEvent);
    }

    return () => {
        for (const type of eventTypes) {
            root.removeEventListener(type, stopEvent);
        }
    };
}

export { DEFAULT_INPUT_BOUNDARY_EVENT_TYPES };
