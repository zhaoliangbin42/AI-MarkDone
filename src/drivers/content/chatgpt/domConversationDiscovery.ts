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
    source: 'turn-wrapper' | 'legacy-container' | 'role-scan';
};

export type ChatGPTDomRoundIdentity = {
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    assistantTurnId: string | null;
};

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

function rootContains(root: ParentNode, node: Node): boolean {
    return root === document || (root instanceof Node && root.contains(node));
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

function isVirtualizationEligible(adapter: SiteAdapter, messageEl: HTMLElement): boolean {
    return adapter.isVirtualizationEligibleMessage?.(messageEl) ?? true;
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
            if (previousRound) pushUnique(previousRound.groupEls, turnWrapper);
            continue;
        }

        const realAssistantMessageEl = findAssistantMessage(adapter, turnWrapper);
        const hasRealAssistantMessage = realAssistantMessageEl instanceof HTMLElement;
        if (hasRealAssistantMessage && !isVirtualizationEligible(adapter, realAssistantMessageEl)) {
            continue;
        }

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
            if (previousRound) pushUnique(previousRound.groupEls, container);
            continue;
        }

        const resolvedAssistantRoot = assistantRootEl;
        const realAssistantMessageEl = findAssistantMessage(adapter, resolvedAssistantRoot);
        const hasRealAssistantMessage = realAssistantMessageEl instanceof HTMLElement;
        if (hasRealAssistantMessage && !isVirtualizationEligible(adapter, realAssistantMessageEl)) {
            continue;
        }

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
            if (previousRound) pushUnique(previousRound.groupEls, roleRoot);
            continue;
        }

        const assistantMessageEl = findAssistantMessage(adapter, roleRoot) ?? roleNode;
        if (!isVirtualizationEligible(adapter, assistantMessageEl)) continue;

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

function getChatGPTPageIndex(adapter: SiteAdapter): ChatGPTPageIndex {
    const existing = pageIndexByAdapter.get(adapter);
    if (existing) return existing;

    const index = new ChatGPTPageIndex({
        resolveRoot: () => adapter.getObserverContainer() ?? document,
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
