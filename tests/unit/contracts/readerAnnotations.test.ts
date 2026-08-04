import { describe, expect, it } from 'vitest';
import {
    createReaderAnnotationBundle,
    decodeReaderAnnotationBundle,
    readerAnnotationDocumentKey,
    readerAnnotationStorageKey,
    type ReaderAnnotationDocument,
    type ReaderAnnotationRecord,
} from '@/contracts/readerAnnotations';

const document: ReaderAnnotationDocument = {
    platform: 'chatgpt',
    conversationId: 'conv/one',
    title: 'Conversation',
    lastKnownUrl: 'https://chatgpt.com/c/conv/one',
};

const annotation: ReaderAnnotationRecord = {
    id: 'annotation-1',
    itemId: 'chatgpt-message-1',
    target: { assistantMessageId: 'assistant-1', roundId: 'round-1', position: 2 },
    quoteText: 'Selected text',
    sourceMarkdown: 'Selected text',
    comment: 'Remember this',
    selectors: {
        textQuote: { exact: 'Selected text', prefix: 'Before ', suffix: ' after' },
        textPosition: { start: 10, end: 23 },
        domRange: null,
        atomicRefs: [],
    },
    createdAt: 100,
    updatedAt: 100,
    revision: 1,
    lastKnownAnchorState: 'anchored',
};

describe('reader annotation contract', () => {
    it('uses a stable encoded conversation namespace', () => {
        expect(readerAnnotationDocumentKey(document)).toBe('chatgpt:conversation:conv%2Fone');
        expect(readerAnnotationStorageKey(document)).toBe('aimd:reader_annotations:document:chatgpt:conversation:conv%2Fone');
    });

    it('decodes a valid v1 bundle and rejects cross-document or malformed data', () => {
        const bundle = createReaderAnnotationBundle(document, [annotation]);
        expect(decodeReaderAnnotationBundle(bundle, document)?.annotations).toEqual([annotation]);
        expect(decodeReaderAnnotationBundle(bundle, { ...document, conversationId: 'other' })).toBeNull();
        expect(decodeReaderAnnotationBundle({ ...bundle, annotations: [{ ...annotation, revision: 0 }] })).toBeNull();
    });
});
