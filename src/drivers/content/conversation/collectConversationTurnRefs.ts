import type { SiteAdapter } from '../adapters/base';
import { listAssistantSegmentElements } from './assistantSegments';

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
    const raw = listAssistantSegmentElements(adapter);

    // Turn grouping should avoid nested duplicates (artifact wrappers, quote cards, etc).
    // This does NOT affect legacy position semantics, which are defined by `listAssistantSegmentElements`.
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
        const adapterTurnRoot = adapter.getTurnRootElement?.(messageEl) ?? null;
        const key = (adapterTurnRoot || messageEl) as HTMLElement;
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
