import type { SiteAdapter } from '../adapters/base';

export type ChatGPTDomRoundRef = {
    position: number;
    id: string;
    userRootEl: HTMLElement;
    userMessageEl: HTMLElement;
    userPromptText: string | null;
    userPromptQuality: 'real' | 'fallback';
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

const ROLE_SELECTOR = '[data-message-author-role]';
const USER_ROLE_SELECTOR = '[data-message-author-role="user"]';
const TURN_ROOT_SELECTOR = '[data-turn-id-container], [data-testid^="conversation-turn-"], section[data-turn], article[data-turn], [data-turn]';
const TESTID_TURN_WRAPPER_SELECTOR = '[data-testid^="conversation-turn-"][data-turn]';
const FALLBACK_TURN_WRAPPER_SELECTOR = 'article[data-turn], section[data-turn]';
const LEGACY_TURN_CONTAINER_SELECTOR = '[data-turn-id-container]';

type StructuredTurn = {
    id?: string | null;
    role?: string | null;
    author?: { role?: string | null } | null;
    messages?: unknown[];
};

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePromptText(text: string): string {
    return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
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

function getTurnRole(turn: StructuredTurn | null): 'user' | 'assistant' | null {
    const role = readString(readRecord(turn?.author), 'role') ?? (typeof turn?.role === 'string' ? turn.role : null);
    if (role === 'user' || role === 'assistant') return role;
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = readRecord(messages[index]);
        const messageRole = readString(readRecord(message?.author) ?? message, 'role');
        if (messageRole === 'user' || messageRole === 'assistant') return messageRole;
    }
    return null;
}

function getReactRootCandidate(element: HTMLElement): any {
    for (const key of Object.keys(element)) {
        if (!key.startsWith('__reactFiber$') && !key.startsWith('__reactProps$')) continue;
        const value = (element as unknown as Record<string, unknown>)[key];
        if (value) return value;
    }
    return null;
}

function findStructuredTurnData(element: HTMLElement): StructuredTurn | null {
    let fiber = getReactRootCandidate(element);
    let depth = 0;

    while (fiber && depth < 12) {
        const candidates = [
            fiber.pendingProps,
            fiber.memoizedProps,
            fiber.pendingProps?.value,
            fiber.memoizedProps?.value,
        ].filter(Boolean) as Array<Record<string, unknown>>;

        for (const candidate of candidates) {
            const turn =
                (candidate.turn as StructuredTurn | undefined)
                ?? (candidate.currentTurn as StructuredTurn | undefined)
                ?? (candidate.prevTurn as StructuredTurn | undefined)
                ?? null;
            if (turn && getTurnRole(turn)) return turn;
        }

        fiber = fiber.return ?? null;
        depth += 1;
    }

    return null;
}

function isStructuredTextContent(record: Record<string, unknown>): boolean {
    const contentType = readString(record, 'content_type');
    return !contentType || contentType === 'text' || contentType === 'multimodal_text';
}

function normalizeStructuredText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        return value.map((item) => normalizeStructuredText(item)).filter(Boolean).join('\n\n').trim();
    }

    const record = readRecord(value);
    if (!record || !isStructuredTextContent(record)) return '';
    if (Array.isArray(record.parts)) {
        const combined = record.parts
            .map((part) => typeof part === 'string' ? part : '')
            .filter(Boolean)
            .join('\n')
            .trim();
        if (combined) return combined;
    }
    return readString(record, 'text') ?? readString(record, 'content') ?? readString(record, 'markdown') ?? '';
}

function getStructuredTurnText(turn: StructuredTurn | null, expectedRole: 'user' | 'assistant'): string {
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    const texts = messages
        .filter((message) => {
            const record = readRecord(message);
            if (!record) return false;
            const role = readString(readRecord(record.author) ?? record, 'role') ?? getTurnRole(turn);
            if (role !== expectedRole) return false;
            const content = readRecord(record.content);
            return !content || isStructuredTextContent(content);
        })
        .map((message) => normalizeStructuredText(readRecord(message)?.content))
        .filter(Boolean);
    return texts[texts.length - 1] ?? '';
}

function getStructuredTurnMessageId(turn: StructuredTurn | null, expectedRole: 'user' | 'assistant'): string | null {
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const record = readRecord(messages[index]);
        if (!record) continue;
        const role = readString(readRecord(record.author) ?? record, 'role') ?? getTurnRole(turn);
        if (role !== expectedRole) continue;
        const id = readString(record, 'id');
        if (id) return id;
    }
    return typeof turn?.id === 'string' && turn.id.trim() ? turn.id.trim() : null;
}

function getTurnRootFromContainer(container: HTMLElement, role: 'user' | 'assistant'): HTMLElement | null {
    const selector = `section[data-turn="${role}"], article[data-turn="${role}"], [data-turn="${role}"]`;
    const turnRoot = container.matches(selector) ? container : container.querySelector(selector);
    return turnRoot instanceof HTMLElement ? turnRoot : null;
}

function extractPromptTextFromElement(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button, [role="button"], input, textarea, select, [data-aimd-role], [aria-label*="message actions" i]').forEach((node) => node.remove());
    return normalizePromptText((clone.textContent || '').trim());
}

function extractUserPrompt(userRootEl: HTMLElement, userMessageEl: HTMLElement): string | null {
    const bubble =
        userRootEl.querySelector(`${USER_ROLE_SELECTOR} .whitespace-pre-wrap`) as HTMLElement | null
        || userRootEl.querySelector(USER_ROLE_SELECTOR) as HTMLElement | null
        || userRootEl.querySelector('.whitespace-pre-wrap') as HTMLElement | null
        || userMessageEl;
    const normalized = extractPromptTextFromElement(bubble) || extractPromptTextFromElement(userRootEl);
    return normalized || null;
}

function buildPrompt(raw: string | null | undefined, position: number): { text: string; quality: 'real' | 'fallback' } {
    const normalized = normalizePromptText(raw ?? '');
    if (normalized) return { text: normalized, quality: 'real' };
    return { text: `Message ${position}`, quality: 'fallback' };
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
        prompt: string | null;
    } | null = null;

    for (const turnWrapper of turnWrappers) {
        const role = turnWrapper.getAttribute('data-turn');
        if (role === 'user') {
            const userMessage = findUserMessage(turnWrapper);
            pendingUser = {
                root: turnWrapper,
                message: userMessage,
                prompt: extractUserPrompt(turnWrapper, userMessage),
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
        const prompt = buildPrompt(pendingUser.prompt, rounds.length + 1);

        rounds.push({
            position: rounds.length + 1,
            id,
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            userPromptText: prompt.text,
            userPromptQuality: prompt.quality,
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
        prompt: string | null;
    } | null = null;

    for (const container of containers) {
        const structuredTurn = findStructuredTurnData(container);
        const structuredRole = getTurnRole(structuredTurn);
        const userRootEl = getTurnRootFromContainer(container, 'user');
        const assistantRootEl = getTurnRootFromContainer(container, 'assistant');

        if ((userRootEl && !assistantRootEl) || structuredRole === 'user') {
            const userRoot = userRootEl ?? container;
            const userMessage = findUserMessage(userRoot);
            pendingUser = {
                container,
                root: userRoot,
                message: userMessage,
                prompt: extractUserPrompt(userRoot, userMessage) || getStructuredTurnText(structuredTurn, 'user') || null,
            };
            continue;
        }

        if (!assistantRootEl && structuredRole !== 'assistant') continue;

        if (!pendingUser) {
            const previousRound = rounds[rounds.length - 1];
            if (previousRound) pushUnique(previousRound.groupEls, container);
            continue;
        }

        const resolvedAssistantRoot = assistantRootEl ?? container;
        const realAssistantMessageEl = findAssistantMessage(adapter, resolvedAssistantRoot);
        const hasRealAssistantMessage = realAssistantMessageEl instanceof HTMLElement;
        if (hasRealAssistantMessage && !isVirtualizationEligible(adapter, realAssistantMessageEl)) {
            continue;
        }

        const id = (realAssistantMessageEl ? adapter.getMessageId(realAssistantMessageEl) : null)
            || getStructuredTurnMessageId(structuredTurn, 'assistant')
            || resolvedAssistantRoot.getAttribute('data-turn-id')
            || resolvedAssistantRoot.getAttribute('data-testid')
            || resolvedAssistantRoot.id
            || `chatgpt-legacy-round-${rounds.length + 1}`;
        const assistantMessageEl = hasRealAssistantMessage
            ? realAssistantMessageEl
            : createEmptyChatGPTAssistantMessageFallback(id);
        const groupEls: HTMLElement[] = [];
        pushUnique(groupEls, pendingUser.container);
        pushUnique(groupEls, container);
        const prompt = buildPrompt(pendingUser.prompt, rounds.length + 1);

        rounds.push({
            position: rounds.length + 1,
            id,
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            userPromptText: prompt.text,
            userPromptQuality: prompt.quality,
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

export function collectChatGPTDomRoundRefs(adapter: SiteAdapter): ChatGPTDomRoundRef[] {
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
        prompt: string | null;
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
                prompt: extractUserPrompt(roleRoot, roleNode),
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
        const prompt = buildPrompt(pendingUser.prompt, rounds.length + 1);

        rounds.push({
            position: rounds.length + 1,
            id,
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            userPromptText: prompt.text,
            userPromptQuality: prompt.quality,
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

export function collectChatGPTDomRoundAnchors(adapter: SiteAdapter): Array<{ position: number; anchorEl: HTMLElement }> {
    return collectChatGPTDomRoundRefs(adapter).map((round) => ({
        position: round.position,
        anchorEl: round.anchorEl,
    }));
}
