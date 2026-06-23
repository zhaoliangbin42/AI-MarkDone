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
    | 'CONFLICT'
    | 'AUTH_REQUIRED'
    | 'PERMISSION_DENIED'
    | 'RATE_LIMITED'
    | 'PROVIDER_UNAVAILABLE'
    | 'INTEGRITY_MISMATCH'
    | 'SNAPSHOT_CORRUPTED'
    | 'SCHEMA_UNSUPPORTED'
    | 'SOURCE_UNAVAILABLE';

export type BookmarksSortMode = 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';

export type SettingsCategory =
    | 'platforms'
    | 'behavior'
    | 'reader'
    | 'formula'
    | 'export'
    | 'chatgptDirectory'
    | 'chatgptBehavior'
    | 'appearance'
    | 'bookmarks'
    | 'language';

export type BookmarksListPayload = {
    query?: string;
    platform?: string;
    kind?: 'all' | 'page' | 'message';
    folderPath?: string;
    recursive?: boolean;
    sortMode?: BookmarksSortMode;
};

export type BookmarksSavePayload = {
    url: string;
    position: number;
    messageId?: string | null;
    userMessage: string;
    aiResponse?: string;
    title?: string;
    platform?: string;
    timestamp?: number;
    folderPath?: string;
    options?: { saveContextOnly?: boolean };
};

export type BookmarksRemovePayload = { url: string; position: number };
export type BookmarksPageSavePayload = {
    url: string;
    title: string;
    platform?: string;
    timestamp?: number;
    folderPath?: string;
};
export type BookmarksPageRemovePayload = { url: string };
export type BookmarksPageStatusPayload = { url: string };

export type BookmarksExportPayload = { preserveStructure?: boolean };

export type BookmarksImportPayload = {
    jsonText: string;
    options?: {
        saveContextOnly?: boolean;
    };
};

export type BookmarksPositionsPayload = { url: string };

export type BookmarksBulkItem =
    | { kind?: 'message'; url: string; position: number }
    | { kind: 'page'; url: string };
export type BookmarksBulkRemovePayload = { items: BookmarksBulkItem[]; folderPaths?: string[] };
export type BookmarksBulkMovePayload = { items: BookmarksBulkItem[]; targetFolderPath: string };
export type BookmarksExportSelectedPayload = { items: BookmarksBulkItem[]; preserveStructure?: boolean };

export type FolderCreatePayload = { path: string };
export type FolderDeletePayload = { path: string };
export type FolderRenamePayload = { oldPath: string; newName: string };
export type FolderMovePayload = { sourcePath: string; targetParentPath: string };

export type BookmarksUiStateKey = 'lastSelectedFolderPath';
export type BookmarksUiStateGetPayload = { key: BookmarksUiStateKey };
export type BookmarksUiStateSetPayload = { key: BookmarksUiStateKey; value: string | null };
export type ChangelogNoticeReason = 'install' | 'update';
export type ChangelogNoticeState = {
    pendingVersion: string | null;
    lastShownVersion: string | null;
    reason: ChangelogNoticeReason | null;
    previousVersion?: string | null;
};
export type BookmarksChangelogNoticeAckPayload = { version: string };
export type BookmarksStorageUsageResponse = {
    usedBytes: number;
    quotaBytes: number;
    usedPercentage: number;
    warningLevel: 'none' | 'warning' | 'critical';
};

export type CloudBackupProviderId = 'googleDrive';
export type CloudBackupRestoreStrategy = 'previewOnly' | 'safeMerge' | 'replaceLocal';
export type CloudBackupAuthStrategy = 'browserManagedGoogleIdentity' | 'webExtensionAccessToken' | 'unsupported';
export type CloudBackupBrowserFamily = 'googleChrome' | 'webAuthCompatible' | 'firefox' | 'unsupported';
export type CloudBackupSessionState = 'unknown' | 'readyInThisSession' | 'needsConfirmation' | 'error';
export type CloudBackupAccountSummary = {
    accountEmail: string | null;
    accountDisplayName: string | null;
    accountPhotoUrl: string | null;
};
export type CloudBackupConnectedAccount = CloudBackupAccountSummary & {
    connectedAt: string | null;
};
export type CloudBackupDiagnostics = {
    extensionId: string | null;
    expectedExtensionId: string;
    extensionIdMatchesExpected: boolean;
    chromeExtensionClientId: string | null;
    webAuthClientId: string | null;
    browserFamily: CloudBackupBrowserFamily;
    hasIdentityPermission: boolean;
    hasGoogleApiHostPermission: boolean;
    hasManifestOAuthClient: boolean;
    hasDriveFileScope: boolean;
    supportsGetAuthToken: boolean;
    supportsLaunchWebAuthFlow: boolean;
    redirectUrl: string | null;
    oauthRequestPreview: {
        clientId: string | null;
        redirectUri: string | null;
        scope: string;
        responseType: 'token';
    } | null;
    authStrategy: CloudBackupAuthStrategy;
    usesManifestOAuthClient: boolean;
    usesWebOAuthClient: boolean;
    ready: boolean;
};
export type CloudBackupStatusPayload = { provider: CloudBackupProviderId };
export type CloudBackupDiagnosticsPayload = { provider: CloudBackupProviderId };
export type CloudBackupConnectPayload = { provider: CloudBackupProviderId };
export type CloudBackupDisconnectPayload = { provider: CloudBackupProviderId };
export type CloudBackupBackupNowPayload = { provider: CloudBackupProviderId };
export type CloudBackupListSnapshotsPayload = { provider: CloudBackupProviderId };
export type CloudBackupPreviewRestorePayload = {
    provider: CloudBackupProviderId;
    snapshotId: string;
    strategy?: CloudBackupRestoreStrategy;
};
export type CloudBackupApplyRestorePayload = {
    provider: CloudBackupProviderId;
    snapshotId: string;
    strategy: 'safeMerge';
};
export type CloudBackupDeleteSnapshotPayload = { provider: CloudBackupProviderId; snapshotId: string };

export type SettingsGetCategoryPayload = { category: SettingsCategory };
export type SettingsSetCategoryPayload = { category: SettingsCategory; value: unknown };
export type ContentReadyPayload = { platform: 'chatgpt' | 'gemini' | 'claude' | 'deepseek'; url: string };

export type ReaderSessionSerializableItem = {
    id: string;
    userPrompt: string;
    content: string;
    meta?: {
        platformId?: string;
        messageId?: string | null;
        position?: number;
        url?: string;
        bookmarkable?: boolean;
        bookmarked?: boolean;
    };
};

export type ReaderSessionSnapshot = {
    items: ReaderSessionSerializableItem[];
    startIndex: number;
    sourceUrl: string;
    theme: 'light' | 'dark';
    createdAt: number;
    updatedAt: number;
};

export type ReaderSessionCreatePayload = {
    snapshot: ReaderSessionSnapshot;
};

export type ReaderSessionByIdPayload = { sessionId: string };
export type ReaderSessionDraftPayload = { sessionId: string; text?: string };
export type ReaderSessionBeforeSendPayload = { sessionId: string };
export type ReaderSessionSendPayload = { sessionId: string; text: string };
export type ReaderSessionLocatePayload = {
    sessionId: string;
    position?: number;
    messageId?: string | null;
};

export type ExtRequest =
    | { v: ProtocolVersion; id: RequestId; type: 'ping' }
    | { v: ProtocolVersion; id: RequestId; type: 'content:ready'; payload: ContentReadyPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'ui:toggle_toolbar' }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:create'; payload: ReaderSessionCreatePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:get'; payload: ReaderSessionByIdPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:refresh'; payload: ReaderSessionByIdPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:draft'; payload: ReaderSessionDraftPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:beforeSend'; payload: ReaderSessionBeforeSendPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:send'; payload: ReaderSessionSendPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:locate'; payload: ReaderSessionLocatePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'readerSession:close'; payload: ReaderSessionByIdPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:getAll' }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:getCategory'; payload: SettingsGetCategoryPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:setCategory'; payload: SettingsSetCategoryPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'settings:reset' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:list'; payload?: BookmarksListPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:positions'; payload: BookmarksPositionsPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:save'; payload: BookmarksSavePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:remove'; payload: BookmarksRemovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:page:save'; payload: BookmarksPageSavePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:page:remove'; payload: BookmarksPageRemovePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:page:status'; payload: BookmarksPageStatusPayload }
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
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:storageUsage' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:uiState:get'; payload: BookmarksUiStateGetPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:uiState:set'; payload: BookmarksUiStateSetPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:changelogNotice:get' }
    | { v: ProtocolVersion; id: RequestId; type: 'bookmarks:changelogNotice:ack'; payload: BookmarksChangelogNoticeAckPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:status'; payload: CloudBackupStatusPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:diagnostics'; payload: CloudBackupDiagnosticsPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:connect'; payload: CloudBackupConnectPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:disconnect'; payload: CloudBackupDisconnectPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:backupNow'; payload: CloudBackupBackupNowPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:listSnapshots'; payload: CloudBackupListSnapshotsPayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:previewRestore'; payload: CloudBackupPreviewRestorePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:applyRestore'; payload: CloudBackupApplyRestorePayload }
    | { v: ProtocolVersion; id: RequestId; type: 'cloudBackup:deleteSnapshot'; payload: CloudBackupDeleteSnapshotPayload };

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
        'content:ready',
        'ui:toggle_toolbar',
        'readerSession:create',
        'readerSession:get',
        'readerSession:refresh',
        'readerSession:draft',
        'readerSession:beforeSend',
        'readerSession:send',
        'readerSession:locate',
        'readerSession:close',
        'settings:getAll',
        'settings:getCategory',
        'settings:setCategory',
        'settings:reset',
        'bookmarks:list',
        'bookmarks:positions',
        'bookmarks:save',
        'bookmarks:remove',
        'bookmarks:page:save',
        'bookmarks:page:remove',
        'bookmarks:page:status',
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
        'bookmarks:storageUsage',
        'bookmarks:uiState:get',
        'bookmarks:uiState:set',
        'bookmarks:changelogNotice:get',
        'bookmarks:changelogNotice:ack',
        'cloudBackup:status',
        'cloudBackup:diagnostics',
        'cloudBackup:connect',
        'cloudBackup:disconnect',
        'cloudBackup:backupNow',
        'cloudBackup:listSnapshots',
        'cloudBackup:previewRestore',
        'cloudBackup:applyRestore',
        'cloudBackup:deleteSnapshot',
    ]);

    if (!allowedTypes.has(type)) return false;
    if (type === 'content:ready') {
        const payload = rec.payload;
        if (typeof payload !== 'object' || payload === null) return false;
        const readyPayload = payload as Record<string, unknown>;
        return (
            readyPayload.platform === 'chatgpt'
            || readyPayload.platform === 'gemini'
            || readyPayload.platform === 'claude'
            || readyPayload.platform === 'deepseek'
        )
            && typeof readyPayload.url === 'string'
            && readyPayload.url.trim().length > 0;
    }

    if (type.startsWith('readerSession:')) {
        const payload = rec.payload;
        if (typeof payload !== 'object' || payload === null) return false;
        const sessionPayload = payload as Record<string, unknown>;
        if (type === 'readerSession:create') {
            const snapshot = sessionPayload.snapshot as Record<string, unknown> | null;
            return !!snapshot
                && Array.isArray(snapshot.items)
                && typeof snapshot.startIndex === 'number'
                && typeof snapshot.sourceUrl === 'string'
                && (snapshot.theme === 'light' || snapshot.theme === 'dark')
                && typeof snapshot.createdAt === 'number'
                && typeof snapshot.updatedAt === 'number';
        }
        if (typeof sessionPayload.sessionId !== 'string' || sessionPayload.sessionId.trim().length === 0) return false;
        if (type === 'readerSession:draft' && sessionPayload.text !== undefined) {
            return typeof sessionPayload.text === 'string';
        }
        if (type === 'readerSession:send') {
            return typeof sessionPayload.text === 'string';
        }
        if (type === 'readerSession:locate') {
            return sessionPayload.position === undefined || typeof sessionPayload.position === 'number' || typeof sessionPayload.messageId === 'string' || sessionPayload.messageId === null;
        }
        return true;
    }

    return true;
}
