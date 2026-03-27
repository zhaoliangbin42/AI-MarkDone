export type ConversationWindowGroup = {
    id: string;
    top: number;
    bottom: number;
    assistantIndex: number;
    heavy: boolean;
    streaming: boolean;
    hasFocus: boolean;
};

export function computeMountedConversationGroups(params: {
    groups: ConversationWindowGroup[];
    viewportTop: number;
    viewportBottom: number;
    overscanPx: number;
    preserveRecentAssistantCount: number;
}): Set<string> {
    const { groups, viewportTop, viewportBottom, overscanPx, preserveRecentAssistantCount } = params;
    const mounted = new Set<string>();
    const assistantIndices = groups.map((group) => group.assistantIndex).sort((a, b) => a - b);
    const maxAssistantIndex = assistantIndices.length > 0 ? assistantIndices[assistantIndices.length - 1]! : -1;
    const minRecentAssistantIndex = Math.max(0, maxAssistantIndex - preserveRecentAssistantCount + 1);

    for (const group of groups) {
        const nearViewport = group.bottom >= viewportTop - overscanPx && group.top <= viewportBottom + overscanPx;
        const preserveRecent = group.assistantIndex >= minRecentAssistantIndex;
        if (nearViewport || preserveRecent || group.streaming || group.hasFocus) {
            mounted.add(group.id);
        }
    }

    return mounted;
}
