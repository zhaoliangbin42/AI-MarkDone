import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearReaderCommentScope,
    listReaderComments,
    removeReaderComment,
    saveReaderComment,
    type ReaderCommentRecord,
} from '@/services/reader/commentSession';

const scopeId = 'reader-comments-test';

function createRecord(overrides?: Partial<ReaderCommentRecord>): ReaderCommentRecord {
    return {
        id: 'comment-1',
        itemId: 'item-1',
        quoteText: 'quoted text',
        sourceMarkdown: '`code`',
        comment: 'hello',
        selectors: {
            textQuote: { exact: 'quoted text', prefix: '', suffix: '' },
            textPosition: { start: 0, end: 11 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt: 10,
        updatedAt: 10,
        ...overrides,
    };
}

describe('commentSession', () => {
    beforeEach(() => {
        clearReaderCommentScope(scopeId);
    });

    it('stores comments per scope and item', () => {
        saveReaderComment(scopeId, createRecord());
        saveReaderComment(scopeId, createRecord({ id: 'comment-2', itemId: 'item-2', createdAt: 20, updatedAt: 20 }));

        expect(listReaderComments(scopeId, 'item-1')).toHaveLength(1);
        expect(listReaderComments(scopeId, 'item-2')).toHaveLength(1);
    });

    it('updates existing comments in place', () => {
        saveReaderComment(scopeId, createRecord());
        saveReaderComment(scopeId, createRecord({ comment: 'updated', updatedAt: 30 }));

        const comments = listReaderComments(scopeId, 'item-1');
        expect(comments).toHaveLength(1);
        expect(comments[0]?.comment).toBe('updated');
        expect(comments[0]?.updatedAt).toBe(30);
    });

    it('removes an existing comment and clears the item bucket when it becomes empty', () => {
        saveReaderComment(scopeId, createRecord());

        removeReaderComment(scopeId, 'item-1', 'comment-1');

        expect(listReaderComments(scopeId, 'item-1')).toEqual([]);
    });
});
