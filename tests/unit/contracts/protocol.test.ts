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
});

