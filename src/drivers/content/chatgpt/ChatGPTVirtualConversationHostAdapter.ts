import type { SiteAdapter } from '../adapters/base';
import { createConversationDocumentKeyV1 } from '../../../contracts/conversationContent';
import {
    type ConversationHostSessionV2,
    type HostEvidenceBatchV2,
    type HostEvidenceFactV2,
    type HostRoleSurfaceV2,
    type HostRoundSlotV2,
    type HostEntryKeyV2,
    type VirtualConversationHostAdapterV2,
} from '../../../contracts/conversationDiscoveryV2';
import {
    decodeSlotTopologyV2,
    type SlotMarkerEvidenceV2,
} from '../../../core/conversation/slotTopologyDecoderV2';
import { getChatGPTConversationId, isChatGPTConversationPage } from './chatgptRoute';

const SLOT_MARKER_SELECTOR = '[data-turn-id-container]';
const ROLE_SELECTOR = '[data-message-author-role="user"], [data-message-author-role="assistant"]';
const OBSERVED_ATTRIBUTES = [
    'data-turn-id-container',
    'data-message-author-role',
    'data-message-id',
    'data-turn-id',
    'data-testid',
    'class',
    'style',
    'aria-hidden',
];

type MarkerRecord = SlotMarkerEvidenceV2 & Readonly<{ element: HTMLElement }>;

/** ChatGPT-only Adapter. No consumer is allowed to know these host details. */
export class ChatGPTVirtualConversationHostAdapter implements VirtualConversationHostAdapterV2 {
    readonly platformId = 'chatgpt' as const;

    constructor(private readonly site: SiteAdapter) {}

    resolveDocument() {
        const conversationId = getChatGPTConversationId(window.location.href)?.trim().toLowerCase() ?? null;
        if (!conversationId || !isChatGPTConversationPage(window.location.href)) return null;
        return Object.freeze({
            documentKey: createConversationDocumentKeyV1('chatgpt', conversationId),
            conversationId,
            canonicalUrl: window.location.href.split('#')[0] || window.location.href,
        });
    }

    start(params: Readonly<{
        documentEpochId: string;
        onEvidence: (batch: HostEvidenceBatchV2) => void;
    }>): ConversationHostSessionV2 {
        return new ChatGPTVirtualConversationHostSession(this.site, params.documentEpochId, params.onEvidence);
    }
}

class ChatGPTVirtualConversationHostSession implements ConversationHostSessionV2 {
    readonly initial: HostEvidenceBatchV2;
    private readonly markerKeys = new WeakMap<HTMLElement, string>();
    private readonly surfaceTokens = new WeakMap<HTMLElement, string>();
    private readonly observer: MutationObserver;
    private readonly onEvidence: (batch: HostEvidenceBatchV2) => void;
    private readonly epochId: string;
    private revision = 0;
    private batchSequence = 0;
    private markerSequence = 0;
    private surfaceSequence = 0;
    private disposed = false;
    private lastTopologyToken: string | null = null;
    private lastTopologyRounds: readonly HostRoundSlotV2[] = [];
    private lastMarkers: MarkerRecord[] = [];
    private lastSurfaces = new Map<string, HostRoleSurfaceV2>();
    private lastRoot: HTMLElement | null = null;
    private hasInitialScan = false;

    constructor(
        private readonly site: SiteAdapter,
        epochId: string,
        onEvidence: (batch: HostEvidenceBatchV2) => void,
    ) {
        this.epochId = epochId;
        this.onEvidence = onEvidence;
        const observerOwner = document.documentElement;
        this.observer = new MutationObserver((records) => {
            if (this.disposed) return;
            this.revision += 1;
            this.emit(this.scan('explicit', this.requiresTopologyRescan(records), records));
        });
        this.observer.observe(observerOwner, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: OBSERVED_ATTRIBUTES,
        });
        this.initial = this.scan('explicit', true);
        // Mutations between observer installation and the first scan are
        // synchronously folded into the first published batch.
        const records = this.observer.takeRecords();
        if (records.length > 0) {
            this.revision += 1;
            const followUp = this.scan('explicit', true);
            this.initial = mergeBatches(this.initial, followUp);
        }
    }

    snapshot(_reason: 'explicit' | 'pageshow' | 'root-replaced'): HostEvidenceBatchV2 {
        return this.scan(_reason, true);
    }

    private scan(
        _reason: 'explicit' | 'pageshow' | 'root-replaced',
        fullScan: boolean,
        records: readonly MutationRecord[] = [],
    ): HostEvidenceBatchV2 {
        if (this.disposed) return emptyBatch(this.epochId, this.revision, this.nextBatchId());
        const root = this.resolveScanRoot();
        const shouldScanTopology = fullScan || !this.hasInitialScan || root !== this.lastRoot || this.lastTopologyToken === null;
        const markers = shouldScanTopology
            ? (root ? this.collectMarkers(root) : [])
            : this.lastMarkers;
        if (shouldScanTopology) this.lastMarkers = markers;
        const decoded = decodeSlotTopologyV2(this.epochId, markers);
        const facts: HostEvidenceFactV2[] = [];

        if (decoded.kind === 'ready') {
            const topology = decoded.topology;
            if (this.lastTopologyToken !== topology.token || this.lastRoot !== root) {
                facts.push({
                    kind: 'topology-replaced',
                    topologyToken: topology.token,
                    leadingUnpairedSlots: topology.leadingUnpairedSlots,
                    trailingUnpairedSlots: topology.trailingUnpairedSlots,
                    rounds: topology.rounds,
                });
            }
            this.lastTopologyToken = topology.token;
            this.lastTopologyRounds = topology.rounds;
            this.lastRoot = root;

            const dirtyMarkerKeys = shouldScanTopology
                ? null
                : this.collectDirtyMarkerKeys(records, markers, topology.rounds);
            const refreshedMarkers = dirtyMarkerKeys
                ? this.refreshDirtyMarkers(markers, dirtyMarkerKeys)
                : markers;
            if (dirtyMarkerKeys) this.lastMarkers = refreshedMarkers;
            const observed = shouldScanTopology
                ? this.collectSurfaces(markers, topology.rounds)
                : this.mergeDirtySurfaces(refreshedMarkers, topology.rounds, dirtyMarkerKeys ?? new Set());
            const current = normalizeRoundTurnIdentities(observed, topology.rounds);
            for (const [surfaceKey, previous] of this.lastSurfaces) {
                if (!current.has(surfaceKey)) {
                    facts.push({
                        kind: 'role-unmounted',
                        entry: previous.entry,
                        role: previous.role,
                        surfaceToken: previous.surfaceToken,
                    });
                }
            }
            for (const [surfaceKey, surface] of current) {
                const previous = this.lastSurfaces.get(surfaceKey);
                // Re-emit the current surface as a capture candidate on every
                // observed batch.  This is not a materialization change: the
                // Discovery Module deduplicates the mount revision, while a
                // not-yet-sealed stable surface gets another one-shot compile
                // opportunity after its body changes.
                if (!previous || !sameSurface(previous, surface) || surface.lifecycle === 'stable') {
                    facts.push({ kind: 'role-mounted', surface });
                }
                if (
                    surface.role === 'user'
                    && surface.lifecycle === 'stable'
                    && surface.messageId
                    && surface.contentRootElement
                ) {
                    const text = normalizePromptText(surface.contentRootElement.textContent ?? '');
                    if (text) {
                        facts.push({
                            kind: 'prompt-recognized',
                            entry: surface.entry,
                            messageId: surface.messageId,
                            text,
                            surfaceToken: surface.surfaceToken,
                        });
                    }
                }
            }
            // The normalized map is the source for subsequent incremental
            // surface comparisons and capture scheduling.  A live ChatGPT
            // shell may put the marker on an outer virtualization wrapper
            // while the message identity lives on a nested section; the
            // round-level normalization above joins both role surfaces using
            // typed message IDs, never text or a mounted DOM ordinal.
            this.lastSurfaces = current;
            this.hasInitialScan = true;
        } else {
            facts.push({
                kind: 'topology-unavailable',
                reason: root
                    ? decoded.reason === 'ambiguous' || decoded.reason === 'empty'
                        ? 'ambiguous-topology'
                        : 'topology-conflict'
                    : 'host-root-unavailable',
            });
            if (this.lastTopologyRounds.length > 0) {
                facts.push({
                    kind: 'projection-invalidated',
                    fromOrdinal: 1,
                    reason: 'topology-incompatible',
                });
            }
            this.lastTopologyToken = null;
            this.lastTopologyRounds = [];
            this.lastRoot = root;
            this.hasInitialScan = true;
            for (const previous of this.lastSurfaces.values()) {
                facts.push({
                    kind: 'role-unmounted',
                    entry: previous.entry,
                    role: previous.role,
                    surfaceToken: previous.surfaceToken,
                });
            }
            this.lastSurfaces.clear();
        }

        return Object.freeze({
            epochId: this.epochId,
            hostRevision: this.revision,
            batchId: this.nextBatchId(),
            facts: Object.freeze(facts),
        });
    }

    resolveElement(element: HTMLElement): HostEntryKeyV2 | null {
        if (this.disposed) return null;
        let cursor: HTMLElement | null = element;
        while (cursor) {
            const key = this.markerKeys.get(cursor);
            if (key) {
                const round = this.lastTopologyRounds.find((candidate) => (
                    candidate.userSlotKey === key || candidate.assistantSlotKey === key
                ));
                return round?.entry ?? null;
            }
            cursor = cursor.parentElement;
        }
        return null;
    }

    scrollSlotIntoView(entry: HostEntryKeyV2, role: 'user' | 'assistant', align: 'start' | 'center'): boolean {
        const round = this.lastTopologyRounds.find((candidate) => candidate.entry.slotKey === entry.slotKey);
        if (!round || round.entry.epochId !== this.epochId) return false;
        const key = role === 'user' ? round.userSlotKey : round.assistantSlotKey;
        const element = this.findMarkerByKey(key);
        if (!element?.isConnected) return false;
        try {
            element.scrollIntoView({ behavior: 'auto', block: align });
            return true;
        } catch {
            return false;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.observer.disconnect();
        this.lastSurfaces.clear();
        this.lastTopologyRounds = [];
        this.lastMarkers = [];
        this.hasInitialScan = false;
    }

    private emit(batch: HostEvidenceBatchV2): void {
        if (batch.facts.length > 0) this.onEvidence(batch);
    }

    private resolveScanRoot(): HTMLElement | null {
        const preferred = this.site.getObserverContainer?.();
        if (preferred?.isConnected) return preferred;
        const main = document.querySelector('main');
        if (main instanceof HTMLElement) return main;
        return document.body instanceof HTMLElement ? document.body : null;
    }

    private collectMarkers(root: HTMLElement): MarkerRecord[] {
        const nodes: HTMLElement[] = [];
        if (root.matches(SLOT_MARKER_SELECTOR)) nodes.push(root);
        nodes.push(...Array.from(root.querySelectorAll<HTMLElement>(SLOT_MARKER_SELECTOR)));
        return nodes.map((element) => {
            const key = this.getMarkerKey(element);
            const role = this.readRole(element);
            return {
                key,
                element,
                parent: element.parentElement ?? root,
                role,
                sentinel: element.getAttribute(SLOT_MARKER_SELECTOR.slice(1, -1)) === 'client-created-root',
                estimatedHeightPx: this.readEstimatedHeight(element),
            };
        });
    }

    private collectSurfaces(
        markers: readonly MarkerRecord[],
        rounds: readonly HostRoundSlotV2[],
        onlyMarkerKeys?: ReadonlySet<string>,
    ): Map<string, HostRoleSurfaceV2> {
        const roundBySlotKey = new Map<string, HostRoundSlotV2>();
        for (const round of rounds) {
            roundBySlotKey.set(round.userSlotKey, round);
            roundBySlotKey.set(round.assistantSlotKey, round);
        }

        const surfaces = new Map<string, HostRoleSurfaceV2>();
        for (const marker of markers) {
            if (onlyMarkerKeys && !onlyMarkerKeys.has(marker.key)) continue;
            const round = roundBySlotKey.get(marker.key);
            if (!round || !marker.role) continue;
            const message = this.findRoleMessage(marker.element, marker.role);
            if (!message) continue;
            const contentRoot = this.findContentRoot(message, marker.role);
            const surfaceToken = this.getSurfaceToken(marker.element, marker.role);
            const surface: HostRoleSurfaceV2 = Object.freeze({
                entry: round.entry,
                role: marker.role,
                lifecycle: this.readLifecycle(message),
                turnId: this.readTurnId(marker.element, message),
                messageId: this.readMessageId(message),
                surfaceToken,
                anchorElement: marker.element,
                messageElement: message,
                contentRootElement: contentRoot,
            });
            surfaces.set(`${round.entry.slotKey}:${marker.role}`, surface);
        }
        return surfaces;
    }

    private mergeDirtySurfaces(
        markers: readonly MarkerRecord[],
        rounds: readonly HostRoundSlotV2[],
        dirtyMarkerKeys: ReadonlySet<string>,
    ): Map<string, HostRoleSurfaceV2> {
        if (dirtyMarkerKeys.size === 0) return this.lastSurfaces;
        const roundByMarkerKey = new Map<string, HostRoundSlotV2>();
        for (const round of rounds) {
            roundByMarkerKey.set(round.userSlotKey, round);
            roundByMarkerKey.set(round.assistantSlotKey, round);
        }
        const next = new Map(this.lastSurfaces);
        for (const markerKey of dirtyMarkerKeys) {
            const round = roundByMarkerKey.get(markerKey);
            if (!round) continue;
            next.delete(`${round.entry.slotKey}:user`);
            next.delete(`${round.entry.slotKey}:assistant`);
        }
        for (const [key, surface] of this.collectSurfaces(markers, rounds, dirtyMarkerKeys)) {
            next.set(key, surface);
        }
        return next;
    }

    private refreshDirtyMarkers(
        markers: readonly MarkerRecord[],
        dirtyMarkerKeys: ReadonlySet<string>,
    ): MarkerRecord[] {
        return markers.map((marker) => dirtyMarkerKeys.has(marker.key)
            ? {
                ...marker,
                role: this.readRole(marker.element),
                sentinel: marker.element.getAttribute('data-turn-id-container') === 'client-created-root',
                estimatedHeightPx: this.readEstimatedHeight(marker.element),
            }
            : marker);
    }

    private collectDirtyMarkerKeys(
        records: readonly MutationRecord[],
        markers: readonly MarkerRecord[],
        rounds: readonly HostRoundSlotV2[],
    ): Set<string> {
        const markerByElement = new Map(markers.map((marker) => [marker.element, marker]));
        const dirty = new Set<string>();
        const markFromNode = (node: Node | null): void => {
            const element = node instanceof HTMLElement ? node : node?.parentElement;
            if (!element) return;
            let cursor: HTMLElement | null = element;
            while (cursor) {
                const marker = markerByElement.get(cursor);
                if (marker) {
                    dirty.add(marker.key);
                    return;
                }
                cursor = cursor.parentElement;
            }
        };
        const markAllAssistantSurfaces = (): void => {
            for (const round of rounds) dirty.add(round.assistantSlotKey);
        };
        for (const record of records) {
            markFromNode(record.target);
            const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
            for (const node of nodes) {
                markFromNode(node);
                if (containsGenerationSignal(node)) markAllAssistantSurfaces();
            }
            if (containsGenerationSignal(record.target)) markAllAssistantSurfaces();
        }
        return dirty;
    }

    private requiresTopologyRescan(records: readonly MutationRecord[]): boolean {
        if (!this.hasInitialScan || this.lastTopologyToken === null) return true;
        for (const record of records) {
            if (record.type === 'attributes' && record.attributeName === 'data-turn-id-container') return true;
            if (record.type !== 'childList') continue;
            const target = record.target.nodeType === 1
                ? record.target as HTMLElement
                : record.target.parentElement;
            const targetInsideMarker = Boolean(target?.closest(SLOT_MARKER_SELECTOR));
            const changedMarker = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
                .some((node) => node.nodeType === 1 && (
                    (node as Element).matches(SLOT_MARKER_SELECTOR)
                    || (node as Element).querySelector(SLOT_MARKER_SELECTOR)
                ));
            if (changedMarker || (!targetInsideMarker && record.addedNodes.length > 0)) return true;
        }
        return false;
    }

    private findRoleMessage(marker: HTMLElement, role: 'user' | 'assistant'): HTMLElement | null {
        if (marker.matches(`[data-message-author-role="${role}"]`)) return marker;
        const candidates = Array.from(marker.querySelectorAll<HTMLElement>(`[data-message-author-role="${role}"]`));
        if (candidates.length === 0) return null;
        return candidates.find((candidate) => this.readMessageId(candidate) !== null) ?? candidates[0] ?? null;
    }

    private findContentRoot(message: HTMLElement, role: 'user' | 'assistant'): HTMLElement | null {
        if (role === 'user') {
            // The user bubble is the semantic prompt surface.  File tiles,
            // attachment buttons and collapse chrome live beside it and must
            // not become directory labels or prompt body input.
            const prompt = message.querySelector<HTMLElement>('.whitespace-pre-wrap');
            return prompt instanceof HTMLElement ? prompt : null;
        }
        const selector = this.site.getMessageContentSelector();
        if (message.matches(selector)) return message;
        const root = message.querySelector(selector);
        return root instanceof HTMLElement ? root : null;
    }

    private readRole(marker: HTMLElement): 'user' | 'assistant' | null {
        const roles = new Set<'user' | 'assistant'>();
        if (marker.matches(ROLE_SELECTOR)) roles.add(marker.getAttribute('data-message-author-role') as 'user' | 'assistant');
        for (const node of marker.querySelectorAll<HTMLElement>(ROLE_SELECTOR)) {
            const role = node.getAttribute('data-message-author-role');
            if (role === 'user' || role === 'assistant') roles.add(role);
        }
        return roles.size === 1 ? Array.from(roles)[0]! : null;
    }

    private readMessageId(message: HTMLElement): string | null {
        const value = message.getAttribute('data-message-id')?.trim();
        return value || null;
    }

    private readTurnId(marker: HTMLElement, message: HTMLElement): string | null {
        const values = [
            marker.getAttribute('data-turn-id'),
            message.getAttribute('data-turn-id'),
        ];
        for (const value of values) {
            const normalized = value?.trim();
            if (normalized) return normalized;
        }
        return null;
    }

    private readLifecycle(message: HTMLElement): HostRoleSurfaceV2['lifecycle'] {
        try {
            return this.site.isStreamingMessage(message) ? 'streaming' : 'stable';
        } catch {
            return 'unknown';
        }
    }

    private readEstimatedHeight(element: HTMLElement): number | null {
        const raw = element.style.getPropertyValue('--last-known-height')
            || element.style.getPropertyValue('--estimated-turn-height');
        const value = Number.parseFloat(raw);
        return Number.isFinite(value) && value >= 0 ? value : null;
    }

    private getMarkerKey(element: HTMLElement): string {
        const declared = element.getAttribute('data-turn-id-container')?.trim();
        if (declared) {
            this.markerKeys.set(element, declared);
            return declared;
        }
        const existing = this.markerKeys.get(element);
        if (existing) return existing;
        const generated = `epoch-slot-${++this.markerSequence}`;
        this.markerKeys.set(element, generated);
        return generated;
    }

    private getSurfaceToken(element: HTMLElement, role: 'user' | 'assistant'): string {
        const existing = this.surfaceTokens.get(element);
        if (existing) return existing;
        const token = `surface:${this.epochId}:${role}:${++this.surfaceSequence}`;
        this.surfaceTokens.set(element, token);
        return token;
    }

    private findMarkerByKey(key: string): HTMLElement | null {
        const cached = this.lastMarkers.find((marker) => marker.key === key)?.element;
        if (cached?.isConnected) return cached;
        const root = this.resolveScanRoot();
        if (!root) return null;
        return this.collectMarkers(root).find((marker) => marker.key === key)?.element ?? null;
    }

    private nextBatchId(): string {
        return `host:${this.epochId}:${++this.batchSequence}`;
    }
}

function normalizeRoundTurnIdentities(
    surfaces: Map<string, HostRoleSurfaceV2>,
    rounds: readonly HostRoundSlotV2[],
): Map<string, HostRoleSurfaceV2> {
    const normalized = new Map(surfaces);
    for (const round of rounds) {
        const userKey = `${round.entry.slotKey}:user`;
        const assistantKey = `${round.entry.slotKey}:assistant`;
        const user = normalized.get(userKey);
        const assistant = normalized.get(assistantKey);
        if (!user || !assistant) continue;

        let turnId: string | null = null;
        if (user.turnId && assistant.turnId) {
            if (user.turnId !== assistant.turnId) continue;
            turnId = user.turnId;
        } else if (user.messageId && assistant.messageId) {
            // Current ChatGPT renders `data-turn-id-container` and message
            // IDs but no shared turn ID on the hydrated role nodes.  The
            // ordered pair of typed message IDs is the only stable identity
            // available at this boundary; it remains unchanged across
            // virtualization unmount/remount and changes on regeneration.
            turnId = `chatgpt-turn:${user.messageId}:${assistant.messageId}`;
        }
        if (!turnId) continue;

        normalized.set(userKey, Object.freeze({ ...user, turnId }));
        normalized.set(assistantKey, Object.freeze({ ...assistant, turnId }));
    }
    return normalized;
}

function sameSurface(a: HostRoleSurfaceV2, b: HostRoleSurfaceV2): boolean {
    return a.surfaceToken === b.surfaceToken
        && a.lifecycle === b.lifecycle
        && a.turnId === b.turnId
        && a.messageId === b.messageId
        && a.contentRootElement === b.contentRootElement;
}

function emptyBatch(epochId: string, revision: number, batchId: string): HostEvidenceBatchV2 {
    return Object.freeze({ epochId, hostRevision: revision, batchId, facts: Object.freeze([]) });
}

function mergeBatches(first: HostEvidenceBatchV2, second: HostEvidenceBatchV2): HostEvidenceBatchV2 {
    return Object.freeze({
        epochId: second.epochId,
        hostRevision: second.hostRevision,
        batchId: `${first.batchId}+${second.batchId}`,
        facts: Object.freeze([...first.facts, ...second.facts]),
    });
}

function containsGenerationSignal(node: Node): boolean {
    if (!(node instanceof Element)) return false;
    const selector = 'button[data-testid="stop-button"], button[data-testid="copy-turn-action-button"]';
    return node.matches(selector) || Boolean(node.querySelector(selector));
}

function normalizePromptText(value: string): string {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
