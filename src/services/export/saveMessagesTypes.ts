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

export type SaveFormat = 'markdown' | 'pdf' | 'png';

export type TranslateFn = (key: string, args?: unknown) => string;

export type ExportProgressPhase = 'preparing' | 'rendering' | 'zipping' | 'downloading' | 'done';

export type ExportProgressEvent = {
    phase: ExportProgressPhase;
    completed: number;
    total: number;
    filename?: string;
};

export type ExportProgressCallback = (event: ExportProgressEvent) => void;
