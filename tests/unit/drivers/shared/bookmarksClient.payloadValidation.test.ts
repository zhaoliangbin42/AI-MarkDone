import { beforeEach, describe, expect, it, vi } from 'vitest';

const responseDataByType = new Map<string, unknown>();
const sendExtRequestMock = vi.fn(async (request: any) => ({
    kind: 'response' as const,
    response: {
        v: request.v,
        id: request.id,
        type: request.type,
        ok: true as const,
        data: responseDataByType.get(request.type),
    },
}));

vi.mock('../../../../src/drivers/shared/rpc', () => ({
    sendExtRequest: (request: any) => sendExtRequestMock(request),
}));

describe('drivers/shared bookmarksClient payload validation', () => {
    beforeEach(() => {
        responseDataByType.clear();
        sendExtRequestMock.mockClear();
    });

    it('rejects a successful bookmarks:list envelope whose bookmarks payload is missing', async () => {
        responseDataByType.set('bookmarks:list', {});
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.list();

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
            failure: {
                kind: 'transport',
                code: 'INVALID_RESPONSE',
                delivery: 'unknown',
            },
        });
    });

    it('rejects malformed bookmark records inside a successful bookmarks:list payload', async () => {
        responseDataByType.set('bookmarks:list', { bookmarks: [{ title: 'Incomplete bookmark' }] });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.list();

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects a successful folders:list envelope with missing folder records', async () => {
        responseDataByType.set('bookmarks:folders:list', { folderPaths: [] });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.foldersList();

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects malformed folder paths and folder records', async () => {
        responseDataByType.set('bookmarks:folders:list', {
            folderPaths: ['Work', 42],
            folders: [{ path: 'Work', name: 'Work', depth: '1', createdAt: 1, updatedAt: 1 }],
        });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.foldersList();

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects a successful bookmarks:positions envelope whose positions payload is missing', async () => {
        responseDataByType.set('bookmarks:positions', {});
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.positions({ url: 'https://chatgpt.com/c/example' });

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects non-finite and non-number bookmark positions', async () => {
        responseDataByType.set('bookmarks:positions', { positions: [1, '2', Number.NaN] });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.positions({ url: 'https://chatgpt.com/c/example' });

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects a successful page status envelope whose saved flag is missing', async () => {
        responseDataByType.set('bookmarks:page:status', {});
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.pageStatus({ url: 'https://chatgpt.com/c/example' });

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects a non-boolean saved flag in a page status payload', async () => {
        responseDataByType.set('bookmarks:page:status', { saved: 'false' });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        const result = await bookmarksClient.pageStatus({ url: 'https://chatgpt.com/c/example' });

        expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('rejects successful mutation envelopes that do not acknowledge the write', async () => {
        responseDataByType.set('bookmarks:save', {});
        responseDataByType.set('bookmarks:remove', {});
        responseDataByType.set('bookmarks:page:save', {});
        responseDataByType.set('bookmarks:page:remove', {});
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');
        const message = {
            url: 'https://chatgpt.com/c/example',
            position: 1,
            userMessage: 'Question',
        };

        await expect(bookmarksClient.save(message)).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
        await expect(bookmarksClient.remove({ url: message.url, position: 1 })).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
        await expect(bookmarksClient.pageSave({
            url: message.url,
            title: 'Example',
            platform: 'ChatGPT',
        })).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
        await expect(bookmarksClient.pageRemove({ url: message.url })).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });

    it('preserves valid read payloads after decoding', async () => {
        const bookmark = {
            kind: 'message' as const,
            url: 'https://chatgpt.com/c/example',
            urlWithoutProtocol: 'chatgpt.com/c/example',
            position: 1,
            messageId: 'assistant-1',
            userMessage: 'Question',
            aiResponse: 'Answer',
            timestamp: 1,
            title: 'Question',
            platform: 'ChatGPT',
            folderPath: 'Work',
        };
        const folder = { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 };
        responseDataByType.set('bookmarks:list', { bookmarks: [bookmark] });
        responseDataByType.set('bookmarks:folders:list', { folderPaths: ['Work'], folders: [folder] });
        responseDataByType.set('bookmarks:positions', { positions: [1] });
        responseDataByType.set('bookmarks:page:status', { saved: true });
        responseDataByType.set('bookmarks:save', { warnings: [] });
        responseDataByType.set('bookmarks:remove', { removed: 1 });
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');

        await expect(bookmarksClient.list()).resolves.toEqual({ ok: true, data: { bookmarks: [bookmark] } });
        await expect(bookmarksClient.foldersList()).resolves.toEqual({ ok: true, data: { folderPaths: ['Work'], folders: [folder] } });
        await expect(bookmarksClient.positions({ url: bookmark.url })).resolves.toEqual({ ok: true, data: { positions: [1] } });
        await expect(bookmarksClient.pageStatus({ url: bookmark.url })).resolves.toEqual({ ok: true, data: { saved: true } });
    });
});
