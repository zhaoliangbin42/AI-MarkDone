import { describe, expect, it } from 'vitest';
import {
    isChatGPTNavigationHostname,
    isChatGPTPageHostname,
    isChatGPTPageUrl,
} from '@/contracts/chatgptHosts';

describe('ChatGPT host contract', () => {
    it('accepts only the two page hosts and treats chat.com as an alias', () => {
        expect(isChatGPTPageHostname('chatgpt.com')).toBe(true);
        expect(isChatGPTPageHostname('chat.openai.com')).toBe(true);
        expect(isChatGPTPageHostname('sub.chatgpt.com')).toBe(false);
        expect(isChatGPTNavigationHostname('chat.com')).toBe(true);
        expect(isChatGPTNavigationHostname('sub.chat.com')).toBe(false);
    });

    it('validates page URLs without allowing share routes to become conversation identity', () => {
        expect(isChatGPTPageUrl('https://chatgpt.com/c/one')).toBe(true);
        expect(isChatGPTPageUrl('https://evil.chatgpt.com/c/one')).toBe(false);
        expect(isChatGPTPageUrl('https://chat.com/c/one')).toBe(false);
    });
});
