import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION } from '@/contracts/protocol';
import { browser } from '@/drivers/shared/browser';
import { sendExtRequest } from '@/drivers/shared/rpc';

describe('extension RPC transport', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('rejects a response that does not match the originating request', async () => {
        vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
            v: PROTOCOL_VERSION,
            id: 'another-request-id',
            type: 'settings:getAll',
            ok: true,
            data: { settings: {} },
        } as any);

        const result = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: 'request-123456',
            type: 'bookmarks:folders:list',
        });

        expect(result).toEqual({
            kind: 'transport-failure',
            failure: {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response',
                delivery: 'unknown',
            },
        });
    });

    it('classifies an invalidated extension context as a page-refresh failure', async () => {
        vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('Extension context invalidated.'));

        const result = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: 'request-123456',
            type: 'bookmarks:folders:list',
        });

        expect(result).toEqual({
            kind: 'transport-failure',
            failure: {
                code: 'CONTEXT_INVALIDATED',
                message: 'Extension context invalidated.',
                delivery: 'not-sent',
            },
        });
    });

    it('classifies Firefox missing-receiver wording as a known not-sent failure', async () => {
        vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(
            new Error('Could not establish connection. Receiving end does not exist.'),
        );

        const result = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: 'request-firefox-receiver',
            type: 'bookmarks:folders:list',
        });

        expect(result).toEqual({
            kind: 'transport-failure',
            failure: {
                code: 'RECEIVER_UNAVAILABLE',
                message: 'Could not establish connection. Receiving end does not exist.',
                delivery: 'not-sent',
            },
        });
    });

    it('does not replay a timed-out mutation whose delivery is unknown', async () => {
        vi.useFakeTimers();
        const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(() => new Promise(() => undefined));

        const pending = sendExtRequest({
            v: PROTOCOL_VERSION,
            id: 'request-123456',
            type: 'bookmarks:save',
            payload: {
                url: 'https://chatgpt.com/c/example',
                position: 1,
                userMessage: 'Question',
            },
        }, { timeoutMs: 50 });
        await vi.advanceTimersByTimeAsync(51);

        await expect(pending).resolves.toEqual({
            kind: 'transport-failure',
            failure: {
                code: 'REQUEST_TIMEOUT',
                message: 'Request timed out',
                delivery: 'unknown',
            },
        });
        expect(sendMessage).toHaveBeenCalledTimes(1);
    });
});
