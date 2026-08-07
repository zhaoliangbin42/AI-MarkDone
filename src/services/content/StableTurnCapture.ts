import type { ConversationTurnV1 } from '../../contracts/conversationContent';

export type StableTurnObservationV1 = Readonly<{
    turn: ConversationTurnV1;
    lifecycle: 'stable' | 'streaming' | 'incomplete';
    captureId: string;
    revision: number;
}>;

export type StableTurnCaptureResultV1 =
    | Readonly<{ kind: 'ready'; turn: ConversationTurnV1 }>
    | Readonly<{ kind: 'pending'; turnId: string; assistantMessageId: string }>
    | Readonly<{
        kind: 'unavailable';
        reason: 'invalid-identity' | 'invalid-content' | 'evidence-conflict';
        turnId?: string;
        assistantMessageId?: string;
    }>;

type SealedTurn = Readonly<{
    turn: ConversationTurnV1;
    digest: string;
    captureId: string;
    revision: number;
}>;

/**
 * Provider-neutral stability gate for host-rendered turns.
 *
 * A DOM observation is evidence, not content.  Only a typed identity with a
 * complete, non-streaming semantic body can cross this gate.  The first
 * accepted digest is sealed; later divergent observations become an explicit
 * conflict instead of replacing user-visible content.
 */
export class StableTurnCapture {
    private readonly sealed = new Map<string, SealedTurn>();

    reset(): void {
        this.sealed.clear();
    }

    capture(observation: StableTurnObservationV1): StableTurnCaptureResultV1 {
        const { turn } = observation;
        const turnId = turn.identity.turnId.trim();
        const assistantMessageId = turn.identity.assistantMessageId.trim();
        if (!turnId || !assistantMessageId) {
            return {
                kind: 'unavailable',
                reason: 'invalid-identity',
                turnId: turnId || undefined,
                assistantMessageId: assistantMessageId || undefined,
            };
        }
        if (observation.lifecycle !== 'stable') {
            return { kind: 'pending', turnId, assistantMessageId };
        }
        if (!turn.userText.trim() || !turn.assistantMarkdown.trim()) {
            return {
                kind: 'unavailable',
                reason: 'invalid-content',
                turnId,
                assistantMessageId,
            };
        }

        const key = `assistant:${assistantMessageId}`;
        const digest = digestTurn(turn);
        const previous = this.sealed.get(key);
        if (previous) {
            return previous.digest === digest
                ? { kind: 'ready', turn: previous.turn }
                : {
                    kind: 'unavailable',
                    reason: 'evidence-conflict',
                    turnId,
                    assistantMessageId,
                };
        }

        const sealed = Object.freeze({
            turn: freezeTurn(turn),
            digest,
            captureId: observation.captureId,
            revision: observation.revision,
        });
        this.sealed.set(key, sealed);
        return { kind: 'ready', turn: sealed.turn };
    }

    has(assistantMessageId: string): boolean {
        return this.sealed.has(`assistant:${assistantMessageId}`);
    }
}

function freezeTurn(turn: ConversationTurnV1): ConversationTurnV1 {
    return Object.freeze({
        ...turn,
        identity: Object.freeze({ ...turn.identity }),
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
    });
}

function digestTurn(turn: ConversationTurnV1): string {
    return JSON.stringify({
        identity: turn.identity,
        userText: turn.userText,
        assistantMarkdown: turn.assistantMarkdown,
        assistantProvenance: turn.assistantProvenance,
    });
}
