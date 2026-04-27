import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { highlightElement, scrollToBookmarkTargetWithRetry, type ScrollResult } from '../../../drivers/content/bookmarks/navigation';

export type ChatGPTSkeletonAnchor = {
    position: number;
    anchorEl: HTMLElement;
};

export type ChatGPTRoundPosition = {
    position: number;
    jumpAnchor: HTMLElement;
    userAnchor: HTMLElement | null;
    assistantRoot: HTMLElement | null;
    groupEls: HTMLElement[];
};

export type ChatGPTNavigationTarget = {
    position: number;
    messageId?: string | null;
};

export type ChatGPTNavigationOptions = {
    timeoutMs?: number;
    intervalMs?: number;
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
    anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
}

function getAnchorForTarget(adapter: SiteAdapter, target: ChatGPTNavigationTarget): HTMLElement | null {
    return collectChatGPTSkeletonAnchors(adapter)[target.position - 1]?.anchorEl ?? null;
}

function pushUnique(nodes: HTMLElement[], node: HTMLElement | null | undefined): void {
    if (node && !nodes.includes(node)) nodes.push(node);
}

export function collectChatGPTRoundPositions(adapter: SiteAdapter): ChatGPTRoundPosition[] {
    const groupRefs = adapter.getConversationGroupRefs?.() ?? [];
    return groupRefs
        .map((groupRef, index): ChatGPTRoundPosition | null => {
            const jumpAnchor = groupRef.barAnchorEl ?? groupRef.userRootEl ?? groupRef.assistantRootEl;
            if (!(jumpAnchor instanceof HTMLElement)) return null;
            const groupEls: HTMLElement[] = [];
            pushUnique(groupEls, groupRef.barAnchorEl);
            pushUnique(groupEls, groupRef.userRootEl);
            pushUnique(groupEls, groupRef.assistantRootEl);
            if (!groupRef.assistantRootEl || !groupRef.assistantRootEl.contains(groupRef.assistantMessageEl)) {
                pushUnique(groupEls, groupRef.assistantMessageEl);
            }
            for (const groupEl of groupRef.groupEls) pushUnique(groupEls, groupEl);
            if (groupEls.length === 0) pushUnique(groupEls, jumpAnchor);
            return {
                position: index + 1,
                jumpAnchor,
                userAnchor: groupRef.userRootEl ?? null,
                assistantRoot: groupRef.assistantRootEl ?? null,
                groupEls,
            };
        })
        .filter((position): position is ChatGPTRoundPosition => position !== null);
}

export function collectChatGPTSkeletonAnchors(adapter: SiteAdapter): ChatGPTSkeletonAnchor[] {
    return collectChatGPTRoundPositions(adapter).map((position) => ({
        position: position.position,
        anchorEl: position.jumpAnchor,
    }));
}

export function resolveChatGPTSkeletonPositionForMessage(adapter: SiteAdapter, messageElement: HTMLElement): number | null {
    const groupRefs = adapter.getConversationGroupRefs?.() ?? [];
    const index = groupRefs.findIndex((groupRef) => {
        const candidates = [
            groupRef.barAnchorEl,
            groupRef.userRootEl,
            groupRef.assistantRootEl,
            groupRef.assistantMessageEl,
            ...groupRef.groupEls,
        ].filter((node): node is HTMLElement => node instanceof HTMLElement);
        return candidates.some((node) => (
            node === messageElement
            || node.contains(messageElement)
            || messageElement.contains(node)
        ));
    });
    return index >= 0 ? index + 1 : null;
}

export async function navigateChatGPTDirectoryTarget(
    adapter: SiteAdapter,
    target: ChatGPTNavigationTarget,
    options?: ChatGPTNavigationOptions
): Promise<ScrollResult> {
    const anchor = getAnchorForTarget(adapter, target);
    if (anchor && typeof anchor.scrollIntoView === 'function') {
        const settledAnchor = await scrollChatGPTAnchorWithAlignment(adapter, target, anchor, options);
        window.setTimeout(() => highlightElement(settledAnchor), 40);
        return { ok: true };
    }

    return scrollToBookmarkTargetWithRetry(
        adapter,
        { position: target.position, messageId: target.messageId },
        {
            timeoutMs: options?.timeoutMs ?? 1500,
            intervalMs: options?.intervalMs ?? 120,
        },
    );
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
