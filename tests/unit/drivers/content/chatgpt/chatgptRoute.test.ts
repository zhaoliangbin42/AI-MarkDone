import { describe, expect, it } from 'vitest';
import {
    buildChatGPTMessageUrl,
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

describe('ChatGPT message URLs', () => {
    const messageId = '12345678-1234-1234-1234-123456789abc';
    const conversationId = 'conv_ABC-12345678';

    it.each([
        'https://chatgpt.com/c/',
        'https://chatgpt.com/conversation/',
        'https://chatgpt.com/g/project-id/c/',
        'https://chatgpt.com/workspace/alpha/g/project-id/conversation/',
    ])('retains a supported conversation path: %s', (baseUrl) => {
        expect(buildChatGPTMessageUrl(`${baseUrl}${conversationId}`, messageId))
            .toBe(`${baseUrl}${conversationId}?messageId=${messageId}`);
    });

    it('removes stale message and search positioning while preserving unrelated query values', () => {
        const url = `https://chatgpt.com/c/${conversationId}?message=old&messageId=older&messageId=duplicate&historySearchQuery=old+quote&selectedTextQuery=old+selection&selectedTextOccurrence=2&model=auto&branch=one#latest`;
        expect(buildChatGPTMessageUrl(url, messageId))
            .toBe(`https://chatgpt.com/c/${conversationId}?model=auto&branch=one&messageId=${messageId}`);
    });

    it('canonicalizes the legacy ChatGPT page domain', () => {
        expect(buildChatGPTMessageUrl(`https://chat.openai.com/g/project-id/c/${conversationId}?model=auto`, messageId))
            .toBe(`https://chatgpt.com/g/project-id/c/${conversationId}?model=auto&messageId=${messageId}`);
    });

    it.each([
        'https://example.com/c/conv_ABC-12345678',
        'https://evil.chatgpt.com/c/conv_ABC-12345678',
        'https://chatgpt.com.evil.example/c/conv_ABC-12345678',
        'https://chat.com/c/conv_ABC-12345678',
        'https://user:password@chatgpt.com/c/conv_ABC-12345678',
        'https://chatgpt.com@evil.example/c/conv_ABC-12345678',
        'https://chatgpt.com/',
        'https://chatgpt.com/share/conv_ABC-12345678',
        'https://chatgpt.com/c/WEB%3Atemporary-session',
        'http://localhost:3000/c/conv_ABC-12345678',
        'http://chatgpt.com/c/conv_ABC-12345678',
        'https://chatgpt.com:8080/c/conv_ABC-12345678',
        'javascript://chatgpt.com/c/conv_ABC-12345678',
        '/c/conv_ABC-12345678',
        'invalid-url',
    ])('rejects an untrusted or non-conversation URL: %s', (url) => {
        expect(buildChatGPTMessageUrl(url, messageId)).toBeNull();
    });

    it.each([
        null,
        undefined,
        '',
        '   ',
        ' message-id ',
        'fallback-turn-0',
        'fallback-turn-0:2:assistant',
        'client-created-root',
        'conversation-turn-12',
        'chatgpt-turn:assistant-1',
        'chatgpt-message-slot:assistant-1',
        'message\u0000id',
        'message\u0085id',
    ])('rejects an absent, temporary, or malformed message ID: %s', (id) => {
        expect(buildChatGPTMessageUrl(`https://chatgpt.com/c/${conversationId}`, id)).toBeNull();
    });

    it.each([
        'assistant-1',
        'user-1',
        'message_ABC.123~stable',
        'message-id&model=other#latest?query=other',
        'message/id%2Fid',
        'a'.repeat(161),
    ])('encodes opaque stable message tokens without adding query parameters: %s', (id) => {
        const result = buildChatGPTMessageUrl(`https://chatgpt.com/c/${conversationId}`, id);
        expect(result).not.toBeNull();
        const parsed = new URL(result!);
        expect(parsed.searchParams.get('messageId')).toBe(id);
        expect([...parsed.searchParams.keys()]).toEqual(['messageId']);
    });
});
