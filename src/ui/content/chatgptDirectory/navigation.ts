import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ScrollResult } from '../../../drivers/content/bookmarks/navigation';
import { highlightNavigationTarget } from '../../../drivers/content/conversation/highlight';
import { releaseChatGPTSendPositionRestore } from '../../../drivers/content/chatgpt/sendPositionRestoreEvents';
import { getChatGPTConversationIndex } from '../../../drivers/content/chatgpt/ChatGPTConversationIndex';
import {
    materializeChatGPTConversationTarget,
    resolveChatGPTCanonicalTarget,
    type ChatGPTCanonicalNavigationTarget,
    type ChatGPTMaterializationOptions,
} from '../../../drivers/content/chatgpt/ChatGPTConversationNavigation';

export type ChatGPTRoundPosition = {
    position: number;
    id: string | null;
    messageId: string | null;
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    userPromptText: string | null;
    userPromptQuality?: 'real' | 'fallback';
    jumpAnchor: HTMLElement | null;
    userAnchor: HTMLElement | null;
    assistantRoot: HTMLElement | null;
    groupEls: HTMLElement[];
};

export type ChatGPTNavigationTarget = ChatGPTCanonicalNavigationTarget;

export type ChatGPTNavigationOptions = ChatGPTMaterializationOptions & {
    alignmentTimeoutMs?: number;
    alignmentQuietMs?: number;
    alignmentTolerancePx?: number;
    maxAlignmentAttempts?: number;
};

type AlignmentDebugEvent = {
    stage: string;
    position: number;
    attempt: number;
    top?: number;
    delta?: number;
    aborted?: boolean;
    mutationCount?: number;
    resizeCount?: number;
    reason?: string;
};

const DEFAULT_ALIGNMENT_TIMEOUT_MS = 900;
const DEFAULT_ALIGNMENT_QUIET_MS = 80;
const DEFAULT_ALIGNMENT_TOLERANCE_PX = 8;
const DEFAULT_MAX_ALIGNMENT_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isNavigationDebugEnabled(): boolean {
    try {
        return window.localStorage.getItem('aimd:nav-debug') === '1'
            || window.localStorage.getItem('aimd:debug') === '1';
    } catch {
        return false;
    }
}

function flushNavigationDebug(events: AlignmentDebugEvent[]): void {
    if (!events.length || !isNavigationDebugEnabled()) return;
    try {
        console.table(events);
    } catch {
        // Debug logging must never affect navigation.
    }
}

function getAnchorTop(anchor: HTMLElement): number {
    return anchor.getBoundingClientRect().top;
}

function scrollAnchor(anchor: HTMLElement): void {
    releaseChatGPTSendPositionRestore();
    anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
}

function getAnchorForTarget(adapter: SiteAdapter, target: ChatGPTNavigationTarget): HTMLElement | null {
    return resolveChatGPTCanonicalTarget(adapter, target)?.materialized?.jumpAnchorEl ?? null;
}

export function collectChatGPTRoundPositions(adapter: SiteAdapter): ChatGPTRoundPosition[] {
    return getChatGPTConversationIndex(adapter).getRounds().map((indexedRound) => {
        const materialized = indexedRound.materialized;
        return {
            position: indexedRound.position,
            id: indexedRound.round.id,
            messageId: indexedRound.round.messageId ?? indexedRound.round.assistantMessageId,
            roundId: indexedRound.identity.roundId,
            userMessageId: indexedRound.identity.userMessageId,
            assistantMessageId: indexedRound.identity.assistantMessageId,
            userPromptText: indexedRound.round.userPrompt,
            userPromptQuality: 'real',
            jumpAnchor: materialized?.jumpAnchorEl ?? null,
            userAnchor: materialized?.userRootEl ?? null,
            assistantRoot: materialized?.assistantRootEl ?? null,
            groupEls: materialized?.groupEls ?? [],
        };
    });
}

function getRoundViewportRange(round: ChatGPTRoundPosition): { top: number; bottom: number } | null {
    const nodes = round.groupEls.length
        ? round.groupEls
        : (round.jumpAnchor ? [round.jumpAnchor] : []);
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
        if (!node.isConnected) continue;
        const rect = node.getBoundingClientRect();
        if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) continue;
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
    return { top, bottom };
}

export function resolveChatGPTActivePosition(
    rounds: ChatGPTRoundPosition[],
    referenceY: number,
    fallbackPosition = 0,
): number {
    if (rounds.length === 0) return 0;
    const ranges = rounds.map((round) => {
        const range = getRoundViewportRange(round);
        return range ? { position: round.position, ...range } : null;
    }).filter((range): range is { position: number; top: number; bottom: number } => range !== null);
    const visible = ranges.find((range) => range.top <= referenceY && range.bottom >= referenceY);
    if (visible) return visible.position;
    if (ranges.length > 0) {
        const getDistance = (range: { top: number; bottom: number }) => {
            if (referenceY < range.top) return range.top - referenceY;
            if (referenceY > range.bottom) return referenceY - range.bottom;
            return 0;
        };
        let nearest = ranges[0]!;
        let nearestDistance = getDistance(nearest);
        for (const range of ranges.slice(1)) {
            const distance = getDistance(range);
            if (distance < nearestDistance) {
                nearest = range;
                nearestDistance = distance;
            }
        }
        return nearest.position;
    }
    return fallbackPosition || rounds[0]?.position || 0;
}

export async function navigateChatGPTDirectoryTarget(
    adapter: SiteAdapter,
    target: ChatGPTNavigationTarget,
    options?: ChatGPTNavigationOptions
): Promise<ScrollResult> {
    const materialized = await materializeChatGPTConversationTarget(adapter, target, options);
    if (!materialized.ok) return materialized;
    const exactTarget: ChatGPTNavigationTarget = {
        position: materialized.indexedRound.position,
        messageId: materialized.indexedRound.round.messageId,
        roundId: materialized.indexedRound.identity.roundId,
        userMessageId: materialized.indexedRound.identity.userMessageId,
        assistantMessageId: materialized.indexedRound.identity.assistantMessageId,
    };
    const anchor = materialized.anchor;
    if (anchor && typeof anchor.scrollIntoView === 'function') {
        const settledAnchor = await scrollChatGPTAnchorWithAlignment(adapter, exactTarget, anchor, options);
        window.setTimeout(() => highlightNavigationTarget(settledAnchor), 40);
        return { ok: true };
    }
    return { ok: false, message: 'Materialized target has no scroll anchor' };
}

async function scrollChatGPTAnchorWithAlignment(
    adapter: SiteAdapter,
    target: ChatGPTNavigationTarget,
    initialAnchor: HTMLElement,
    options?: ChatGPTNavigationOptions,
): Promise<HTMLElement> {
    const timeoutMs = Math.max(0, options?.alignmentTimeoutMs ?? DEFAULT_ALIGNMENT_TIMEOUT_MS);
    const quietMs = Math.max(16, options?.alignmentQuietMs ?? DEFAULT_ALIGNMENT_QUIET_MS);
    const tolerancePx = Math.max(0, options?.alignmentTolerancePx ?? DEFAULT_ALIGNMENT_TOLERANCE_PX);
    const maxAttempts = Math.max(1, options?.maxAlignmentAttempts ?? DEFAULT_MAX_ALIGNMENT_ATTEMPTS);
    const debugEvents: AlignmentDebugEvent[] = [];
    let anchor = initialAnchor;
    let attempts = 1;
    let aborted = false;
    let mutationCount = 0;
    let resizeCount = 0;
    let lastActivityAt = Date.now();

    const markActivity = () => {
        lastActivityAt = Date.now();
    };
    const abortForUser = () => {
        aborted = true;
    };
    const userAbortEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    scrollAnchor(anchor);
    const targetTop = getAnchorTop(anchor);
    debugEvents.push({ stage: 'scroll', position: target.position, attempt: attempts, top: targetTop });

    if (timeoutMs <= 0) {
        flushNavigationDebug(debugEvents);
        return anchor;
    }

    for (const eventName of userAbortEvents) {
        document.addEventListener(eventName, abortForUser, { capture: true, passive: true });
    }

    try {
        const observerRoot = adapter.getObserverContainer?.() ?? document.body;
        if (observerRoot) {
            mutationObserver = new MutationObserver(() => {
                mutationCount += 1;
                markActivity();
            });
            mutationObserver.observe(observerRoot, { childList: true, subtree: true, characterData: true });
        }

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                resizeCount += 1;
                markActivity();
            });
            resizeObserver.observe(anchor);
            const scrollRoot = adapter.getConversationScrollRoot?.();
            if (scrollRoot) resizeObserver.observe(scrollRoot);
        }

        const startedAt = Date.now();
        while (!aborted && attempts < maxAttempts && Date.now() - startedAt < timeoutMs) {
            await sleep(quietMs);
            if (aborted) break;
            if (Date.now() - lastActivityAt < quietMs) continue;

            const nextAnchor = getAnchorForTarget(adapter, target);
            if (nextAnchor && nextAnchor !== anchor) {
                resizeObserver?.unobserve(anchor);
                anchor = nextAnchor;
                if (resizeObserver) resizeObserver.observe(anchor);
                markActivity();
            }

            if (!anchor.isConnected || typeof anchor.scrollIntoView !== 'function') {
                debugEvents.push({
                    stage: 'skip',
                    position: target.position,
                    attempt: attempts,
                    aborted,
                    mutationCount,
                    resizeCount,
                    reason: 'anchor-disconnected',
                });
                break;
            }

            const currentTop = getAnchorTop(anchor);
            const delta = currentTop - targetTop;
            debugEvents.push({
                stage: 'measure',
                position: target.position,
                attempt: attempts,
                top: currentTop,
                delta,
                mutationCount,
                resizeCount,
            });
            if (Math.abs(delta) <= tolerancePx) break;

            attempts += 1;
            scrollAnchor(anchor);
            debugEvents.push({
                stage: 'realign',
                position: target.position,
                attempt: attempts,
                top: getAnchorTop(anchor),
                delta,
                mutationCount,
                resizeCount,
            });
            markActivity();
        }
    } finally {
        mutationObserver?.disconnect();
        resizeObserver?.disconnect();
        for (const eventName of userAbortEvents) {
            document.removeEventListener(eventName, abortForUser, { capture: true });
        }
        debugEvents.push({
            stage: 'done',
            position: target.position,
            attempt: attempts,
            top: anchor.isConnected ? getAnchorTop(anchor) : undefined,
            aborted,
            mutationCount,
            resizeCount,
        });
        flushNavigationDebug(debugEvents);
    }

    return anchor;
}
