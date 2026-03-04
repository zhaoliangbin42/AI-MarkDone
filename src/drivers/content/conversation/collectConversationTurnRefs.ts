import type { SiteAdapter } from '../adapters/base';

export type ConversationTurnRef = {
    index: number;
    primaryMessageEl: HTMLElement;
    messageEls: HTMLElement[];
    userPrompt: string;
    messageId: string | null;
    turnRootEl: HTMLElement;
};

export function collectConversationTurnRefs(adapter: SiteAdapter): ConversationTurnRef[] {
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

    const groups = new Map<HTMLElement, HTMLElement[]>();
    for (const messageEl of messages) {
        const turnRoot = messageEl.closest?.('[data-testid^="conversation-turn-"]');
        const key = (turnRoot instanceof HTMLElement ? turnRoot : messageEl) as HTMLElement;
        const group = groups.get(key);
        if (group) group.push(messageEl);
        else groups.set(key, [messageEl]);
    }

    const refs: ConversationTurnRef[] = [];
    let idx = 0;
    for (const [turnRootEl, messageEls] of groups) {
        const primaryMessageEl = messageEls[messageEls.length - 1]!;
        const userPrompt = adapter.extractUserPrompt(primaryMessageEl) || `Message ${idx + 1}`;
        const messageId = adapter.getMessageId(primaryMessageEl);
        refs.push({ index: idx, primaryMessageEl, messageEls, userPrompt, messageId, turnRootEl });
        idx += 1;
    }

    return refs;
}

