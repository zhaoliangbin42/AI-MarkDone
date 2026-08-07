import { describe, expect, it } from 'vitest';
import type { Bookmark } from '@/core/bookmarks/types';
import {
    resolveConversationBookmark,
    resolveConversationBookmarkPositions,
} from '@/services/bookmarks/conversationBookmarkResolver';

const turns = [
    { position: 1, assistantMessageId: 'assistant-1' },
    { position: 2, assistantMessageId: 'assistant-2' },
    { position: 3, assistantMessageId: 'assistant-3' },
] as const;

function bookmark(patch: Partial<Bookmark> = {}): Bookmark {
    return {
        url: 'https://chat.openai.com/c/conversation-1',
        urlWithoutProtocol: 'chat.openai.com/c/conversation-1',
        position: 2,
        messageId: 'assistant-2',
        userMessage: 'Prompt',
        aiResponse: 'Answer',
        timestamp: 1,
        title: 'Prompt',
        platform: 'ChatGPT',
        folderPath: 'Import',
        ...patch,
    };
}

describe('conversationBookmarkResolver', () => {
    it('uses the persisted assistant message identity for a canonical match', () => {
        expect(resolveConversationBookmark(bookmark(), turns)).toEqual({
            kind: 'matched',
            position: 2,
            resolvedBy: 'identity',
        });
    });

    it('does not highlight another turn when identity and position disagree', () => {
        expect(resolveConversationBookmark(bookmark({ position: 1 }), turns)).toEqual({
            kind: 'identity-conflict',
            bookmarkPosition: 1,
            canonicalPosition: 2,
            messageId: 'assistant-2',
        });
    });

    it('keeps position-only legacy bookmarks readable', () => {
        expect(resolveConversationBookmark(bookmark({ messageId: null, position: 3 }), turns)).toEqual({
            kind: 'matched',
            position: 3,
            resolvedBy: 'position',
        });
    });

    it('uses position only when a legacy identity is absent from the current source', () => {
        expect(resolveConversationBookmark(bookmark({ messageId: 'old-branch-assistant', position: 1 }), turns)).toEqual({
            kind: 'matched',
            position: 1,
            resolvedBy: 'position',
        });
    });

    it('matches historical ChatGPT URLs without changing the bookmark record', () => {
        const legacy = bookmark({
            url: 'https://chat.openai.com/c/conversation-1',
            urlWithoutProtocol: 'chat.openai.com/c/conversation-1',
        });
        const resolved = resolveConversationBookmarkPositions(
            [legacy],
            'https://chatgpt.com/c/conversation-1?mweb_fallback=1',
            turns,
            (a, b) => new URL(a).hostname.replace('chat.openai.com', 'chatgpt.com')
                === new URL(b).hostname.replace('chat.openai.com', 'chatgpt.com')
                && new URL(a).pathname === new URL(b).pathname,
        );
        expect(resolved).toEqual(new Set([2]));
        expect(legacy.url).toBe('https://chat.openai.com/c/conversation-1');
        expect(legacy.position).toBe(2);
        expect(legacy.messageId).toBe('assistant-2');
    });
});
