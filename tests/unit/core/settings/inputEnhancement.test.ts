import { describe, expect, it } from 'vitest';
import { resolveChatGPTInputEnhancement } from '../../../../src/core/settings/inputEnhancement';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '../../../../src/core/settings/types';

describe('ChatGPT input enhancement settings', () => {
    it('gates every capability through the entry and runtime master switches', () => {
        const unavailable = resolveChatGPTInputEnhancement({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            available: false,
        });
        const paused = resolveChatGPTInputEnhancement({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: false,
        });

        expect(unavailable).toEqual({
            enabled: false,
            enterKeyNewline: false,
            boldShortcut: false,
            lists: { enabled: false, ordered: false, unordered: false },
            formulaSuggestions: false,
            formulaPreview: false,
        });
        expect(paused).toEqual(unavailable);
    });
});
