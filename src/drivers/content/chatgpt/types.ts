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

export type ChatGPTConversationProof = 'observed-graph' | 'birth-epoch';

export type ChatGPTConversationSnapshot = {
    readonly conversationId: string;
    readonly revision: number;
    readonly proof: ChatGPTConversationProof;
    readonly branchKey: string;
    readonly rounds: readonly ChatGPTConversationRound[];
    readonly capturedAt: number;
};

export type ChatGPTConversationState = {
    readonly status: 'idle' | 'collecting' | 'ready' | 'blocked';
    readonly routeEpoch: number;
    readonly revision: number;
    readonly conversationId: string | null;
    readonly snapshot: ChatGPTConversationSnapshot | null;
    readonly reason?: 'unproven-history' | 'identity-conflict';
};

export interface ChatGPTConversationSource {
    getState(): ChatGPTConversationState;
    subscribe(listener: (state: ChatGPTConversationState) => void): () => void;
    ensureReady(): Promise<ChatGPTConversationSnapshot | null>;
}

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

export type ChatGPTConversationSnapshotCandidate = {
    conversationId: string;
    rounds: ChatGPTConversationRound[];
    capturedAt: number;
    branchKey: unknown;
};
