export type ConversationRegistryGroupRef = {
    id: string;
    title: string;
    barEl: HTMLElement;
    bodyEls: HTMLElement[];
    assistantRootEl: HTMLElement;
    assistantIndex: number;
    collapsed: boolean;
    virtualized: boolean;
    isStreaming: boolean;
};

export type ConversationGroupRegistryPort = {
    getGroups(): ConversationRegistryGroupRef[];
    markVirtualized(groupId: string, virtualized: boolean, placeholderEl?: HTMLElement | null): boolean;
    completeRestore(groupId: string): boolean;
    onRestoreRequested(callbacks: { onRestoreVirtualizedGroup?: (groupId: string) => void }): void;
};
