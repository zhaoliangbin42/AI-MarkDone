import { describe, expect, it } from 'vitest';
import {
    getChatGPTConversationId,
    isChatGPTConversationPage,
} from '@/drivers/content/chatgpt/chatgptRoute';

describe('ChatGPT route identity', () => {
    it.each([
        ['https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc', '12345678-1234-1234-1234-123456789abc'],
        ['https://chatgpt.com/conversation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
    ])('recognizes supported conversation paths', (url, expectedId) => {
        expect(getChatGPTConversationId(url)).toBe(expectedId);
        expect(isChatGPTConversationPage(url)).toBe(true);
    });

    it('rejects non-conversation routes', () => {
        expect(getChatGPTConversationId('https://chatgpt.com/')).toBeNull();
        expect(getChatGPTConversationId('https://chatgpt.com/g/gpt-id')).toBeNull();
        expect(isChatGPTConversationPage('https://chatgpt.com/')).toBe(false);
    });
});
