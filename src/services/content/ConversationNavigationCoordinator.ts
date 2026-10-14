import type {
    ConversationContentSourceV1,
    ConversationSnapshotV1,
} from '../../contracts/conversationContent';
import { getConversationHistoryStatusV1 } from '../../contracts/conversationContent';
import type {
    ConversationCanonicalTargetV1,
    ConversationNavigationInputV1,
    ConversationNavigationFailureReasonV1,
    ConversationNavigationOptionsV1,
    ConversationNavigationPortV1,
    ConversationNavigationResultV1,
} from '../../contracts/conversationNavigation';

export type ConversationNavigationExecutorV1 = (
    target: ConversationCanonicalTargetV1,
    options: ConversationNavigationOptionsV1,
    source: ConversationNavigationInputV1['source'],
) => Promise<Readonly<{ ok: true } | { ok: false; message: string; reason?: ConversationNavigationFailureReasonV1 }>>;

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

function isCompleteSnapshot(snapshot: ConversationSnapshotV1): boolean {
    return snapshot.coverage === 'complete' && getConversationHistoryStatusV1(snapshot) === 'complete';
}

function targetKey(input: ConversationNavigationInputV1): string {
    return [
        input.source,
        input.documentKey ?? '',
        input.position,
        input.messageId ?? '',
        input.roundId ?? '',
        input.userMessageId ?? '',
        input.assistantMessageId ?? '',
    ].join('|');
}

function normalize(value: string | null | undefined): string | null {
    const result = value?.trim();
    return result || null;
}

function readIdentityMatches(
    snapshot: ConversationSnapshotV1,
    input: ConversationNavigationInputV1,
): ConversationSnapshotV1['turns'] {
    const expectedAssistantMessageId = normalize(input.assistantMessageId ?? input.messageId);
    const expectedRoundId = expectedAssistantMessageId ? null : normalize(input.roundId);
    const expectedUserMessageId = expectedAssistantMessageId ? null : normalize(input.userMessageId);
    return snapshot.turns.filter((turn) => (
        (!expectedRoundId || turn.identity.turnId === expectedRoundId)
        && (!expectedUserMessageId || turn.identity.userMessageId === expectedUserMessageId)
        && (!expectedAssistantMessageId || turn.identity.assistantMessageId === expectedAssistantMessageId)
    ));
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
    if (input.documentKey && state.document && input.documentKey !== state.document.key) {
        return { kind: 'failed', reason: 'stale-target' };
    }
    if (!snapshot || !state.document) return { kind: 'wait' };
    if (snapshot.document.key !== state.document.key) return { kind: 'failed', reason: 'stale-target' };
    const assistantId = normalize(input.assistantMessageId ?? input.messageId);
    if (normalize(input.assistantMessageId) && normalize(input.messageId) && normalize(input.messageId) !== assistantId) {
        return { kind: 'failed', reason: 'identity-conflict' };
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
        const roundId = normalize(input.roundId);
        const userMessageId = normalize(input.userMessageId);
        // Provisional turn/user labels may change; another known turn is a real conflict.
        if (assistantId && snapshot.turns.some(candidate => (
            (roundId && roundId !== turn.identity.turnId && candidate.identity.turnId === roundId)
            || (userMessageId && userMessageId !== turn.identity.userMessageId && candidate.identity.userMessageId === userMessageId)
        ))) return { kind: 'failed', reason: 'identity-conflict' };
        if (!assistantId && input.source !== 'bookmark' && Number.isFinite(input.position) && input.position > 0 && Math.round(input.position) !== turn.ordinal) {
            return { kind: 'failed', reason: 'identity-conflict' };
        }
        return {
            kind: 'resolved',
            value: { target: buildTarget(snapshot, turn), resolvedBy: 'identity' },
        };
    }

    return hasIdentity && !isCompleteSnapshot(snapshot)
        ? { kind: 'wait' }
        : { kind: 'failed', reason: 'source-unavailable' };
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
    if (!source) return () => undefined;
    const abort = () => target.abort('cancelled');
    if (source.aborted) abort();
    source.addEventListener('abort', abort, { once: true });
    return () => source.removeEventListener('abort', abort);
}

function abortReason(signal: AbortSignal): 'cancelled' | 'hydration-timeout' | 'stale-target' {
    return signal.reason === 'hydration-timeout' || signal.reason === 'stale-target'
        ? signal.reason
        : 'cancelled';
}

export class ConversationNavigationCoordinator implements ConversationNavigationPortV1 {
    private active: ActiveNavigation | null = null;

    constructor(private readonly options: ConversationNavigationCoordinatorOptionsV1) {}

    navigate(
        input: ConversationNavigationInputV1,
        options: ConversationNavigationOptionsV1 = {},
    ): Promise<ConversationNavigationResultV1> {
        const key = targetKey(input);
        if (
            input.source !== 'directory'
            && input.source !== 'stepper'
            && this.active?.key === key
            && !this.active.controller.signal.aborted
        ) return this.active.promise;
        this.cancelActive();

        const controller = new AbortController();
        const unlink = linkAbortSignal(options.signal, controller);
        const timeoutMs = Math.max(1, Math.min(MAX_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        const deadlineMs = Math.min(Date.now() + timeoutMs, options.deadlineMs ?? Infinity);
        const abortForUser = () => controller.abort('cancelled');
        const userEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
        for (const event of userEvents) document.addEventListener(event, abortForUser, { capture: true, passive: true });
        const initialState = this.options.source.read();
        let documentKey = input.documentKey ?? initialState.document?.key;
        let observedDocument = Boolean(initialState.document);
        let projectionId = initialState.snapshot?.projectionId;
        const unsubscribeBoundary = this.options.source.subscribe(state => {
            if (documentKey && (observedDocument || state.document) && state.document?.key !== documentKey) controller.abort('stale-target');
            if (projectionId && state.snapshot?.projectionId && state.snapshot.projectionId !== projectionId) controller.abort('stale-target');
            observedDocument ||= Boolean(state.document);
            documentKey ??= state.document?.key;
            projectionId ??= state.snapshot?.projectionId;
        });
        if (deadlineMs <= Date.now()) controller.abort('hydration-timeout');
        const timeoutId = window.setTimeout(() => controller.abort('hydration-timeout'), Math.max(0, deadlineMs - Date.now()));
        let onAbort: () => void = () => undefined;
        const interrupted = new Promise<ConversationNavigationResultV1>(resolve => {
            onAbort = () => resolve({ ok: false, reason: abortReason(controller.signal) });
            controller.signal.addEventListener('abort', onAbort, { once: true });
            if (controller.signal.aborted) onAbort();
        });
        const promise = Promise.race([
            this.run(input, { ...options, signal: controller.signal, timeoutMs, deadlineMs }),
            interrupted,
        ])
            .catch((): ConversationNavigationResultV1 => ({
                ok: false,
                reason: controller.signal.aborted ? abortReason(controller.signal) : 'source-unavailable',
            }))
            .finally(() => {
                unlink();
                unsubscribeBoundary();
                window.clearTimeout(timeoutId);
                controller.signal.removeEventListener('abort', onAbort);
                for (const event of userEvents) document.removeEventListener(event, abortForUser, { capture: true });
                if (this.active?.controller === controller) this.active = null;
            });
        this.active = { key, controller, promise };
        return promise;
    }

    cancelActive(): void {
        this.active?.controller.abort('cancelled');
        this.active = null;
    }

    private async run(
        input: ConversationNavigationInputV1,
        options: ConversationNavigationOptionsV1 & { signal: AbortSignal; timeoutMs: number },
    ): Promise<ConversationNavigationResultV1> {
        const resolved = await this.waitForTarget(input, options);
        if (resolved.kind !== 'resolved') return { ok: false, reason: resolved.reason };
        if (options.signal.aborted) return { ok: false, reason: abortReason(options.signal) };

        const execution = await this.options.execute(resolved.value.target, options, input.source);
        if (options.signal.aborted) return { ok: false, reason: abortReason(options.signal) };
        if (!execution.ok) {
            if (execution.reason) return { ok: false, reason: execution.reason };
            if (execution.message === 'Navigation cancelled') {
                return { ok: false, reason: 'cancelled' };
            }
            if (execution.message.includes('timeout')) return { ok: false, reason: 'hydration-timeout' };
            if (execution.message.includes('conflict')) return { ok: false, reason: 'identity-conflict' };
            if (execution.message.includes('stale') || execution.message.includes('route') || execution.message === 'Conversation changed') {
                return { ok: false, reason: 'stale-target' };
            }
            return { ok: false, reason: 'slot-missing' };
        }
        const verified = tryResolve(this.options.source.read(), {
            ...input,
            assistantMessageId: resolved.value.target.assistantMessageId,
            documentKey: resolved.value.target.documentKey,
        });
        if (verified.kind !== 'resolved') return { ok: false, reason: verified.kind === 'failed' ? verified.reason : 'stale-target' };
        return {
            ok: true,
            phase: 'hydrated',
            resolvedBy: resolved.value.resolvedBy,
            target: verified.value.target,
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
                unsubscribe();
                options.signal.removeEventListener('abort', onAbort);
                resolve(result);
            };
            const onAbort = () => finish({ kind: 'failed', reason: abortReason(options.signal) });
            const check = () => {
                if (options.signal.aborted) return onAbort();
                const result = tryResolve(this.options.source.read(), input);
                if (result.kind === 'resolved') return finish(result);
                if (result.kind === 'failed') {
                    return finish(result);
                }
            };
            options.signal.addEventListener('abort', onAbort, { once: true });
            unsubscribe = this.options.source.subscribe(check);
            if (settled) unsubscribe();
            else check();
        });
    }
}
