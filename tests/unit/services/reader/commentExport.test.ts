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
            commentTemplate: '针对\n【选中文字】\n我的评价是：\n【用户评论】\n---------------',
        })).toBe('');
    });

    it('formats comments as an enumerated multiline list using markdown source placeholders', () => {
        const result = buildCommentsExport(
            [
                makeComment({ id: 'c1', sourceMarkdown: '`code`', comment: 'first' }),
                makeComment({ id: 'c2', sourceMarkdown: '$x+y$', comment: 'second', createdAt: 2, updatedAt: 2 }),
            ],
            {
                userPrompt: '请基于以下逐条评论，整理出结构化反馈：',
                commentTemplate: '针对\n【选中文字】\n我的评价是：\n【用户评论】\n---------------',
            },
        );

        expect(result).toBe(
            [
                '请基于以下逐条评论，整理出结构化反馈：',
                '',
                '1. 针对',
                '   `code`',
                '   我的评价是：',
                '   first',
                '   ---------------',
                '2. 针对',
                '   $x+y$',
                '   我的评价是：',
                '   second',
                '   ---------------',
            ].join('\n'),
        );
    });

    it('replaces repeated placeholders and keeps literal text when placeholders are omitted', () => {
        const result = buildCommentsExport(
            [makeComment({ sourceMarkdown: 'alpha', comment: 'beta' })],
            {
                userPrompt: '',
                commentTemplate: '内容：\n【选中文字】\n再次引用：\n【选中文字】\n评论：\n【用户评论】',
            },
        );

        expect(result).toBe(
            [
                '1. 内容：',
                '   alpha',
                '   再次引用：',
                '   alpha',
                '   评论：',
                '   beta',
            ].join('\n'),
        );
    });
});
