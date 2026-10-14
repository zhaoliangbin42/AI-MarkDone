/**
 * Shared content-runtime navigation seam.
 *
 * Consumers provide the strongest identity they have. Platform adapters
 * resolve that input against the canonical conversation source and own all
 * host-specific materialization details.
 */

export type ConversationNavigationSourceV1 =
    | 'directory'
    | 'bookmark'
    | 'reader'
    | 'stepper';

export type ConversationNavigationInputV1 = Readonly<{
    /** Last known display position; a unique assistant identity takes precedence. */
    position: number;
    messageId?: string | null;
    roundId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
    documentKey?: string | null;
    source: ConversationNavigationSourceV1;
}>;

export type ConversationCanonicalTargetV1 = Readonly<{
    documentKey: string;
    position: number;
    roundId: string;
    userMessageId: string | null;
    assistantMessageId: string;
}>;

export type ConversationNavigationFailureReasonV1 =
    | 'cancelled'
    | 'stale-target'
    | 'identity-conflict'
    | 'slot-missing'
    | 'hydration-timeout'
    | 'source-unavailable';

export type ConversationNavigationResultV1 =
    | Readonly<{
        ok: true;
        phase: 'already-mounted' | 'hydrated';
        resolvedBy: 'identity' | 'position';
        target: ConversationCanonicalTargetV1;
    }>
    | Readonly<{
        ok: false;
        reason: ConversationNavigationFailureReasonV1;
    }>;

export type ConversationNavigationOptionsV1 = Readonly<{
    align?: 'start' | 'center';
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Absolute Date.now() deadline shared by source, hydration and alignment. */
    deadlineMs?: number;
}>;

export interface ConversationNavigationPortV1 {
    navigate(
        input: ConversationNavigationInputV1,
        options?: ConversationNavigationOptionsV1,
    ): Promise<ConversationNavigationResultV1>;

    cancelActive(): void;
}
