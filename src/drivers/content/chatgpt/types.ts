export type ChatGPTConversationRound = {
    id: string;
    position: number;
    userPrompt: string;
    assistantContent: string;
    preview: string;
    messageId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
};

type ChatGPTConversationSnapshotBase = {
    conversationId: string;
    buildFingerprint: string | null;
    rounds: ChatGPTConversationRound[];
    capturedAt: number;
};

export type ChatGPTConversationSnapshotCandidate = ChatGPTConversationSnapshotBase & {
    source: unknown;
    origin: unknown;
    coverage: unknown;
    branchKey: unknown;
};

export type ChatGPTConversationSnapshot = ChatGPTConversationSnapshotBase & {
    source: 'runtime-bridge';
    origin: 'conversation-graph';
    coverage: 'complete';
    branchKey: string;
};
