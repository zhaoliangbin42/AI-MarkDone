import type {
    BookmarksBulkMovePayload,
    BookmarksBulkRemovePayload,
    BookmarksExportPayload,
    BookmarksExportSelectedPayload,
    BookmarksImportPayload,
    BookmarksListPayload,
    BookmarksPositionsPayload,
    BookmarksRemovePayload,
    BookmarksSavePayload,
    ExtRequest,
    ProtocolErrorCode,
} from '../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../contracts/protocol';
import { sendExtRequest } from '../../drivers/shared/rpc';
import type { BookmarksSortMode, FolderCreatePayload, FolderDeletePayload, FolderMovePayload, FolderRenamePayload } from '../../contracts/protocol';
import type { Bookmark, Folder } from '../../core/bookmarks/types';

export type Result<T> = { ok: true; data: T } | { ok: false; errorCode: ProtocolErrorCode; message: string };

function toResult<T>(res: any): Result<T> {
    if (!res || typeof res !== 'object') return { ok: false, errorCode: 'INTERNAL_ERROR', message: 'Invalid response' };
    if (res.ok) return { ok: true, data: (res.data ?? null) as T };
    const code = res.error?.code as ProtocolErrorCode | undefined;
    const msg = (res.error?.message as string | undefined) || 'Request failed';
    return { ok: false, errorCode: code || 'INTERNAL_ERROR', message: msg };
}

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest = payload === undefined
        ? { v: PROTOCOL_VERSION, id: createRequestId(), type } as any
        : { v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any;
    const res = await sendExtRequest(req as any);
    return toResult(res as any);
}

export type ListResponse = { bookmarks: Bookmark[] };
export type PositionsResponse = { positions: number[] };
export type FoldersListResponse = { folderPaths: string[]; folders: Folder[] };
export type SaveResponse = { warnings?: string[] };
export type RemoveResponse = { removed: number };
export type BulkRemoveResponse = { removed: number };
export type BulkMoveResponse = { moved: number; missing: number };
export type ExportResponse = { payload: any };
export type RepairResponse = { stats: any };

export const bookmarksRemoteApi = {
    async list(payload?: BookmarksListPayload): Promise<Result<ListResponse>> {
        return call('bookmarks:list', payload);
    },
    async positions(payload: BookmarksPositionsPayload): Promise<Result<PositionsResponse>> {
        return call('bookmarks:positions', payload);
    },
    async save(payload: BookmarksSavePayload): Promise<Result<SaveResponse>> {
        return call('bookmarks:save', payload);
    },
    async remove(payload: BookmarksRemovePayload): Promise<Result<RemoveResponse>> {
        return call('bookmarks:remove', payload);
    },
    async bulkRemove(payload: BookmarksBulkRemovePayload): Promise<Result<BulkRemoveResponse>> {
        return call('bookmarks:bulkRemove', payload);
    },
    async bulkMove(payload: BookmarksBulkMovePayload): Promise<Result<BulkMoveResponse>> {
        return call('bookmarks:bulkMove', payload);
    },
    async exportAll(payload?: BookmarksExportPayload): Promise<Result<ExportResponse>> {
        return call('bookmarks:export', payload);
    },
    async exportSelected(payload: BookmarksExportSelectedPayload): Promise<Result<ExportResponse>> {
        return call('bookmarks:exportSelected', payload);
    },
    async import(payload: BookmarksImportPayload): Promise<Result<any>> {
        return call('bookmarks:import', payload);
    },
    async repair(): Promise<Result<RepairResponse>> {
        return call('bookmarks:repair');
    },
    async foldersList(): Promise<Result<FoldersListResponse>> {
        return call('bookmarks:folders:list');
    },
    async foldersCreate(payload: FolderCreatePayload): Promise<Result<any>> {
        return call('bookmarks:folders:create', payload);
    },
    async foldersDelete(payload: FolderDeletePayload): Promise<Result<any>> {
        return call('bookmarks:folders:delete', payload);
    },
    async foldersRename(payload: FolderRenamePayload): Promise<Result<any>> {
        return call('bookmarks:folders:rename', payload);
    },
    async foldersMove(payload: FolderMovePayload): Promise<Result<any>> {
        return call('bookmarks:folders:move', payload);
    },
    async listOptionsDefaults(): Promise<{ sortMode: BookmarksSortMode; platform: string }> {
        return { sortMode: 'time-desc', platform: 'All' };
    },
};

