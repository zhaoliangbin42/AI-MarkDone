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
        const useCapture = type === 'focus' || type === 'focusin';
        root.addEventListener(type, stopEvent, useCapture);
    }

    return () => {
        for (const type of eventTypes) {
            const useCapture = type === 'focus' || type === 'focusin';
            root.removeEventListener(type, stopEvent, useCapture);
        }
    };
}

export { DEFAULT_INPUT_BOUNDARY_EVENT_TYPES };
