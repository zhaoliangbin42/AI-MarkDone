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
    private subscribers = new Set<() => void>();

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
        this.subscribers.add(listener);
        this.ensureObservedRoot();
        return () => this.subscribers.delete(listener);
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = null;
        this.subscribers.clear();
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
            if (!hostMutations.some(mutationAffectsRoundStructure)) return;
            for (const listener of Array.from(this.subscribers)) {
                try {
                    listener();
                } catch (error) {
                    logger.warn('[AI-MarkDone][ChatGPTPageIndex] Round-change subscriber failed', error);
                }
            }
        });
        this.observer.observe(nextRoot, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
}
