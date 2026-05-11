import type { ConversationGroupRef, SiteAdapter } from '../adapters/base';
import { listAssistantSegmentElements } from './assistantSegments';

export type ConversationTurnRef = {
    index: number;
    primaryMessageEl: HTMLElement;
    messageEls: HTMLElement[];
    userPrompt: string;
    userPromptQuality?: 'real' | 'fallback';
    messageId: string | null;
    turnRootEl: HTMLElement;
    assistantRootEl?: HTMLElement | null;
    assistantContentRootEl?: HTMLElement | null;
    userRootEl?: HTMLElement | null;
    jumpAnchorEl?: HTMLElement | null;
    groupEls?: HTMLElement[];
    isStreaming?: boolean;
};

function listTopLevelAssistantMessages(rootEl: HTMLElement, selector: string, fallbackEl: HTMLElement): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    const push = (node: Element | null) => {
        if (node instanceof HTMLElement && !candidates.includes(node)) candidates.push(node);
    };

    try {
        if (rootEl.matches(selector)) push(rootEl);
        rootEl.querySelectorAll(selector).forEach(push);
    } catch {
        // Invalid platform selector should not prevent the adapter-provided fallback element from working.
    }
    push(fallbackEl);

    return candidates.filter((el) => {
        const parent = el.parentElement;
        if (!parent) return true;
        try {
            const closest = parent.closest(selector);
            return closest === null || !rootEl.contains(closest);
        } catch {
            return true;
        }
    });
}

function mapGroupRefsToTurns(adapter: SiteAdapter, groupRefs: ConversationGroupRef[]): ConversationTurnRef[] {
    const selector = adapter.getMessageSelector();
    const refs: ConversationTurnRef[] = [];

    for (const groupRef of groupRefs) {
        const messageEls = listTopLevelAssistantMessages(groupRef.assistantRootEl, selector, groupRef.assistantMessageEl);
        const primaryMessageEl = messageEls[messageEls.length - 1] ?? groupRef.assistantMessageEl;
        const userPrompt = groupRef.userPromptText?.trim()
            || adapter.extractUserPrompt(primaryMessageEl)
            || `Message ${refs.length + 1}`;
        const messageId = adapter.getMessageId(primaryMessageEl) || groupRef.id || null;

        refs.push({
            index: refs.length,
            primaryMessageEl,
            messageEls: messageEls.length > 0 ? messageEls : [primaryMessageEl],
            userPrompt,
            userPromptQuality: groupRef.userPromptQuality,
            messageId,
            turnRootEl: groupRef.assistantRootEl,
            assistantRootEl: groupRef.assistantRootEl,
            assistantContentRootEl: groupRef.assistantContentRootEl ?? null,
            userRootEl: groupRef.userRootEl,
            jumpAnchorEl: groupRef.barAnchorEl ?? groupRef.userRootEl ?? groupRef.assistantRootEl,
            groupEls: groupRef.groupEls,
            isStreaming: groupRef.isStreaming,
        });
    }

    return refs;
}

export function collectConversationTurnRefs(adapter: SiteAdapter): ConversationTurnRef[] {
    try {
        if (adapter.getConversationGroupRefs) {
            const groupRefs = adapter.getConversationGroupRefs();
            return groupRefs.length > 0 ? mapGroupRefsToTurns(adapter, groupRefs) : [];
        }
    } catch {
        // Fall back to legacy assistant-segment discovery if a platform-owned grouping hook fails.
    }

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
