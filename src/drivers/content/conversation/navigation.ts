import type { SiteAdapter } from '../adapters/base';
import { listAssistantSegmentElements } from './assistantSegments';
import { collectConversationTurnRefs } from './collectConversationTurnRefs';

export type ConversationLocator =
    | { kind: 'turnIndex'; turnIndex: number }
    | { kind: 'messageId'; messageId: string }
    | { kind: 'legacyAssistantPosition'; position: number };

export type ResolveResult = { ok: true; targetEl: HTMLElement; turnIndex: number } | { ok: false; message: string };

export type ScrollResult = { ok: true } | { ok: false; message: string };

export function highlightElement(element: HTMLElement): void {
    element.dataset.aimdHighlight = '1';
    element.style.outline = '2px solid var(--aimd-interactive-primary)';
    element.style.outlineOffset = '2px';
    window.setTimeout(() => {
        if (element.dataset.aimdHighlight !== '1') return;
        delete element.dataset.aimdHighlight;
        element.style.outline = '';
        element.style.outlineOffset = '';
    }, 3000);
}

function findTurnIndexForSegment(turns: ReturnType<typeof collectConversationTurnRefs>, segment: HTMLElement): number {
    for (let i = 0; i < turns.length; i += 1) {
        const t = turns[i]!;
        if (t.messageEls.some((el) => el === segment || el.contains(segment) || segment.contains(el))) return i;
    }
    return -1;
}

export function resolveConversationTarget(adapter: SiteAdapter, locator: ConversationLocator): ResolveResult {
    const turns = collectConversationTurnRefs(adapter);
    if (turns.length === 0) return { ok: false, message: 'No conversation turns found' };

    if (locator.kind === 'turnIndex') {
        const idx = locator.turnIndex;
        if (!Number.isFinite(idx) || idx < 0 || idx >= turns.length) return { ok: false, message: 'Turn index out of range' };
        return { ok: true, targetEl: turns[idx]!.primaryMessageEl, turnIndex: idx };
    }

    if (locator.kind === 'messageId') {
        const id = locator.messageId;
        if (!id) return { ok: false, message: 'Invalid messageId' };
        const idx = turns.findIndex((t) => t.messageId === id);
        if (idx < 0) return { ok: false, message: 'messageId not found' };
        return { ok: true, targetEl: turns[idx]!.primaryMessageEl, turnIndex: idx };
    }

    // legacyAssistantPosition (1-based segment index, across all assistant segments)
    const position = locator.position;
    if (!Number.isFinite(position) || position <= 0) return { ok: false, message: 'Invalid position' };

    const segments = listAssistantSegmentElements(adapter);
    const segIndex = position - 1;
    if (segIndex < 0 || segIndex >= segments.length) return { ok: false, message: 'Position out of range' };

    const segment = segments[segIndex]!;
    const idx = findTurnIndexForSegment(turns, segment);
    if (idx < 0) return { ok: false, message: 'Failed to map segment to turn' };

    return { ok: true, targetEl: turns[idx]!.primaryMessageEl, turnIndex: idx };
}

export function scrollToConversationTarget(
    adapter: SiteAdapter,
    locator: ConversationLocator,
    options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): ScrollResult {
    const res = resolveConversationTarget(adapter, locator);
    if (!res.ok) return res;
    res.targetEl.scrollIntoView({ behavior: options?.behavior ?? 'smooth', block: options?.block ?? 'center' });
    window.setTimeout(() => highlightElement(res.targetEl), 100);
    return { ok: true };
}

export async function scrollToConversationTargetWithRetry(
    adapter: SiteAdapter,
    locator: ConversationLocator,
    options?: { timeoutMs?: number; intervalMs?: number }
): Promise<ScrollResult> {
    const timeoutMs = options?.timeoutMs ?? 2000;
    const intervalMs = options?.intervalMs ?? 200;
    const start = Date.now();
    let last: ScrollResult = { ok: false, message: 'Not ready' };
    while (Date.now() - start < timeoutMs) {
        last = scrollToConversationTarget(adapter, locator);
        if (last.ok) return last;
        await new Promise((r) => window.setTimeout(r, intervalMs));
    }
    return last;
}
