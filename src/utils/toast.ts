const TOAST_STYLE_ID = 'aimd-shared-toast-style';
const TOAST_VIEWPORT_ID = 'aimd-toast-viewport';
const DEFAULT_TOAST_DURATION_MS = 3000;

export type ToastTone = 'info' | 'success' | 'error';

export type ShowToastParams = {
    text: string;
    tone?: ToastTone;
    durationMs?: number;
};

let removalTimer: number | null = null;

function getToastCss(): string {
    return `
#${TOAST_VIEWPORT_ID} {
  position: fixed;
  inset-block-start: var(--aimd-space-4, 16px);
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: var(--aimd-toast-z, 10000);
  pointer-events: none;
  display: flex;
  justify-content: center;
  width: min(92vw, 560px);
}
.aimd-toast {
  box-sizing: border-box;
  max-width: min(92vw, 420px);
  padding: var(--aimd-space-2, 8px) var(--aimd-space-4, 16px);
  border-radius: var(--aimd-radius-lg, 8px);
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
  animation: aimdToastLifecycle var(--aimd-toast-duration, 3000ms) var(--aimd-ease-out, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
}
@keyframes aimdToastLifecycle {
  0% { opacity: 0; transform: translateY(-12px); }
  10% { opacity: 1; transform: translateY(0); }
  88% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}
@media (prefers-reduced-motion: reduce) {
  .aimd-toast {
    animation: aimdToastReduced var(--aimd-toast-duration, 3000ms) linear forwards;
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

export function showToast(params: ShowToastParams): void {
    if (typeof document === 'undefined') return;
    const text = params.text.trim();
    if (!text) return;

    ensureToastStyle();
    const viewport = ensureToastViewport();
    if (removalTimer !== null) {
        window.clearTimeout(removalTimer);
        removalTimer = null;
    }
    viewport.replaceChildren();

    const durationMs = Number.isFinite(params.durationMs) && (params.durationMs ?? 0) > 0
        ? Math.round(params.durationMs!)
        : DEFAULT_TOAST_DURATION_MS;
    const toast = document.createElement('div');
    toast.className = 'aimd-toast';
    toast.dataset.tone = params.tone ?? 'info';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.setProperty('--aimd-toast-duration', `${durationMs}ms`);
    toast.textContent = text;
    viewport.appendChild(toast);

    removalTimer = window.setTimeout(() => {
        if (toast.parentElement === viewport) toast.remove();
        if (!viewport.firstElementChild) viewport.remove();
        removalTimer = null;
    }, durationMs);
}
