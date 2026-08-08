import { describe, expect, it, vi } from 'vitest';

import { prepareChatGPTBookmark } from '@/services/bookmarks/conversationBookmarkPreparation';
import { createConversationContentSource, toConversationSnapshotV1 } from '../../../helpers/chatgptContentFixtures';

describe('ChatGPT bookmark preparation', () => {
    it('reads the published turn without refreshing the conversation source', async () => {
        const base = createConversationContentSource({
            conversationId: 'bookmark-conversation',
            revision: 4,
            rounds: [{
                id: 'round-1',
                userPrompt: 'Saved prompt',
                assistantContent: 'Saved answer',
                assistantMessageId: 'assistant-1',
                userMessageId: 'user-1',
            }],
        });
        const refresh = vi.fn(async () => base.read());
        const source = { ...base, refresh };
        const target = {
            documentKey: toConversationSnapshotV1({ conversationId: 'bookmark-conversation', rounds: [] }).document.key,
            turnId: 'round-1',
            assistantMessageId: 'assistant-1',
            userMessageId: 'user-1',
        };
        const materialization = {
            resolveElement: vi.fn(() => target),
        };

        const prepared = await prepareChatGPTBookmark(
            source,
            materialization,
            document.createElement('article'),
        );

        expect(refresh).not.toHaveBeenCalled();
        expect(prepared).toMatchObject({
            messageId: 'assistant-1',
            position: 1,
            userMessage: 'Saved prompt',
            assistantMarkdown: 'Saved answer',
            contentRevision: '4',
        });
    });
});
