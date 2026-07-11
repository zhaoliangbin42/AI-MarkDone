export type BookmarksPanelOptions = {
    onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void;
};

export type BookmarksPanelPort = {
    isVisible(): boolean;
    toggle(): Promise<void>;
    show(): Promise<void>;
    hide(): void;
};
