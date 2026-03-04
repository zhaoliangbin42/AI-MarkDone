import { describe, expect, it } from 'vitest';
import { buildConversationMetadata, getConversationDescriptor } from '@/drivers/content/conversation/metadata';

describe('conversation metadata SSoT', () => {
    it('normalizes title and derives platform display name from adapter platform id', () => {
        document.documentElement.innerHTML = '<head><title>My Conversation - ChatGPT</title></head><body></body>';

        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const desc = getConversationDescriptor(adapter);
        expect(desc.title).toBe('My Conversation');
        expect(desc.platformId).toBe('chatgpt');

        const now = new Date('2026-03-04T10:00:00.000Z');
        const meta = buildConversationMetadata(adapter, 3, now);
        expect(meta.title).toBe('My Conversation');
        expect(meta.platform).toBe('ChatGPT');
        expect(meta.count).toBe(3);
        expect(meta.exportedAt).toBe('2026-03-04T10:00:00.000Z');
    });
});

