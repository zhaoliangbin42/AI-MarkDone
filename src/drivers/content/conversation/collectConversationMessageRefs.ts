import type { SiteAdapter } from '../adapters/base';

export type ConversationMessageRef = {
    index: number;
    messageEl: HTMLElement;
    userPrompt: string;
    messageId: string | null;
};

export function collectConversationMessageRefs(adapter: SiteAdapter): ConversationMessageRef[] {
    const selector = adapter.getMessageSelector();
    const container = adapter.getObserverContainer() || document.body;

    const raw = Array.from(container.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const messages = Array.from(new Set(raw)).filter((el) => {
        const parent = el.parentElement;
        if (!parent) return true;
        try {
            return parent.closest(selector) === null;
        } catch {
            return true;
        }
    });

    return messages.map((messageEl, index) => {
        const userPrompt = adapter.extractUserPrompt(messageEl) || `Message ${index + 1}`;
        const messageId = adapter.getMessageId(messageEl);
        return { index, messageEl, userPrompt, messageId };
    });
}

