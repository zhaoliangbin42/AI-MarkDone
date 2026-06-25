import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, createRequestId, isExtRequest } from '@/contracts/protocol';

describe('protocol', () => {
    it('createRequestId returns stable prefix', () => {
        const id = createRequestId();
        expect(id.startsWith('req_')).toBe(true);
        expect(id.length).toBeGreaterThan(10);
    });

    it('isExtRequest validates version and type', () => {
        const ok = { v: PROTOCOL_VERSION, id: createRequestId(), type: 'ping' } as const;
        expect(isExtRequest(ok)).toBe(true);

        const badV = { v: 999, id: createRequestId(), type: 'ping' };
        expect(isExtRequest(badV)).toBe(false);

        const badType = { v: PROTOCOL_VERSION, id: createRequestId(), type: 'nope' };
        expect(isExtRequest(badType)).toBe(false);
    });

    it('accepts the Google Drive backup diagnostics request', () => {
        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'cloudBackup:diagnostics',
            payload: { provider: 'googleDrive' },
        })).toBe(true);
    });

    it('accepts a valid content ready handshake and rejects malformed payloads', () => {
        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'content:ready',
            payload: { platform: 'chatgpt', url: 'https://chatgpt.com/c/mock' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'content:ready',
            payload: { platform: 'gemini', url: 'https://gemini.google.com/app' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'content:ready',
            payload: { platform: 'chatgpt' },
        })).toBe(false);
    });

    it('accepts detached reader session requests and rejects malformed create payloads', () => {
        const snapshot = {
            items: [{ id: 'item-1', userPrompt: 'Hello', content: 'World' }],
            startIndex: 0,
            sourceUrl: 'https://chatgpt.com/c/mock',
            theme: 'light',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:create',
            payload: { snapshot },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:get',
            payload: { sessionId: 'reader_1' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:draft',
            payload: { sessionId: 'reader_1' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:draft',
            payload: { sessionId: 'reader_1', text: 'Edited draft' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:beforeSend',
            payload: { sessionId: 'reader_1' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:send',
            payload: { sessionId: 'reader_1', text: 'Next prompt' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:create',
            payload: { snapshot: { ...snapshot, items: 'bad' } },
        })).toBe(false);
    });

    it('accepts prompt library requests and rejects malformed save payloads', () => {
        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'prompts:list',
            payload: { context: 'composer' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'prompts:save',
            payload: {
                prompt: {
                    id: 'prompt-custom',
                    title: 'Summarize',
                    content: 'Summarize this.',
                    triggerText: '\\sum',
                    contexts: ['composer', 'readerComment'],
                    enabled: true,
                },
            },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'prompts:delete',
            payload: { id: 'prompt-custom' },
        })).toBe(true);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'prompts:save',
            payload: { prompt: { id: 'missing-content', title: 'Bad' } },
        })).toBe(false);
    });
});
