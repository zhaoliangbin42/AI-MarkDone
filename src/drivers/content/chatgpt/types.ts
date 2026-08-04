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
    position: number;
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    assistantTurnId: string | null;
    userPrompt: string;
    assistantContent: string;
    status: 'streaming' | 'complete' | 'incomplete';
};

export type ChatGPTDomTurnObservation = {
    observedAt: number;
    rounds: readonly ChatGPTDomTurnFact[];
};

export type ChatGPTDomTurnFactSource = {
    start(listener: (observation: ChatGPTDomTurnObservation) => void): void;
    stop(): void;
    read(): ChatGPTDomTurnObservation;
};
