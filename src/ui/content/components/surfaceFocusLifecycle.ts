import { getSurfaceOpenDuration } from './motionLifecycle';

function findFocusable(root: ParentNode | null | undefined): HTMLElement | null {
    if (!root) return null;
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return root.querySelector<HTMLElement>(selector);
}

function findPreferredFocusable(root: ParentNode | null | undefined, selectors: string[]): HTMLElement | null {
    if (!root) return null;
    for (const selector of selectors) {
        const candidate = root.querySelector<HTMLElement>(selector);
        if (candidate && !candidate.hasAttribute('disabled') && candidate.getAttribute('aria-hidden') !== 'true') {
            return candidate;
        }
    }
    return null;
}

export class SurfaceFocusLifecycle {
    private opener: HTMLElement | null = null;
    private focusTimer: number | null = null;

    capture(): void {
        this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    scheduleInitialFocus(params: {
        surface: HTMLElement | null | undefined;
        selectors?: string[];
    }): void {
        this.clearPendingFocus();
        const surface = params.surface ?? null;
        if (!surface) return;

        const delayMs = getSurfaceOpenDuration(surface);
        this.focusTimer = window.setTimeout(() => {
            if (!surface.isConnected) return;
            const target = findPreferredFocusable(surface, params.selectors ?? []) ?? findFocusable(surface);
            target?.focus?.({ preventScroll: true } as FocusOptions);
            this.focusTimer = null;
        }, delayMs);
    }

    restore(fallbackRoot?: ParentNode | null): void {
        this.clearPendingFocus();

        const opener = this.opener;
        this.opener = null;
        if (opener?.isConnected) {
            opener.focus?.({ preventScroll: true } as FocusOptions);
            return;
        }

        const fallback = findFocusable(fallbackRoot ?? document);
        fallback?.focus?.({ preventScroll: true } as FocusOptions);
    }

    clear(): void {
        this.clearPendingFocus();
        this.opener = null;
    }

    private clearPendingFocus(): void {
        if (this.focusTimer !== null) {
            window.clearTimeout(this.focusTimer);
            this.focusTimer = null;
        }
    }
}
