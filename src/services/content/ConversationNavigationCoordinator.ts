import type {
    ConversationContentSourceV1,
    ConversationSnapshotV1,
} from '../../contracts/conversationContent';
import type {
    ConversationCanonicalTargetV1,
    ConversationNavigationInputV1,
    ConversationNavigationOptionsV1,
    ConversationNavigationPortV1,
    ConversationNavigationResultV1,
} from '../../contracts/conversationNavigation';

export type ConversationNavigationExecutorV1 = (
    target: ConversationCanonicalTargetV1,
    options: ConversationNavigationOptionsV1,
) => Promise<Readonly<{ ok: true } | { ok: false; message: string }>>;

export type ConversationNavigationCoordinatorOptionsV1 = Readonly<{
    source: ConversationContentSourceV1;
    execute: ConversationNavigationExecutorV1;
}>;

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 15_000;

type ResolvedTarget = Readonly<{
    target: ConversationCanonicalTargetV1;
    resolvedBy: 'identity' | 'position';
}>;

type ActiveNavigation = Readonly<{
    key: string;
    controller: AbortController;
    promise: Promise<ConversationNavigationResultV1>;
}>;

function normalize(value: string | null | undefined): string | null {
    const result = value?.trim();
    return result || null;
}

function isCompleteSnapshot(snapshot: ConversationSnapshotV1): boolean {
    return snapshot.coverage === 'complete' && snapshot.turns.length > 0;
}

function targetKey(input: ConversationNavigationInputV1): string {
    return [
        input.documentKey ?? '',
        input.position,
        input.messageId ?? '',
        input.roundId ?? '',
        input.userMessageId ?? '',
        input.assistantMessageId ?? '',
    ].join('|');
}

function readIdentityMatches(
    snapshot: ConversationSnapshotV1,
    input: ConversationNavigationInputV1,
): ConversationSnapshotV1['turns'] {
    const expectedRoundId = normalize(input.roundId);
    const expectedUserMessageId = normalize(input.userMessageId);
    const expectedAssistantMessageId = normalize(input.assistantMessageId ?? input.messageId);
    return snapshot.turns.filter((turn) => (
        (!expectedRoundId || turn.identity.turnId === expectedRoundId)
        && (!expectedUserMessageId || turn.identity.userMessageId === expectedUserMessageId)
        && (!expectedAssistantMessageId || turn.identity.assistantMessageId === expectedAssistantMessageId)
    ));
}

function canUsePositionFallback(input: ConversationNavigationInputV1): boolean {
    return input.source === 'bookmark' || input.source === 'pending-restore';
}

function buildTarget(
    snapshot: ConversationSnapshotV1,
    turn: ConversationSnapshotV1['turns'][number],
): ConversationCanonicalTargetV1 {
    return Object.freeze({
        documentKey: snapshot.document.key,
        position: turn.ordinal,
        roundId: turn.identity.turnId,
        userMessageId: turn.identity.userMessageId,
        assistantMessageId: turn.identity.assistantMessageId,
    });
}

function tryResolve(
    state: ReturnType<ConversationContentSourceV1['read']>,
    input: ConversationNavigationInputV1,
): Readonly<{
    kind: 'resolved';
    value: ResolvedTarget;
} | {
    kind: 'wait';
} | {
    kind: 'failed';
    reason: 'stale-target' | 'identity-conflict' | 'source-unavailable';
}> {
    const snapshot = state.snapshot;
    if (!snapshot || !state.document) return { kind: 'wait' };
    if (input.documentKey && input.documentKey !== state.document.key) {
        return { kind: 'failed', reason: 'stale-target' };
    }

    const hasIdentity = Boolean(
        normalize(input.roundId)
        || normalize(input.userMessageId)
        || normalize(input.assistantMessageId ?? input.messageId),
    );
    const identityMatches = hasIdentity ? readIdentityMatches(snapshot, input) : [];
    if (identityMatches.length > 1) return { kind: 'failed', reason: 'identity-conflict' };
    if (identityMatches.length === 1) {
        const turn = identityMatches[0]!;
        if (Number.isFinite(input.position) && input.position > 0 && Math.round(input.position) !== turn.ordinal) {
            return { kind: 'failed', reason: 'identity-conflict' };
        }
        return {
            kind: 'resolved',
            value: { target: buildTarget(snapshot, turn), resolvedBy: 'identity' },
        };
    }

    if (!isCompleteSnapshot(snapshot)) return { kind: 'wait' };
    if (!canUsePositionFallback(input)) return { kind: 'failed', reason: 'source-unavailable' };
    if (!Number.isFinite(input.position) || input.position <= 0) {
        return { kind: 'failed', reason: 'source-unavailable' };
    }
    const turn = snapshot.turns.find((candidate) => candidate.ordinal === Math.round(input.position));
    if (!turn) return { kind: 'failed', reason: 'source-unavailable' };
    return {
        kind: 'resolved',
        value: { target: buildTarget(snapshot, turn), resolvedBy: 'position' },
    };
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
    if (!source) return () => undefined;
    const abort = () => target.abort();
    if (source.aborted) target.abort();
    source.addEventListener('abort', abort, { once: true });
    return () => source.removeEventListener('abort', abort);
}

export class ConversationNavigationCoordinator implements ConversationNavigationPortV1 {
    private active: ActiveNavigation | null = null;

    constructor(private readonly options: ConversationNavigationCoordinatorOptionsV1) {}

    navigate(
        input: ConversationNavigationInputV1,
        options: ConversationNavigationOptionsV1 = {},
    ): Promise<ConversationNavigationResultV1> {
        const key = targetKey(input);
        if (this.active?.key === key) return this.active.promise;
        this.cancelActive();

        const controller = new AbortController();
        const unlink = linkAbortSignal(options.signal, controller);
        const timeoutMs = Math.max(1, Math.min(MAX_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        const promise = this.run(input, { ...options, signal: controller.signal, timeoutMs })
            .finally(() => {
                unlink();
                if (this.active?.controller === controller) this.active = null;
            });
        this.active = { key, controller, promise };
        return promise;
    }

    cancelActive(): void {
        this.active?.controller.abort();
        this.active = null;
    }

    private async run(
        input: ConversationNavigationInputV1,
        options: ConversationNavigationOptionsV1 & { signal: AbortSignal; timeoutMs: number },
    ): Promise<ConversationNavigationResultV1> {
        const resolved = await this.waitForTarget(input, options);
        if (resolved.kind !== 'resolved') return { ok: false, reason: resolved.reason };
        if (options.signal.aborted) return { ok: false, reason: 'cancelled' };

        const execution = await this.options.execute(resolved.value.target, options);
        if (!execution.ok) {
            if (options.signal.aborted || execution.message === 'Navigation cancelled') {
                return { ok: false, reason: 'cancelled' };
            }
            if (execution.message.includes('timeout')) return { ok: false, reason: 'hydration-timeout' };
            if (execution.message.includes('conflict')) return { ok: false, reason: 'identity-conflict' };
            if (execution.message.includes('stale') || execution.message.includes('route')) {
                return { ok: false, reason: 'stale-target' };
            }
            return { ok: false, reason: 'slot-missing' };
        }
        return {
            ok: true,
            phase: 'hydrated',
            resolvedBy: resolved.value.resolvedBy,
            target: resolved.value.target,
        };
    }

    private waitForTarget(
        input: ConversationNavigationInputV1,
        options: ConversationNavigationOptionsV1 & { signal: AbortSignal; timeoutMs: number },
    ): Promise<Readonly<{
        kind: 'resolved';
        value: ResolvedTarget;
    } | {
        kind: 'failed';
        reason: 'cancelled' | 'stale-target' | 'identity-conflict' | 'source-unavailable' | 'hydration-timeout';
    }>> {
        return new Promise((resolve) => {
            let settled = false;
            let timeoutId = 0;
            let unsubscribe: () => void = () => undefined;
            const finish = (result: Readonly<{
                kind: 'resolved';
                value: ResolvedTarget;
            } | {
                kind: 'failed';
                reason: 'cancelled' | 'stale-target' | 'identity-conflict' | 'source-unavailable' | 'hydration-timeout';
            }>) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                unsubscribe();
                options.signal.removeEventListener('abort', onAbort);
                resolve(result);
            };
            const onAbort = () => finish({ kind: 'failed', reason: 'cancelled' });
            const check = () => {
                if (options.signal.aborted) return onAbort();
                const result = tryResolve(this.options.source.read(), input);
                if (result.kind === 'resolved') return finish(result);
                if (result.kind === 'failed') {
                    return finish(result);
                }
            };
            unsubscribe = this.options.source.subscribe(check);
            options.signal.addEventListener('abort', onAbort, { once: true });
            timeoutId = window.setTimeout(() => finish({ kind: 'failed', reason: 'hydration-timeout' }), options.timeoutMs);
            check();
        });
    }
}
