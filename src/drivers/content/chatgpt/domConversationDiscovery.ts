import type { SiteAdapter } from '../adapters/base';
import { ChatGPTPageIndex } from './ChatGPTPageIndex';

export type ChatGPTDomRoundRef = {
    id: string;
    identity: ChatGPTDomRoundIdentity;
    userRootEl: HTMLElement;
    userMessageEl: HTMLElement;
    anchorEl: HTMLElement;
    jumpAnchorEl: HTMLElement;
    assistantRootEl: HTMLElement;
    assistantMessageEl: HTMLElement;
    assistantContentRootEl: HTMLElement | null;
    groupEls: HTMLElement[];
    assistantIndex: number;
    isStreaming: boolean;
    source: 'turn-wrapper' | 'legacy-container' | 'role-scan' | 'assistant-only';
};

export type ChatGPTDomRoundIdentity = {
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    assistantTurnId: string | null;
};

export type ChatGPTResolvedDomTurnIdentity = Readonly<{
    turnId: string;
    userMessageId: string;
    assistantMessageId: string;
}>;

/** Resolve the one typed identity shared by host capture and materialization. */
export function resolveChatGPTDomRoundIdentity(
    round: ChatGPTDomRoundRef,
): ChatGPTResolvedDomTurnIdentity | null {
    const userTurnId = round.identity.roundId?.trim() ?? '';
    const assistantTurnId = round.identity.assistantTurnId?.trim() ?? '';
    const userMessageId = round.identity.userMessageId?.trim() ?? '';
    const assistantMessageId = round.identity.assistantMessageId?.trim() ?? '';
    if (!userMessageId || !assistantMessageId) return null;
    const turnId = userTurnId || assistantTurnId
        || `chatgpt-turn:${userMessageId}:${assistantMessageId}`;
    return turnId ? Object.freeze({ turnId, userMessageId, assistantMessageId }) : null;
}

/**
 * Resolve the identity available for a mounted assistant surface.
 *
 * Virtualized ChatGPT windows can keep the assistant turn mounted while its
 * preceding user turn is temporarily detached. That surface is sufficient
 * for an already-cached message's toolbar, geometry, and materialization, but
 * it is intentionally not sufficient to create a new semantic content turn.
 */
export type ChatGPTDomRoundProjectionIdentity = Readonly<{
    turnId: string;
    userMessageId: string | null;
    assistantMessageId: string;
}>;

export function resolveChatGPTDomRoundProjectionIdentity(
    round: ChatGPTDomRoundRef,
): ChatGPTDomRoundProjectionIdentity | null {
    const assistantMessageId = round.identity.assistantMessageId?.trim()
        || round.identity.assistantTurnId?.trim()
        || '';
    if (!assistantMessageId) return null;
    const userMessageId = round.identity.userMessageId?.trim() || null;
    const turnId = round.identity.roundId?.trim()
        || round.identity.assistantTurnId?.trim()
        || `chatgpt-turn:${assistantMessageId}`;
    return Object.freeze({ turnId, userMessageId, assistantMessageId });
}

const ROLE_SELECTOR = '[data-message-author-role]';
const USER_ROLE_SELECTOR = '[data-message-author-role="user"]';
const TURN_ROOT_SELECTOR = '[data-turn-id-container], [data-testid^="conversation-turn-"], section[data-turn], article[data-turn], [data-turn]';
const TESTID_TURN_WRAPPER_SELECTOR = '[data-testid^="conversation-turn-"][data-turn]';
const FALLBACK_TURN_WRAPPER_SELECTOR = 'article[data-turn], section[data-turn]';
const LEGACY_TURN_CONTAINER_SELECTOR = '[data-turn-id-container]';

function readElementId(element: HTMLElement | null | undefined, attribute: string): string | null {
    const value = element?.getAttribute(attribute)?.trim();
    return value || null;
}

function readRoundId(...elements: Array<HTMLElement | null | undefined>): string | null {
    for (const element of elements) {
        const id = readElementId(element, 'data-turn-id');
        if (id) return id;
    }
    return null;
}

function readMessageId(...elements: Array<HTMLElement | null | undefined>): string | null {
    for (const element of elements) {
        const id = readElementId(element, 'data-message-id');
        if (id) return id;
    }
    return null;
}

function getDiscoveryRoot(adapter: SiteAdapter): ParentNode {
    const observerRoot = adapter.getObserverContainer();
    const scopedMain = observerRoot?.matches?.('main')
        ? observerRoot
        : observerRoot?.querySelector?.('main');
    if (scopedMain instanceof HTMLElement) return scopedMain;
    const main = document.querySelector('main');
    if (main instanceof HTMLElement) return main;
    return observerRoot ?? document;
}

function listRoleNodes(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll(ROLE_SELECTOR)).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
}

function listTurnWrappers(root: ParentNode): HTMLElement[] {
    const testIdTurns = Array.from(root.querySelectorAll(TESTID_TURN_WRAPPER_SELECTOR)).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && rootContains(root, node),
    );
    if (testIdTurns.length > 0) return filterTopLevelTurns(testIdTurns);

    const fallbackTurns = Array.from(root.querySelectorAll(FALLBACK_TURN_WRAPPER_SELECTOR)).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && rootContains(root, node),
    );
    return filterTopLevelTurns(fallbackTurns);
}

function listLegacyTurnContainers(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll(LEGACY_TURN_CONTAINER_SELECTOR)).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && rootContains(root, node),
    );
}

export function collectChatGPTDomTurnSlots(adapter: SiteAdapter): HTMLElement[] {
    const root = getDiscoveryRoot(adapter);
    const containers = listLegacyTurnContainers(root);
    const groups = new Map<HTMLElement, HTMLElement[]>();
    for (const container of containers) {
        const parent = container.parentElement;
        if (!parent || !rootContains(root, parent)) continue;
        const group = groups.get(parent);
        if (group) group.push(container);
        else groups.set(parent, [container]);
    }
    return Array.from(groups.values()).sort((left, right) => right.length - left.length)[0] ?? [];
}

function rootContains(root: ParentNode, node: Node): boolean {
    return root === document || (root instanceof Node && root.contains(node));
}

function findPersistentTurnSlot(element: HTMLElement): HTMLElement | null {
    let nearestMarkedAncestor: HTMLElement | null = null;
    let current: HTMLElement | null = element;
    while (current) {
        if (current.matches(LEGACY_TURN_CONTAINER_SELECTOR)) {
            nearestMarkedAncestor ??= current;
            const previous = current.previousElementSibling;
            const next = current.nextElementSibling;
            if (
                previous?.matches(LEGACY_TURN_CONTAINER_SELECTOR)
                || next?.matches(LEGACY_TURN_CONTAINER_SELECTOR)
            ) {
                return current;
            }
        }
        current = current.parentElement;
    }
    return nearestMarkedAncestor;
}

function areAdjacentConversationItems(previous: HTMLElement, next: HTMLElement): boolean {
    const getListItem = (element: HTMLElement): { parent: HTMLElement; index: number } | null => {
        const persistentSlot = findPersistentTurnSlot(element);
        if (persistentSlot?.parentElement) {
            return {
                parent: persistentSlot.parentElement,
                index: Array.from(persistentSlot.parentElement.children).indexOf(persistentSlot),
            };
        }
        let current = element;
        while (current.parentElement && current.parentElement.children.length === 1) {
            current = current.parentElement;
        }
        const parent = current.parentElement;
        if (!parent) return null;
        return { parent, index: Array.from(parent.children).indexOf(current) };
    };
    const previousItem = getListItem(previous);
    const nextItem = getListItem(next);
    return Boolean(
        previousItem
        && nextItem
        && previousItem.parent === nextItem.parent
        && nextItem.index === previousItem.index + 1,
    );
}

function getTurnRoot(roleNode: HTMLElement, root: ParentNode): HTMLElement {
    const candidate = roleNode.closest(TURN_ROOT_SELECTOR);
    if (candidate instanceof HTMLElement && rootContains(root, candidate)) {
        return candidate;
    }
    return roleNode;
}

function filterTopLevelTurns(turns: HTMLElement[]): HTMLElement[] {
    return turns.filter((turn) => {
        const parent = turn.parentElement;
        if (!parent) return true;
        const nestedTurn = parent.closest(TESTID_TURN_WRAPPER_SELECTOR) ?? parent.closest(FALLBACK_TURN_WRAPPER_SELECTOR);
        return nestedTurn === null;
    });
}

function findAssistantMessage(adapter: SiteAdapter, assistantRootEl: HTMLElement): HTMLElement | null {
    try {
        if (assistantRootEl.matches(adapter.getMessageSelector())) return assistantRootEl;
        const message = assistantRootEl.querySelector(adapter.getMessageSelector());
        if (message instanceof HTMLElement) return message;
    } catch {
        // Invalid or drifting platform selector should not prevent role-backed discovery.
    }
    return null;
}

function findAssistantContentRoot(adapter: SiteAdapter, assistantMessageEl: HTMLElement | null): HTMLElement | null {
    if (!assistantMessageEl) return null;
    const selector = adapter.getMessageContentSelector();
    if (!selector) return assistantMessageEl;
    try {
        const content = assistantMessageEl.matches(selector)
            ? assistantMessageEl
            : assistantMessageEl.querySelector(selector);
        return content instanceof HTMLElement ? content : null;
    } catch {
        return null;
    }
}

export function createEmptyChatGPTAssistantMessageFallback(id: string | null): HTMLElement {
    const fallback = document.createElement('div');
    fallback.setAttribute('data-aimd-empty-assistant-message', 'true');
    if (id) fallback.setAttribute('data-message-id', id);
    return fallback;
}

function findUserMessage(userRootEl: HTMLElement): HTMLElement {
    const message = userRootEl.querySelector(USER_ROLE_SELECTOR);
    return message instanceof HTMLElement ? message : userRootEl;
}

function getTurnRootFromContainer(container: HTMLElement, role: 'user' | 'assistant'): HTMLElement | null {
    const selector = `section[data-turn="${role}"], article[data-turn="${role}"], [data-turn="${role}"]`;
    const turnRoot = container.matches(selector) ? container : container.querySelector(selector);
    return turnRoot instanceof HTMLElement ? turnRoot : null;
}

function pushUnique(nodes: HTMLElement[], node: HTMLElement | null | undefined): void {
    if (node && !nodes.includes(node)) nodes.push(node);
}

function createAssistantOnlyRoundRef(
    adapter: SiteAdapter,
    assistantRootEl: HTMLElement,
    assistantIndex: number,
): ChatGPTDomRoundRef {
    const realAssistantMessageEl = findAssistantMessage(adapter, assistantRootEl);
    const assistantMessageId = readMessageId(realAssistantMessageEl, assistantRootEl);
    const assistantTurnId = readRoundId(assistantRootEl);
    const id = assistantMessageId
        || assistantTurnId
        || readElementId(assistantRootEl, 'data-turn-id-container')
        || assistantRootEl.getAttribute('data-testid')
        || `chatgpt-assistant-round-${assistantIndex + 1}`;
    const assistantMessageEl = realAssistantMessageEl
        ?? createEmptyChatGPTAssistantMessageFallback(id);
    return {
        id,
        identity: {
            roundId: null,
            userMessageId: null,
            assistantMessageId,
            assistantTurnId,
        },
        // Keep the public ref shape stable for legacy adapter callers. The
        // source marker and one-element group make the missing user side
        // explicit to the canonical materialization layer.
        userRootEl: assistantRootEl,
        userMessageEl: assistantMessageEl,
        anchorEl: assistantRootEl,
        jumpAnchorEl: assistantRootEl,
        assistantRootEl,
        assistantMessageEl,
        assistantContentRootEl: findAssistantContentRoot(adapter, realAssistantMessageEl),
        groupEls: [assistantRootEl],
        assistantIndex,
        isStreaming: realAssistantMessageEl instanceof HTMLElement
            && adapter.isStreamingMessage(realAssistantMessageEl),
        source: 'assistant-only',
    };
}

function collectTurnWrapperRoundRefs(adapter: SiteAdapter, root: ParentNode): ChatGPTDomRoundRef[] {
    const turnWrappers = listTurnWrappers(root);
    const rounds: ChatGPTDomRoundRef[] = [];
    let pendingUser: {
        root: HTMLElement;
        message: HTMLElement;
    } | null = null;

    for (const turnWrapper of turnWrappers) {
        const role = turnWrapper.getAttribute('data-turn');
        if (role === 'user') {
            const userMessage = findUserMessage(turnWrapper);
            pendingUser = {
                root: turnWrapper,
                message: userMessage,
            };
            continue;
        }

        if (role !== 'assistant') continue;

        if (!pendingUser) {
            const previousRound = rounds[rounds.length - 1];
            const previousGroupEl = previousRound?.groupEls[previousRound.groupEls.length - 1];
            if (previousGroupEl && areAdjacentConversationItems(previousGroupEl, turnWrapper)) {
                pushUnique(previousRound!.groupEls, turnWrapper);
                continue;
            }
            rounds.push(createAssistantOnlyRoundRef(adapter, turnWrapper, rounds.length));
            continue;
        }
        if (!areAdjacentConversationItems(pendingUser.root, turnWrapper)) {
            pendingUser = null;
            rounds.push(createAssistantOnlyRoundRef(adapter, turnWrapper, rounds.length));
            continue;
        }

        const realAssistantMessageEl = findAssistantMessage(adapter, turnWrapper);
        const hasRealAssistantMessage = realAssistantMessageEl instanceof HTMLElement;

        const groupEls: HTMLElement[] = [];
        pushUnique(groupEls, pendingUser.root);
        pushUnique(groupEls, turnWrapper);
        const id = (realAssistantMessageEl ? adapter.getMessageId(realAssistantMessageEl) : null)
            || realAssistantMessageEl?.getAttribute('data-message-id')
            || turnWrapper.getAttribute('data-turn-id')
            || turnWrapper.id
            || turnWrapper.getAttribute('data-testid')
            || `chatgpt-turn-round-${rounds.length + 1}`;
        const assistantMessageEl = hasRealAssistantMessage
            ? realAssistantMessageEl
            : createEmptyChatGPTAssistantMessageFallback(id);
        rounds.push({
            id,
            identity: {
                roundId: readRoundId(pendingUser.root),
                userMessageId: readMessageId(pendingUser.message, pendingUser.root),
                assistantMessageId: readMessageId(realAssistantMessageEl, turnWrapper),
                assistantTurnId: readRoundId(turnWrapper),
            },
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            anchorEl: pendingUser.root,
            jumpAnchorEl: pendingUser.root,
            assistantRootEl: turnWrapper,
            assistantMessageEl,
            assistantContentRootEl: findAssistantContentRoot(adapter, realAssistantMessageEl),
            groupEls,
            assistantIndex: rounds.length,
            isStreaming: hasRealAssistantMessage && adapter.isStreamingMessage(assistantMessageEl),
            source: 'turn-wrapper',
        });
        pendingUser = null;
    }

    return rounds;
}

function collectLegacyContainerRoundRefs(adapter: SiteAdapter, root: ParentNode): ChatGPTDomRoundRef[] {
    const containers = listLegacyTurnContainers(root);
    const rounds: ChatGPTDomRoundRef[] = [];
    let pendingUser: {
        container: HTMLElement;
        root: HTMLElement;
        message: HTMLElement;
    } | null = null;

    for (const container of containers) {
        const userRootEl = getTurnRootFromContainer(container, 'user');
        const assistantRootEl = getTurnRootFromContainer(container, 'assistant');

        if (userRootEl && !assistantRootEl) {
            const userRoot = userRootEl;
            const userMessage = findUserMessage(userRoot);
            pendingUser = {
                container,
                root: userRoot,
                message: userMessage,
            };
            continue;
        }

        if (!assistantRootEl) continue;

        if (!pendingUser) {
            const previousRound = rounds[rounds.length - 1];
            const previousGroupEl = previousRound?.groupEls[previousRound.groupEls.length - 1];
            if (previousGroupEl && areAdjacentConversationItems(previousGroupEl, container)) {
                pushUnique(previousRound!.groupEls, container);
                continue;
            }
            rounds.push(createAssistantOnlyRoundRef(adapter, assistantRootEl, rounds.length));
            continue;
        }
        if (!areAdjacentConversationItems(pendingUser.container, container)) {
            pendingUser = null;
            rounds.push(createAssistantOnlyRoundRef(adapter, assistantRootEl, rounds.length));
            continue;
        }

        const resolvedAssistantRoot = assistantRootEl;
        const realAssistantMessageEl = findAssistantMessage(adapter, resolvedAssistantRoot);
        const hasRealAssistantMessage = realAssistantMessageEl instanceof HTMLElement;

        const roundId = readRoundId(pendingUser.root, pendingUser.container);
        const userMessageId = readMessageId(pendingUser.message, pendingUser.root, pendingUser.container);
        const assistantMessageId = readMessageId(realAssistantMessageEl, resolvedAssistantRoot);
        const assistantTurnId = readRoundId(resolvedAssistantRoot, container);
        const id = assistantMessageId || assistantTurnId || roundId || userMessageId;
        if (!id) continue;
        const assistantMessageEl = hasRealAssistantMessage
            ? realAssistantMessageEl
            : createEmptyChatGPTAssistantMessageFallback(id);
        const groupEls: HTMLElement[] = [];
        pushUnique(groupEls, pendingUser.container);
        pushUnique(groupEls, container);
        rounds.push({
            id,
            identity: {
                roundId,
                userMessageId,
                assistantMessageId,
                assistantTurnId,
            },
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            anchorEl: pendingUser.container,
            jumpAnchorEl: pendingUser.container,
            assistantRootEl: resolvedAssistantRoot,
            assistantMessageEl,
            assistantContentRootEl: findAssistantContentRoot(adapter, realAssistantMessageEl),
            groupEls,
            assistantIndex: rounds.length,
            isStreaming: hasRealAssistantMessage && adapter.isStreamingMessage(assistantMessageEl),
            source: 'legacy-container',
        });
        pendingUser = null;
    }

    return rounds;
}

function discoverChatGPTDomRoundRefs(adapter: SiteAdapter): ChatGPTDomRoundRef[] {
    const root = getDiscoveryRoot(adapter);
    const turnWrapperRounds = collectTurnWrapperRoundRefs(adapter, root);
    if (turnWrapperRounds.length > 0) return turnWrapperRounds;
    const legacyContainerRounds = collectLegacyContainerRoundRefs(adapter, root);
    if (legacyContainerRounds.length > 0) return legacyContainerRounds;

    const roleNodes = listRoleNodes(root);
    const seenRoleRoots = new Set<HTMLElement>();
    const rounds: ChatGPTDomRoundRef[] = [];
    let pendingUser: {
        root: HTMLElement;
        message: HTMLElement;
        paired: boolean;
    } | null = null;

    for (const roleNode of roleNodes) {
        const role = roleNode.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') continue;

        const roleRoot = getTurnRoot(roleNode, root);
        if (seenRoleRoots.has(roleRoot)) continue;
        seenRoleRoots.add(roleRoot);

        if (role === 'user') {
            pendingUser = {
                root: roleRoot,
                message: roleNode,
                paired: false,
            };
            continue;
        }

        if (!pendingUser || pendingUser.paired) {
            const previousRound = rounds[rounds.length - 1];
            const previousGroupEl = previousRound?.groupEls[previousRound.groupEls.length - 1];
            if (previousGroupEl && areAdjacentConversationItems(previousGroupEl, roleRoot)) {
                pushUnique(previousRound!.groupEls, roleRoot);
                continue;
            }
            rounds.push(createAssistantOnlyRoundRef(adapter, roleRoot, rounds.length));
            continue;
        }
        if (!areAdjacentConversationItems(pendingUser.root, roleRoot)) {
            pendingUser = null;
            rounds.push(createAssistantOnlyRoundRef(adapter, roleRoot, rounds.length));
            continue;
        }

        const assistantMessageEl = findAssistantMessage(adapter, roleRoot) ?? roleNode;

        const groupEls: HTMLElement[] = [];
        pushUnique(groupEls, pendingUser.root);
        pushUnique(groupEls, roleRoot);
        const id = adapter.getMessageId(assistantMessageEl)
            || assistantMessageEl.getAttribute('data-message-id')
            || roleRoot.getAttribute('data-turn-id')
            || roleRoot.getAttribute('data-testid')
            || `chatgpt-role-round-${rounds.length + 1}`;
        rounds.push({
            id,
            identity: {
                roundId: readRoundId(pendingUser.root),
                userMessageId: readMessageId(pendingUser.message, pendingUser.root),
                assistantMessageId: readMessageId(assistantMessageEl, roleRoot),
                assistantTurnId: readRoundId(roleRoot),
            },
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            anchorEl: pendingUser.root,
            jumpAnchorEl: pendingUser.root,
            assistantRootEl: roleRoot,
            assistantMessageEl,
            assistantContentRootEl: findAssistantContentRoot(adapter, assistantMessageEl),
            groupEls,
            assistantIndex: rounds.length,
            isStreaming: adapter.isStreamingMessage(assistantMessageEl),
            source: 'role-scan',
        });
        pendingUser.paired = true;
    }

    return rounds;
}

const pageIndexByAdapter = new WeakMap<SiteAdapter, ChatGPTPageIndex>();

export function getChatGPTPageIndex(adapter: SiteAdapter): ChatGPTPageIndex {
    const existing = pageIndexByAdapter.get(adapter);
    if (existing) return existing;

    const index = new ChatGPTPageIndex({
        // Observe the stable document element so body/main replacement is a
        // signal instead of a missed mutation on a detached host root.
        resolveRoot: () => document.documentElement ?? document,
        resolveSurfaceRoot: () => getDiscoveryRoot(adapter),
        discover: () => discoverChatGPTDomRoundRefs(adapter),
    });
    pageIndexByAdapter.set(adapter, index);
    return index;
}

export function collectChatGPTDomRoundRefs(adapter: SiteAdapter): ChatGPTDomRoundRef[] {
    return getChatGPTPageIndex(adapter).getSnapshot();
}

export function subscribeChatGPTDomRoundChanges(adapter: SiteAdapter, listener: () => void): () => void {
    return getChatGPTPageIndex(adapter).subscribe(listener);
}

export function invalidateChatGPTDomRoundSnapshot(adapter: SiteAdapter): void {
    getChatGPTPageIndex(adapter).invalidate();
}

export function disposeChatGPTPageIndex(adapter: SiteAdapter): void {
    const index = pageIndexByAdapter.get(adapter);
    index?.dispose();
    pageIndexByAdapter.delete(adapter);
}

export function collectChatGPTDomRoundAnchors(adapter: SiteAdapter): Array<{ identity: ChatGPTDomRoundIdentity; anchorEl: HTMLElement }> {
    return collectChatGPTDomRoundRefs(adapter).map((round) => ({
        identity: round.identity,
        anchorEl: round.anchorEl,
    }));
}
