import type {
    ChatGPTConversationProof,
    ChatGPTConversationRound,
    ChatGPTConversationSnapshot,
    ChatGPTConversationState,
    ChatGPTDomTurnFact,
    ChatGPTDomTurnObservation,
} from './types';

export type ChatGPTConversationGraphFact = {
    kind: 'graph';
    routeEpoch: number;
    conversationId: string;
    branchKey: string;
    capturedAt: number;
    rounds: readonly ChatGPTConversationRound[];
};

export type ChatGPTConversationRouteFact = {
    kind: 'route';
    routeEpoch: number;
    conversationId: string | null;
    allowBirth: boolean;
    preserveBirth: boolean;
};

export type ChatGPTConversationDomFact = {
    kind: 'dom';
    routeEpoch: number;
    conversationId: string | null;
    observation: ChatGPTDomTurnObservation;
};

export type ChatGPTConversationFact =
    | ChatGPTConversationGraphFact
    | ChatGPTConversationRouteFact
    | ChatGPTConversationDomFact;

export type ChatGPTConversationModel = {
    state: ChatGPTConversationState;
    proof: ChatGPTConversationProof | null;
    branchKey: string | null;
    rounds: readonly ChatGPTConversationRound[];
    graphRounds: readonly ChatGPTConversationRound[];
    birth: {
        eligible: boolean;
        sawStreaming: boolean;
    };
};

function cleanId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function cleanText(value: string | null | undefined): string {
    return String(value ?? '').trim();
}

function sameRoundIdentity(
    left: Pick<ChatGPTConversationRound, 'id' | 'userMessageId' | 'assistantMessageId' | 'messageId'>,
    right: Pick<ChatGPTConversationRound, 'id' | 'userMessageId' | 'assistantMessageId' | 'messageId'>,
): boolean {
    const leftAssistant = cleanId(left.assistantMessageId) ?? cleanId(left.messageId);
    const rightAssistant = cleanId(right.assistantMessageId) ?? cleanId(right.messageId);
    return cleanId(left.id) === cleanId(right.id)
        && cleanId(left.userMessageId) === cleanId(right.userMessageId)
        && leftAssistant === rightAssistant;
}

function sameRound(left: ChatGPTConversationRound, right: ChatGPTConversationRound): boolean {
    return left.position === right.position
        && sameRoundIdentity(left, right)
        && left.userPrompt === right.userPrompt
        && left.assistantContent === right.assistantContent
        && left.preview === right.preview;
}

function sameRounds(
    left: readonly ChatGPTConversationRound[],
    right: readonly ChatGPTConversationRound[],
): boolean {
    return left.length === right.length && left.every((round, index) => sameRound(round, right[index]!));
}

function truncatePreview(value: string, maxLength = 180): string {
    const text = cleanText(value).replace(/\s+/g, ' ');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function factToRound(fact: ChatGPTDomTurnFact, position: number): ChatGPTConversationRound | null {
    const roundId = cleanId(fact.roundId)
        ?? cleanId(fact.assistantTurnId)
        ?? cleanId(fact.userMessageId);
    const userMessageId = cleanId(fact.userMessageId);
    const assistantMessageId = cleanId(fact.assistantMessageId);
    const userPrompt = cleanText(fact.userPrompt);
    const assistantContent = cleanText(fact.assistantContent);
    if (
        fact.status !== 'complete'
        || !roundId
        || !userMessageId
        || !assistantMessageId
        || !userPrompt
        || !assistantContent
    ) {
        return null;
    }
    return {
        id: roundId,
        position,
        userPrompt,
        assistantContent,
        preview: truncatePreview(userPrompt),
        messageId: assistantMessageId,
        userMessageId,
        assistantMessageId,
    };
}

function hasUniqueDomIdentity(rounds: readonly ChatGPTDomTurnFact[]): boolean {
    const roundIds = new Set<string>();
    const userIds = new Set<string>();
    const assistantIds = new Set<string>();
    for (const round of rounds) {
        const roundId = cleanId(round.roundId) ?? cleanId(round.assistantTurnId);
        const userId = cleanId(round.userMessageId);
        const assistantId = cleanId(round.assistantMessageId);
        if (roundId && roundIds.has(roundId)) return false;
        if (userId && userIds.has(userId)) return false;
        if (assistantId && assistantIds.has(assistantId)) return false;
        if (roundId) roundIds.add(roundId);
        if (userId) userIds.add(userId);
        if (assistantId) assistantIds.add(assistantId);
    }
    return true;
}

function publish(
    model: ChatGPTConversationModel,
    input: {
        status: ChatGPTConversationState['status'];
        conversationId: string | null;
        proof: ChatGPTConversationProof | null;
        branchKey: string | null;
        rounds: readonly ChatGPTConversationRound[];
        capturedAt: number;
        reason?: ChatGPTConversationState['reason'];
    },
): ChatGPTConversationModel {
    const previous = model.state;
    const sameSnapshot = previous.snapshot
        && input.proof
        && input.branchKey
        && previous.snapshot.proof === input.proof
        && previous.snapshot.branchKey === input.branchKey
        && previous.snapshot.conversationId === input.conversationId
        && sameRounds(previous.snapshot.rounds, input.rounds);
    const sameState = previous.status === input.status
        && previous.conversationId === input.conversationId
        && previous.reason === input.reason
        && Boolean(previous.snapshot) === Boolean(input.proof && input.rounds.length > 0)
        && (!previous.snapshot || Boolean(sameSnapshot));
    if (sameState) {
        return {
            ...model,
            proof: input.proof,
            branchKey: input.branchKey,
            rounds: previous.snapshot?.rounds ?? input.rounds,
        };
    }

    const revision = previous.revision + 1;
    const immutableRounds = Object.freeze(
        input.rounds.map((round) => Object.freeze({ ...round })),
    );
    const snapshot: ChatGPTConversationSnapshot | null = input.proof
        && input.branchKey
        && input.conversationId
        && immutableRounds.length > 0
        ? Object.freeze({
            conversationId: input.conversationId,
            revision,
            proof: input.proof,
            branchKey: input.branchKey,
            capturedAt: input.capturedAt,
            rounds: immutableRounds,
        })
        : null;
    const state: ChatGPTConversationState = Object.freeze({
        status: input.status,
        routeEpoch: previous.routeEpoch,
        revision,
        conversationId: input.conversationId,
        snapshot,
        ...(input.reason ? { reason: input.reason } : {}),
    });
    return {
        ...model,
        state,
        proof: input.proof,
        branchKey: input.branchKey,
        rounds: immutableRounds,
    };
}

function reduceRoute(
    model: ChatGPTConversationModel,
    fact: ChatGPTConversationRouteFact,
): ChatGPTConversationModel {
    const birthEligible = fact.allowBirth || (fact.preserveBirth && model.birth.eligible);
    const status: ChatGPTConversationState['status'] = fact.conversationId
        ? birthEligible ? 'collecting' : 'blocked'
        : 'idle';
    return {
        state: Object.freeze({
            status,
            routeEpoch: fact.routeEpoch,
            revision: model.state.revision + 1,
            conversationId: fact.conversationId,
            snapshot: null,
            ...(status === 'blocked' ? { reason: 'unproven-history' as const } : {}),
        }),
        proof: null,
        branchKey: null,
        rounds: [],
        graphRounds: [],
        birth: {
            eligible: birthEligible,
            sawStreaming: fact.preserveBirth ? model.birth.sawStreaming : false,
        },
    };
}

function reduceBirthDom(
    model: ChatGPTConversationModel,
    fact: ChatGPTConversationDomFact,
): ChatGPTConversationModel {
    const domRounds = fact.observation.rounds;
    const sawStreaming = model.birth.sawStreaming
        || domRounds.some((round) => round.status === 'streaming');
    const nextModel = {
        ...model,
        birth: {
            ...model.birth,
            sawStreaming,
        },
    };
    if (!model.birth.eligible || !fact.conversationId) return nextModel;
    if (!hasUniqueDomIdentity(domRounds)) {
        return publish(nextModel, {
            status: 'blocked',
            conversationId: fact.conversationId,
            proof: null,
            branchKey: null,
            rounds: [],
            capturedAt: fact.observation.observedAt,
            reason: 'identity-conflict',
        });
    }

    const completed: ChatGPTConversationRound[] = [];
    for (const [index, domRound] of domRounds.entries()) {
        const round = factToRound(domRound, index + 1);
        if (!round) break;
        completed.push(round);
    }
    if (completed.length > 0 && !sawStreaming) {
        return publish(nextModel, {
            status: 'blocked',
            conversationId: fact.conversationId,
            proof: null,
            branchKey: null,
            rounds: [],
            capturedAt: fact.observation.observedAt,
            reason: 'unproven-history',
        });
    }
    if (completed.length === 0) {
        return publish(nextModel, {
            status: 'collecting',
            conversationId: fact.conversationId,
            proof: null,
            branchKey: null,
            rounds: [],
            capturedAt: fact.observation.observedAt,
        });
    }
    const branchKey = completed[completed.length - 1]!.assistantMessageId!;
    return publish(nextModel, {
        status: 'ready',
        conversationId: fact.conversationId,
        proof: 'birth-epoch',
        branchKey,
        rounds: completed,
        capturedAt: fact.observation.observedAt,
    });
}

function findDomFactForRound(
    facts: readonly ChatGPTDomTurnFact[],
    round: ChatGPTConversationRound,
): ChatGPTDomTurnFact | null {
    const matches = facts.filter((fact) => {
        const factRoundId = cleanId(fact.roundId) ?? cleanId(fact.assistantTurnId);
        const factAssistantId = cleanId(fact.assistantMessageId);
        return factRoundId === cleanId(round.id)
            || cleanId(fact.userMessageId) === cleanId(round.userMessageId)
            || factAssistantId === (cleanId(round.assistantMessageId) ?? cleanId(round.messageId));
    });
    return matches.length === 1 ? matches[0]! : null;
}

function hasDomIdentityConflict(
    facts: readonly ChatGPTDomTurnFact[],
    rounds: readonly ChatGPTConversationRound[],
): boolean {
    for (const fact of facts) {
        const factRoundId = cleanId(fact.roundId);
        const factUserId = cleanId(fact.userMessageId);
        const factAssistantId = cleanId(fact.assistantMessageId);
        for (const round of rounds) {
            const roundId = cleanId(round.id);
            const userId = cleanId(round.userMessageId);
            const assistantId = cleanId(round.assistantMessageId) ?? cleanId(round.messageId);
            const sharesTypedIdentity = Boolean(
                (factRoundId && roundId && factRoundId === roundId)
                || (factUserId && userId && factUserId === userId)
                || (factAssistantId && assistantId && factAssistantId === assistantId),
            );
            if (!sharesTypedIdentity) continue;
            if (factRoundId && roundId && factRoundId !== roundId) return true;
            if (factUserId && userId && factUserId !== userId) return true;
            if (factAssistantId && assistantId && factAssistantId !== assistantId) return true;
        }
    }
    return false;
}

function reduceReadyDom(
    model: ChatGPTConversationModel,
    fact: ChatGPTConversationDomFact,
): ChatGPTConversationModel {
    const domRounds = fact.observation.rounds;
    if (!hasUniqueDomIdentity(domRounds) || hasDomIdentityConflict(domRounds, model.rounds)) {
        return publish(model, {
            status: 'blocked',
            conversationId: fact.conversationId,
            proof: null,
            branchKey: null,
            rounds: [],
            capturedAt: fact.observation.observedAt,
            reason: 'identity-conflict',
        });
    }

    const previousTail = model.rounds[model.rounds.length - 1];
    if (!previousTail) {
        const pending = model.graphRounds[0];
        const domRound = pending
            ? domRounds.find((candidate) => graphPendingMatchesDom(pending, candidate))
            : null;
        const completion = pending && domRound
            ? completeGraphPendingRound(pending, domRound, 1)
            : null;
        if (!completion) return model;
        const published = publish(model, {
            status: 'ready',
            conversationId: fact.conversationId,
            proof: model.proof,
            branchKey: completion.assistantMessageId,
            rounds: [completion],
            capturedAt: fact.observation.observedAt,
        });
        return {
            ...published,
            graphRounds: [completion, ...model.graphRounds.slice(1)],
        };
    }
    const tailFact = findDomFactForRound(domRounds, previousTail);
    if (!tailFact) return model;
    const tailIndex = domRounds.indexOf(tailFact);
    const appended: ChatGPTConversationRound[] = [];
    for (const domRound of domRounds.slice(tailIndex + 1)) {
        const position = model.rounds.length + appended.length + 1;
        const pendingGraphRound = model.graphRounds[position - 1];
        const round = pendingGraphRound && graphPendingMatchesDom(pendingGraphRound, domRound)
            ? completeGraphPendingRound(pendingGraphRound, domRound, position)
            : factToRound(domRound, position);
        if (!round) break;
        appended.push(round);
    }
    if (appended.length === 0) return model;
    const rounds = [...model.rounds, ...appended];
    return publish(model, {
        status: 'ready',
        conversationId: fact.conversationId,
        proof: model.proof,
        branchKey: appended[appended.length - 1]!.assistantMessageId,
        rounds,
        capturedAt: fact.observation.observedAt,
    });
}

function graphPendingMatchesDom(
    pending: ChatGPTConversationRound,
    fact: ChatGPTDomTurnFact,
): boolean {
    const pendingRoundId = cleanId(pending.id);
    const pendingUserId = cleanId(pending.userMessageId);
    const pendingAssistantId = cleanId(pending.assistantMessageId) ?? (
        cleanId(pending.messageId) !== pendingUserId ? cleanId(pending.messageId) : null
    );
    const factRoundId = cleanId(fact.roundId) ?? cleanId(fact.assistantTurnId);
    const factUserId = cleanId(fact.userMessageId);
    const factAssistantId = cleanId(fact.assistantMessageId);
    if (pendingUserId && factUserId && pendingUserId !== factUserId) return false;
    if (pendingAssistantId && factAssistantId && pendingAssistantId !== factAssistantId) return false;
    return Boolean(
        (pendingRoundId && factRoundId === pendingRoundId)
        || (pendingUserId && factUserId === pendingUserId)
        || (pendingAssistantId && factAssistantId === pendingAssistantId),
    );
}

function completeGraphPendingRound(
    pending: ChatGPTConversationRound,
    fact: ChatGPTDomTurnFact,
    position: number,
): ChatGPTConversationRound | null {
    const completed = factToRound(fact, position);
    if (!completed || !graphPendingMatchesDom(pending, fact)) return null;
    return {
        ...completed,
        id: pending.id,
        position,
        userPrompt: pending.userPrompt,
        preview: pending.preview,
        userMessageId: pending.userMessageId ?? completed.userMessageId,
    };
}

function graphCompletedPrefix(rounds: readonly ChatGPTConversationRound[]): ChatGPTConversationRound[] {
    const completed: ChatGPTConversationRound[] = [];
    const roundIds = new Set<string>();
    const userIds = new Set<string>();
    const assistantIds = new Set<string>();
    for (const [index, raw] of rounds.entries()) {
        const roundId = cleanId(raw.id);
        const userId = cleanId(raw.userMessageId);
        const assistantId = cleanId(raw.assistantMessageId) ?? cleanId(raw.messageId);
        if (
            !roundId
            || raw.position !== index + 1
            || !cleanText(raw.userPrompt)
            || !cleanText(raw.assistantContent)
            || !assistantId
            || roundIds.has(roundId)
            || (userId !== null && userIds.has(userId))
            || assistantIds.has(assistantId)
        ) {
            break;
        }
        roundIds.add(roundId);
        if (userId) userIds.add(userId);
        assistantIds.add(assistantId);
        completed.push({
            ...raw,
            messageId: assistantId,
            assistantMessageId: assistantId,
        });
    }
    return completed;
}

function mergeGraphWithVerifiedTail(
    graphRounds: readonly ChatGPTConversationRound[],
    verifiedRounds: readonly ChatGPTConversationRound[],
): readonly ChatGPTConversationRound[] {
    const completedGraph = graphCompletedPrefix(graphRounds);
    if (verifiedRounds.length <= completedGraph.length) return completedGraph;
    const knownGraphPrefix = graphRounds.slice(
        0,
        Math.min(graphRounds.length, verifiedRounds.length),
    );
    if (!knownGraphPrefix.every((round, index) => (
        graphRoundSharesLineage(round, verifiedRounds[index]!)
    ))) {
        return completedGraph;
    }
    const prefixMatches = completedGraph.every((round, index) => (
        sameRoundIdentity(round, verifiedRounds[index]!)
    ));
    if (!prefixMatches) return completedGraph;

    const next = [...completedGraph];
    for (const verified of verifiedRounds.slice(completedGraph.length)) {
        if (verified.position !== next.length + 1) break;
        next.push(verified);
    }
    return next;
}

function graphRoundSharesLineage(
    graph: ChatGPTConversationRound,
    verified: ChatGPTConversationRound,
): boolean {
    const graphRoundId = cleanId(graph.id);
    const verifiedRoundId = cleanId(verified.id);
    const graphUserId = cleanId(graph.userMessageId);
    const verifiedUserId = cleanId(verified.userMessageId);
    const graphAssistantId = cleanId(graph.assistantMessageId) ?? (
        cleanId(graph.messageId) !== graphUserId ? cleanId(graph.messageId) : null
    );
    const verifiedAssistantId = cleanId(verified.assistantMessageId)
        ?? cleanId(verified.messageId);
    if (graphRoundId && verifiedRoundId && graphRoundId !== verifiedRoundId) return false;
    if (graphUserId && verifiedUserId && graphUserId !== verifiedUserId) return false;
    if (
        graphAssistantId
        && verifiedAssistantId
        && graphAssistantId !== verifiedAssistantId
    ) {
        return false;
    }
    return Boolean(
        (graphRoundId && graphRoundId === verifiedRoundId)
        || (graphUserId && graphUserId === verifiedUserId)
        || (graphAssistantId && graphAssistantId === verifiedAssistantId),
    );
}

function reduceGraph(
    model: ChatGPTConversationModel,
    fact: ChatGPTConversationGraphFact,
): ChatGPTConversationModel {
    const completedGraph = graphCompletedPrefix(fact.rounds);
    const rounds = mergeGraphWithVerifiedTail(fact.rounds, model.rounds);
    const branchKey = rounds.length > completedGraph.length
        ? cleanId(rounds[rounds.length - 1]?.assistantMessageId)
            ?? cleanId(rounds[rounds.length - 1]?.messageId)
            ?? fact.branchKey
        : fact.branchKey;
    const published = publish(model, {
        status: rounds.length > 0 ? 'ready' : 'collecting',
        conversationId: fact.conversationId,
        proof: 'observed-graph',
        branchKey,
        rounds,
        capturedAt: fact.capturedAt,
    });
    return {
        ...published,
        graphRounds: fact.rounds,
    };
}

export function createChatGPTConversationModel(): ChatGPTConversationModel {
    return {
        state: Object.freeze({
            status: 'idle',
            routeEpoch: 0,
            revision: 0,
            conversationId: null,
            snapshot: null,
        }),
        proof: null,
        branchKey: null,
        rounds: [],
        graphRounds: [],
        birth: {
            eligible: false,
            sawStreaming: false,
        },
    };
}

export function reduceChatGPTConversation(
    model: ChatGPTConversationModel,
    fact: ChatGPTConversationFact,
): ChatGPTConversationModel {
    if (fact.kind === 'route') return reduceRoute(model, fact);
    if (
        fact.routeEpoch !== model.state.routeEpoch
        || fact.conversationId !== model.state.conversationId
    ) {
        return model;
    }
    if (fact.kind === 'graph') return reduceGraph(model, fact);
    if (!model.proof) return reduceBirthDom(model, fact);
    return reduceReadyDom(model, fact);
}
