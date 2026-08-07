import type {
    ConversationBodyV2,
    ConversationDiscoveryChangeV2,
    ConversationDiscoveryDomainV2,
    ConversationDiscoveryPortV2,
    ConversationDiscoverySnapshotV2,
    ConversationDocumentEpochV2,
    ConversationEntryMaterializationV2,
    ConversationEntryRefV2,
    ConversationIndexEntryV2,
    ConversationLocateResultV2,
    ConversationSealedTurnV2,
    ConversationTokenSetV2,
    ConversationTurnIdentityV2,
    ConversationTurnReadResultV2,
    ConversationTurnRevisionV2,
    ConversationTurnTargetV2,
    ConversationRevisionSetV2,
    HostEvidenceBatchV2,
    HostRoleSurfaceV2,
    HostRoundSlotV2,
    RenderedContentCompilerV2,
    RenderedParserCapabilityV2,
    VirtualConversationHostAdapterV2,
    ConversationHostSessionV2,
} from '../../contracts/conversationDiscoveryV2';
import { logger } from '../../core/logger';

type StoredTurn = Readonly<{
    turn: ConversationSealedTurnV2;
    semanticDigest: string;
}>;

type StoredPrompt = Readonly<{
    messageId: string;
    text: string;
}>;

type MutableMount = {
    user: HostRoleSurfaceV2 | null;
    assistant: HostRoleSurfaceV2 | null;
};

export type ConversationDiscoveryModuleV2Options = Readonly<{
    host: VirtualConversationHostAdapterV2;
    compiler: RenderedContentCompilerV2;
    parser: RenderedParserCapabilityV2;
    placeholderLabel?: (position: number) => string;
    createEpochId?: () => string;
}>;

/**
 * Deep Module for one ChatGPT document epoch.  It owns the normalized store,
 * sparse projection, capture sealing, branch fencing and event semantics.
 * The Host Adapter is the only implementation that knows platform DOM.
 */
export class ConversationDiscoveryModuleV2 implements ConversationDiscoveryPortV2 {
    private readonly listeners = new Set<(change: ConversationDiscoveryChangeV2) => void>();
    private readonly slots = new Map<string, HostRoundSlotV2>();
    private readonly turns = new Map<string, StoredTurn>();
    private readonly prompts = new Map<string, StoredPrompt>();
    private readonly identities = new Map<string, ConversationTurnIdentityV2>();
    private readonly aliases = new Map<string, string | 'conflict'>();
    private readonly mounted = new Map<string, MutableMount>();
    private readonly conflicts = new Set<string>();
    private readonly seenBatchIds = new Set<string>();
    private readonly pendingCompiles = new Set<string>();
    private readonly pendingCaptures = new Set<Promise<void>>();
    private order: string[] = [];
    private document: ConversationDocumentEpochV2 | null = null;
    private session: ConversationHostSessionV2 | null = null;
    private snapshot: ConversationDiscoverySnapshotV2 = {
        kind: 'idle',
        document: null,
        entries: Object.freeze([]),
    };
    private revisions: ConversationRevisionSetV2 = { topology: 0, content: 0, materialization: 0 };
    private topologyToken = 'topology:none';
    private topologyUnavailable: Extract<ConversationDiscoverySnapshotV2, { kind: 'unavailable' }>['reason'] | null = null;
    private projectionSequence = 0;
    private latestHostRevision = 0;
    private disposed = false;

    constructor(private readonly options: ConversationDiscoveryModuleV2Options) {}

    init(): void {
        if (this.disposed) this.disposed = false;
        const resolved = this.options.host.resolveDocument();
        if (!resolved) {
            this.disposeSession();
            this.resetStore();
            this.document = null;
            this.publish(['topology', 'content', 'materialization'], []);
            return;
        }

        if (this.document?.documentKey === resolved.documentKey && this.session) {
            void this.refresh();
            return;
        }

        this.disposeSession();
        this.resetStore();
        const documentEpochId = this.options.createEpochId?.()
            ?? `epoch:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
        this.document = Object.freeze({
            documentEpochId,
            projectionId: `projection:${++this.projectionSequence}`,
            documentKey: resolved.documentKey,
            platformId: 'chatgpt',
            conversationId: resolved.conversationId,
            canonicalUrl: resolved.canonicalUrl,
            ...(resolved.title ? { title: resolved.title } : {}),
        });
        this.session = this.options.host.start({
            documentEpochId,
            onEvidence: (batch) => this.ingest(batch),
        });
        this.ingest(this.session.initial);
    }

    read(): ConversationDiscoverySnapshotV2 {
        return this.snapshot;
    }

    subscribe(listener: (change: ConversationDiscoveryChangeV2) => void): () => void {
        this.listeners.add(listener);
        this.emitTo(listener, {
            changed: Object.freeze(['topology', 'content', 'materialization']),
            affectedEntries: Object.freeze(this.currentRefs()),
            snapshot: this.snapshot,
        });
        return () => this.listeners.delete(listener);
    }

    async refresh(): Promise<ConversationDiscoverySnapshotV2> {
        if (this.disposed) return this.snapshot;
        if (!this.document) {
            this.init();
            await this.flushPendingCaptures();
            return this.snapshot;
        }
        const session = this.session;
        if (!session) return this.snapshot;
        this.ingest(session.snapshot('explicit'));
        // `refresh()` is a local flush boundary.  A synchronous init can only
        // enqueue captures, so wait for the captures already observed in this
        // document epoch before returning a snapshot to a consumer such as
        // Reader or Bookmark Preparation.  This does not wait for future DOM
        // work, poll, scroll, or acquire anything from the network.
        await this.flushPendingCaptures();
        return this.snapshot;
    }

    readTurn(target: ConversationTurnTargetV2): ConversationTurnReadResultV2 {
        const resolved = this.resolveTarget(target);
        if (resolved.kind !== 'ready-target') return { kind: 'unavailable', reason: resolved.reason };
        const stored = this.turns.get(resolved.slotKey);
        if (!stored) return { kind: 'unavailable', reason: 'not-recognized' };
        if (this.conflicts.has(resolved.slotKey)) return { kind: 'unavailable', reason: 'identity-conflict' };
        const position = this.order.indexOf(resolved.slotKey) + 1;
        if (position <= 0) return { kind: 'unavailable', reason: 'stale-target' };
        return Object.freeze({
            kind: 'ready',
            ref: this.createRef(resolved.slotKey),
            position,
            turn: stored.turn,
            revision: this.createTurnRevision(stored.turn.turnToken),
        });
    }

    resolveElement(element: HTMLElement): ConversationEntryRefV2 | null {
        const entry = this.session?.resolveElement(element);
        if (!entry || entry.epochId !== this.document?.documentEpochId || !this.slots.has(entry.slotKey)) return null;
        return this.createRef(entry.slotKey);
    }

    locate(
        target: ConversationTurnTargetV2,
        options: Readonly<{
            align?: 'start' | 'center';
            timeoutMs?: number;
            signal?: AbortSignal;
        }> = {},
    ): Promise<ConversationLocateResultV2> {
        const resolved = this.resolveTarget(target);
        if (resolved.kind !== 'ready-target' && resolved.reason !== 'not-recognized') {
            return Promise.resolve({ kind: 'unavailable', reason: resolved.reason === 'identity-conflict' ? 'identity-conflict' : 'stale-target' });
        }
        const slotKey = resolved.kind === 'ready-target' ? resolved.slotKey : this.resolveUnknownTarget(target);
        if (!slotKey || !this.slots.has(slotKey)) return Promise.resolve({ kind: 'unavailable', reason: 'slot-missing' });
        const align = options.align ?? 'start';
        const current = this.readMount(slotKey);
        if (current?.assistant?.anchorElement.isConnected || current?.user?.anchorElement.isConnected) {
            this.preciseScroll(current, align);
            return Promise.resolve({
                kind: 'located',
                phase: 'already-mounted',
                ref: this.createRef(slotKey),
                surfaceToken: current.assistant?.surfaceToken ?? current.user?.surfaceToken ?? null,
            });
        }

        const session = this.session;
        if (!session) return Promise.resolve({ kind: 'unavailable', reason: 'slot-missing' });
        const round = this.slots.get(slotKey)!;

        return new Promise<ConversationLocateResultV2>((resolve) => {
            let settled = false;
            const timeoutMs = Math.max(1, Math.min(5000, options.timeoutMs ?? 2000));
            const controller = new AbortController();
            let timeoutId: number | null = null;
            let unsubscribe: () => void = () => undefined;
            const userAbortListeners: Array<[string, EventListener]> = [];
            const cleanup = () => {
                if (timeoutId !== null) window.clearTimeout(timeoutId);
                unsubscribe();
                controller.signal.removeEventListener('abort', onAbort);
                for (const [type, handler] of userAbortListeners) {
                    window.removeEventListener(type, handler, true);
                }
                options.signal?.removeEventListener('abort', onAbort);
            };
            const finish = (result: ConversationLocateResultV2) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
            };
            const onAbort = () => finish({ kind: 'cancelled' });
            const check = () => {
                const mount = this.readMount(slotKey);
                if (!mount?.assistant?.anchorElement.isConnected && !mount?.user?.anchorElement.isConnected) return;
                this.preciseScroll(mount, align);
                finish({
                    kind: 'located',
                    phase: 'hydrated',
                    ref: this.createRef(slotKey),
                    surfaceToken: mount.assistant?.surfaceToken ?? mount.user?.surfaceToken ?? null,
                });
            };
            unsubscribe = this.subscribe((change) => {
                if (change.changed.includes('materialization') || change.changed.includes('topology')) check();
            });
            timeoutId = window.setTimeout(() => finish({ kind: 'unavailable', reason: 'hydration-timeout' }), timeoutMs);
            for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
                const handler = () => controller.abort();
                userAbortListeners.push([type, handler]);
                window.addEventListener(type, handler, true);
            }
            controller.signal.addEventListener('abort', onAbort, { once: true });
            if (options.signal) {
                if (options.signal.aborted) {
                    onAbort();
                    return;
                }
                options.signal.addEventListener('abort', onAbort, { once: true });
            }
            if (!session.scrollSlotIntoView(round.entry, 'assistant', align)) {
                finish({ kind: 'unavailable', reason: 'slot-missing' });
                return;
            }
            check();
        });
    }

    dispose(): void {
        this.disposed = true;
        this.disposeSession();
        this.listeners.clear();
        this.resetStore();
        this.document = null;
        this.snapshot = { kind: 'idle', document: null, entries: Object.freeze([]) };
    }

    private ingest(batch: HostEvidenceBatchV2): void {
        if (this.disposed || !this.document || batch.epochId !== this.document.documentEpochId) return;
        if (this.seenBatchIds.has(batch.batchId) || batch.hostRevision < this.latestHostRevision) return;
        this.seenBatchIds.add(batch.batchId);
        this.latestHostRevision = Math.max(this.latestHostRevision, batch.hostRevision);
        const changed = new Set<ConversationDiscoveryDomainV2>();
        const affected = new Set<string>();
        const compileCandidates = new Set<string>();

        for (const fact of batch.facts) {
            switch (fact.kind) {
                case 'topology-replaced':
                    this.applyTopology(fact.rounds, fact.topologyToken, affected, changed);
                    break;
                case 'topology-unavailable':
                    this.topologyUnavailable = fact.reason;
                    changed.add('topology');
                    break;
                case 'projection-invalidated':
                    this.startNewProjection(fact.fromOrdinal);
                    changed.add('content');
                    break;
                case 'role-mounted':
                    this.applyMount(fact.surface, affected, changed, compileCandidates);
                    break;
                case 'role-unmounted':
                    this.applyUnmount(fact.entry.slotKey, fact.role, affected, changed);
                    break;
                case 'prompt-recognized':
                    this.applyPrompt(fact.entry.slotKey, fact.messageId, fact.text, affected, changed);
                    break;
            }
        }

        if (changed.size > 0) this.publish(Array.from(changed), Array.from(affected));
        for (const slotKey of compileCandidates) this.scheduleCapture(slotKey);
    }

    private applyTopology(
        rounds: readonly HostRoundSlotV2[],
        token: string,
        affected: Set<string>,
        changed: Set<ConversationDiscoveryDomainV2>,
    ): void {
        this.topologyUnavailable = null;
        const nextOrder = rounds.map((round) => round.entry.slotKey);
        if (this.topologyToken === token
            && this.order.length === nextOrder.length
            && this.order.every((slotKey, index) => slotKey === nextOrder[index])) return;
        this.topologyToken = token;
        const previousOrder = this.order;
        this.order = nextOrder;
        this.slots.clear();
        for (const round of rounds) this.slots.set(round.entry.slotKey, round);
        const nextKeys = new Set(nextOrder);
        let removedFacts = false;
        for (const slotKey of previousOrder) {
            if (nextKeys.has(slotKey)) continue;
            this.removeSlotFacts(slotKey);
            removedFacts = true;
        }
        this.revisions = {
            ...this.revisions,
            topology: this.revisions.topology + 1,
            ...(removedFacts ? { content: this.revisions.content + 1 } : {}),
        };
        changed.add('topology');
        for (const slotKey of this.order) affected.add(slotKey);
    }

    private applyMount(
        surface: HostRoleSurfaceV2,
        affected: Set<string>,
        changed: Set<ConversationDiscoveryDomainV2>,
        compileCandidates: Set<string>,
    ): void {
        if (!this.slots.has(surface.entry.slotKey)) return;
        const mount = this.mounted.get(surface.entry.slotKey) ?? { user: null, assistant: null };
        const previous = mount[surface.role];
        mount[surface.role] = surface;
        this.mounted.set(surface.entry.slotKey, mount);
        if (!previous || !sameSurface(previous, surface)) {
            this.revisions = { ...this.revisions, materialization: this.revisions.materialization + 1 };
            changed.add('materialization');
        }
        affected.add(surface.entry.slotKey);
        const identity = this.readIdentity(mount);
        if (identity) {
            this.identities.set(surface.entry.slotKey, identity);
            compileCandidates.add(surface.entry.slotKey);
        }
    }

    private applyUnmount(
        slotKey: string,
        role: 'user' | 'assistant',
        affected: Set<string>,
        changed: Set<ConversationDiscoveryDomainV2>,
    ): void {
        const mount = this.mounted.get(slotKey);
        if (!mount) return;
        mount[role] = null;
        if (!mount.user && !mount.assistant) this.mounted.delete(slotKey);
        this.revisions = { ...this.revisions, materialization: this.revisions.materialization + 1 };
        changed.add('materialization');
        affected.add(slotKey);
    }

    private applyPrompt(
        slotKey: string,
        messageId: string,
        text: string,
        affected: Set<string>,
        changed: Set<ConversationDiscoveryDomainV2>,
    ): void {
        if (!this.slots.has(slotKey)) return;
        const normalizedMessageId = messageId.trim();
        const normalizedText = text.trim();
        if (!normalizedMessageId || !normalizedText) return;
        const previous = this.prompts.get(slotKey);
        if (previous?.messageId === normalizedMessageId && previous.text === normalizedText) return;
        this.prompts.set(slotKey, Object.freeze({
            messageId: normalizedMessageId,
            text: normalizedText,
        }));
        this.revisions = { ...this.revisions, content: this.revisions.content + 1 };
        changed.add('content');
        affected.add(slotKey);
    }

    private async captureTurn(slotKey: string): Promise<void> {
        if (this.pendingCompiles.has(slotKey) || !this.document) return;
        const mount = this.mounted.get(slotKey);
        const identity = mount ? this.readIdentity(mount) : null;
        const user = mount?.user;
        const assistant = mount?.assistant;
        if (!identity || !user || !assistant || user.lifecycle !== 'stable' || assistant.lifecycle !== 'stable') return;
        if (!user.contentRootElement && !user.messageElement) return;
        if (!assistant.contentRootElement && !assistant.messageElement) return;
        const existing = this.turns.get(slotKey);
        if (existing?.turn.identity.assistantMessageId === identity.assistantMessageId && !this.conflicts.has(slotKey)) return;

        this.pendingCompiles.add(slotKey);
        const epochId = this.document.documentEpochId;
        const projectionId = this.document.projectionId;
        const capturedSurfaceTokens = {
            user: user.surfaceToken,
            assistant: assistant.surfaceToken,
        };
        let recaptureRequired = false;
        try {
            const result = await this.options.compiler.compile({
                identity,
                userRootClone: (user.contentRootElement ?? user.messageElement).cloneNode(true) as HTMLElement,
                assistantRootClone: (assistant.contentRootElement ?? assistant.messageElement).cloneNode(true) as HTMLElement,
                userSurfaceToken: user.surfaceToken,
                assistantSurfaceToken: assistant.surfaceToken,
                parser: this.options.parser,
                policy: {
                    maxNodes: 50_000,
                    maxInputCodeUnits: 4_000_000,
                    maxOutputCodeUnits: 4_000_000,
                    maxFormulaCodeUnits: 10_000,
                    maxSliceMs: 8,
                    maxWallTimeMs: 2_000,
                },
            });
            if (result.kind !== 'ready') return;
            if (this.document?.documentEpochId !== epochId || this.document.projectionId !== projectionId) return;
            const currentMount = this.mounted.get(slotKey);
            if (currentMount?.user && currentMount.assistant) {
                const currentIdentity = this.readIdentity(currentMount);
                const sameIdentity = currentIdentity?.turnId === identity.turnId
                    && currentIdentity.userMessageId === identity.userMessageId
                    && currentIdentity.assistantMessageId === identity.assistantMessageId;
                const sameSurface = currentMount.user?.surfaceToken === capturedSurfaceTokens.user
                    && currentMount.assistant?.surfaceToken === capturedSurfaceTokens.assistant;
                if (!sameIdentity || !sameSurface) {
                    // A remount or identity replacement happened while the
                    // clone was compiling. Do not seal the old observation;
                    // the current surface will be captured after this task.
                    recaptureRequired = true;
                    return;
                }
            }
            this.sealTurn(slotKey, identity, result.user, result.assistant, result.semanticDigest);
        } catch (error) {
            logger.warn('[AI-MarkDone][ConversationDiscoveryModuleV2] turn capture failed', error);
        } finally {
            this.pendingCompiles.delete(slotKey);
            if (recaptureRequired) this.scheduleCapture(slotKey);
        }
    }

    private scheduleCapture(slotKey: string): void {
        if (this.pendingCompiles.has(slotKey)) return;
        const task = this.captureTurn(slotKey);
        this.pendingCaptures.add(task);
        void task.finally(() => this.pendingCaptures.delete(task));
    }

    private async flushPendingCaptures(): Promise<void> {
        while (this.pendingCaptures.size > 0) {
            await Promise.all(Array.from(this.pendingCaptures));
        }
    }

    private sealTurn(
        slotKey: string,
        identity: ConversationTurnIdentityV2,
        user: ConversationBodyV2,
        assistant: ConversationBodyV2,
        semanticDigest: string,
    ): void {
        let existing = this.turns.get(slotKey);
        if (existing && existing.turn.identity.assistantMessageId !== identity.assistantMessageId) {
            this.startNewProjection(this.order.indexOf(slotKey) + 1);
            existing = undefined;
        }
        const aliasKey = `assistant:${identity.assistantMessageId}`;
        const aliasOwner = this.aliases.get(aliasKey);
        if (aliasOwner && aliasOwner !== slotKey) {
            if (aliasOwner !== 'conflict') this.conflicts.add(aliasOwner);
            this.conflicts.add(slotKey);
            this.aliases.set(aliasKey, 'conflict');
            this.publish(['content'], aliasOwner !== 'conflict' ? [slotKey, aliasOwner] : [slotKey]);
            return;
        }
        const nextTurnToken = digest({ identity, user, assistant, semanticDigest });
        if (existing && existing.turn.turnToken === nextTurnToken && !this.conflicts.has(slotKey)) return;
        if (existing && existing.turn.turnToken !== nextTurnToken) {
            this.conflicts.add(slotKey);
            this.publish(['content'], [slotKey]);
            return;
        }
        const provenance = Object.freeze({
            authority: 'host-rendered' as const,
            fidelity: 'verified-normalized' as const,
            adapterId: 'chatgpt' as const,
            compilerVersion: 'rendered-content-v2' as const,
        });
        const turn: ConversationSealedTurnV2 = Object.freeze({
            schemaVersion: 2,
            key: `${this.document!.documentKey}:assistant:${identity.assistantMessageId}`,
            identity: Object.freeze({ ...identity }),
            user: Object.freeze({ ...user }),
            assistant: Object.freeze({ ...assistant }),
            turnToken: nextTurnToken,
            provenance,
        });
        this.turns.set(slotKey, { turn, semanticDigest });
        this.identities.set(slotKey, identity);
        this.aliases.set(`turn:${identity.turnId}`, slotKey);
        this.aliases.set(`user:${identity.userMessageId}`, slotKey);
        this.aliases.set(aliasKey, slotKey);
        this.conflicts.delete(slotKey);
        this.revisions = { ...this.revisions, content: this.revisions.content + 1 };
        this.publish(['content'], [slotKey]);
    }

    private startNewProjection(fromOrdinal: number): void {
        if (!this.document) return;
        const cutoff = Math.max(0, fromOrdinal - 1);
        for (let index = cutoff; index < this.order.length; index += 1) {
            const slotKey = this.order[index]!;
            const turn = this.turns.get(slotKey);
            if (turn) {
                this.aliases.delete(`turn:${turn.turn.identity.turnId}`);
                this.aliases.delete(`user:${turn.turn.identity.userMessageId}`);
                this.aliases.delete(`assistant:${turn.turn.identity.assistantMessageId}`);
            }
            this.turns.delete(slotKey);
            this.prompts.delete(slotKey);
            this.identities.delete(slotKey);
            this.conflicts.delete(slotKey);
        }
        this.document = Object.freeze({ ...this.document, projectionId: `projection:${++this.projectionSequence}` });
        this.revisions = { ...this.revisions, content: this.revisions.content + 1 };
    }

    private resolveTarget(target: ConversationTurnTargetV2):
        | { kind: 'ready-target'; slotKey: string }
        | { kind: 'unavailable'; reason: 'not-recognized' | 'stale-target' | 'identity-conflict' } {
        if (!this.document) return { kind: 'unavailable', reason: 'stale-target' };
        if (target.kind === 'entry') {
            if (target.ref.documentEpochId !== this.document.documentEpochId || target.ref.projectionId !== this.document.projectionId) {
                return { kind: 'unavailable', reason: 'stale-target' };
            }
            if (!this.slots.has(target.ref.slotKey)) return { kind: 'unavailable', reason: 'not-recognized' };
            if (this.conflicts.has(target.ref.slotKey)) return { kind: 'unavailable', reason: 'identity-conflict' };
            return { kind: 'ready-target', slotKey: target.ref.slotKey };
        }
        if (target.documentKey !== this.document.documentKey) return { kind: 'unavailable', reason: 'stale-target' };
        const owner = this.aliases.get(`assistant:${target.assistantMessageId}`);
        if (owner === 'conflict') return { kind: 'unavailable', reason: 'identity-conflict' };
        if (!owner || !this.slots.has(owner)) return { kind: 'unavailable', reason: 'not-recognized' };
        if (this.conflicts.has(owner)) return { kind: 'unavailable', reason: 'identity-conflict' };
        return { kind: 'ready-target', slotKey: owner };
    }

    private resolveUnknownTarget(target: ConversationTurnTargetV2): string | null {
        if (target.kind === 'entry' && target.ref.documentEpochId === this.document?.documentEpochId) return target.ref.slotKey;
        return null;
    }

    private readMount(slotKey: string): MutableMount | null {
        return this.mounted.get(slotKey) ?? null;
    }

    private readIdentity(mount: MutableMount): ConversationTurnIdentityV2 | null {
        const user = mount.user;
        const assistant = mount.assistant;
        if (!user || !assistant) return null;
        if (user.lifecycle !== 'stable' || assistant.lifecycle !== 'stable') return null;
        if (!user.turnId || !assistant.turnId || user.turnId !== assistant.turnId) return null;
        if (!user.messageId || !assistant.messageId) return null;
        return Object.freeze({
            turnId: assistant.turnId,
            userMessageId: user.messageId,
            assistantMessageId: assistant.messageId,
        });
    }

    private preciseScroll(mount: MutableMount, align: 'start' | 'center'): void {
        const anchor = mount.assistant?.anchorElement ?? mount.user?.anchorElement;
        if (!anchor?.isConnected) return;
        try {
            anchor.scrollIntoView({ behavior: 'auto', block: align });
        } catch {
        }
    }

    private createRef(slotKey: string): ConversationEntryRefV2 {
        return Object.freeze({
            documentEpochId: this.document!.documentEpochId,
            projectionId: this.document!.projectionId,
            slotKey,
        });
    }

    private createTurnRevision(turnToken: string): ConversationTurnRevisionV2 {
        return Object.freeze({
            documentEpochId: this.document!.documentEpochId,
            projectionId: this.document!.projectionId,
            topologyToken: this.topologyToken,
            contentToken: this.contentToken(),
            turnToken,
        });
    }

    private publish(changed: readonly ConversationDiscoveryDomainV2[], affectedSlotKeys: readonly string[]): void {
        this.snapshot = this.buildSnapshot();
        const refs = affectedSlotKeys.map((slotKey) => this.createRef(slotKey));
        const change: ConversationDiscoveryChangeV2 = Object.freeze({
            changed: Object.freeze([...new Set(changed)]),
            affectedEntries: Object.freeze(refs),
            snapshot: this.snapshot,
        });
        for (const listener of Array.from(this.listeners)) this.emitTo(listener, change);
    }

    private buildSnapshot(): ConversationDiscoverySnapshotV2 {
        if (!this.document) {
            return { kind: 'unavailable', document: null, reason: 'unsupported-route', entries: Object.freeze([]) };
        }
        if (this.topologyUnavailable || this.order.length === 0) {
            return {
                kind: 'unavailable',
                document: this.document,
                reason: this.topologyUnavailable ?? 'host-root-unavailable',
                entries: Object.freeze([]),
            };
        }
        const entries: ConversationIndexEntryV2[] = this.order.map((slotKey, index) => {
            const turn = this.turns.get(slotKey)?.turn ?? null;
            const mount = this.mounted.get(slotKey);
            const identity = turn?.identity ?? this.identities.get(slotKey) ?? null;
            const materialization: ConversationEntryMaterializationV2 = Object.freeze({
                kind: mount?.user?.anchorElement.isConnected || mount?.assistant?.anchorElement.isConnected ? 'mounted' : 'shell',
                user: mount?.user ?? null,
                assistant: mount?.assistant ?? null,
            });
            return Object.freeze({
                ref: this.createRef(slotKey),
                position: index + 1,
                label: turn
                    ? Object.freeze({ kind: 'prompt' as const, text: turn.user.text })
                    : this.prompts.has(slotKey)
                        ? Object.freeze({ kind: 'prompt' as const, text: this.prompts.get(slotKey)!.text })
                    : Object.freeze({ kind: 'placeholder' as const, text: this.placeholder(index + 1) }),
                identity,
                content: turn && !this.conflicts.has(slotKey)
                    ? Object.freeze({ kind: 'ready' as const, turnToken: turn.turnToken })
                    : Object.freeze({ kind: 'unavailable' as const }),
                materialization,
            });
        });
        const revisions = Object.freeze({ ...this.revisions });
        const tokens: ConversationTokenSetV2 = Object.freeze({
            topologyToken: this.topologyToken,
            contentToken: this.contentToken(),
            materializationToken: this.materializationToken(),
        });
        return Object.freeze({
            kind: 'ready',
            document: this.document,
            revisions,
            tokens,
            totalCount: entries.length,
            readyCount: entries.filter((entry) => entry.content.kind === 'ready').length,
            entries: Object.freeze(entries),
        });
    }

    private contentToken(): string {
        const turns = Array.from(this.turns.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([slotKey, stored]) => `${slotKey}:${stored.turn.turnToken}`)
            .join('|');
        const prompts = Array.from(this.prompts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([slotKey, prompt]) => `${slotKey}:${prompt.messageId}:${prompt.text}`)
            .join('|');
        return `content:${this.revisions.content}:${hash(`${this.document?.projectionId ?? 'none'}:${turns}|prompts:${prompts}`)}`;
    }

    private materializationToken(): string {
        const mounts = Array.from(this.mounted.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([slotKey, mount]) => `${slotKey}:${mount.user?.surfaceToken ?? '-'}:${mount.assistant?.surfaceToken ?? '-'}`)
            .join('|');
        return `materialization:${this.revisions.materialization}:${hash(mounts)}`;
    }

    private currentRefs(): ConversationEntryRefV2[] {
        return this.order.map((slotKey) => this.createRef(slotKey));
    }

    private placeholder(position: number): string {
        return this.options.placeholderLabel?.(position) ?? `Message ${position}`;
    }

    private emitTo(listener: (change: ConversationDiscoveryChangeV2) => void, change: ConversationDiscoveryChangeV2): void {
        try {
            listener(change);
        } catch (error) {
            logger.warn('[AI-MarkDone][ConversationDiscoveryModuleV2] subscriber failed', error);
        }
    }

    private disposeSession(): void {
        this.session?.dispose();
        this.session = null;
    }

    private resetStore(): void {
        this.slots.clear();
        this.turns.clear();
        this.prompts.clear();
        this.identities.clear();
        this.aliases.clear();
        this.mounted.clear();
        this.conflicts.clear();
        this.seenBatchIds.clear();
        this.pendingCompiles.clear();
        this.pendingCaptures.clear();
        this.order = [];
        this.latestHostRevision = 0;
        this.revisions = { topology: 0, content: 0, materialization: 0 };
        this.topologyToken = 'topology:none';
        this.topologyUnavailable = null;
        this.snapshot = { kind: 'idle', document: null, entries: Object.freeze([]) };
    }

    private removeSlotFacts(slotKey: string): void {
        const turn = this.turns.get(slotKey);
        if (turn) {
            this.aliases.delete(`turn:${turn.turn.identity.turnId}`);
            this.aliases.delete(`user:${turn.turn.identity.userMessageId}`);
            this.aliases.delete(`assistant:${turn.turn.identity.assistantMessageId}`);
        }
        this.turns.delete(slotKey);
        this.prompts.delete(slotKey);
        this.identities.delete(slotKey);
        this.mounted.delete(slotKey);
        this.conflicts.delete(slotKey);
    }
}

function sameSurface(a: HostRoleSurfaceV2, b: HostRoleSurfaceV2): boolean {
    return a.surfaceToken === b.surfaceToken
        && a.lifecycle === b.lifecycle
        && a.turnId === b.turnId
        && a.messageId === b.messageId
        && a.anchorElement === b.anchorElement
        && a.messageElement === b.messageElement
        && a.contentRootElement === b.contentRootElement;
}

function digest(value: unknown): string {
    const input = JSON.stringify(value);
    let hashValue = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hashValue ^= input.charCodeAt(index);
        hashValue = Math.imul(hashValue, 16777619);
    }
    return (hashValue >>> 0).toString(16).padStart(8, '0');
}

function hash(value: string): string {
    return digest(value);
}
