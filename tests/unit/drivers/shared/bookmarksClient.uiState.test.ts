import { describe, expect, it, vi } from 'vitest';

const sendExtRequestMock = vi.fn(async (req: any) => {
    return { v: 1, id: req.id, ok: true, type: req.type, data: { value: 'Import' } };
});

vi.mock('../../../../src/drivers/shared/rpc', () => {
    return { sendExtRequest: (req: any) => sendExtRequestMock(req) };
});

describe('drivers/shared bookmarksClient uiState', () => {
    it('sends bookmarks:uiState:get with lastSelectedFolderPath key', async () => {
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');
        const res = await bookmarksClient.uiStateGetLastSelectedFolderPath();
        expect(res.ok).toBe(true);
        expect(sendExtRequestMock).toHaveBeenCalledTimes(1);
        const req = sendExtRequestMock.mock.calls[0]![0];
        expect(req.type).toBe('bookmarks:uiState:get');
        expect(req.payload).toEqual({ key: 'lastSelectedFolderPath' });
    });

    it('sends bookmarks:uiState:set with value', async () => {
        sendExtRequestMock.mockClear();
        const { bookmarksClient } = await import('../../../../src/drivers/shared/clients/bookmarksClient');
        const res = await bookmarksClient.uiStateSetLastSelectedFolderPath('Work');
        expect(res.ok).toBe(true);
        expect(sendExtRequestMock).toHaveBeenCalledTimes(1);
        const req = sendExtRequestMock.mock.calls[0]![0];
        expect(req.type).toBe('bookmarks:uiState:set');
        expect(req.payload).toEqual({ key: 'lastSelectedFolderPath', value: 'Work' });
    });
});

