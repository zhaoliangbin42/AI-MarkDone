export const PROTOCOL_VERSION = 1 as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type RequestId = string;

export type ProtocolErrorCode =
    | 'UNKNOWN_TYPE'
    | 'UNTRUSTED_SENDER'
    | 'INVALID_REQUEST'
    | 'INTERNAL_ERROR'
    | 'QUOTA_EXCEEDED'
    | 'INVALID_IMPORT'
    | 'MIGRATION_IN_PROGRESS'
    | 'NOT_FOUND'
    | 'INVALID_PATH'
    | 'CONFLICT';

export type BookmarksSortMode = 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';

export type SettingsCategory =
    | 'platforms'
    | 'chatgpt'
    | 'behavior'
    | 'reader'
    | 'bookmarks'
    | 'performance'
    | 'language';

export type BookmarksListPayload = {
    query?: string;
    platform?: string;
    folderPath?: string;
    recursive?: boolean;
    sortMode?: BookmarksSortMode;
};

export type BookmarksSavePayload = {
    url: string;
    position: number;
    userMessage: string;
    aiResponse?: string;
    title?: string;
    platform?: string;
    timestamp?: number;
    folderPath?: string;
    options?: { saveContextOnly?: boolean };
};

export type BookmarksRemovePayload = { url: string; position: number };

export type BookmarksExportPayload = { preserveStructure?: boolean };

export type BookmarksImportPayload = {
    jsonText: string;
    options?: {
        saveContextOnly?: boolean;
    };
};

export type BookmarksPositionsPayload = { url: string };

export type BookmarksBulkItem = { url: string; position: number };
export type BookmarksBulkRemovePayload = { items: BookmarksBulkItem[] };
export type BookmarksBulkMovePayload = { items: BookmarksBulkItem[]; targetFolderPath: string };
export type BookmarksExportSelectedPayload = { items: BookmarksBulkItem[]; preserveStructure?: boolean };

export type FolderCreatePayload = { path: string };
export type FolderDeletePayload = { path: string };
export type FolderRenamePayload = { oldPath: string; newName: string };
export type FolderMovePayload = { sourcePath: string; targetParentPath: string };

export type BookmarksUiStateKey = 'lastSelectedFolderPath';
export type BookmarksUiStateGetPayload = { key: BookmarksUiStateKey };
export type BookmarksUiStateSetPayload = { key: BookmarksUiStateKey; value: string | null };

export type SettingsGetCategoryPayload = { category: SettingsCategory };
export type SettingsSetCategoryPayload = { category: SettingsCategory; value: unknown };

export type ExtRequest =
    | { v: ProtocolVersion; id: RequestId; type: 'ping' }
    | { v: ProtocolVersion; id: RequestId; type: 'ui:toggle_toolbar' }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:getAll' }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:getCategory'; payload: SettingsGetCategoryPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:setCategory'; payload: SettingsSetCategoryPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:reset' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:list'; payload?: BookmarksListPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:positions'; payload: BookmarksPositionsPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:save'; payload: BookmarksSavePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:remove'; payload: BookmarksRemovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:bulkRemove'; payload: BookmarksBulkRemovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:bulkMove'; payload: BookmarksBulkMovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:export'; payload?: BookmarksExportPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:exportSelected'; payload: BookmarksExportSelectedPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:import'; payload: BookmarksImportPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:repair' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:folders:list' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:folders:create'; payload: FolderCreatePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:folders:delete'; payload: FolderDeletePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:folders:rename'; payload: FolderRenamePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:folders:move'; payload: FolderMovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:uiState:get'; payload: BookmarksUiStateGetPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:uiState:set'; payload: BookmarksUiStateSetPayload };

export type ExtResponse =
    | { v: ProtocolVersion; id: RequestId; ok: true; type: ExtRequest['type']; data?: unknown }
    | { v: ProtocolVersion; id: RequestId; ok: false; type: ExtRequest['type']; error: { code: ProtocolErrorCode; message: string } };

export function createRequestId(): RequestId {
    const rand = Math.random().toString(16).slice(2);
    return `req_${Date.now().toString(16)}_${rand}`;
}

export function isExtRequest(value: unknown): value is ExtRequest {
    if (typeof value !== 'object' || value === null) return false;
    const rec = value as Record<string, unknown>;
    if (rec.v !== PROTOCOL_VERSION) return false;
    if (typeof rec.id !== 'string' || rec.id.length < 6) return false;
    const type = rec.type;
    if (typeof type !== 'string') return false;

    const allowedTypes = new Set<string>([
        'ping',
        'ui:toggle_toolbar',
        'settings:getAll',
        'settings:getCategory',
        'settings:setCategory',
        'settings:reset',
        'bookmarks:list',
        'bookmarks:positions',
        'bookmarks:save',
        'bookmarks:remove',
        'bookmarks:bulkRemove',
        'bookmarks:bulkMove',
        'bookmarks:export',
        'bookmarks:exportSelected',
        'bookmarks:import',
        'bookmarks:repair',
        'bookmarks:folders:list',
        'bookmarks:folders:create',
        'bookmarks:folders:delete',
        'bookmarks:folders:rename',
        'bookmarks:folders:move',
        'bookmarks:uiState:get',
        'bookmarks:uiState:set',
    ]);

    return allowedTypes.has(type);
}
