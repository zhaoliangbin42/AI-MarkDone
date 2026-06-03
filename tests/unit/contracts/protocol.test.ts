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
        })).toBe(false);

        expect(isExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'content:ready',
            payload: { platform: 'chatgpt' },
        })).toBe(false);
    });
});
