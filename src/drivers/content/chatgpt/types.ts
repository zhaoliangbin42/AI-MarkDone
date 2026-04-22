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

export type ChatGPTConversationSnapshot = {
    conversationId: string;
    buildFingerprint: string | null;
    rounds: ChatGPTConversationRound[];
    source: 'runtime-bridge' | 'react-props' | 'dom';
    capturedAt: number;
};
