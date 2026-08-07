import type {
    BookmarksChangelogNoticeAckPayload,
    BookmarksBulkMovePayload,
    BookmarksBulkRemovePayload,
    ChangelogNoticeState,
    BookmarksExportPayload,
    BookmarksExportSelectedPayload,
    BookmarksImportPayload,
    BookmarksListPayload,
    BookmarksPositionsPayload,
    BookmarksRemovePayload,
    BookmarksPageRemovePayload,
    BookmarksPageSavePayload,
    BookmarksPageStatusPayload,
    BookmarksSavePayload,
    BookmarksUiStateGetPayload,
    BookmarksUiStateSetPayload,
    BookmarksStorageUsageResponse,
    ExtRequest,
} from '../../../contracts/protocol';
import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    type RuntimeClientResult,
} from './clientResult';
import type { BookmarksSortMode, FolderCreatePayload, FolderDeletePayload, FolderMovePayload, FolderRenamePayload } from '../../../contracts/protocol';
import type { Bookmark, Folder } from '../../../core/bookmarks/types';
import { hasFields, isRecord, readArrayField } from './payloadValidation';

export type Result<T> = RuntimeClientResult<T>;

async function call<T extends ExtRequest['type']>(type: T, payload?: any): Promise<Result<any>> {
    const req: ExtRequest =
        payload === undefined
            ? ({ v: PROTOCOL_VERSION, id: createRequestId(), type } as any)
            : ({ v: PROTOCOL_VERSION, id: createRequestId(), type, payload } as any);
    return requestRuntimeClient(req);
}

export type ListResponse = { bookmarks: Bookmark[] };
export type PositionsResponse = { positions: number[] };
export type FoldersListResponse = { folderPaths: string[]; folders: Folder[] };
export type SaveResponse = { warnings: string[] };
export type RemoveResponse = { removed: number };
export type PageStatusResponse = { saved: boolean };
export type BulkRemoveResponse = { removed: number };
export type BulkMoveResponse = { moved: number; missing: number };
export type ExportResponse = { payload: any };
export type RepairResponse = { stats: any };
export type UiStateGetResponse = { value: string | null };
export type UiStateSetResponse = { value: string | null };
export type StorageUsageResponse = BookmarksStorageUsageResponse;
export type ChangelogNoticeResponse = ChangelogNoticeState;

function isBookmark(value: unknown): value is Bookmark {
    if (!hasFields(value, ['url', 'urlWithoutProtocol', 'title', 'platform', 'folderPath'], ['timestamp'])) return false;
    if (value.kind !== undefined && value.kind !== 'message' && value.kind !== 'page') return false;
    if (typeof value.url !== 'string' || typeof value.urlWithoutProtocol !== 'string') return false;
    if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return false;
    if (typeof value.title !== 'string' || typeof value.platform !== 'string' || typeof value.folderPath !== 'string') return false;
    if (value.position !== undefined && (typeof value.position !== 'number' || !Number.isFinite(value.position))) return false;
    if (value.pageKey !== undefined && typeof value.pageKey !== 'string') return false;
    if (value.messageId !== undefined && value.messageId !== null && typeof value.messageId !== 'string') return false;
    if (value.userMessage !== undefined && typeof value.userMessage !== 'string') return false;
    return value.aiResponse === undefined || typeof value.aiResponse === 'string';
}

function isFolder(value: unknown): value is Folder {
    return hasFields(value, ['path', 'name'], ['depth', 'createdAt', 'updatedAt'])
        && Number.isInteger(value.depth as number)
        && (value.depth as number) >= 0;
}

function invalidResponse(message: string): Result<never> {
    return createInvalidResponseClientFailure(message);
}

function isRemovalAck(value: unknown): value is RemoveResponse {
    return isRecord(value)
        && typeof value.removed === 'number'
        && Number.isInteger(value.removed)
        && value.removed >= 0;
}

async function save(type: 'bookmarks:save' | 'bookmarks:page:save', payload: unknown): Promise<Result<SaveResponse>> {
    const result = await call(type, payload);
    if (!result.ok) return result;
    const warnings = readArrayField<string>(result.data, 'warnings', (warning) => typeof warning === 'string');
    return warnings ? { ok: true, data: { warnings } } : invalidResponse(`Invalid ${type} response payload`);
}

async function remove(type: 'bookmarks:remove' | 'bookmarks:page:remove', payload: unknown): Promise<Result<RemoveResponse>> {
    const result = await call(type, payload);
    return !result.ok || isRemovalAck(result.data)
        ? result as Result<RemoveResponse>
        : invalidResponse(`Invalid ${type} response payload`);
}

export const bookmarksClient = {
    async list(payload?: BookmarksListPayload): Promise<Result<ListResponse>> {
        const result = await call('bookmarks:list', payload);
        if (!result.ok) return result;
        const bookmarks = readArrayField<Bookmark>(result.data, 'bookmarks', isBookmark);
        if (!bookmarks) {
            return invalidResponse('Invalid bookmarks:list response payload');
        }
        return { ok: true, data: { bookmarks } };
    },
    async positions(payload: BookmarksPositionsPayload): Promise<Result<PositionsResponse>> {
        const result = await call('bookmarks:positions', payload);
        if (!result.ok) return result;
        const positions = readArrayField<number>(
            result.data,
            'positions',
            (position) => typeof position === 'number' && Number.isInteger(position) && position > 0,
        );
        if (!positions) {
            return invalidResponse('Invalid bookmarks:positions response payload');
        }
        return { ok: true, data: { positions } };
    },
    async save(payload: BookmarksSavePayload): Promise<Result<SaveResponse>> {
        return save('bookmarks:save', payload);
    },
    async remove(payload: BookmarksRemovePayload): Promise<Result<RemoveResponse>> {
        return remove('bookmarks:remove', payload);
    },
    async pageSave(payload: BookmarksPageSavePayload): Promise<Result<SaveResponse>> {
        return save('bookmarks:page:save', payload);
    },
    async pageRemove(payload: BookmarksPageRemovePayload): Promise<Result<RemoveResponse>> {
        return remove('bookmarks:page:remove', payload);
    },
    async pageStatus(payload: BookmarksPageStatusPayload): Promise<Result<PageStatusResponse>> {
        const result = await call('bookmarks:page:status', payload);
        if (!result.ok) return result;
        if (!isRecord(result.data) || typeof result.data.saved !== 'boolean') {
            return invalidResponse('Invalid bookmarks:page:status response payload');
        }
        return { ok: true, data: result.data as PageStatusResponse };
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
        const result = await call('bookmarks:folders:list');
        if (!result.ok) return result;
        const folderPaths = readArrayField<string>(result.data, 'folderPaths', (path) => typeof path === 'string');
        const folders = readArrayField<Folder>(result.data, 'folders', isFolder);
        if (!folderPaths || !folders) {
            return invalidResponse('Invalid bookmarks:folders:list response payload');
        }
        return { ok: true, data: { folderPaths, folders } };
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
    async storageUsage(): Promise<Result<StorageUsageResponse>> {
        return call('bookmarks:storageUsage');
    },
    async uiStateGetLastSelectedFolderPath(): Promise<Result<UiStateGetResponse>> {
        const payload: BookmarksUiStateGetPayload = { key: 'lastSelectedFolderPath' };
        return call('bookmarks:uiState:get', payload);
    },
    async uiStateSetLastSelectedFolderPath(value: string | null): Promise<Result<UiStateSetResponse>> {
        const payload: BookmarksUiStateSetPayload = { key: 'lastSelectedFolderPath', value };
        return call('bookmarks:uiState:set', payload);
    },
    async getChangelogNotice(): Promise<Result<ChangelogNoticeResponse>> {
        return call('bookmarks:changelogNotice:get');
    },
    async ackChangelogNotice(version: string): Promise<Result<ChangelogNoticeResponse>> {
        const payload: BookmarksChangelogNoticeAckPayload = { version };
        return call('bookmarks:changelogNotice:ack', payload);
    },
    async listOptionsDefaults(): Promise<{ sortMode: BookmarksSortMode; platform: string }> {
        return { sortMode: 'time-desc', platform: 'All' };
    },
};
