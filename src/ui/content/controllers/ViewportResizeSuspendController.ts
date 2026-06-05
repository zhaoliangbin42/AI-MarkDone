export const AIMD_VIEWPORT_RESIZE_IDLE_EVENT = 'aimd:viewport-resize-idle';

const STYLE_ID = 'aimd-viewport-resize-suspend-style';
const RESIZING_ATTR = 'aimdViewportResizing';
const DEFAULT_WIDTH_THRESHOLD_PX = 8;
const DEFAULT_IDLE_DELAY_MS = 1000;

type ViewportResizeSuspendControllerOptions = {
    widthThresholdPx?: number;
    idleDelayMs?: number;
};

export class ViewportResizeSuspendController {
    private widthThresholdPx: number;
    private idleDelayMs: number;
    private initialized = false;
    private suspended = false;
    private lastWidth = 0;
    private idleTimer: number | null = null;

    constructor(options: ViewportResizeSuspendControllerOptions = {}) {
        this.widthThresholdPx = options.widthThresholdPx ?? DEFAULT_WIDTH_THRESHOLD_PX;
        this.idleDelayMs = options.idleDelayMs ?? DEFAULT_IDLE_DELAY_MS;
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.lastWidth = this.readViewportWidth();
        this.ensureStyles();
        window.addEventListener('resize', this.handleResize, { passive: true });
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        window.removeEventListener('resize', this.handleResize);
        this.clearIdleTimer();
        this.exitSuspend(false);
    }

    isSuspended(): boolean {
        return this.suspended;
    }

    private handleResize = (): void => {
        const nextWidth = this.readViewportWidth();
        const hasActiveResizeSession = this.idleTimer !== null || this.suspended;
        if (!hasActiveResizeSession && Math.abs(nextWidth - this.lastWidth) < this.widthThresholdPx) return;

        this.lastWidth = nextWidth;
        this.enterSuspend();

        this.clearIdleTimer();
        this.idleTimer = window.setTimeout(() => {
            this.idleTimer = null;
            this.exitSuspend(true);
        }, this.idleDelayMs);
    };

    private readViewportWidth(): number {
        return Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
    }

    private enterSuspend(): void {
        if (this.suspended) return;
        this.suspended = true;
        document.documentElement.dataset[RESIZING_ATTR] = '1';
    }

    private exitSuspend(emitIdle: boolean): void {
        const wasSuspended = this.suspended;
        this.suspended = false;
        delete document.documentElement.dataset[RESIZING_ATTR];
        if (emitIdle && wasSuspended) {
            window.dispatchEvent(new CustomEvent(AIMD_VIEWPORT_RESIZE_IDLE_EVENT));
        }
    }

    private clearIdleTimer(): void {
        if (this.idleTimer === null) return;
        window.clearTimeout(this.idleTimer);
        this.idleTimer = null;
    }

    private ensureStyles(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-directory-rail,
html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-directory-preview,
html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-directory-step-controls,
html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-message-stepper {
  visibility: hidden;
  pointer-events: none;
  content-visibility: hidden;
  transition: none;
}

html[data-aimd-viewport-resizing="1"] .aimd-message-toolbar-host[data-aimd-placement="actionbar"],
html[data-aimd-viewport-resizing="1"] [data-aimd-role="message-toolbar"][data-aimd-placement="actionbar"] {
  visibility: hidden;
  pointer-events: none;
  content-visibility: hidden;
  transition: none;
}
`;
        document.head.appendChild(style);
    }
}
