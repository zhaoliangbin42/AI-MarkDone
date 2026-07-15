import {
    DEFAULT_CHATGPT_PAGE_WIDTH_SCALE,
    MAX_CHATGPT_PAGE_WIDTH_SCALE,
    MIN_CHATGPT_PAGE_WIDTH_SCALE,
} from '../../../core/settings/types';

const CHATGPT_PAGE_WIDTH_STYLE_ID = 'aimd-chatgpt-page-width-style';
const CHATGPT_PAGE_WIDTH_DATASET = 'aimdChatgptPageWidth';
const CHATGPT_PAGE_WIDTH_SELECTORS = [
    ':is([class*="max-w-(--thread-content-max-width)"], .text-token-text-primary > div > div)',
] as const;

function normalizeScale(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return DEFAULT_CHATGPT_PAGE_WIDTH_SCALE;
    return Math.min(MAX_CHATGPT_PAGE_WIDTH_SCALE, Math.max(MIN_CHATGPT_PAGE_WIDTH_SCALE, Math.round(numeric)));
}

export class ChatGPTPageWidthController {
    private scale = DEFAULT_CHATGPT_PAGE_WIDTH_SCALE;
    private styleEl: HTMLStyleElement | null = null;
    private observer: MutationObserver | null = null;
    private originalWidths: Partial<Record<typeof CHATGPT_PAGE_WIDTH_SELECTORS[number], string>> = {};

    init(): void {
        this.apply();
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.styleEl?.remove();
        this.styleEl = null;
        delete document.documentElement.dataset[CHATGPT_PAGE_WIDTH_DATASET];
        this.originalWidths = {};
    }

    setScale(value: number): void {
        const next = normalizeScale(value);
        if (next === this.scale) {
            this.apply();
            return;
        }
        this.scale = next;
        this.originalWidths = {};
        this.apply();
    }

    private apply(): void {
        if (this.scale <= DEFAULT_CHATGPT_PAGE_WIDTH_SCALE) {
            this.clearStyle();
            return;
        }

        this.ensureStyleEl();
        this.snapshotOriginalWidths();

        const entries = Object.entries(this.originalWidths);
        if (entries.length === 0) {
            this.watchForElements();
            return;
        }

        document.documentElement.dataset[CHATGPT_PAGE_WIDTH_DATASET] = '1';
        const rules = entries
            .map(([selector, base]) => `html[data-aimd-chatgpt-page-width="1"] ${selector} { max-width: calc(${base} * ${this.scale} / 100); }`)
            .join('\n');
        this.styleEl!.textContent = rules;
        this.watchForElements();
    }

    private ensureStyleEl(): void {
        if (this.styleEl?.isConnected) return;
        const existing = document.getElementById(CHATGPT_PAGE_WIDTH_STYLE_ID);
        if (existing instanceof HTMLStyleElement) {
            this.styleEl = existing;
            return;
        }
        const style = document.createElement('style');
        style.id = CHATGPT_PAGE_WIDTH_STYLE_ID;
        document.head.appendChild(style);
        this.styleEl = style;
    }

    private clearStyle(): void {
        this.observer?.disconnect();
        this.observer = null;
        if (this.styleEl) {
            this.styleEl.textContent = '';
        }
        delete document.documentElement.dataset[CHATGPT_PAGE_WIDTH_DATASET];
    }

    private snapshotOriginalWidths(): void {
        const missing = CHATGPT_PAGE_WIDTH_SELECTORS.filter((selector) => !this.originalWidths[selector]);
        if (missing.length === 0) return;

        const currentStyle = this.styleEl?.textContent ?? '';
        if (this.styleEl) this.styleEl.textContent = '';
        delete document.documentElement.dataset[CHATGPT_PAGE_WIDTH_DATASET];

        for (const selector of missing) {
            const candidates = document.querySelectorAll<HTMLElement>(selector);
            for (const element of candidates) {
                const value = window.getComputedStyle(element).maxWidth;
                if (value && value !== 'none' && value !== '100%') {
                    this.originalWidths[selector] = value;
                    break;
                }
            }
        }

        if (this.styleEl) this.styleEl.textContent = currentStyle;
    }

    private watchForElements(): void {
        if (this.scale <= DEFAULT_CHATGPT_PAGE_WIDTH_SCALE) return;
        const allKnown = CHATGPT_PAGE_WIDTH_SELECTORS.every((selector) => this.originalWidths[selector]);
        if (allKnown) {
            this.observer?.disconnect();
            this.observer = null;
            return;
        }
        if (this.observer || !document.body) return;
        this.observer = new MutationObserver(() => {
            this.apply();
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
