import type { ChatGPTDomRoundRef } from './domConversationDiscovery';
import { logger } from '../../../core/logger';

type ChatGPTPageIndexOptions = {
    resolveRoot: () => ParentNode;
    discover: () => ChatGPTDomRoundRef[];
};

const ROUND_STRUCTURE_SELECTOR = [
    '[data-turn-id-container]',
    '[data-turn="user"]',
    '[data-turn="assistant"]',
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '[data-testid^="conversation-turn-"]',
].join(',');

const ROUND_IDENTITY_ATTRIBUTES = new Set([
    'data-message-id',
    'data-turn-id',
    'data-turn',
    'data-message-author-role',
]);

function getElementForOwnershipCheck(node: Node): Element | null {
    if (node.nodeType === 1) return node as Element;
    return node.parentElement;
}

function isExtensionOwnedNode(node: Node): boolean {
    return Boolean(getElementForOwnershipCheck(node)?.closest('[data-aimd-role]'));
}

function mutationAffectsHostPage(mutation: MutationRecord): boolean {
    if (mutation.type === 'attributes') {
        if (mutation.attributeName?.startsWith('data-aimd-')) return false;
        return !isExtensionOwnedNode(mutation.target);
    }

    if (mutation.type === 'characterData') {
        return !isExtensionOwnedNode(mutation.target);
    }

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.some((node) => !isExtensionOwnedNode(node));
}

function nodeMayContainRoundStructure(node: Node): boolean {
    if (node.nodeType !== 1 && node.nodeType !== 11) return false;
    const queryable = node as Element | DocumentFragment;
    if (node.nodeType === 1 && (queryable as Element).matches(ROUND_STRUCTURE_SELECTOR)) return true;
    return queryable.querySelector(ROUND_STRUCTURE_SELECTOR) !== null;
}

function mutationAffectsRoundStructure(mutation: MutationRecord): boolean {
    if (mutation.type === 'attributes') {
        return !isExtensionOwnedNode(mutation.target)
            && Boolean(mutation.attributeName && ROUND_IDENTITY_ATTRIBUTES.has(mutation.attributeName));
    }
    if (mutation.type !== 'childList' || isExtensionOwnedNode(mutation.target)) return false;
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
        !isExtensionOwnedNode(node) && nodeMayContainRoundStructure(node)
    ));
}

export class ChatGPTPageIndex {
    private readonly options: ChatGPTPageIndexOptions;
    private observer: MutationObserver | null = null;
    private observedRoot: ParentNode | null = null;
    private snapshot: ChatGPTDomRoundRef[] | null = null;
    private roundSubscribers = new Set<() => void>();
    private mutationSubscribers = new Set<() => void>();

    constructor(options: ChatGPTPageIndexOptions) {
        this.options = options;
    }

    getSnapshot(): ChatGPTDomRoundRef[] {
        this.ensureObservedRoot();
        if (!this.snapshot) this.snapshot = this.options.discover();
        return this.snapshot;
    }

    invalidate(): void {
        this.snapshot = null;
    }

    subscribe(listener: () => void): () => void {
        this.roundSubscribers.add(listener);
        this.ensureObservedRoot();
        return () => this.roundSubscribers.delete(listener);
    }

    subscribeMutations(listener: () => void): () => void {
        this.mutationSubscribers.add(listener);
        this.ensureObservedRoot();
        return () => this.mutationSubscribers.delete(listener);
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = null;
        this.roundSubscribers.clear();
        this.mutationSubscribers.clear();
        this.invalidate();
    }

    private ensureObservedRoot(): void {
        const currentRootIsConnected = Boolean(
            this.observedRoot
            && 'isConnected' in this.observedRoot
            && this.observedRoot.isConnected,
        );
        if (this.snapshot && currentRootIsConnected) return;

        const nextRoot = this.options.resolveRoot();
        if (nextRoot === this.observedRoot && currentRootIsConnected) return;

        const hadRoot = this.observedRoot !== null;
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = nextRoot;
        if (hadRoot) this.invalidate();

        if (typeof MutationObserver !== 'function') return;
        this.observer = new MutationObserver((mutations) => {
            const hostMutations = mutations.filter(mutationAffectsHostPage);
            if (hostMutations.length === 0) return;
            this.invalidate();
            this.notify(this.mutationSubscribers, 'Content-change');
            if (!hostMutations.some(mutationAffectsRoundStructure)) return;
            this.notify(this.roundSubscribers, 'Round-change');
        });
        this.observer.observe(nextRoot, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    private notify(subscribers: Set<() => void>, label: string): void {
        for (const listener of Array.from(subscribers)) {
            try {
                listener();
            } catch (error) {
                logger.warn(`[AI-MarkDone][ChatGPTPageIndex] ${label} subscriber failed`, error);
            }
        }
    }
}
