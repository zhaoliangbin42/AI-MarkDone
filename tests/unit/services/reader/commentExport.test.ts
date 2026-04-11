import { describe, expect, it } from 'vitest';
import { buildCommentsExport } from '@/services/reader/commentExport';
import type { ReaderCommentRecord } from '@/services/reader/commentSession';

function makeComment(overrides: Partial<ReaderCommentRecord>): ReaderCommentRecord {
    return {
        id: 'c1',
        itemId: 'item-1',
        quoteText: 'quote',
        sourceMarkdown: 'source',
        comment: 'note',
        selectors: {
            textQuote: { exact: '', prefix: '', suffix: '' },
            textPosition: { start: 0, end: 5 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

describe('commentExport', () => {
    it('returns an empty string when there are no comments', () => {
        expect(buildCommentsExport([], {
            userPrompt: 'Top line',
            prompt1: '针对',
            prompt2: '，我的评价是：',
            prompt3: '。',
        })).toBe('');
    });

    it('formats comments as an enumerated list using markdown source', () => {
        const result = buildCommentsExport(
            [
                makeComment({ id: 'c1', sourceMarkdown: '`code`', comment: 'first' }),
                makeComment({ id: 'c2', sourceMarkdown: '$x+y$', comment: 'second', createdAt: 2, updatedAt: 2 }),
            ],
            {
                userPrompt: '请基于以下逐条评论，整理出结构化反馈：',
                prompt1: '针对',
                prompt2: '，我的评价是：',
                prompt3: '。',
            },
        );

        expect(result).toBe(
            [
                '请基于以下逐条评论，整理出结构化反馈：',
                '1. 针对`code`，我的评价是：first。',
                '2. 针对$x+y$，我的评价是：second。',
            ].join('\n'),
        );
    });
});
