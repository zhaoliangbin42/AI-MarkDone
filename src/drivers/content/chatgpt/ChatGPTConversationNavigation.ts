import type { SiteAdapter } from '../adapters/base';
import {
    getChatGPTConversationIndex,
    type ChatGPTIndexedRound,
} from './ChatGPTConversationIndex';
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

    const scrollRoot = adapter.getConversationScrollRoot?.();
    if (!(scrollRoot instanceof HTMLElement)) return { ok: false, message: 'Conversation scroll root unavailable' };

    const timeoutMs = Math.max(0, options?.timeoutMs ?? 1500);
    const intervalMs = Math.max(16, options?.intervalMs ?? 120);
    const maxAttempts = Math.max(1, options?.maxSeekAttempts ?? 24);
    const routeAtStart = window.location.href;
    const startedAt = Date.now();
    let lowerScrollBound = 0;
    let upperScrollBound: number | null = null;
    let abortedByUser = false;
    const abortForUser = () => {
        abortedByUser = true;
    };
    const userAbortEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const eventName of userAbortEvents) {
        document.addEventListener(eventName, abortForUser, { capture: true, passive: true });
    }

    try {
        releaseChatGPTSendPositionRestore();
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
            if (attempt > 0 && minMaterialized !== null && maxMaterialized !== null) {
                if (currentTarget.position > maxMaterialized) {
                    lowerScrollBound = Math.max(lowerScrollBound, scrollRoot.scrollTop);
                    if (upperScrollBound <= lowerScrollBound && maxScrollTop > lowerScrollBound) {
                        upperScrollBound = maxScrollTop;
                    }
                } else if (currentTarget.position < minMaterialized) {
                    upperScrollBound = Math.min(upperScrollBound, scrollRoot.scrollTop);
                } else {
                    return { ok: false, message: 'Materialized range is missing the canonical identity' };
                }
                desiredTop = Math.round((lowerScrollBound + upperScrollBound) / 2);
            }
            desiredTop = Math.max(0, Math.min(maxScrollTop, desiredTop));
            if (attempt > 0 && desiredTop === scrollRoot.scrollTop) {
                return { ok: false, message: 'Conversation materialization reached its scroll boundary' };
            }
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
