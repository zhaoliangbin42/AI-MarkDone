// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildChatGPTMessageUrl } from '@/contracts/chatgptMessageUrl';

describe('ChatGPT message URL contract without a content runtime', () => {
    it('builds a canonical HTTPS link without browser globals', () => {
        expect(buildChatGPTMessageUrl('https://CHAT.OPENAI.COM.:443/g/project/c/conv-12345678', 'assistant-1'))
            .toBe('https://chatgpt.com/g/project/c/conv-12345678?messageId=assistant-1');
    });

    it('preserves repeated unrelated query values and their decoded meaning', () => {
        const result = buildChatGPTMessageUrl('https://chatgpt.com/c/conv-12345678?custom=a%2Bb&custom=a+b&messageId=old', 'assistant-1');
        expect(result).not.toBeNull();
        const params = new URL(result!).searchParams;
        expect(params.getAll('custom')).toEqual(['a+b', 'a b']);
        expect(params.getAll('messageId')).toEqual(['assistant-1']);
    });

    it('round-trips opaque Unicode identity exactly', () => {
        const messageId = '消息_🔗';
        const result = buildChatGPTMessageUrl('https://chatgpt.com/c/conv-12345678', messageId);
        expect(result).not.toBeNull();
        expect(new URL(result!).searchParams.get('messageId')).toBe(messageId);
    });

    it('rejects an identity that URL encoding would change', () => {
        expect(buildChatGPTMessageUrl('https://chatgpt.com/c/conv-12345678', '\ud800')).toBeNull();
    });
});
