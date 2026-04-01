export type ConversationVirtualizationPolicy = {
    enabled: boolean;
    mode: 'off' | 'on';
    preserveRecentAssistantCount: number;
    viewportOverscanPx: number;
    restoreMarginPx: number;
    heavyMessageNodeThreshold: number;
    heavyMessageKatexThreshold: number;
    maxHeavyRestorePerSlice: number;
};

export const DEFAULT_CONVERSATION_VIRTUALIZATION_POLICY: ConversationVirtualizationPolicy = {
    enabled: true,
    mode: 'on',
    preserveRecentAssistantCount: 0,
    viewportOverscanPx: 1200,
    restoreMarginPx: 1400,
    heavyMessageNodeThreshold: 3000,
    heavyMessageKatexThreshold: 2000,
    maxHeavyRestorePerSlice: 1,
};

type ConversationVirtualizationSettings = {
    foldingPowerMode?: 'off' | 'on';
};

export function buildConversationVirtualizationPolicy(
    settings: ConversationVirtualizationSettings | null | undefined
): ConversationVirtualizationPolicy {
    const mode = settings?.foldingPowerMode === 'off' ? 'off' : 'on';
    return {
        ...DEFAULT_CONVERSATION_VIRTUALIZATION_POLICY,
        mode,
        enabled: mode !== 'off',
    };
}
