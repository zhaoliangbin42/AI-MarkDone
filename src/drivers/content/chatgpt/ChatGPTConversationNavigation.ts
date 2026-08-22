import type { SiteAdapter } from '../adapters/base';
import type {
    ConversationObtainedSurfaceTurnV1,
    ConversationSurfaceMaterializationV1,
    ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';
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
    surface: ConversationSurfacePortV1;
    timeoutMs?: number;
    signal?: AbortSignal;
    seekStepPx?: number;
};

export type ChatGPTNavigationRound = Readonly<{
    position: number;
    messageId: string;
    roundId: string;
    userMessageId: string | null;
    assistantMessageId: string;
    materialization: ConversationSurfaceMaterializationV1 | null;
}>;

export type ChatGPTMaterializationResult =
    | { ok: true; anchor: HTMLElement; round: ChatGPTNavigationRound }
    | { ok: false; message: string };

type NavigationRelation = -1 | 1;

type NavigationCursor = {
    position: number;
    top: number;
    bottom: number;
};

const SEEK_SETTLE_DELAY_MS = 80;
const MAX_SEEK_STEPS = 200;
const MAX_SEEK_STALLS = 3;
const MIN_SEEK_STEP_PX = 120;
const MAX_SEEK_STEP_PX = 2000;
const MIN_CONFIGURED_SEEK_STEP_PX = 1000;
const MAX_CONFIGURED_SEEK_STEP_PX = 5000;

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

function matchesTargetIdentity(round: ChatGPTNavigationRound, target: ChatGPTCanonicalNavigationTarget): boolean {
    const expectedRoundId = normalizeIdentity(target.roundId);
    const expectedUserMessageId = normalizeIdentity(target.userMessageId);
    const expectedAssistantMessageId = normalizeIdentity(target.assistantMessageId);
    const expectedMessageId = normalizeIdentity(target.messageId);
    if (expectedRoundId && round.roundId !== expectedRoundId) return false;
    if (expectedUserMessageId && round.userMessageId !== expectedUserMessageId) return false;
    if (expectedAssistantMessageId && round.assistantMessageId !== expectedAssistantMessageId) return false;
    if (
        expectedMessageId
        && round.messageId !== expectedMessageId
        && round.assistantMessageId !== expectedMessageId
    ) return false;
    return true;
}

export function resolveChatGPTCanonicalTarget(
    surface: ConversationSurfacePortV1,
    target: ChatGPTCanonicalNavigationTarget,
): ChatGPTNavigationRound | null {
    const rounds = readNavigationRounds(surface);
    if (hasExplicitIdentity(target)) {
        const matches = rounds.filter((round) => matchesTargetIdentity(round, target));
        return matches.length === 1 ? matches[0]! : null;
    }
    const matches = rounds.filter((round) => round.position === target.position);
    return matches.length === 1 ? matches[0]! : null;
}

function toExactTarget(round: ChatGPTNavigationRound): ChatGPTCanonicalNavigationTarget {
    return {
        position: round.position,
        messageId: round.messageId,
        roundId: round.roundId,
        userMessageId: round.userMessageId,
        assistantMessageId: round.assistantMessageId,
    };
}

function readMaterializationRange(
    round: ChatGPTNavigationRound,
): { top: number; bottom: number } | null {
    const materialization = round.materialization;
    if (!materialization) return null;
    const nodes = materialization.groupElements.length > 0
        ? materialization.groupElements
        : [materialization.jumpAnchorElement];
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

function getScrollRootCenter(root: HTMLElement): number {
    const rect = root.getBoundingClientRect();
    const top = Number.isFinite(rect.top) ? rect.top : 0;
    const height = Number.isFinite(rect.height) && rect.height > 0
        ? rect.height
        : Math.max(root.clientHeight, window.innerHeight);
    return top + height / 2;
}

function readNavigationCursor(
    rounds: readonly ChatGPTNavigationRound[],
    root: HTMLElement,
): NavigationCursor | null {
    const center = getScrollRootCenter(root);
    const ranges = rounds
        .map((round) => {
            const range = readMaterializationRange(round);
            return range ? { position: round.position, ...range } : null;
        })
        .filter((range): range is NavigationCursor => range !== null);
    if (ranges.length === 0) return null;

    const distance = (range: NavigationCursor): number => {
        if (center < range.top) return range.top - center;
        if (center > range.bottom) return center - range.bottom;
        return 0;
    };
    return ranges.reduce((nearest, candidate) => (
        distance(candidate) < distance(nearest) ? candidate : nearest
    ));
}

function getNavigationRelation(
    targetPosition: number,
    cursorPosition: number,
): NavigationRelation | 0 {
    if (targetPosition === cursorPosition) return 0;
    return targetPosition > cursorPosition ? 1 : -1;
}

function getSeekStep(root: HTMLElement, configuredStepPx?: number): number {
    if (Number.isFinite(configuredStepPx)) {
        return Math.min(
            MAX_CONFIGURED_SEEK_STEP_PX,
            Math.max(MIN_CONFIGURED_SEEK_STEP_PX, configuredStepPx as number),
        );
    }
    const viewport = Math.max(root.clientHeight, window.innerHeight, MIN_SEEK_STEP_PX);
    return Math.min(MAX_SEEK_STEP_PX, Math.max(MIN_SEEK_STEP_PX, viewport * 0.9));
}

function getScrollMaximum(root: HTMLElement): number {
    return Math.max(0, root.scrollHeight - root.clientHeight);
}

function isAtSeekBoundary(root: HTMLElement, relation: NavigationRelation): boolean {
    const maximum = getScrollMaximum(root);
    return relation < 0
        ? root.scrollTop <= 1
        : root.scrollTop >= maximum - 1;
}

function scrollRootBy(root: HTMLElement, delta: number): boolean {
    const before = root.scrollTop;
    const maximum = getScrollMaximum(root);
    const next = Math.max(0, Math.min(maximum, before + delta));
    if (typeof root.scrollTo === 'function') {
        root.scrollTo({ top: next, behavior: 'auto' });
    } else if (typeof root.scrollBy === 'function') {
        root.scrollBy({ top: next - before, behavior: 'auto' });
    } else {
        return false;
    }
    return root.scrollTop !== before;
}

type CanonicalSlotEntry = {
    round: ChatGPTNavigationRound;
    role: 'user' | 'assistant';
    materializedEl: HTMLElement | null;
};

function resolveCanonicalHostSlot(
    adapter: SiteAdapter,
    rounds: ChatGPTNavigationRound[],
    target: ChatGPTNavigationRound,
): HTMLElement | null {
    const sequence: CanonicalSlotEntry[] = [];
    for (const round of rounds) {
        if (!round.userMessageId || !round.assistantMessageId) return null;
        sequence.push({
            round,
            role: 'user',
            materializedEl: round.materialization?.userElement ?? null,
        }, {
            round,
            role: 'assistant',
            materializedEl: round.materialization?.assistantElement ?? null,
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
    const targetUserMessageId = normalizeIdentity(target.userMessageId);
    const targetAssistantMessageId = normalizeIdentity(target.assistantMessageId);
    const targetRoundId = normalizeIdentity(target.roundId);
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
    options: ChatGPTMaterializationOptions,
): Promise<ChatGPTMaterializationResult> {
    const { surface } = options;
    const readRounds = () => readNavigationRounds(surface);
    const canonicalTarget = resolveChatGPTCanonicalTarget(surface, target);
    if (!canonicalTarget) return { ok: false, message: 'Canonical target unavailable' };
    const exactTarget = toExactTarget(canonicalTarget);
    const mountedAnchor = canonicalTarget.materialization?.jumpAnchorElement;
    if (mountedAnchor instanceof HTMLElement && mountedAnchor.isConnected) {
        return { ok: true, anchor: mountedAnchor, round: canonicalTarget };
    }

    const timeoutMs = Math.max(1, Math.min(15_000, options.timeoutMs ?? 15_000));
    const projectionAtStart = surface.readFrame().projectionId;
    const conversationBoundaryChanged = () => surface.readFrame().projectionId !== projectionAtStart;
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
            let settleTimerId = 0;
            let unsubscribe: () => void = () => undefined;
            let coarseSlot: HTMLElement | null = null;
            let seekStep = 0;
            let seekRelation: NavigationRelation | null = null;
            let seekSteps = 0;
            let seekStalls = 0;
            let checking = false;
            let checkAgain = false;
            let routeChangedPending: (() => void) | null = null;
            const routeChanged = () => {
                if (conversationBoundaryChanged()) routeChangedPending?.();
                else check();
            };
            const finish = (result: ChatGPTMaterializationResult) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                window.clearTimeout(settleTimerId);
                unsubscribe();
                window.removeEventListener('popstate', routeChanged);
                window.removeEventListener('hashchange', routeChanged);
                routeChangedPending = null;
                cancelPending = null;
                resolve(result);
            };
            cancelPending = () => finish({ ok: false, message: 'Navigation cancelled' });
            routeChangedPending = () => finish({ ok: false, message: 'Conversation changed' });
            window.addEventListener('popstate', routeChanged);
            window.addEventListener('hashchange', routeChanged);
            const scheduleCheck = (delayMs: number) => {
                if (settled || settleTimerId !== 0) return;
                settleTimerId = window.setTimeout(() => {
                    settleTimerId = 0;
                    check();
                }, Math.max(0, delayMs));
            };
            const seekWithoutSlot = (currentTarget: ChatGPTNavigationRound): boolean => {
                const root = adapter.getConversationScrollRoot?.();
                if (!root) return false;
                const cursor = readNavigationCursor(readRounds(), root);
                if (!cursor) return false;
                const relation = getNavigationRelation(currentTarget.position, cursor.position);
                if (relation === 0) return false;
                if (seekRelation !== null && seekRelation !== relation) {
                    seekStep = Math.max(MIN_SEEK_STEP_PX, seekStep / 2);
                }
                seekRelation = relation;
                if (seekStep <= 0) seekStep = getSeekStep(root, options.seekStepPx);
                if (seekSteps >= MAX_SEEK_STEPS || isAtSeekBoundary(root, relation)) {
                    finish({ ok: false, message: 'Conversation navigation seek timeout' });
                    return true;
                }

                const moved = scrollRootBy(root, relation * seekStep);
                seekSteps += 1;
                if (!moved) {
                    seekStalls += 1;
                    if (seekStalls >= MAX_SEEK_STALLS) {
                        finish({ ok: false, message: 'Conversation navigation seek stalled' });
                        return true;
                    }
                } else {
                    seekStalls = 0;
                }
                invalidateChatGPTDomRoundSnapshot(adapter);
                surface.refreshSurface();
                scheduleCheck(SEEK_SETTLE_DELAY_MS);
                return true;
            };
            const check = () => {
                if (checking) {
                    checkAgain = true;
                    return;
                }
                checking = true;
                try {
                if (abortedByUser || options.signal?.aborted) {
                    finish({ ok: false, message: 'Navigation cancelled' });
                    return;
                }
                if (conversationBoundaryChanged()) {
                    finish({ ok: false, message: 'Conversation changed' });
                    return;
                }
                const currentTarget = resolveChatGPTCanonicalTarget(surface, exactTarget);
                if (!currentTarget) return;
                const currentAnchor = currentTarget.materialization?.jumpAnchorElement;
                if (currentAnchor instanceof HTMLElement && currentAnchor.isConnected) {
                    finish({ ok: true, anchor: currentAnchor, round: currentTarget });
                    return;
                }
                if (coarseSlot?.isConnected) return;
                coarseSlot = null;
                const targetSlot = resolveCanonicalHostSlot(adapter, readRounds(), currentTarget);
                if (targetSlot && typeof targetSlot.scrollIntoView === 'function') {
                    coarseSlot = targetSlot;
                    targetSlot.scrollIntoView({ behavior: 'auto', block: 'start' });
                    // The host may hydrate synchronously inside scrollIntoView.
                    // Invalidate the existing discovery snapshot once so the
                    // immediate verification observes that replacement without
                    // introducing a polling loop.
                    invalidateChatGPTDomRoundSnapshot(adapter);
                    surface.refreshSurface();
                    scheduleCheck(0);
                    return;
                }
                seekWithoutSlot(currentTarget);
                } finally {
                    checking = false;
                    if (checkAgain && !settled) {
                        checkAgain = false;
                        scheduleCheck(0);
                    }
                }
            };
            let subscribing = true;
            unsubscribe = surface.subscribeFrame(() => {
                if (!subscribing) check();
            });
            subscribing = false;
            timeoutId = window.setTimeout(() => finish({ ok: false, message: 'Conversation hydration timeout' }), timeoutMs);
            options.signal?.addEventListener('abort', () => finish({ ok: false, message: 'Navigation cancelled' }), { once: true });
            check();
        });
    } finally {
        for (const eventName of userAbortEvents) {
            document.removeEventListener(eventName, abortForUser, { capture: true });
        }
    }

}

function readNavigationRounds(surface: ConversationSurfacePortV1): ChatGPTNavigationRound[] {
    return surface.readFrame().obtainedTurns.map(toNavigationRound);
}

function toNavigationRound(entry: ConversationObtainedSurfaceTurnV1): ChatGPTNavigationRound {
    const { turn, materialization } = entry;
    return {
        position: turn.ordinal,
        messageId: turn.identity.assistantMessageId,
        roundId: turn.identity.turnId,
        userMessageId: turn.identity.userMessageId,
        assistantMessageId: turn.identity.assistantMessageId,
        materialization,
    };
}
