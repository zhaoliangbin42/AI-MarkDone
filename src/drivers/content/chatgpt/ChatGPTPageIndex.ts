import type { ChatGPTDomRoundRef } from './domConversationDiscovery';
import { logger } from '../../../core/logger';

type ChatGPTPageIndexOptions = {
    resolveRoot: () => ParentNode;
    discover: () => ChatGPTDomRoundRef[];
};

export type ChatGPTHostObservationKind = 'structure' | 'identity' | 'content' | 'lifecycle';

export type ChatGPTHostObservationBatch = Readonly<{
    revision: number;
    kinds: readonly ChatGPTHostObservationKind[];
    assistantMessageIds: readonly string[];
}>;

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

// ChatGPT changes its semantic stop/copy test id when streaming completes.
// This locale-independent host attribute is the small lifecycle signal needed
// to re-read the same typed turn without observing every text mutation.
const HOST_LIFECYCLE_ATTRIBUTES = new Set([
    ...ROUND_IDENTITY_ATTRIBUTES,
    'data-testid',
]);
const GENERATION_LIFECYCLE_SELECTOR = [
    'button[data-testid="stop-button"]',
    'button[data-testid="copy-turn-action-button"]',
    '[data-conversation-screenshot-content] iframe[title="internal://deep-research"]',
].join(',');

function getElementForOwnershipCheck(node: Node): Element | null {
    if (node.nodeType === 1) return node as Element;
    return node.parentElement;
}

function isExtensionOwnedNode(node: Node): boolean {
    return Boolean(getElementForOwnershipCheck(node)?.closest('[data-aimd-role]'));
}

function isAssistantContentNode(node: Node): boolean {
    if (isExtensionOwnedNode(node)) return false;
    const element = getElementForOwnershipCheck(node);
    return Boolean(element?.closest('[data-message-author-role="assistant"]'));
}

function mutationAffectsHostPage(mutation: MutationRecord): boolean {
    if (mutation.type === 'characterData') {
        // React frequently updates an existing text node in place while a
        // long answer is streaming. Keep the single PageIndex observer, but
        // only accept text changes inside typed assistant content.
        return isAssistantContentNode(mutation.target);
    }
    if (mutation.type === 'attributes') {
        if (mutation.attributeName?.startsWith('data-aimd-')) return false;
        if (isExtensionOwnedNode(mutation.target)) return false;
        const target = getElementForOwnershipCheck(mutation.target);
        if (!target || !mutation.attributeName) return false;
        if (ROUND_IDENTITY_ATTRIBUTES.has(mutation.attributeName)) {
            return target.matches(ROUND_STRUCTURE_SELECTOR)
                || target.closest(ROUND_STRUCTURE_SELECTOR) !== null;
        }
        if (mutation.attributeName !== 'data-testid') return false;
        const currentTestId = target.getAttribute('data-testid') ?? '';
        const previousTestId = mutation.oldValue ?? '';
        return target.matches(ROUND_STRUCTURE_SELECTOR)
            || target.closest(ROUND_STRUCTURE_SELECTOR) !== null
            || currentTestId === 'stop-button'
            || currentTestId === 'copy-turn-action-button'
            || previousTestId === 'stop-button'
            || previousTestId === 'copy-turn-action-button';
    }

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (isAssistantContentNode(mutation.target)) return true;
    return changedNodes.some((node) => (
        !isExtensionOwnedNode(node) && nodeMayContainContentLifecycle(node)
    ));
}

function nodeMayContainRoundStructure(node: Node): boolean {
    if (node.nodeType !== 1 && node.nodeType !== 11) return false;
    const queryable = node as Element | DocumentFragment;
    if (node.nodeType === 1 && (queryable as Element).matches(ROUND_STRUCTURE_SELECTOR)) return true;
    return queryable.querySelector(ROUND_STRUCTURE_SELECTOR) !== null;
}

function nodeMayContainContentLifecycle(node: Node): boolean {
    if (nodeMayContainRoundStructure(node)) return true;
    if (node.nodeType !== 1 && node.nodeType !== 11) return false;
    const queryable = node as Element | DocumentFragment;
    if (node.nodeType === 1 && (queryable as Element).matches(GENERATION_LIFECYCLE_SELECTOR)) {
        return true;
    }
    return queryable.querySelector(GENERATION_LIFECYCLE_SELECTOR) !== null;
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
    private observationSubscribers = new Set<(batch: ChatGPTHostObservationBatch) => void>();
    private observationRevision = 0;

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

    subscribeObservations(listener: (batch: ChatGPTHostObservationBatch) => void): () => void {
        this.observationSubscribers.add(listener);
        this.ensureObservedRoot();
        return () => this.observationSubscribers.delete(listener);
    }

    getObservationRevision(): number {
        this.ensureObservedRoot();
        return this.observationRevision;
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = null;
        this.roundSubscribers.clear();
        this.mutationSubscribers.clear();
        this.observationSubscribers.clear();
        this.observationRevision = 0;
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
            const kinds = new Set<ChatGPTHostObservationKind>();
            const assistantMessageIds = new Set<string>();
            for (const mutation of hostMutations) {
                mutationKinds(mutation).forEach((kind) => kinds.add(kind));
                collectAssistantMessageIds(mutation).forEach((id) => assistantMessageIds.add(id));
            }
            this.observationRevision += 1;
            this.notifyObservations({
                revision: this.observationRevision,
                kinds: Object.freeze(Array.from(kinds)),
                assistantMessageIds: Object.freeze(Array.from(assistantMessageIds)),
            });
            this.notify(this.mutationSubscribers, 'Content-change');
            if (!hostMutations.some(mutationAffectsRoundStructure)) return;
            this.notify(this.roundSubscribers, 'Round-change');
        });
        this.observer.observe(nextRoot, {
            attributes: true,
            attributeOldValue: true,
            attributeFilter: Array.from(HOST_LIFECYCLE_ATTRIBUTES),
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

    private notifyObservations(batch: ChatGPTHostObservationBatch): void {
        for (const listener of Array.from(this.observationSubscribers)) {
            try {
                listener(batch);
            } catch (error) {
                logger.warn('[AI-MarkDone][ChatGPTPageIndex] Host observation subscriber failed', error);
            }
        }
    }
}

function mutationKinds(mutation: MutationRecord): ChatGPTHostObservationKind[] {
    if (mutation.type === 'characterData') return ['content'];
    if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'data-testid') {
            const current = getElementForOwnershipCheck(mutation.target)?.getAttribute('data-testid') ?? '';
            const previous = mutation.oldValue ?? '';
            if (
                current === 'stop-button'
                || current === 'copy-turn-action-button'
                || previous === 'stop-button'
                || previous === 'copy-turn-action-button'
            ) return ['lifecycle'];
        }
        return ['identity'];
    }
    if (mutationAffectsRoundStructure(mutation)) return ['structure'];
    if (nodeMayContainContentLifecycleFromMutation(mutation)) return ['lifecycle'];
    return ['content'];
}

function nodeMayContainContentLifecycleFromMutation(mutation: MutationRecord): boolean {
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.some((node) => {
        if (node.nodeType !== 1 && node.nodeType !== 11) return false;
        const queryable = node as Element | DocumentFragment;
        if (node.nodeType === 1 && (queryable as Element).matches(GENERATION_LIFECYCLE_SELECTOR)) return true;
        return queryable.querySelector(GENERATION_LIFECYCLE_SELECTOR) !== null;
    });
}

function collectAssistantMessageIds(mutation: MutationRecord): string[] {
    const ids = new Set<string>();
    const collect = (node: Node): void => {
        const element = getElementForOwnershipCheck(node);
        const message = element?.closest('[data-message-author-role="assistant"]');
        const directId = message?.getAttribute('data-message-id')?.trim();
        if (directId) ids.add(directId);
        if (node.nodeType !== 1 && node.nodeType !== 11) return;
        const queryable = node as Element | DocumentFragment;
        queryable.querySelectorAll?.('[data-message-author-role="assistant"][data-message-id]').forEach((candidate) => {
            const id = candidate.getAttribute('data-message-id')?.trim();
            if (id) ids.add(id);
        });
    };
    collect(mutation.target);
    mutation.addedNodes.forEach(collect);
    mutation.removedNodes.forEach(collect);
    return Array.from(ids);
}
