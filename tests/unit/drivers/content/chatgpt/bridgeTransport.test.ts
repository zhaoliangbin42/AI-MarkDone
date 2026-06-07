import { describe, expect, it } from 'vitest';
import {
    decodeBridgeDetail,
    encodeBridgeRequest,
    encodeBridgeResponse,
} from '@/drivers/content/chatgpt/bridgeTransport';

describe('ChatGPT bridge transport', () => {
    it('keeps object details for the default Chrome-compatible transport', () => {
        const payload = { requestId: 'r1', type: 'snapshot' as const, conversationId: 'c1', force: true };

        const encoded = encodeBridgeRequest(payload, false);

        expect(encoded).toBe(payload);
        expect(decodeBridgeDetail<typeof payload>(encoded)).toEqual(payload);
    });

    it('roundtrips JSON string details for Firefox page/content boundaries', () => {
        const payload = { requestId: 'r1', type: 'snapshot' as const, conversationId: 'c1', force: true };

        const encodedRequest = encodeBridgeRequest(payload, true);
        const encodedResponse = encodeBridgeResponse({ requestId: 'r1', ok: true }, true);

        expect(typeof encodedRequest).toBe('string');
        expect(decodeBridgeDetail<typeof payload>(encodedRequest)).toEqual(payload);
        expect(typeof encodedResponse).toBe('string');
        expect(decodeBridgeDetail<{ requestId: string; ok: boolean }>(encodedResponse)).toEqual({ requestId: 'r1', ok: true });
    });

    it('returns null for invalid or empty details', () => {
        expect(decodeBridgeDetail(null)).toBeNull();
        expect(decodeBridgeDetail('not-json')).toBeNull();
        expect(decodeBridgeDetail('null')).toBeNull();
    });
});
