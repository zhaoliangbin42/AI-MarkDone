import type { SiteAdapter } from '../adapters/base';
import {
    getChatGPTConversationIndex,
    type ChatGPTIndexedRound,
} from './ChatGPTConversationIndex';
import { collectChatGPTDomTurnSlots, invalidateChatGPTDomRoundSnapshot } from './domConversationDiscovery';
import { releaseChatGPTSendPositionRestore } from './sendPositionRestoreEvents';

export type ChatGPTCanonicalNavigationTarget = {
    position: number;
    messageId?: string | null;
    roundId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
};

export type ChatGPTMaterializationOptions = {
    timeoutMs?: number;
    intervalMs?: number;
    maxSeekAttempts?: number;
    signal?: AbortSignal;
};

export type ChatGPTMaterializationResult =
    | { ok: true; anchor: HTMLElement; indexedRound: ChatGPTIndexedRound }
    | { ok: false; message: string };

function normalizeIdentity(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function hasExplicitIdentity(target: ChatGPTCanonicalNavigationTarget): boolean {
    return Boolean(
        normalizeIdentity(target.roundId)
        || normalizeIdentity(target.userMessageId)
        || normalizeIdentity(target.assistantMessageId)
        || normalizeIdentity(target.messageId),
    );
}

function matchesTargetIdentity(round: ChatGPTIndexedRound, target: ChatGPTCanonicalNavigationTarget): boolean {
    const expectedRoundId = normalizeIdentity(target.roundId);
    const expectedUserMessageId = normalizeIdentity(target.userMessageId);
    const expectedAssistantMessageId = normalizeIdentity(target.assistantMessageId);
    const expectedMessageId = normalizeIdentity(target.messageId);
    if (expectedRoundId && round.identity.roundId !== expectedRoundId) return false;
    if (expectedUserMessageId && round.identity.userMessageId !== expectedUserMessageId) return false;
    if (expectedAssistantMessageId && round.identity.assistantMessageId !== expectedAssistantMessageId) return false;
    if (
        expectedMessageId
        && normalizeIdentity(round.round.messageId) !== expectedMessageId
        && round.identity.assistantMessageId !== expectedMessageId
    ) return false;
    return true;
}

export function resolveChatGPTCanonicalTarget(
    adapter: SiteAdapter,
    target: ChatGPTCanonicalNavigationTarget,
): ChatGPTIndexedRound | null {
    const rounds = getChatGPTConversationIndex(adapter).getRounds();
    if (hasExplicitIdentity(target)) {
        const matches = rounds.filter((round) => matchesTargetIdentity(round, target));
        return matches.length === 1 ? matches[0]! : null;
    }
    const matches = rounds.filter((round) => round.position === target.position);
    return matches.length === 1 ? matches[0]! : null;
}

function toExactTarget(round: ChatGPTIndexedRound): ChatGPTCanonicalNavigationTarget {
    return {
        position: round.position,
        messageId: round.round.messageId,
        roundId: round.identity.roundId,
        userMessageId: round.identity.userMessageId,
        assistantMessageId: round.identity.assistantMessageId,
    };
}

type CanonicalSlotEntry = {
    round: ChatGPTIndexedRound;
    role: 'user' | 'assistant';
    materializedEl: HTMLElement | null;
};

function resolveCanonicalHostSlot(
    adapter: SiteAdapter,
    rounds: ChatGPTIndexedRound[],
    target: ChatGPTIndexedRound,
): HTMLElement | null {
    const sequence: CanonicalSlotEntry[] = [];
    for (const round of rounds) {
        if (!round.identity.userMessageId || !round.identity.assistantMessageId) return null;
        sequence.push({
            round,
            role: 'user',
            materializedEl: round.materialized?.userRootEl ?? null,
        }, {
            round,
            role: 'assistant',
            materializedEl: round.materialized?.assistantRootEl ?? null,
        });
    }

    const slots = collectChatGPTDomTurnSlots(adapter);
    if (sequence.length === 0) return null;

    // ChatGPT's persistent slot marker is the message id once a slot is
    // hydrated, and the same marker is retained while the slot is an empty
    // shell. Prefer that typed identity over ordinal alignment. The host may
    // retain tool/branch slots that are not part of the active graph, so one
    // global offset cannot safely map every canonical round to a slot.
    const targetSlotByMessageId = new Map<string, HTMLElement>();
    const duplicateMarkers = new Set<string>();
    for (const slot of slots) {
        const marker = normalizeIdentity(slot.getAttribute('data-turn-id-container'));
        if (!marker) continue;
        if (duplicateMarkers.has(marker)) continue;
        if (targetSlotByMessageId.has(marker)) {
            targetSlotByMessageId.delete(marker);
            duplicateMarkers.add(marker);
            continue;
        }
        targetSlotByMessageId.set(marker, slot);
    }
    const isRoleCompatible = (slot: HTMLElement, role: 'user' | 'assistant'): boolean => {
        const knownRoles = new Set<'user' | 'assistant'>();
        if (slot.matches(`[data-message-author-role="${role}"]`)) knownRoles.add(role);
        for (const node of slot.querySelectorAll<HTMLElement>('[data-message-author-role]')) {
            const observed = node.getAttribute('data-message-author-role');
            if (observed === 'user' || observed === 'assistant') knownRoles.add(observed);
        }
        return knownRoles.size === 0 || knownRoles.has(role);
    };
    const targetUserMessageId = normalizeIdentity(target.identity.userMessageId);
    const targetAssistantMessageId = normalizeIdentity(target.identity.assistantMessageId);
    const targetRoundId = normalizeIdentity(target.identity.roundId);
    const identityCandidates: Array<{ id: string; role: 'user' | 'assistant' }> = [];
    if (targetUserMessageId) identityCandidates.push({ id: targetUserMessageId, role: 'user' });
    if (targetRoundId) identityCandidates.push({ id: targetRoundId, role: 'user' });
    if (targetAssistantMessageId) identityCandidates.push({ id: targetAssistantMessageId, role: 'assistant' });
    const userIdentitySlots = new Set<HTMLElement>();
    const assistantIdentitySlots = new Set<HTMLElement>();
    for (const candidate of identityCandidates) {
        const slot = targetSlotByMessageId.get(candidate.id);
        if (!slot?.isConnected || !isRoleCompatible(slot, candidate.role)) continue;
        if (candidate.role === 'user') userIdentitySlots.add(slot);
        else assistantIdentitySlots.add(slot);
    }
    // A canonical round has two persistent host slots. Prefer the user slot
    // because it is the stable coarse navigation anchor; only fall back to
    // the assistant slot when the source did not expose a user identity.
    if (userIdentitySlots.size === 1) return userIdentitySlots.values().next().value ?? null;
    if (userIdentitySlots.size > 1) return null;
    if (assistantIdentitySlots.size === 1) return assistantIdentitySlots.values().next().value ?? null;
    if (assistantIdentitySlots.size > 1) return null;

    if (slots.length < sequence.length) return null;

    const slotIndexByElement = new Map(slots.map((slot, index) => [slot, index]));
    const findSlotIndex = (element: HTMLElement): number | null => {
        let current: HTMLElement | null = element;
        while (current) {
            const index = slotIndexByElement.get(current);
            if (index !== undefined) return index;
            current = current.parentElement;
        }
        return null;
    };

    const offsets = new Set<number>();
    for (let index = 0; index < sequence.length; index += 1) {
        const element = sequence[index]!.materializedEl;
        if (!element) continue;
        const slotIndex = findSlotIndex(element);
        if (slotIndex !== null) offsets.add(slotIndex - index);
    }
    if (offsets.size !== 1) return null;
    const offset = offsets.values().next().value;
    if (
        typeof offset !== 'number'
        || !Number.isInteger(offset)
        || offset < 0
        || offset + sequence.length > slots.length
    ) return null;

    const targetIndex = sequence.findIndex((entry) => entry.round.position === target.position && entry.role === 'user');
    if (targetIndex < 0) return null;
    const slot = slots[offset + targetIndex];
    return slot?.isConnected ? slot : null;
}

export async function materializeChatGPTConversationTarget(
    adapter: SiteAdapter,
    target: ChatGPTCanonicalNavigationTarget,
    options?: ChatGPTMaterializationOptions,
): Promise<ChatGPTMaterializationResult> {
    const index = getChatGPTConversationIndex(adapter);
    const canonicalTarget = resolveChatGPTCanonicalTarget(adapter, target);
    if (!canonicalTarget) return { ok: false, message: 'Canonical target unavailable' };
    const exactTarget = toExactTarget(canonicalTarget);
    const mountedAnchor = canonicalTarget.materialized?.jumpAnchorEl;
    if (mountedAnchor instanceof HTMLElement) {
        return { ok: true, anchor: mountedAnchor, indexedRound: canonicalTarget };
    }

    const timeoutMs = Math.max(1, Math.min(15_000, options?.timeoutMs ?? 15_000));
    const routeAtStart = window.location.href;
    let abortedByUser = false;
    let cancelPending: (() => void) | null = null;
    const abortForUser = () => {
        abortedByUser = true;
        cancelPending?.();
    };
    const userAbortEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const eventName of userAbortEvents) {
        document.addEventListener(eventName, abortForUser, { capture: true, passive: true });
    }

    try {
        releaseChatGPTSendPositionRestore();
        return await new Promise<ChatGPTMaterializationResult>((resolve) => {
            let settled = false;
            let timeoutId = 0;
            let unsubscribe: () => void = () => undefined;
            let coarseSlot: HTMLElement | null = null;
            let routeChangedPending: (() => void) | null = null;
            const routeChanged = () => routeChangedPending?.();
            const finish = (result: ChatGPTMaterializationResult) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                unsubscribe();
                window.removeEventListener('popstate', routeChanged);
                window.removeEventListener('hashchange', routeChanged);
                routeChangedPending = null;
                cancelPending = null;
                resolve(result);
            };
            cancelPending = () => finish({ ok: false, message: 'Navigation cancelled' });
            routeChangedPending = () => finish({ ok: false, message: 'Conversation route changed' });
            window.addEventListener('popstate', routeChanged);
            window.addEventListener('hashchange', routeChanged);
            const check = () => {
                if (abortedByUser || options?.signal?.aborted) {
                    finish({ ok: false, message: 'Navigation cancelled' });
                    return;
                }
                if (window.location.href !== routeAtStart) {
                    finish({ ok: false, message: 'Conversation route changed' });
                    return;
                }
                const currentTarget = resolveChatGPTCanonicalTarget(adapter, exactTarget);
                if (!currentTarget) return;
                const currentAnchor = currentTarget.materialized?.jumpAnchorEl;
                if (currentAnchor instanceof HTMLElement) {
                    finish({ ok: true, anchor: currentAnchor, indexedRound: currentTarget });
                    return;
                }
                if (coarseSlot?.isConnected) return;
                coarseSlot = null;
                const targetSlot = resolveCanonicalHostSlot(adapter, index.getRounds(), currentTarget);
                if (!targetSlot || typeof targetSlot.scrollIntoView !== 'function') return;
                coarseSlot = targetSlot;
                targetSlot.scrollIntoView({ behavior: 'auto', block: 'start' });
                // The host may hydrate synchronously inside scrollIntoView.
                // Invalidate the existing discovery snapshot once so the
                // immediate verification observes that replacement without
                // introducing a polling loop.
                invalidateChatGPTDomRoundSnapshot(adapter);
                check();
            };
            unsubscribe = index.subscribe(check);
            timeoutId = window.setTimeout(() => finish({ ok: false, message: 'Conversation hydration timeout' }), timeoutMs);
            options?.signal?.addEventListener('abort', () => finish({ ok: false, message: 'Navigation cancelled' }), { once: true });
            check();
        });
    } finally {
        for (const eventName of userAbortEvents) {
            document.removeEventListener(eventName, abortForUser, { capture: true });
        }
    }

}
