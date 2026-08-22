import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { t } from '../components/i18n';

const SAMPLE_INTERVAL_MS = 100;
const DOM_SETTLE_WINDOW_MS = 300;
const QUIET_WINDOW_MS = 3_000;
const TOP_EPSILON_PX = 1;
const OFFICIAL_TOP_EPSILON_PX = 16;
const TOP_RETRY_INTERVAL_MS = 500;
const RETREAT_PX = 1_000;
const DEFAULT_TIMEOUT_MS = 20_000;

type TopScrollPhase = 'seeking-top' | 'waiting-for-change' | 'stabilizing-change' | 'waiting-for-retreat';

function isExtensionSurfaceElement(node: EventTarget | null): boolean {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest([
        '[data-aimd-role]',
        '#aimd-bookmarks-panel-host',
        '#aimd-reader-panel-host',
        '#aimd-bookmark-save-dialog-host',
        '#aimd-changelog-notice-host',
        '.aimd-message-toolbar-host',
        '.send-popover',
        '.aimd-field-control',
    ].join(',')));
}

export class ChatGPTTopScrollController {
    private initialized = false;
    private running = false;
    private timeoutMs = DEFAULT_TIMEOUT_MS;
    private deadline = 0;
    private lastProgressKey: string | null = null;
    private pendingProgressKey: string | null = null;
    private progressChangedAt: number | null = null;
    private lastProgressAt = 0;
    private lastTopCommandAt: number | null = null;
    private phase: TopScrollPhase | null = null;
    private sampleTimer: number | null = null;
    private button: HTMLButtonElement | null = null;
    private readonly onButtonClick = (): void => this.toggle();

    constructor(private readonly adapter: SiteAdapter) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.syncButtonLabel();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.stop();
        this.initialized = false;
        this.bindButton(null);
    }

    setTimeoutMs(value: number): void {
        if (!Number.isFinite(value)) return;
        this.timeoutMs = Math.max(1, Math.round(value));
    }

    setAppearance(_snapshot: AppearanceSnapshot): void {
        // The button inherits the Stepper host's AppearanceScope.
    }

    refreshLabels(): void {
        this.syncButtonLabel();
    }

    bindButton(button: HTMLButtonElement | null): void {
        if (this.button === button) {
            this.syncButtonLabel();
            return;
        }
        this.button?.removeEventListener('click', this.onButtonClick);
        this.button = button;
        this.button?.addEventListener('click', this.onButtonClick);
        this.syncButtonLabel();
    }

    toggle(): void {
        if (!this.initialized) return;
        if (this.running) this.stop();
        else this.start();
    }

    private start(): void {
        if (!this.initialized || this.running) return;
        const root = this.adapter.getConversationScrollRoot?.();
        if (!root) return;
        this.running = true;
        this.deadline = Date.now() + this.timeoutMs;
        this.lastProgressKey = this.readProgressKey(root) ?? '';
        this.pendingProgressKey = null;
        this.progressChangedAt = null;
        this.lastProgressAt = Date.now();
        this.lastTopCommandAt = null;
        this.phase = 'seeking-top';
        this.syncButtonLabel();
        this.bindUserTakeoverListeners();
        this.sample();
    }

    private stop(): void {
        if (!this.running) return;
        this.running = false;
        if (this.sampleTimer !== null) {
            window.clearTimeout(this.sampleTimer);
            this.sampleTimer = null;
        }
        this.unbindUserTakeoverListeners();
        this.lastProgressKey = null;
        this.pendingProgressKey = null;
        this.progressChangedAt = null;
        this.lastProgressAt = 0;
        this.lastTopCommandAt = null;
        this.phase = null;
        this.syncButtonLabel();
    }

    private sample = (): void => {
        if (!this.running) return;
        if (Date.now() >= this.deadline) {
            this.stop();
            return;
        }
        const root = this.adapter.getConversationScrollRoot?.();
        if (!root) {
            this.stop();
            return;
        }

        const now = Date.now();
        const progressKey = this.readProgressKey(root) ?? '';
        const atTop = this.isAtTop(root);
        switch (this.phase) {
            case 'seeking-top':
                if (atTop) {
                    this.phase = 'waiting-for-change';
                    this.lastProgressAt = now;
                } else if (this.canRetryTop(now)) {
                    this.issueTop(root, now);
                }
                break;
            case 'waiting-for-change':
                if (!atTop) {
                    this.phase = 'seeking-top';
                    if (this.canRetryTop(now)) this.issueTop(root, now);
                    break;
                }
                if (progressKey !== this.lastProgressKey) {
                    this.beginProgressChange(progressKey, now);
                } else if (now - this.lastProgressAt >= QUIET_WINDOW_MS) {
                    this.stop();
                    return;
                }
                break;
            case 'stabilizing-change':
                if (!atTop) {
                    this.phase = 'seeking-top';
                    if (this.canRetryTop(now)) this.issueTop(root, now);
                    break;
                }
                if (progressKey !== this.pendingProgressKey) {
                    if (progressKey === this.lastProgressKey) {
                        this.pendingProgressKey = null;
                        this.progressChangedAt = null;
                        this.phase = 'waiting-for-change';
                    } else {
                        this.beginProgressChange(progressKey, now);
                    }
                    break;
                }
                if (
                    this.progressChangedAt !== null
                    && now - this.progressChangedAt >= DOM_SETTLE_WINDOW_MS
                ) {
                    this.retreatFromTop(root, now);
                }
                break;
            case 'waiting-for-retreat':
                if (!atTop) {
                    this.phase = 'seeking-top';
                    this.pendingProgressKey = null;
                    this.progressChangedAt = null;
                    this.issueTop(root, now);
                } else if (progressKey !== this.lastProgressKey) {
                    this.beginProgressChange(progressKey, now);
                } else if (
                    this.lastTopCommandAt !== null
                    && now - this.lastTopCommandAt >= TOP_RETRY_INTERVAL_MS
                ) {
                    // The root could not move away from the edge. Let the
                    // normal quiet completion path decide whether to stop.
                    this.phase = 'waiting-for-change';
                }
                break;
        }

        this.sampleTimer = window.setTimeout(() => {
            this.sampleTimer = null;
            this.sample();
        }, SAMPLE_INTERVAL_MS);
    };

    private issueTop(root: HTMLElement, now: number): void {
        root.scrollTo({ top: 0, behavior: 'auto' });
        this.lastTopCommandAt = now;
    }

    private canRetryTop(now: number): boolean {
        return this.lastTopCommandAt === null
            || now - this.lastTopCommandAt >= TOP_RETRY_INTERVAL_MS;
    }

    private beginProgressChange(progressKey: string, now: number): void {
        this.lastProgressKey = this.lastProgressKey ?? progressKey;
        this.pendingProgressKey = progressKey;
        this.progressChangedAt = now;
        this.lastProgressAt = now;
        this.phase = 'stabilizing-change';
    }

    private retreatFromTop(root: HTMLElement, now: number): void {
        const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
        const retreatTop = Math.min(RETREAT_PX, maxTop);
        if (retreatTop <= TOP_EPSILON_PX || !this.hasMountedNodeEvidence(root)) {
            this.stop();
            return;
        }
        root.scrollTo({ top: retreatTop, behavior: 'auto' });
        this.lastProgressKey = this.pendingProgressKey ?? this.lastProgressKey;
        this.pendingProgressKey = null;
        this.progressChangedAt = null;
        this.lastProgressAt = now;
        this.lastTopCommandAt = now;
        this.phase = 'waiting-for-retreat';
    }

    private isAtTop(root: HTMLElement): boolean {
        if (root.hasAttribute('data-scroll-root') || root.hasAttribute('data-scroll-from-top')) {
            return root.scrollTop <= OFFICIAL_TOP_EPSILON_PX
                && !root.hasAttribute('data-scroll-from-top');
        }
        return root.scrollTop <= TOP_EPSILON_PX;
    }

    private readProgressKey(root: HTMLElement | null | undefined): string | null {
        if (!root) return null;
        const turnIds = Array.from(root.querySelectorAll<HTMLElement>('[data-turn-id-container]'))
            .map((element) => element.getAttribute('data-turn-id-container') ?? '');
        const messageIds = Array.from(root.querySelectorAll<HTMLElement>('[data-message-id]'))
            .map((element) => element.getAttribute('data-message-id') ?? '');
        return `turns:${turnIds.join(',')}|messages:${messageIds.join(',')}`;
    }

    private hasMountedNodeEvidence(root: HTMLElement): boolean {
        return root.querySelector('[data-turn-id-container], [data-message-id]') !== null;
    }

    private onUserTakeover = (event: Event): void => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (path.some((node) => isExtensionSurfaceElement(node))) return;
        this.stop();
    };

    private bindUserTakeoverListeners(): void {
        document.addEventListener('click', this.onUserTakeover, { capture: true, passive: true });
        document.addEventListener('wheel', this.onUserTakeover, { capture: true, passive: true });
        document.addEventListener('keydown', this.onUserTakeover, { capture: true, passive: true });
    }

    private unbindUserTakeoverListeners(): void {
        document.removeEventListener('click', this.onUserTakeover, { capture: true });
        document.removeEventListener('wheel', this.onUserTakeover, { capture: true });
        document.removeEventListener('keydown', this.onUserTakeover, { capture: true });
    }

    private syncButtonLabel(): void {
        if (!this.button) return;
        const label = this.running
            ? this.getLabel('chatgptStopScrollToTop', 'Stop going to top')
            : this.getLabel('chatgptScrollToTop', 'Go to top');
        this.button.setAttribute('aria-label', label);
        this.button.setAttribute('title', label);
        this.button.dataset.running = this.running ? '1' : '0';
        this.button.dataset.active = this.running ? '1' : '0';
        this.button.setAttribute('aria-busy', this.running ? 'true' : 'false');
    }

    private getLabel(key: string, fallback: string): string {
        const label = t(key);
        return !label || label === key ? fallback : label;
    }
}
