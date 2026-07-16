export type DialogKeyboardScopeHandle = { detach(): void };

import { eventWithinTransientRoot, TRANSIENT_ROOT_ATTR } from './transientUi';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(focusables).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'));
}

type InternalScope = {
    root: HTMLElement;
    ensureFocusInside(): void;
};

const scopeStack: InternalScope[] = [];

function isTopMost(scope: InternalScope): boolean {
    return scopeStack.length > 0 && scopeStack[scopeStack.length - 1] === scope;
}

function elementInRoot(root: HTMLElement, el: HTMLElement | null): boolean {
    if (!el) return false;
    if (el === root) return true;
    return root.contains(el);
}

function elementInTransientRoot(el: HTMLElement | null): boolean {
    return Boolean(el?.closest?.(`[${TRANSIENT_ROOT_ATTR}]`));
}

function findFirstFocusable(root: HTMLElement): HTMLElement | null {
    const list = getFocusableElements(root);
    return list[0] ?? null;
}

export function attachDialogKeyboardScope(opts: {
    root: HTMLElement;
    keydownTarget?: EventTarget;
    onEscape: () => void;
    stopPropagationAll?: boolean;
    ignoreEscapeWhileComposing?: boolean;
    maintainFocus?: boolean;
    capture?: boolean;
    trapTabWithin?: HTMLElement;
    focusFallback?: () => HTMLElement | null;
}): DialogKeyboardScopeHandle {
    const stopPropagationAll = opts.stopPropagationAll ?? true;
    const ignoreEscapeWhileComposing = opts.ignoreEscapeWhileComposing ?? true;
    const maintainFocus = opts.maintainFocus ?? true;
    const capture = opts.capture ?? false;
    const keydownTarget = opts.keydownTarget ?? opts.root;

    const focusFallback = () => {
        const explicit = opts.focusFallback?.() ?? null;
        const el = (explicit && explicit.isConnected ? explicit : null) ?? findFirstFocusable(opts.root) ?? opts.root;
        if (!el.isConnected) return false;
        // Ensure the root is focusable as a last resort.
        if (el === opts.root && !opts.root.hasAttribute('tabindex')) opts.root.tabIndex = -1;
        el.focus({ preventScroll: true } as any);
        return true;
    };

    const ensureFocusInside = () => {
        if (!maintainFocus) return;
        if (!opts.root.isConnected) return;
        // When focus is inside a shadow tree, `document.activeElement` will be the shadow host (i.e., `root`).
        const active = document.activeElement as HTMLElement | null;
        if (elementInRoot(opts.root, active)) return;
        if (elementInTransientRoot(active)) return;
        // Focus escaped (e.g., element removed by ESC). Bring it back.
        focusFallback();
    };

    const internalScope: InternalScope = { root: opts.root, ensureFocusInside };
    scopeStack.push(internalScope);

    const onKeyDown = (e: KeyboardEvent) => {
        if (!isTopMost(internalScope)) return;
        if (stopPropagationAll) e.stopPropagation();

        if (e.key === 'Escape') {
            if (ignoreEscapeWhileComposing && (e as any).isComposing) return;
            e.preventDefault();
            e.stopPropagation();
            opts.onEscape();
            // If `onEscape` handled a sub-state (e.g., closed an inner modal/editor) without closing the root,
            // the previously focused element may have been removed; restore focus back into the dialog.
            requestAnimationFrame(() => ensureFocusInside());
            return;
        }

        if (e.key === 'Tab' && opts.trapTabWithin) {
            const list = getFocusableElements(opts.trapTabWithin);
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    const onPointerDownCapture = (e: PointerEvent) => {
        if (!maintainFocus) return;
        if (!opts.root.isConnected) return;
        if (eventWithinTransientRoot(e)) return;
        const active = document.activeElement as HTMLElement | null;
        if (elementInRoot(opts.root, active)) return;
        if (elementInTransientRoot(active)) return;

        // For composed events coming out of shadow DOM, `e.target` may be retargeted to the shadow host.
        // Use `composedPath()` to find the real clicked element.
        const path = (e as any).composedPath?.() as unknown[] | undefined;
        const firstInRoot =
            (path?.find((n) => n instanceof HTMLElement && elementInRoot(opts.root, n as HTMLElement)) as HTMLElement | undefined) ??
            (e.target as HTMLElement | null);

        const focusable = firstInRoot?.closest?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as
            | HTMLElement
            | null;
        if (focusable && elementInRoot(opts.root, focusable)) {
            focusable.focus({ preventScroll: true } as any);
            return;
        }
        focusFallback();
    };

    const onDocumentFocusInCapture = (e: FocusEvent) => {
        if (!maintainFocus) return;
        if (!opts.root.isConnected) return;
        if (!isTopMost(internalScope)) return;
        if (eventWithinTransientRoot(e)) return;
        const target = e.target as HTMLElement | null;
        if (elementInRoot(opts.root, target)) return;
        // Focus moved outside (e.g., an input was removed, or the user clicked the page).
        focusFallback();
    };

    const mutationObserver = maintainFocus ? new MutationObserver(() => {
        if (!opts.root.isConnected) return;
        if (!isTopMost(internalScope)) return;
        // If a focused element was removed by a sub-component ESC handler, focus may jump to <body> without
        // any further key events reaching the dialog root. Repair focus opportunistically.
        const active = document.activeElement as HTMLElement | null;
        if (elementInRoot(opts.root, active)) return;
        if (elementInTransientRoot(active)) return;
        focusFallback();
    }) : null;

    keydownTarget.addEventListener('keydown', onKeyDown as EventListener, { capture });
    opts.root.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    if (maintainFocus) {
        document.addEventListener('focusin', onDocumentFocusInCapture, { capture: true });
        mutationObserver?.observe(opts.root, { subtree: true, childList: true });
    }

    // Initial focus: ensure ESC works even if the user clicks a non-focusable area first.
    if (maintainFocus) queueMicrotask(() => ensureFocusInside());
    return {
        detach() {
            keydownTarget.removeEventListener('keydown', onKeyDown as EventListener, { capture } as any);
            opts.root.removeEventListener('pointerdown', onPointerDownCapture, { capture: true } as any);
            if (maintainFocus) {
                document.removeEventListener('focusin', onDocumentFocusInCapture, { capture: true } as any);
                mutationObserver?.disconnect();
            }
            const idx = scopeStack.indexOf(internalScope);
            if (idx >= 0) scopeStack.splice(idx, 1);
        },
    };
}
