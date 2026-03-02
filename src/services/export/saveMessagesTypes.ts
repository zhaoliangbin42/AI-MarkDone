export interface ChatTurn {
    user: string;
    assistant: string; // markdown
    index: number;
}

export interface ConversationMetadata {
    url: string;
    exportedAt: string; // ISO
    title: string;
    count: number;
    platform: string;
}

export type SaveFormat = 'markdown' | 'pdf';

export type TranslateFn = (key: string, args?: unknown) => string;

