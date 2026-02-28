import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../adapters/base';
import { copyTextToClipboard } from '../clipboard/clipboard';
import { copyMarkdownFromMessage } from '../../../services/copy/copy-markdown';
import { MessageToolbar } from '../../../ui/content/MessageToolbar';

type ToolbarRecord = { message: HTMLElement; toolbar: MessageToolbar };

export class MessageToolbarController {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private records = new Map<string, ToolbarRecord>();
    private theme: Theme = 'light';
    private onMessageInjected: ((messageElement: HTMLElement) => void) | null = null;

    constructor(adapter: SiteAdapter, opts?: { onMessageInjected?: (messageElement: HTMLElement) => void }) {
        this.adapter = adapter;
        this.onMessageInjected = opts?.onMessageInjected || null;
    }

    init(): void {
        this.scanAndInject();
        this.refreshPendingStates();

        const container = this.adapter.getObserverContainer() || document.body;
        this.observer = new MutationObserver(() => {
            this.scanAndInject();
            this.refreshPendingStates();
        });
        this.observer.observe(container, { childList: true, subtree: true });
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.records.forEach(({ toolbar }) => toolbar.getElement().remove());
        this.records.clear();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.records.forEach(({ toolbar }) => toolbar.setTheme(theme));
    }

    getMessageElements(): HTMLElement[] {
        return Array.from(this.records.values()).map((r) => r.message);
    }

    private scanAndInject(): void {
        const selector = this.adapter.getMessageSelector();
        const nodes = Array.from(document.querySelectorAll(selector)).filter(
            (n): n is HTMLElement => n instanceof HTMLElement
        );

        nodes.forEach((messageElement) => {
            const id = this.adapter.getMessageId(messageElement);
            if (!id) return;
            if (this.records.has(id)) return;

            const toolbar = new MessageToolbar(this.theme, {
                onCopyMarkdown: async () => {
                    const res = copyMarkdownFromMessage(this.adapter, messageElement);
                    if (!res.ok) return { ok: false, message: res.error.message };
                    const ok = await copyTextToClipboard(res.markdown);
                    return ok ? { ok: true } : { ok: false, message: 'Clipboard write failed.' };
                },
            });

            const host = toolbar.getElement();
            const injected = this.adapter.injectToolbar(messageElement, host);
            if (!injected) {
                host.remove();
                return;
            }

            this.records.set(id, { message: messageElement, toolbar });
            this.onMessageInjected?.(messageElement);
        });
    }

    private refreshPendingStates(): void {
        this.records.forEach(({ message, toolbar }, id) => {
            if (!document.contains(message)) {
                toolbar.getElement().remove();
                this.records.delete(id);
                return;
            }

            const pending = this.adapter.isStreamingMessage(message);
            toolbar.setPending(pending);
        });
    }
}
