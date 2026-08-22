import type { ChatGPTDomRoundRef } from './domConversationDiscovery';
import { logger } from '../../../core/logger';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';

type ChatGPTPageIndexOptions = {
    resolveRoot: () => ParentNode;
    resolveSurfaceRoot?: () => ParentNode;
    discover: () => ChatGPTDomRoundRef[];
};

export type ChatGPTHostObservationKind = 'structure' | 'identity' | 'content' | 'lifecycle' | 'surface';

export type ChatGPTHostObservationBatch = Readonly<{
    revision: number;
    surfaceEpoch: number;
    pageUrl: string;
    kinds: readonly ChatGPTHostObservationKind[];
    assistantMessageIds: readonly string[];
    /** Typed assistant surfaces removed from the mounted host window. */
    removedAssistantMessageIds: readonly string[];
    /** Assistants whose active generation state began in this page epoch. */
    generationStartedAssistantMessageIds: readonly string[];
    /** Still-mounted assistants whose active generation state ended. */
    generationCompletedAssistantMessageIds: readonly string[];
    /** Assistant identity changes inside one stable mounted turn owner. */
    assistantIdentityReplacements: readonly Readonly<{
        previousAssistantMessageId: string;
        nextAssistantMessageId: string;
    }>[];
    /** The current host content root was replaced in this observation batch. */
    surfaceRebased: boolean;
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
const CONVERSATION_SURFACE_CONSUMER_SELECTOR = `[${AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE}]`;

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

function isUserContentNode(node: Node): boolean {
    if (isExtensionOwnedNode(node)) return false;
    const element = getElementForOwnershipCheck(node);
    return Boolean(element?.closest('[data-message-author-role="user"]'));
}

function mutationAffectsHostPage(mutation: MutationRecord): boolean {
    if (mutation.type === 'characterData') {
        // React frequently updates an existing text node in place while a
        // long answer is streaming, and it may hydrate a user prompt after
        // the typed user node is already mounted. Keep the single PageIndex
        // observer, but only accept text changes inside typed message content.
        return isAssistantContentNode(mutation.target) || isUserContentNode(mutation.target);
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

    if (mutationRemovesConversationSurfaceConsumer(mutation)) return true;
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (isAssistantContentNode(mutation.target) || isUserContentNode(mutation.target)) return true;
    return changedNodes.some((node) => (
        !isExtensionOwnedNode(node) && nodeMayContainContentLifecycle(node)
    ));
}

function nodeMayContainConversationSurfaceConsumer(node: Node): boolean {
    if (node.nodeType !== 1 && node.nodeType !== 11) return false;
    const queryable = node as Element | DocumentFragment;
    if (node.nodeType === 1 && (queryable as Element).matches(CONVERSATION_SURFACE_CONSUMER_SELECTOR)) {
        return true;
    }
    return queryable.querySelector(CONVERSATION_SURFACE_CONSUMER_SELECTOR) !== null;
}

function mutationRemovesConversationSurfaceConsumer(mutation: MutationRecord): boolean {
    return mutation.type === 'childList'
        && Array.from(mutation.removedNodes).some(nodeMayContainConversationSurfaceConsumer);
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
    private surfaceRoot: ParentNode | null = null;
    private snapshot: ChatGPTDomRoundRef[] | null = null;
    private roundSubscribers = new Set<() => void>();
    private mutationSubscribers = new Set<() => void>();
    private observationSubscribers = new Set<(batch: ChatGPTHostObservationBatch) => void>();
    private observationRevision = 0;
    private surfaceEpoch = 0;
    private pageUrl = '';
    private surfaceRouteKey = '';
    private activeGenerationAssistantIds = new Set<string>();
    private assistantIdByOwner = new WeakMap<HTMLElement, string>();

    constructor(options: ChatGPTPageIndexOptions) {
        this.options = options;
    }

    getSnapshot(): ChatGPTDomRoundRef[] {
        this.ensureObservedRoot();
        if (!this.snapshot) {
            this.snapshot = this.options.discover();
            this.seedAssistantIdentityOwners(this.snapshot);
        }
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
        this.surfaceRoot = null;
        this.roundSubscribers.clear();
        this.mutationSubscribers.clear();
        this.observationSubscribers.clear();
        this.observationRevision = 0;
        this.surfaceEpoch = 0;
        this.pageUrl = '';
        this.surfaceRouteKey = '';
        this.activeGenerationAssistantIds.clear();
        this.assistantIdByOwner = new WeakMap<HTMLElement, string>();
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
        const rootChanged = hadRoot && nextRoot !== this.observedRoot;
        this.observer?.disconnect();
        this.observer = null;
        this.observedRoot = nextRoot;
        this.surfaceRoot = this.options.resolveSurfaceRoot?.() ?? nextRoot;
        if (hadRoot) this.invalidate();
        this.advanceSurface(window.location.href, rootChanged);

        if (typeof MutationObserver !== 'function') return;
        this.observer = new MutationObserver((mutations) => {
            // A jsdom document can flush queued records after its test realm
            // has been torn down. Production always has window; a dead realm
            // is not a host lifecycle signal and must not leak an exception.
            if (typeof window === 'undefined') return;
            const hostMutations = mutations.filter(mutationAffectsHostPage);
            if (hostMutations.length === 0) return;
            const nextSurfaceRoot = this.options.resolveSurfaceRoot?.() ?? this.observedRoot;
            const surfaceRebased = Boolean(
                this.surfaceRoot
                && nextSurfaceRoot
                && nextSurfaceRoot !== this.surfaceRoot,
            );
            if (surfaceRebased) {
                this.activeGenerationAssistantIds.clear();
                this.assistantIdByOwner = new WeakMap<HTMLElement, string>();
            }
            if (nextSurfaceRoot) this.surfaceRoot = nextSurfaceRoot;
            const kinds = new Set<ChatGPTHostObservationKind>();
            const assistantMessageIds = new Set<string>();
            const removedAssistantMessageIds = new Set<string>();
            for (const mutation of hostMutations) {
                mutationKinds(mutation).forEach((kind) => kinds.add(kind));
                collectAssistantMessageIds(mutation).forEach((id) => assistantMessageIds.add(id));
                collectRemovedAssistantMessageIds(mutation).forEach((id) => removedAssistantMessageIds.add(id));
            }
            const hostEvidenceChanged = Array.from(kinds).some((kind) => kind !== 'surface');
            if (hostEvidenceChanged) this.invalidate();
            this.advanceSurface(window.location.href, surfaceRebased);
            this.observationRevision += 1;
            const shouldReadGenerationState = Array.from(kinds).some((kind) => (
                kind === 'structure' || kind === 'identity' || kind === 'lifecycle'
            ));
            let activeGenerationAssistantMessageIds: string[] = [];
            let generationStartedAssistantMessageIds: string[] = [];
            let generationCompletedAssistantMessageIds: string[] = [];
            let assistantIdentityReplacements: Array<Readonly<{
                previousAssistantMessageId: string;
                nextAssistantMessageId: string;
            }>> = [];
            if (shouldReadGenerationState) {
                const mountedRounds = this.getSnapshot();
                assistantIdentityReplacements = this.collectAssistantIdentityReplacements(mountedRounds);
                const mountedAssistantIds = new Set(
                    mountedRounds
                        .map((round) => round.identity.assistantMessageId?.trim() ?? '')
                        .filter(Boolean),
                );
                activeGenerationAssistantMessageIds = mountedRounds
                    .filter((round) => {
                        const id = round.identity.assistantMessageId?.trim();
                        return Boolean(
                            id
                            && (
                                round.isStreaming
                                || round.assistantRootEl.querySelector('button[data-testid="stop-button"]')
                            )
                        );
                    })
                    .map((round) => round.identity.assistantMessageId!.trim());
                const nextActive = new Set(activeGenerationAssistantMessageIds);
                if (!surfaceRebased) {
                    generationStartedAssistantMessageIds = activeGenerationAssistantMessageIds.filter(
                        (id) => !this.activeGenerationAssistantIds.has(id),
                    );
                    generationCompletedAssistantMessageIds = Array.from(this.activeGenerationAssistantIds).filter(
                        (id) => !nextActive.has(id) && mountedAssistantIds.has(id),
                    );
                }
                this.activeGenerationAssistantIds = nextActive;
            }
            this.notifyObservations({
                revision: this.observationRevision,
                surfaceEpoch: this.surfaceEpoch,
                pageUrl: this.pageUrl,
                kinds: Object.freeze(Array.from(kinds)),
                assistantMessageIds: Object.freeze(Array.from(assistantMessageIds)),
                removedAssistantMessageIds: Object.freeze(Array.from(removedAssistantMessageIds)),
                generationStartedAssistantMessageIds: Object.freeze(generationStartedAssistantMessageIds),
                generationCompletedAssistantMessageIds: Object.freeze(generationCompletedAssistantMessageIds),
                assistantIdentityReplacements: Object.freeze(assistantIdentityReplacements),
                surfaceRebased,
            });
            if (hostEvidenceChanged) this.notify(this.mutationSubscribers, 'Content-change');
            if (!kinds.has('structure') && !kinds.has('identity')) return;
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

    private advanceSurface(pageUrl: string, force: boolean): void {
        const nextRouteKey = resolveSurfaceRouteKey(pageUrl);
        const routeChanged = nextRouteKey !== this.surfaceRouteKey;
        const firstSurface = this.pageUrl === '';
        this.pageUrl = pageUrl;
        this.surfaceRouteKey = nextRouteKey;
        if (firstSurface || force || routeChanged) this.surfaceEpoch += 1;
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

    private seedAssistantIdentityOwners(rounds: readonly ChatGPTDomRoundRef[]): void {
        for (const round of rounds) {
            const id = round.identity.assistantMessageId?.trim();
            if (!id) continue;
            const owner = resolveAssistantIdentityOwner(round);
            if (!this.assistantIdByOwner.has(owner)) this.assistantIdByOwner.set(owner, id);
        }
    }

    private collectAssistantIdentityReplacements(
        rounds: readonly ChatGPTDomRoundRef[],
    ): Array<Readonly<{ previousAssistantMessageId: string; nextAssistantMessageId: string }>> {
        const replacements: Array<Readonly<{
            previousAssistantMessageId: string;
            nextAssistantMessageId: string;
        }>> = [];
        for (const round of rounds) {
            const nextAssistantMessageId = round.identity.assistantMessageId?.trim();
            if (!nextAssistantMessageId) continue;
            const owner = resolveAssistantIdentityOwner(round);
            const previousAssistantMessageId = this.assistantIdByOwner.get(owner);
            if (previousAssistantMessageId && previousAssistantMessageId !== nextAssistantMessageId) {
                replacements.push(Object.freeze({ previousAssistantMessageId, nextAssistantMessageId }));
            }
            this.assistantIdByOwner.set(owner, nextAssistantMessageId);
        }
        return replacements;
    }
}

function resolveAssistantIdentityOwner(round: ChatGPTDomRoundRef): HTMLElement {
    return round.assistantRootEl.closest<HTMLElement>('[data-turn-id-container]')
        ?? round.assistantRootEl;
}

function resolveSurfaceRouteKey(pageUrl: string): string {
    try {
        const url = new URL(pageUrl, window.location.origin);
        return `${url.origin}${url.pathname}`;
    } catch {
        return pageUrl.split(/[?#]/, 1)[0] ?? pageUrl;
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
    const kinds = new Set<ChatGPTHostObservationKind>();
    if (mutationAffectsRoundStructure(mutation)) kinds.add('structure');
    if (mutationRemovesConversationSurfaceConsumer(mutation)) kinds.add('surface');
    if (nodeMayContainContentLifecycleFromMutation(mutation)) kinds.add('lifecycle');
    if (kinds.size === 0) kinds.add('content');
    return Array.from(kinds);
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

function collectRemovedAssistantMessageIds(mutation: MutationRecord): string[] {
    if (mutation.type !== 'childList') return [];
    const ids = new Set<string>();
    for (const removedNode of Array.from(mutation.removedNodes)) {
        if (removedNode.nodeType !== 1 && removedNode.nodeType !== 11) continue;
        const root = removedNode as Element | DocumentFragment;
        if (removedNode.nodeType === 1 && (removedNode as Element).matches('[data-message-author-role="assistant"]')) {
            const direct = (removedNode as Element).getAttribute('data-message-id')?.trim();
            if (direct) ids.add(direct);
        }
        root.querySelectorAll('[data-message-author-role="assistant"][data-message-id]').forEach((assistant) => {
            const id = assistant.getAttribute('data-message-id')?.trim();
            if (id) ids.add(id);
        });
    }
    return Array.from(ids);
}
