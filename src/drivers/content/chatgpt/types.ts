export type ChatGPTConversationRound = {
    readonly id: string;
    readonly position: number;
    readonly userPrompt: string;
    readonly assistantContent: string;
    readonly preview: string;
    readonly messageId: string | null;
    readonly userMessageId: string | null;
    readonly assistantMessageId: string | null;
};

export type ChatGPTDomTurnFact = {
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    assistantTurnId: string | null;
    status: 'streaming' | 'mounted' | 'incomplete';
};

export type ChatGPTDomTurnObservation = {
    observedAt: number;
    rounds: readonly ChatGPTDomTurnFact[];
};
