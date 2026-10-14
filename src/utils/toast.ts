import { markTransientRoot } from '../ui/content/components/transientUi';

const TOAST_STYLE_ID = 'aimd-shared-toast-style';
const TOAST_VIEWPORT_ID = 'aimd-toast-viewport';
const DEFAULT_TOAST_DURATION_MS = 3000;

export type ToastTone = 'info' | 'success' | 'error';

export type ShowToastParams = {
    text: string;
    tone?: ToastTone;
    durationMs?: number;
    action?: Readonly<{ label: string; href: string }>;
    closeLabel?: string;
};

let removalTimer: number | null = null;
let dismissCurrentToast: (() => void) | null = null;

function getToastCss(): string {
    return `
#${TOAST_VIEWPORT_ID} {
  position: fixed;
  inset-block-start: var(--aimd-space-4);
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: var(--aimd-toast-z);
  pointer-events: none;
  display: flex;
  justify-content: center;
  width: min(92vw, 560px);
}
.aimd-toast {
  box-sizing: border-box;
  max-width: min(92vw, 420px);
  padding: var(--aimd-space-2) var(--aimd-space-4);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-toast-bg);
  color: var(--aimd-toast-text);
  box-shadow: var(--aimd-toast-shadow);
  font-family: var(--aimd-font-family-sans, ui-sans-serif, -apple-system, system-ui, sans-serif);
  font-size: var(--aimd-font-size-sm, 13px);
  font-weight: var(--aimd-font-semibold, 600);
  line-height: 1.4;
  letter-spacing: 0;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  animation: aimdToastLifecycle var(--_toast-duration) var(--aimd-ease-out) forwards;
}
.aimd-toast--action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--aimd-space-2);
  min-inline-size: 0;
  pointer-events: auto;
  text-align: start;
  animation: none;
}
.aimd-toast__message {
  flex: 1 1 100%;
  min-inline-size: 0;
}
.aimd-toast__action,
.aimd-toast__close {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: var(--aimd-size-control-compact);
  border: 0;
  border-radius: var(--aimd-radius-sm);
  padding: var(--aimd-space-1) var(--aimd-space-2);
  background: transparent;
  color: var(--aimd-toast-text);
  font: inherit;
  cursor: pointer;
}
.aimd-toast__action {
  flex: 1 1 auto;
  min-inline-size: 0;
  text-align: start;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
.aimd-toast__close {
  flex: 0 0 auto;
  min-inline-size: var(--aimd-size-control-compact);
}
.aimd-toast__action:hover,
.aimd-toast__close:hover {
  background: var(--aimd-interactive-hover);
}
.aimd-toast__action:focus-visible,
.aimd-toast__close:focus-visible {
  outline: var(--aimd-space-1) solid var(--aimd-toast-text);
  outline-offset: var(--aimd-space-1);
}
@keyframes aimdToastLifecycle {
  0% { opacity: 0; transform: translateY(-12px); }
  10% { opacity: 1; transform: translateY(0); }
  88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}
@media (prefers-reduced-motion: reduce) {
  .aimd-toast:not(.aimd-toast--action) {
    animation: aimdToastReduced var(--_toast-duration) var(--aimd-ease-in-out) forwards;
  }
  @keyframes aimdToastReduced {
    0%, 88% { opacity: 1; }
    100% { opacity: 0; }
  }
}
`;
}

function ensureToastStyle(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(TOAST_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TOAST_STYLE_ID;
    style.textContent = getToastCss();
    (document.head || document.documentElement).appendChild(style);
}

function ensureToastViewport(): HTMLElement {
    const existing = document.getElementById(TOAST_VIEWPORT_ID);
    if (existing instanceof HTMLElement) return existing;
    const viewport = document.createElement('div');
    viewport.id = TOAST_VIEWPORT_ID;
    viewport.setAttribute('data-aimd-role', 'toast-viewport');
    document.body.appendChild(viewport);
    return viewport;
}

function getSafeAction(action: ShowToastParams['action']): ShowToastParams['action'] | null {
    if (!action) return null;
    const label = action.label.trim();
    const href = action.href.trim();
    if (!label || !/^https:\/\//i.test(href) || /[\u0000-\u001f\u007f]/.test(action.href)) return null;
    try {
        const url = new URL(href);
        if (url.protocol !== 'https:' || url.username || url.password) return null;
        return { label, href: url.href };
    } catch {
        return null;
    }
}

function getFocusedElement(): HTMLElement | null {
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    return focused instanceof HTMLElement ? focused : null;
}

export function showToast(params: ShowToastParams): void {
    if (typeof document === 'undefined') return;
    const text = params.text.trim();
    if (!text) return;

    ensureToastStyle();
    dismissCurrentToast?.();
    if (removalTimer !== null) {
        window.clearTimeout(removalTimer);
        removalTimer = null;
    }
    const viewport = ensureToastViewport();
    viewport.replaceChildren();

    const action = getSafeAction(params.action);
    const returnFocus = getFocusedElement();
    const durationMs = Number.isFinite(params.durationMs) && (params.durationMs ?? 0) > 0
        ? Math.round(params.durationMs!)
        : DEFAULT_TOAST_DURATION_MS;
    const toast = document.createElement('div');
    toast.className = 'aimd-toast';
    toast.dataset.tone = params.tone ?? 'info';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.setProperty('--_toast-duration', `${durationMs}ms`);
    const dismiss = () => {
        const restoreFocus = toast.contains(getFocusedElement());
        if (toast.parentElement === viewport) toast.remove();
        if (!viewport.firstElementChild) viewport.remove();
        if (dismissCurrentToast === dismiss) {
            dismissCurrentToast = null;
            if (removalTimer !== null) window.clearTimeout(removalTimer);
            removalTimer = null;
        }
        if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
    dismissCurrentToast = dismiss;

    if (action) {
        markTransientRoot(viewport);
        toast.classList.add('aimd-toast--action');
        const message = document.createElement('span');
        message.className = 'aimd-toast__message';
        message.textContent = text;
        const link = document.createElement('a');
        link.className = 'aimd-toast__action';
        link.textContent = action.label;
        link.href = action.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.addEventListener('click', dismiss);
        const close = document.createElement('button');
        close.className = 'aimd-toast__close';
        close.type = 'button';
        close.setAttribute('aria-label', params.closeLabel?.trim() || 'Close');
        close.textContent = '×';
        close.addEventListener('click', dismiss);
        toast.append(message, link, close);
    } else {
        toast.textContent = text;
        removalTimer = window.setTimeout(dismiss, durationMs);
    }
    viewport.appendChild(toast);
}
