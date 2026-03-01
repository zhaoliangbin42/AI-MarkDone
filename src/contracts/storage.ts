export const STORAGE_SCHEMA_VERSION = 1 as const;

export const STORAGE_KEYS = {
    schemaVersion: 'aimd:schema_version',
    userLocale: 'aimd:user_locale',

    bookmarksIndexV1: 'aimd:bookmarks:index:v1',
    bookmarksIndexBuiltAt: 'aimd:bookmarks:index_built_at',
    bookmarksJournalV1: 'aimd:bookmarks:journal:v1',
    bookmarksQuarantinePrefixV1: 'aimd:bookmarks:quarantine:v1:',
} as const;

export const LEGACY_STORAGE_KEYS = {
    bookmarkKeyPrefix: 'bookmark:',
    folderKeyPrefix: 'folder:',
    folderPathsIndex: 'folderPaths',
    migrationFlag: 'bookmarksMigrated',
    migrationDate: 'migrationDate',
    lastSelectedFolderPath: 'lastSelectedFolderPath',
} as const;
