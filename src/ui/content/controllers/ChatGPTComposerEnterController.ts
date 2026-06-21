import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { armChatGPTSendPositionRestore } from '../../../drivers/content/chatgpt/sendPositionRestoreEvents';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

const REBIND_DELAY_MS = 200;

export class ChatGPTComposerEnterController {
    private enabled = false;
    private initialized = false;
    private composer: ComposerInput | null = null;
    private observer: MutationObserver | null = null;
    private rebindTimer: number | null = null;
    private isInsertingNewline = false;
    private isTriggeringSend = false;

    constructor(private readonly adapter: SiteAdapter) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.bindComposer();
        this.observeComposerReplacements();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.detachComposer();
        this.observer?.disconnect();
        this.observer = null;
        if (this.rebindTimer != null) {
            window.clearTimeout(this.rebindTimer);
            this.rebindTimer = null;
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (this.initialized) this.bindComposer();
    }

    private bindComposer(): void {
        const next = this.adapter.getComposerInputElement?.() ?? null;
        if (next === this.composer) return;

        this.detachComposer();
        if (!next) return;

        this.composer = next;
        next.addEventListener('keydown', this.onKeyDownCapture as EventListener, { capture: true });
    }

    private detachComposer(): void {
        this.composer?.removeEventListener('keydown', this.onKeyDownCapture as EventListener, { capture: true } as any);
        this.composer = null;
    }

    private observeComposerReplacements(): void {
        if (this.observer || typeof MutationObserver !== 'function') return;
        const target = document.body || document.documentElement;
        this.observer = new MutationObserver(() => this.scheduleRebind());
        this.observer.observe(target, { childList: true, subtree: true });
    }

    private scheduleRebind(): void {
        if (!this.initialized || this.rebindTimer != null) return;
        this.rebindTimer = window.setTimeout(() => {
            this.rebindTimer = null;
            this.bindComposer();
        }, REBIND_DELAY_MS);
    }

    private onKeyDownCapture = (event: KeyboardEvent): void => {
        const target = event.currentTarget;
        if (!this.enabled || this.isInsertingNewline || this.isTriggeringSend || event.defaultPrevented) return;
        if (!(target instanceof HTMLElement)) return;
        if (this.shouldSend(event)) {
            event.preventDefault();
            event.stopPropagation();
            this.triggerSend(target);
            return;
        }
        if (!this.shouldConvertEnter(event)) return;

        event.preventDefault();
        event.stopPropagation();
        this.insertNewline(target);
    };

    private shouldConvertEnter(event: KeyboardEvent): boolean {
        return event.key === 'Enter'
            && !event.shiftKey
            && !event.metaKey
            && !event.ctrlKey
            && !event.altKey
            && !event.isComposing
            && event.keyCode !== 229;
    }

    private shouldSend(event: KeyboardEvent): boolean {
        return event.key === 'Enter'
            && (event.metaKey || event.ctrlKey)
            && !event.shiftKey
            && !event.altKey
            && !event.isComposing
            && event.keyCode !== 229;
    }

    private insertNewline(input: ComposerInput): void {
        if (this.isContentEditable(input)) {
            this.dispatchNativeShiftEnter(input);
            return;
        }

        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            input.value = `${input.value.slice(0, start)}\n${input.value.slice(end)}`;
            const cursor = start + 1;
            input.selectionStart = cursor;
            input.selectionEnd = cursor;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    private dispatchNativeShiftEnter(input: ComposerInput): void {
        if (document.activeElement !== input) input.focus();
        this.isInsertingNewline = true;
        try {
            for (const type of ['keydown', 'keypress', 'keyup'] as const) {
                input.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                }));
            }
        } finally {
            this.isInsertingNewline = false;
        }
    }

    private triggerSend(input: ComposerInput): void {
        if (document.activeElement !== input) input.focus();
        armChatGPTSendPositionRestore();
        this.isTriggeringSend = true;
        try {
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
            }));
        } finally {
            window.setTimeout(() => {
                this.isTriggeringSend = false;
            }, 50);
        }
    }

    private isContentEditable(input: ComposerInput): boolean {
        return input instanceof HTMLElement && (input.isContentEditable || input.hasAttribute('contenteditable'));
    }
}
