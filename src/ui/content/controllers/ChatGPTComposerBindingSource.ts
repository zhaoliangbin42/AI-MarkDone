export type ChatGPTComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

type Listener = (input: ChatGPTComposerInput | null) => void;

/** One shared composer discovery observer for editing and prompt consumers. */
export class ChatGPTComposerBindingSource {
    private readonly listeners = new Set<Listener>();
    private observer: MutationObserver | null = null;
    private rafId: number | null = null;
    private currentInput: ChatGPTComposerInput | null = null;

    constructor(private readonly readInput: () => ChatGPTComposerInput | null) {}

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        this.ensureObserver();
        this.currentInput = this.readInput();
        listener(this.currentInput);
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.dispose();
        };
    }

    refreshNow(): ChatGPTComposerInput | null {
        const input = this.readInput();
        this.currentInput = input;
        this.listeners.forEach((listener) => listener(input));
        return input;
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.currentInput = null;
    }

    private ensureObserver(): void {
        if (this.observer || typeof MutationObserver !== 'function') return;
        this.observer = new MutationObserver((records) => {
            if (!this.mutationMayAffectComposer(records)) return;
            if (this.rafId !== null) return;
            this.rafId = window.requestAnimationFrame(() => {
                this.rafId = null;
                this.refreshNow();
            });
        });
        this.observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    /**
     * ChatGPT streams reply DOM under the same document subtree as the
     * composer.  The binding only needs to wake for changes inside the
     * composer scope, input replacement, or an unknown/unmounted input.
     * Keeping this filter here preserves the single discovery observer while
     * removing one rAF rebind from every unrelated reply mutation.
     */
    private mutationMayAffectComposer(records: readonly MutationRecord[]): boolean {
        if (records.length === 0) return true;
        const input = this.currentInput;
        if (!input || !input.isConnected) return true;

        const parent = input.parentElement;
        const scope = input.closest('form, [role="form"]')
            ?? (parent && parent !== document.body && parent !== document.documentElement ? parent : null);
        for (const record of records) {
            const target = record.target;
            if (target === input || input.contains(target) || target === scope || Boolean(scope?.contains(target))) {
                return true;
            }
            for (const node of [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]) {
                if (node === input || input.contains(node) || (node instanceof Node && node.contains(input))) {
                    return true;
                }
            }
        }
        return false;
    }
}
