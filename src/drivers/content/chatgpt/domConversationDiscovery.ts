import type { SiteAdapter } from '../adapters/base';

export type ChatGPTDomRoundRef = {
    position: number;
    id: string;
    userRootEl: HTMLElement;
    userMessageEl: HTMLElement;
    userPromptText: string | null;
    anchorEl: HTMLElement;
    assistantRootEl: HTMLElement;
    assistantMessageEl: HTMLElement;
    groupEls: HTMLElement[];
    assistantIndex: number;
    isStreaming: boolean;
    source: 'role-turn';
};

const ROLE_SELECTOR = '[data-message-author-role]';
const USER_ROLE_SELECTOR = '[data-message-author-role="user"]';
const TURN_ROOT_SELECTOR = '[data-turn-id-container], [data-testid^="conversation-turn-"], section[data-turn], article[data-turn], [data-turn]';

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

function findAssistantMessage(adapter: SiteAdapter, assistantRootEl: HTMLElement, fallback: HTMLElement): HTMLElement {
    try {
        if (assistantRootEl.matches(adapter.getMessageSelector())) return assistantRootEl;
        const message = assistantRootEl.querySelector(adapter.getMessageSelector());
        if (message instanceof HTMLElement) return message;
    } catch {
        // Invalid or drifting platform selector should not prevent role-backed discovery.
    }
    return fallback;
}

function extractUserPrompt(userRootEl: HTMLElement, userMessageEl: HTMLElement): string | null {
    const bubble =
        userRootEl.querySelector(`${USER_ROLE_SELECTOR} .whitespace-pre-wrap`) as HTMLElement | null
        || userRootEl.querySelector(USER_ROLE_SELECTOR) as HTMLElement | null
        || userRootEl.querySelector('.whitespace-pre-wrap') as HTMLElement | null
        || userMessageEl;
    const normalized = normalizePromptText((bubble.textContent || userRootEl.textContent || '').trim());
    return normalized || null;
}

function pushUnique(nodes: HTMLElement[], node: HTMLElement | null | undefined): void {
    if (node && !nodes.includes(node)) nodes.push(node);
}

function isVirtualizationEligible(adapter: SiteAdapter, messageEl: HTMLElement): boolean {
    return adapter.isVirtualizationEligibleMessage?.(messageEl) ?? true;
}

export function collectChatGPTDomRoundRefs(adapter: SiteAdapter): ChatGPTDomRoundRef[] {
    const root = getDiscoveryRoot(adapter);
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

        const assistantMessageEl = findAssistantMessage(adapter, roleRoot, roleNode);
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
            position: rounds.length + 1,
            id,
            userRootEl: pendingUser.root,
            userMessageEl: pendingUser.message,
            userPromptText: pendingUser.prompt,
            anchorEl: pendingUser.root,
            assistantRootEl: roleRoot,
            assistantMessageEl,
            groupEls,
            assistantIndex: rounds.length,
            isStreaming: adapter.isStreamingMessage(assistantMessageEl),
            source: 'role-turn',
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
