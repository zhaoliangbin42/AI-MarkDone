import { describe, expect, it } from 'vitest';
import {
    getChatGPTConversationId,
    isChatGPTConversationPage,
    withChatGPTMessageNavigationTrigger,
} from '@/drivers/content/chatgpt/chatgptRoute';

describe('ChatGPT route identity', () => {
    it.each([
        ['https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc', '12345678-1234-1234-1234-123456789abc'],
        ['https://chatgpt.com/conversation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
        ['https://chatgpt.com/g/project-id/c/12345678-1234-1234-1234-123456789abc?model=auto#latest', '12345678-1234-1234-1234-123456789abc'],
        ['https://chatgpt.com/workspace/alpha/g/project-id/c/conv_ABC-12345678?model=auto', 'conv_ABC-12345678'],
        ['https://chatgpt.com/workspace/c/short/g/project-id/conversation/conv_LATER-12345678', 'conv_LATER-12345678'],
    ])('recognizes supported conversation paths', (url, expectedId) => {
        expect(getChatGPTConversationId(url)).toBe(expectedId);
        expect(isChatGPTConversationPage(url)).toBe(true);
    });

    it('rejects non-conversation routes', () => {
        expect(getChatGPTConversationId('https://chatgpt.com/')).toBeNull();
        expect(getChatGPTConversationId('https://chatgpt.com/g/gpt-id')).toBeNull();
        expect(getChatGPTConversationId('https://chatgpt.com/c/WEB%3Atemporary-session')).toBeNull();
        expect(isChatGPTConversationPage('https://chatgpt.com/')).toBe(false);
    });

    it('requires an exact supported ChatGPT page host', () => {
        expect(getChatGPTConversationId('https://evil.chatgpt.com/c/12345678-1234-1234-1234-123456789abc')).toBeNull();
        expect(getChatGPTConversationId('https://chatgpt.com/share/12345678-1234-1234-1234-123456789abc')).toBeNull();
        expect(getChatGPTConversationId('https://chat.com/c/12345678-1234-1234-1234-123456789abc')).toBeNull();
    });

    it('adds an empty message query for supported ChatGPT conversation URLs', () => {
        expect(withChatGPTMessageNavigationTrigger(
            'https://chatgpt.com/g/project/c/12345678-1234-1234-1234-123456789abc?model=auto#latest',
        )).toBe(
            'https://chatgpt.com/g/project/c/12345678-1234-1234-1234-123456789abc?model=auto&message=#latest',
        );
    });

    it('replaces an existing message target with the empty navigation trigger', () => {
        expect(withChatGPTMessageNavigationTrigger(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc?message=1&model=auto',
        )).toBe(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc?message=&model=auto',
        );
    });

    it('leaves non-ChatGPT URLs unchanged', () => {
        const url = 'https://example.com/c/12345678?message=1';
        expect(withChatGPTMessageNavigationTrigger(url)).toBe(url);
    });
});
