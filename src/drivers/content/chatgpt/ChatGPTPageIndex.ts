import type { ChatGPTDomRoundRef } from './domConversationDiscovery';

export type ChatGPTPageSnapshot = {
    revision: number;
    rounds: ChatGPTDomRoundRef[];
};

type ChatGPTPageIndexOptions = {
    resolveRoot: () => ParentNode;
    discover: () => ChatGPTDomRoundRef[];
};

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

export class ChatGPTPageIndex {
    private readonly options: ChatGPTPageIndexOptions;
    private observer: MutationObserver | null = null;
    private observedRoot: ParentNode | null = null;
    private revision = 0;
    private snapshot: ChatGPTPageSnapshot | null = null;

    constructor(options: ChatGPTPageIndexOptions) {
        this.options = options;
    }

    getSnapshot(): ChatGPTPageSnapshot {
        this.ensureObservedRoot();
        if (!this.snapshot) {
            this.snapshot = {
                revision: this.revision,
                rounds: this.options.discover(),
            };
        }
        return this.snapshot;
    }

    invalidate(): void {
        this.revision += 1;
        this.snapshot = null;
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = null;
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
            if (mutations.some(mutationAffectsHostPage)) this.invalidate();
        });
        this.observer.observe(nextRoot, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
}
