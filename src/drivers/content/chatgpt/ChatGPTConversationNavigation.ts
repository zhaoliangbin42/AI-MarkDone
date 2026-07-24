import type { SiteAdapter } from '../adapters/base';
import {
    getChatGPTConversationIndex,
    type ChatGPTConversationIndex,
    type ChatGPTIndexedRound,
} from './ChatGPTConversationIndex';
import { collectChatGPTDomTurnSlots } from './domConversationDiscovery';
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeIdentity(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function getScrollContentTop(scrollRoot: HTMLElement, anchor: HTMLElement): number | null {
    if (!anchor.isConnected) return null;
    const anchorRect = anchor.getBoundingClientRect();
    const scrollRootRect = scrollRoot.getBoundingClientRect();
    const contentTop = scrollRoot.scrollTop + anchorRect.top - scrollRootRect.top;
    return Number.isFinite(contentTop) ? contentTop : null;
}

function getScrollContentBottom(scrollRoot: HTMLElement, anchors: HTMLElement[]): number | null {
    const scrollRootRect = scrollRoot.getBoundingClientRect();
    let bottom = Number.NEGATIVE_INFINITY;
    for (const anchor of anchors) {
        if (!anchor.isConnected) continue;
        const rect = anchor.getBoundingClientRect();
        if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || rect.bottom <= rect.top) continue;
        bottom = Math.max(bottom, rect.bottom);
    }
    if (!Number.isFinite(bottom)) return null;
    const contentBottom = scrollRoot.scrollTop + bottom - scrollRootRect.top;
    return Number.isFinite(contentBottom) ? contentBottom : null;
}

function getMaterializedRoundBottom(scrollRoot: HTMLElement, round: ChatGPTIndexedRound): number | null {
    const materialized = round.materialized;
    if (!materialized) return null;
    return getScrollContentBottom(scrollRoot, materialized.groupEls);
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
    if (sequence.length === 0 || slots.length < sequence.length) return null;
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

function waitForConversationIndexChange(index: ChatGPTConversationIndex, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        let timer = 0;
        let unsubscribe: () => void = () => undefined;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            unsubscribe();
            resolve();
        };
        timer = window.setTimeout(finish, timeoutMs);
        unsubscribe = index.subscribe(finish);
    });
}

export async function materializeChatGPTConversationTarget(
    adapter: SiteAdapter,
    target: ChatGPTCanonicalNavigationTarget,
    options?: ChatGPTMaterializationOptions,
): Promise<ChatGPTMaterializationResult> {
    const index = getChatGPTConversationIndex(adapter);
    await index.ensureSnapshot();
    const canonicalTarget = resolveChatGPTCanonicalTarget(adapter, target);
    if (!canonicalTarget) return { ok: false, message: 'Canonical target unavailable' };
    const exactTarget = toExactTarget(canonicalTarget);
    const mountedAnchor = canonicalTarget.materialized?.jumpAnchorEl;
    if (mountedAnchor instanceof HTMLElement) {
        return { ok: true, anchor: mountedAnchor, indexedRound: canonicalTarget };
    }

    const timeoutMs = Math.max(0, options?.timeoutMs ?? 1500);
    const intervalMs = Math.max(16, options?.intervalMs ?? 120);
    const maxAttempts = Math.max(1, options?.maxSeekAttempts ?? 24);
    const routeAtStart = window.location.href;
    const startedAt = Date.now();
    let lowerScrollBound = 0;
    let upperScrollBound: number | null = null;
    let abortedByUser = false;
    let probeActive = false;
    let probeDirection: -1 | 1 = 1;
    let probeStepPx = 0;
    const abortForUser = () => {
        abortedByUser = true;
    };
    const userAbortEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const eventName of userAbortEvents) {
        document.addEventListener(eventName, abortForUser, { capture: true, passive: true });
    }

    try {
        releaseChatGPTSendPositionRestore();
        let targetSlot: HTMLElement | null = null;
        let usedCanonicalSlot = false;
        for (let attempt = 0; attempt < maxAttempts && Date.now() - startedAt <= timeoutMs; attempt += 1) {
            if (abortedByUser || options?.signal?.aborted) return { ok: false, message: 'Navigation cancelled' };
            if (window.location.href !== routeAtStart) return { ok: false, message: 'Conversation route changed' };
            const currentTarget = resolveChatGPTCanonicalTarget(adapter, exactTarget);
            if (!currentTarget) return { ok: false, message: 'Canonical target unavailable' };
            const currentAnchor = currentTarget.materialized?.jumpAnchorEl;
            if (currentAnchor instanceof HTMLElement) {
                return { ok: true, anchor: currentAnchor, indexedRound: currentTarget };
            }
            if (!targetSlot?.isConnected) {
                targetSlot = resolveCanonicalHostSlot(adapter, index.getRounds(), currentTarget);
            }
            if (!targetSlot || typeof targetSlot.scrollIntoView !== 'function') break;
            usedCanonicalSlot = true;
            const attemptStartedAt = Date.now();
            const changed = waitForConversationIndexChange(index, intervalMs);
            targetSlot.scrollIntoView({ behavior: 'auto', block: 'start' });
            await changed;
            const materializedTarget = resolveChatGPTCanonicalTarget(adapter, exactTarget);
            const materializedAnchor = materializedTarget?.materialized?.jumpAnchorEl;
            if (materializedTarget && materializedAnchor instanceof HTMLElement) {
                return {
                    ok: true,
                    anchor: materializedAnchor,
                    indexedRound: materializedTarget,
                };
            }
            const remainingIntervalMs = intervalMs - (Date.now() - attemptStartedAt);
            if (remainingIntervalMs > 0) await sleep(remainingIntervalMs);
        }

        if (usedCanonicalSlot) {
            // A calibrated host node is stronger evidence than any later pixel estimate.
            // Keep this path fail-closed instead of scrolling away from the proven slot.
            const finalTarget = resolveChatGPTCanonicalTarget(adapter, exactTarget);
            const finalAnchor = finalTarget?.materialized?.jumpAnchorEl;
            if (finalTarget && finalAnchor instanceof HTMLElement) {
                return { ok: true, anchor: finalAnchor, indexedRound: finalTarget };
            }
            return { ok: false, message: 'Canonical target was not materialized' };
        }

        const scrollRoot = adapter.getConversationScrollRoot?.();
        if (!(scrollRoot instanceof HTMLElement)) {
            return { ok: false, message: 'Conversation scroll root unavailable' };
        }
        for (let attempt = 0; attempt < maxAttempts && Date.now() - startedAt <= timeoutMs; attempt += 1) {
            if (abortedByUser || options?.signal?.aborted) return { ok: false, message: 'Navigation cancelled' };
            if (window.location.href !== routeAtStart) return { ok: false, message: 'Conversation route changed' };

            const currentTarget = resolveChatGPTCanonicalTarget(adapter, exactTarget);
            if (!currentTarget) return { ok: false, message: 'Canonical target unavailable' };
            const currentAnchor = currentTarget.materialized?.jumpAnchorEl;
            if (currentAnchor instanceof HTMLElement) {
                return { ok: true, anchor: currentAnchor, indexedRound: currentTarget };
            }

            const rounds = index.getRounds();
            const total = rounds.length;
            if (total === 0) return { ok: false, message: 'Canonical conversation unavailable' };
            const maxScrollTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
            upperScrollBound = upperScrollBound === null
                ? maxScrollTop
                : Math.min(upperScrollBound, maxScrollTop);
            const ratio = total <= 1 ? 0 : (currentTarget.position - 1) / (total - 1);
            const materializedPositions = rounds
                .filter((round) => round.materialized?.jumpAnchorEl instanceof HTMLElement)
                .map((round) => round.position);
            const minMaterialized = materializedPositions.length > 0 ? Math.min(...materializedPositions) : null;
            const maxMaterialized = materializedPositions.length > 0 ? Math.max(...materializedPositions) : null;
            let desiredTop = Math.round(maxScrollTop * ratio);
            let probeHintDirection: -1 | 1 | null = null;
            if (attempt > 0 && minMaterialized !== null && maxMaterialized !== null) {
                if (currentTarget.position > maxMaterialized) {
                    const previous = rounds
                        .filter((round) => (
                            round.position < currentTarget.position
                            && round.materialized?.jumpAnchorEl instanceof HTMLElement
                        ))
                        .sort((left, right) => right.position - left.position)[0];
                    const previousBottom = previous
                        ? getMaterializedRoundBottom(scrollRoot, previous)
                        : null;
                    lowerScrollBound = Math.max(lowerScrollBound, previousBottom ?? scrollRoot.scrollTop);
                    probeHintDirection = 1;
                    if (previousBottom !== null) {
                        desiredTop = Math.max(scrollRoot.scrollTop, lowerScrollBound);
                    }
                    if (upperScrollBound <= lowerScrollBound && maxScrollTop > lowerScrollBound) {
                        upperScrollBound = maxScrollTop;
                    }
                } else if (currentTarget.position < minMaterialized) {
                    const next = rounds
                        .filter((round) => (
                            round.position > currentTarget.position
                            && round.materialized?.jumpAnchorEl instanceof HTMLElement
                        ))
                        .sort((left, right) => left.position - right.position)[0];
                    const nextTop = next?.materialized?.jumpAnchorEl
                        ? getScrollContentTop(scrollRoot, next.materialized.jumpAnchorEl)
                        : null;
                    upperScrollBound = Math.min(upperScrollBound, nextTop ?? scrollRoot.scrollTop);
                    probeHintDirection = -1;
                    if (nextTop !== null) desiredTop = Math.min(scrollRoot.scrollTop, upperScrollBound);
                } else if (currentTarget.materialized === null) {
                    const previous = rounds
                        .filter((round) => (
                            round.position < currentTarget.position
                            && round.materialized?.jumpAnchorEl instanceof HTMLElement
                        ))
                        .sort((left, right) => right.position - left.position)[0];
                    const next = rounds
                        .filter((round) => (
                            round.position > currentTarget.position
                            && round.materialized?.jumpAnchorEl instanceof HTMLElement
                        ))
                        .sort((left, right) => left.position - right.position)[0];
                    const previousTop = previous?.materialized?.jumpAnchorEl
                        ? getScrollContentTop(scrollRoot, previous.materialized.jumpAnchorEl)
                        : null;
                    const nextTop = next?.materialized?.jumpAnchorEl
                        ? getScrollContentTop(scrollRoot, next.materialized.jumpAnchorEl)
                        : null;
                    if (previous && next) {
                        probeHintDirection = currentTarget.position - previous.position
                            >= next.position - currentTarget.position
                            ? 1
                            : -1;
                    }
                    if (previousTop !== null && nextTop !== null && nextTop > previousTop) {
                        lowerScrollBound = Math.max(lowerScrollBound, previousTop);
                        upperScrollBound = Math.min(upperScrollBound, nextTop);
                        const positionSpan = next.position - previous.position;
                        if (positionSpan > 0) {
                            const targetFraction = (currentTarget.position - previous.position) / positionSpan;
                            desiredTop = Math.round(previousTop + (nextTop - previousTop) * targetFraction);
                        }
                    }
                }
                if (probeHintDirection === null || desiredTop === Math.round(maxScrollTop * ratio)) {
                    desiredTop = Math.round((lowerScrollBound + upperScrollBound) / 2);
                }
            }
            const shouldProbe = probeActive || (attempt > 0 && desiredTop === scrollRoot.scrollTop);
            if (shouldProbe) {
                probeActive = true;
                const lowerBound = Math.max(0, Math.min(lowerScrollBound, maxScrollTop));
                const upperBound = Math.max(
                    lowerBound,
                    Math.min(upperScrollBound ?? maxScrollTop, maxScrollTop),
                );
                const span = Math.max(0, upperBound - lowerBound);
                if (probeStepPx === 0) {
                    probeStepPx = Math.max(480, Math.min(1600, Math.round(span / 12) || 480));
                    if (probeHintDirection !== null) probeDirection = probeHintDirection;
                    else if (scrollRoot.scrollTop >= desiredTop) probeDirection = -1;
                }
                let probeTop = scrollRoot.scrollTop + probeDirection * probeStepPx;
                if (probeTop < lowerBound || probeTop > upperBound) {
                    probeDirection = probeDirection === 1 ? -1 : 1;
                    probeTop = scrollRoot.scrollTop + probeDirection * probeStepPx;
                }
                if (probeTop < lowerBound || probeTop > upperBound || probeTop === scrollRoot.scrollTop) {
                    return { ok: false, message: 'Conversation materialization reached its scroll boundary' };
                }
                desiredTop = Math.round(probeTop);
            }
            desiredTop = Math.max(0, Math.min(maxScrollTop, desiredTop));
            if (typeof scrollRoot.scrollTo === 'function') {
                scrollRoot.scrollTo({ top: desiredTop, behavior: 'auto' });
            } else {
                scrollRoot.scrollTop = desiredTop;
            }
            await sleep(intervalMs);
        }
    } finally {
        for (const eventName of userAbortEvents) {
            document.removeEventListener(eventName, abortForUser, { capture: true });
        }
    }

    return { ok: false, message: 'Canonical target was not materialized' };
}
