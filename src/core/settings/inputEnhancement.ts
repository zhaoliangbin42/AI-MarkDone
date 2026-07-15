import type { ChatGPTInputEnhancementSettings } from './types';

export type EffectiveChatGPTInputEnhancement = {
    enabled: boolean;
    enterKeyNewline: boolean;
    boldShortcut: boolean;
    lists: {
        enabled: boolean;
        ordered: boolean;
        unordered: boolean;
    };
    formulaSuggestions: boolean;
    formulaPreview: boolean;
};

export function resolveChatGPTInputEnhancement(
    settings: ChatGPTInputEnhancementSettings,
): EffectiveChatGPTInputEnhancement {
    const enabled = settings.available && settings.enabled;
    const listsEnabled = enabled && settings.lists.enabled;
    return {
        enabled,
        enterKeyNewline: enabled && settings.enterKeyNewline,
        boldShortcut: enabled && settings.boldShortcut,
        lists: {
            enabled: listsEnabled,
            ordered: listsEnabled && settings.lists.ordered,
            unordered: listsEnabled && settings.lists.unordered,
        },
        formulaSuggestions: enabled && settings.formulaSuggestions,
        formulaPreview: enabled && settings.formulaPreview,
    };
}
