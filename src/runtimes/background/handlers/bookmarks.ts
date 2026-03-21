import type { ExtRequest, ExtResponse } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import type { ProtocolErrorCode } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import type { Bookmark, Folder } from '../../../core/bookmarks/types';
import { checkQuota } from '../../../core/bookmarks/quota';
import { normalizeUrlWithoutProtocol } from '../../../core/bookmarks/keys';
import { PathUtils, PathValidationError } from '../../../core/bookmarks/path';
import { logger } from '../../../core/logger';
import {
    exportBookmarks,
    listBookmarks,
    planCreateFolder,
    planDeleteFolder,
    planFolderRelocate,
    planImportBookmarks,
    planRemoveBookmark,
    planRepair,
    planSaveBookmark,
} from '../../../services/bookmarks/bookmarksService';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import { bookmarksIndexStore } from '../../../drivers/background/storage/bookmarksIndexStore';
import { folderIndexStore } from '../../../drivers/background/storage/folderIndexStore';
import { journalStore } from '../../../drivers/background/storage/journalStore';
import { quarantineStore } from '../../../drivers/background/storage/quarantineStore';

type HandlerResult = { response: ExtResponse };

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return {
        v: PROTOCOL_VERSION,
        id,
        ok: false,
        type,
        error: { code, message },
    };
}

function toProtocolErrorCode(error: unknown): { code: ProtocolErrorCode; message: string } {
    if (error instanceof PathValidationError) {
        return { code: 'INVALID_PATH', message: error.message };
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Folder not found:')) return { code: 'NOT_FOUND', message };
    if (message.startsWith('Parent folder does not exist:')) return { code: 'NOT_FOUND', message };
    if (message.includes('already exists')) return { code: 'CONFLICT', message };
    if (message.includes('Folder must be empty')) return { code: 'CONFLICT', message };
    if (message.includes('Cannot move folder into its own descendant')) return { code: 'INVALID_PATH', message };

    return { code: 'INTERNAL_ERROR', message };
}

const DEFAULT_FOLDER_PATH = 'Import';

function parsePositionFromKey(key: string, urlWithoutProtocol: string): number | null {
    const prefix = `${LEGACY_STORAGE_KEYS.bookmarkKeyPrefix}${urlWithoutProtocol}:`;
    if (!key.startsWith(prefix)) return null;
    const posStr = key.slice(prefix.length);
    const pos = Number.parseInt(posStr, 10);
    return Number.isFinite(pos) && pos > 0 ? pos : null;
}

function getQuotaBytesFallback(): number {
    const chromeAny = (globalThis as any).chrome;
    const quota = chromeAny?.storage?.local?.QUOTA_BYTES;
    if (typeof quota === 'number' && quota > 0) return quota;
    return 10 * 1024 * 1024;
}

function normalizeLastSelectedFolderPath(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
        PathUtils.validatePath(trimmed);
        return PathUtils.normalize(trimmed);
    } catch {
        return null;
    }
}

async function readLastSelectedFolderPath(): Promise<string | null> {
    const result = await localStoragePort.get([LEGACY_STORAGE_KEYS.lastSelectedFolderPath]);
    return normalizeLastSelectedFolderPath(result[LEGACY_STORAGE_KEYS.lastSelectedFolderPath]);
}

function normalizeStoredBookmark(key: string, raw: unknown, now: number): Bookmark | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;

    const url = typeof rec.url === 'string' ? rec.url : null;
    const position = typeof rec.position === 'number' ? rec.position : null;
    const userMessage = typeof rec.userMessage === 'string' ? rec.userMessage : null;
    const timestamp = typeof rec.timestamp === 'number' ? rec.timestamp : null;

    if (!url || position === null || !userMessage || timestamp === null) return null;

    const urlWithoutProtocol = typeof rec.urlWithoutProtocol === 'string'
        ? rec.urlWithoutProtocol
        : (() => {
            // Prefer deriving from key (cheaper + consistent with key schema).
            if (key.startsWith(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix)) {
                const lastColon = key.lastIndexOf(':');
                if (lastColon > LEGACY_STORAGE_KEYS.bookmarkKeyPrefix.length) {
                    return key.slice(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix.length, lastColon);
                }
            }
            return normalizeUrlWithoutProtocol(url);
        })();

    const title = typeof rec.title === 'string' && rec.title.trim().length > 0
        ? rec.title
        : userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');

    const platform = typeof rec.platform === 'string' && rec.platform.trim().length > 0
        ? rec.platform
        : 'ChatGPT';

    const folderPath = typeof rec.folderPath === 'string' && rec.folderPath.trim().length > 0 && rec.folderPath !== '/'
        ? rec.folderPath
        : 'Import';

    const aiResponse = typeof rec.aiResponse === 'string' ? rec.aiResponse : undefined;

    return {
        url,
        urlWithoutProtocol,
        position,
        userMessage,
        aiResponse,
        timestamp: timestamp || now,
        title,
        platform,
        folderPath,
    };
}

async function loadAllBookmarks(now: number): Promise<Bookmark[]> {
    const index = await bookmarksIndexStore.buildIndexIfMissing(now);
    if (index.length === 0) return [];

    const bookmarks: Bookmark[] = [];
    const chunkSize = 200;
    for (let i = 0; i < index.length; i += chunkSize) {
        const chunk = index.slice(i, i + chunkSize);
        const result = await localStoragePort.get(chunk);
        for (const key of chunk) {
            const raw = result[key];
            const normalized = normalizeStoredBookmark(key, raw, now);
            if (normalized) bookmarks.push(normalized);
        }
    }
    return bookmarks;
}

async function loadAllFolders(): Promise<{ folderPaths: string[]; folders: Folder[] }> {
    const folderPaths = await folderIndexStore.buildFolderPathsIfMissing();
    if (folderPaths.length === 0) return { folderPaths: [], folders: [] };

    const folders: Folder[] = [];
    const chunkSize = 200;
    for (let i = 0; i < folderPaths.length; i += chunkSize) {
        const chunkPaths = folderPaths.slice(i, i + chunkSize);
        const keys = chunkPaths.map((p) => `${LEGACY_STORAGE_KEYS.folderKeyPrefix}${p}`);
        const result = await localStoragePort.get(keys);
        for (const p of chunkPaths) {
            const raw = result[`${LEGACY_STORAGE_KEYS.folderKeyPrefix}${p}`];
            if (raw && typeof raw === 'object') {
                folders.push(raw as Folder);
            }
        }
    }
    return { folderPaths, folders };
}

function collectRequiredFolderPaths(bookmarks: Bookmark[]): string[] {
    const set = new Set<string>();
    for (const b of bookmarks) {
        const raw = (b.folderPath ?? '').trim();
        if (!raw || raw === '/') continue;
        const normalized = (() => {
            try {
                PathUtils.validatePath(raw);
                return PathUtils.normalize(raw);
            } catch {
                return null;
            }
        })();
        if (!normalized) continue;

        for (const a of PathUtils.getAncestors(normalized)) set.add(a);
        set.add(normalized);
    }
    return Array.from(set).sort((a, b) => PathUtils.getDepth(a) - PathUtils.getDepth(b));
}

async function ensureFolderRecordsExist(params: {
    requiredPaths: string[];
    folderPaths: string[];
    folders: Folder[];
    now: number;
}): Promise<{ updatedFolderPaths: string[]; folderSetPatch: Record<string, Folder>; failedPaths: string[] }> {
    const existingFolderSet = new Set(params.folderPaths);
    const folderByPath = new Map(params.folders.map((f) => [f.path, f]));

    const folderSetPatch: Record<string, Folder> = {};
    const updatedFolderPaths = [...params.folderPaths];
    const failedPaths: string[] = [];

    for (const path of params.requiredPaths) {
        const normalized = (() => {
            try {
                PathUtils.validatePath(path);
                return PathUtils.normalize(path);
            } catch {
                return null;
            }
        })();
        if (!normalized) {
            failedPaths.push(path);
            continue;
        }

        if (!existingFolderSet.has(normalized)) {
            // Create folder record via service-level plan (validates parent and conflicts).
            try {
                const createPlan = planCreateFolder({
                    path: normalized,
                    existingFolders: Array.from(folderByPath.values()),
                    folderPaths: updatedFolderPaths,
                    now: params.now,
                });
                for (const [k, v] of Object.entries(createPlan.setPatch)) {
                    folderSetPatch[k] = v as Folder;
                    folderByPath.set((v as Folder).path, v as Folder);
                }
                updatedFolderPaths.splice(0, updatedFolderPaths.length, ...createPlan.updatedFolderPaths);
                existingFolderSet.add(normalized);
            } catch (e) {
                failedPaths.push(normalized);
            }
        } else if (!folderByPath.has(normalized)) {
            // Self-heal: index says it exists but record missing.
            const folder: Folder = {
                path: normalized,
                name: PathUtils.getFolderName(normalized),
                depth: PathUtils.getDepth(normalized),
                createdAt: params.now,
                updatedAt: params.now,
            };
            folderByPath.set(normalized, folder);
            folderSetPatch[`${LEGACY_STORAGE_KEYS.folderKeyPrefix}${normalized}`] = folder;
        }
    }

    return { updatedFolderPaths, folderSetPatch, failedPaths };
}

async function applyFolderRelocateWithJournal(params: {
    oldPath: string;
    newPath: string;
    now: number;
    opId?: string;
}): Promise<void> {
    await backgroundStorageQueue.enqueue(async () => {
        const lastSelected = await readLastSelectedFolderPath();
        const { folderPaths, folders } = await loadAllFolders();
        const bookmarks = await loadAllBookmarks(params.now);

        const relocatePlan = planFolderRelocate({
            oldPath: params.oldPath,
            newPath: params.newPath,
            folders,
            folderPaths,
            bookmarks,
            now: params.now,
            opId: params.opId,
        });

        await journalStore.setJournal(relocatePlan.journal);

        const setPatch: Record<string, unknown> = {
            ...relocatePlan.folderSetPatch,
            ...relocatePlan.bookmarkSetPatch,
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: relocatePlan.updatedFolderPaths,
        };

        if (lastSelected) {
            const updated = PathUtils.updatePathPrefix(params.oldPath, params.newPath, lastSelected);
            if (updated !== lastSelected) {
                setPatch[LEGACY_STORAGE_KEYS.lastSelectedFolderPath] = updated;
            }
        }
        await localStoragePort.set(setPatch);

        if (relocatePlan.folderRemoveKeys.length > 0) {
            await localStoragePort.remove(relocatePlan.folderRemoveKeys);
        }

        await journalStore.clearJournal();
    });
}

export async function recoverJournalIfAny(now: number): Promise<void> {
    const record = await journalStore.getJournal();
    if (!record) return;

    if (record.type === 'folder_relocate') {
        logger.warn('[AI-MarkDone][Bookmarks][Journal] Recovering unfinished folder relocate:', record);
        try {
            await applyFolderRelocateWithJournal({
                oldPath: record.oldPath,
                newPath: record.newPath,
                now,
                opId: record.opId,
            });
        } finally {
            // If relocation throws, journal remains so we can retry on next startup.
        }
    }
}

export async function handleBookmarksRequest(request: ExtRequest): Promise<HandlerResult | null> {
    const now = Date.now();

    if (!request.type.startsWith('bookmarks:')) return null;

    const quotaBytes = getQuotaBytesFallback();

    switch (request.type) {
        case 'bookmarks:list': {
            const bookmarks = await loadAllBookmarks(now);
            const payload = request.payload ?? {};
            const result = listBookmarks({
                bookmarks,
                query: payload.query,
                platform: payload.platform,
                folderPath: payload.folderPath,
                recursive: payload.recursive,
                sortMode: payload.sortMode,
            });
            return { response: ok(request.id, request.type, result) };
        }
        case 'bookmarks:positions': {
            const urlWithoutProtocol = normalizeUrlWithoutProtocol(request.payload.url);
            const index = await bookmarksIndexStore.buildIndexIfMissing(now);
            const positions: number[] = [];
            for (const key of index) {
                const pos = parsePositionFromKey(key, urlWithoutProtocol);
                if (pos !== null) positions.push(pos);
            }
            positions.sort((a, b) => a - b);
            return { response: ok(request.id, request.type, { positions }) };
        }
        case 'bookmarks:export': {
            const bookmarks = await loadAllBookmarks(now);
            const preserve = request.payload?.preserveStructure !== false;
            const result = exportBookmarks({ bookmarks, preserveStructure: preserve });
            return { response: ok(request.id, request.type, result) };
        }
        case 'bookmarks:exportSelected': {
            const items = Array.isArray(request.payload.items) ? request.payload.items : [];
            const unique = new Map<string, { url: string; position: number }>();
            for (const it of items) {
                if (!it || typeof it.url !== 'string' || typeof it.position !== 'number') continue;
                unique.set(`${it.url}::${it.position}`, { url: it.url, position: it.position });
            }
            const selected = Array.from(unique.values());
            if (selected.length === 0) {
                const preserve = request.payload.preserveStructure !== false;
                const result = exportBookmarks({ bookmarks: [], preserveStructure: preserve });
                return { response: ok(request.id, request.type, result) };
            }

            const keys = selected.map((it) => `bookmark:${normalizeUrlWithoutProtocol(it.url)}:${it.position}`);
            const raw = await localStoragePort.get(keys);
            const bookmarks: Bookmark[] = [];
            for (const key of keys) {
                const normalized = normalizeStoredBookmark(key, raw[key], now);
                if (normalized) bookmarks.push(normalized);
            }
            const preserve = request.payload.preserveStructure !== false;
            const result = exportBookmarks({ bookmarks, preserveStructure: preserve });
            return { response: ok(request.id, request.type, result) };
        }
        case 'bookmarks:save': {
            return backgroundStorageQueue.enqueue(async () => {
                const index = await bookmarksIndexStore.buildIndexIfMissing(now);
                const usedBytes = await localStoragePort.getBytesInUse(null);
                const saveContextOnly = Boolean(request.payload.options?.saveContextOnly);
                const plan = planSaveBookmark({
                    input: request.payload,
                    existingIndex: index,
                    now,
                    usedBytes,
                    quotaBytes,
                    saveContextOnly,
                });
                if (!plan.quota.canProceed) {
                    return { response: err(request.id, request.type, 'QUOTA_EXCEEDED', plan.quota.message || 'Storage quota exceeded') };
                }

                const patch: Record<string, unknown> = {
                    ...plan.setPatch,
                    [STORAGE_KEYS.bookmarksIndexV1]: plan.updatedIndex,
                };
                await localStoragePort.set(patch);
                return { response: ok(request.id, request.type, { warnings: plan.warnings }) };
            });
        }
        case 'bookmarks:remove': {
            return backgroundStorageQueue.enqueue(async () => {
                const index = await bookmarksIndexStore.buildIndexIfMissing(now);
                const plan = planRemoveBookmark({ url: request.payload.url, position: request.payload.position, existingIndex: index });
                await localStoragePort.remove(plan.removeKeys);
                await bookmarksIndexStore.setIndex(plan.updatedIndex);
                return { response: ok(request.id, request.type, { removed: plan.removeKeys.length }) };
            });
        }
        case 'bookmarks:bulkRemove': {
            return backgroundStorageQueue.enqueue(async () => {
                const items = Array.isArray(request.payload.items) ? request.payload.items : [];
                const unique = new Map<string, { url: string; position: number }>();
                for (const it of items) {
                    if (!it || typeof it.url !== 'string' || typeof it.position !== 'number') continue;
                    unique.set(`${it.url}::${it.position}`, { url: it.url, position: it.position });
                }
                const toRemove = Array.from(unique.values());
                const requestedFolderPaths = Array.isArray(request.payload.folderPaths)
                    ? request.payload.folderPaths
                        .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
                        .map((path) => {
                            try {
                                return PathUtils.normalize(path);
                            } catch {
                                return null;
                            }
                        })
                        .filter((path): path is string => Boolean(path))
                    : [];
                if (toRemove.length === 0 && requestedFolderPaths.length === 0) {
                    return { response: ok(request.id, request.type, { removed: 0 }) };
                }

                const index = await bookmarksIndexStore.buildIndexIfMissing(now);
                const removeSet = new Set(
                    toRemove.map((it) => `bookmark:${normalizeUrlWithoutProtocol(it.url)}:${it.position}`),
                );
                let nextFolderPaths: string[] | null = null;

                if (requestedFolderPaths.length > 0) {
                    const [{ folderPaths }, bookmarks, lastSelected] = await Promise.all([
                        loadAllFolders(),
                        loadAllBookmarks(now),
                        readLastSelectedFolderPath(),
                    ]);

                    const affectedFolderPaths = folderPaths.filter((path) => (
                        requestedFolderPaths.some((selectedPath) => (
                            path === selectedPath || PathUtils.isDescendantOf(path, selectedPath)
                        ))
                    ));
                    const affectedFolderPathSet = new Set(affectedFolderPaths);

                    for (const bookmark of bookmarks) {
                        if (requestedFolderPaths.some((selectedPath) => (
                            bookmark.folderPath === selectedPath || PathUtils.isDescendantOf(bookmark.folderPath, selectedPath)
                        ))) {
                            removeSet.add(`${LEGACY_STORAGE_KEYS.bookmarkKeyPrefix}${bookmark.urlWithoutProtocol}:${bookmark.position}`);
                        }
                    }

                    for (const path of affectedFolderPaths) {
                        removeSet.add(`${LEGACY_STORAGE_KEYS.folderKeyPrefix}${path}`);
                    }

                    const remainingFolderPaths = folderPaths.filter((path) => !affectedFolderPathSet.has(path));
                    nextFolderPaths = remainingFolderPaths;

                    if (lastSelected && requestedFolderPaths.some((selectedPath) => (
                        lastSelected === selectedPath || PathUtils.isDescendantOf(lastSelected, selectedPath)
                    ))) {
                        const nextSelected = PathUtils.getPathChain(lastSelected)
                            .slice(0, -1)
                            .reverse()
                            .find((candidate) => remainingFolderPaths.includes(candidate)) ?? null;
                        if (nextSelected) {
                            await localStoragePort.set({ [LEGACY_STORAGE_KEYS.lastSelectedFolderPath]: nextSelected });
                        } else {
                            removeSet.add(LEGACY_STORAGE_KEYS.lastSelectedFolderPath);
                        }
                    }
                }

                const removeKeys = Array.from(removeSet);
                const updatedIndex = index.filter((k) => !removeSet.has(k));

                await localStoragePort.remove(removeKeys);
                await bookmarksIndexStore.setIndex(updatedIndex);
                if (nextFolderPaths) {
                    await folderIndexStore.setFolderPaths(nextFolderPaths);
                }

                return { response: ok(request.id, request.type, { removed: removeKeys.length }) };
            });
        }
        case 'bookmarks:bulkMove': {
            return backgroundStorageQueue.enqueue(async () => {
                const items = Array.isArray(request.payload.items) ? request.payload.items : [];
                const unique = new Map<string, { url: string; position: number }>();
                for (const it of items) {
                    if (!it || typeof it.url !== 'string' || typeof it.position !== 'number') continue;
                    unique.set(`${it.url}::${it.position}`, { url: it.url, position: it.position });
                }
                const toMove = Array.from(unique.values());
                if (toMove.length === 0) return { response: ok(request.id, request.type, { moved: 0, missing: 0 }) };

                const targetFolderPath = String(request.payload.targetFolderPath ?? '').trim();
                const normalizedTarget = targetFolderPath && targetFolderPath !== '/'
                    ? PathUtils.normalize(targetFolderPath)
                    : DEFAULT_FOLDER_PATH;
                if (normalizedTarget !== DEFAULT_FOLDER_PATH) PathUtils.validatePath(normalizedTarget);

                const { folderPaths, folders } = await loadAllFolders();
                const ensure = await ensureFolderRecordsExist({
                    requiredPaths: [normalizedTarget],
                    folderPaths,
                    folders,
                    now,
                });
                if (ensure.failedPaths.length > 0) {
                    return { response: err(request.id, request.type, 'INVALID_PATH', 'Target folder path is invalid or cannot be created') };
                }
                if (Object.keys(ensure.folderSetPatch).length > 0 || ensure.updatedFolderPaths !== folderPaths) {
                    await localStoragePort.set({
                        ...ensure.folderSetPatch,
                        [LEGACY_STORAGE_KEYS.folderPathsIndex]: ensure.updatedFolderPaths,
                    });
                }

                const keys = toMove.map((it) => `bookmark:${normalizeUrlWithoutProtocol(it.url)}:${it.position}`);
                const existing = await localStoragePort.get(keys);
                const patch: Record<string, unknown> = {};
                let moved = 0;
                let missing = 0;

                for (const key of keys) {
                    const normalized = normalizeStoredBookmark(key, existing[key], now);
                    if (!normalized) {
                        missing += 1;
                        continue;
                    }
                    patch[key] = { ...normalized, folderPath: normalizedTarget };
                    moved += 1;
                }

                if (Object.keys(patch).length > 0) {
                    await localStoragePort.set(patch);
                }

                return { response: ok(request.id, request.type, { moved, missing }) };
            });
        }
        case 'bookmarks:repair': {
            return backgroundStorageQueue.enqueue(async () => {
                const existingIndex = await bookmarksIndexStore.loadIndex();
                const raw = await localStoragePort.get(null);
                const repairPlan = planRepair({ rawStorage: raw, existingIndex, now });

                await quarantineStore.writeEntries(repairPlan.quarantine, now);
                if (Object.keys(repairPlan.setPatch).length > 0) {
                    await localStoragePort.set(repairPlan.setPatch as any);
                }
                if (repairPlan.removeKeys.length > 0) {
                    await localStoragePort.remove(repairPlan.removeKeys);
                }
                if (repairPlan.updatedIndex) {
                    await bookmarksIndexStore.setIndex(repairPlan.updatedIndex);
                }

                return { response: ok(request.id, request.type, { stats: repairPlan.stats }) };
            });
        }
        case 'bookmarks:import': {
            return backgroundStorageQueue.enqueue(async () => {
                const existingIndex = await bookmarksIndexStore.buildIndexIfMissing(now);
                const existing = await loadAllBookmarks(now);
                const usedBytes = await localStoragePort.getBytesInUse(null);
                const saveContextOnly = Boolean(request.payload.options?.saveContextOnly);

                const plan = planImportBookmarks({
                    jsonText: request.payload.jsonText,
                    existing,
                    existingIndex,
                    now,
                    usedBytes,
                    quotaBytes,
                    saveContextOnly,
                });
                if (!plan.quota.canImport) {
                    return { response: err(request.id, request.type, 'QUOTA_EXCEEDED', plan.quota.message || 'Not enough storage space') };
                }

                const { folderPaths, folders } = await loadAllFolders();
                const ensure = await ensureFolderRecordsExist({
                    requiredPaths: plan.foldersToEnsure,
                    folderPaths,
                    folders,
                    now,
                });

                // If some folders fail to create, force affected bookmarks into Import to avoid hidden entries.
                let bookmarksToUpsert = plan.bookmarksToUpsert;
                if (ensure.failedPaths.length > 0) {
                    const failedPrefixes = ensure.failedPaths.map((p) => `${p}/`);
                    bookmarksToUpsert = bookmarksToUpsert.map((b) => {
                        const affected = ensure.failedPaths.includes(b.folderPath)
                            || failedPrefixes.some((prefix) => b.folderPath.startsWith(prefix));
                        return affected ? { ...b, folderPath: DEFAULT_FOLDER_PATH } : b;
                    });
                }

                const bookmarkPatch: Record<string, unknown> = {};
                for (const b of bookmarksToUpsert) {
                    const key = `${LEGACY_STORAGE_KEYS.bookmarkKeyPrefix}${b.urlWithoutProtocol}:${b.position}`;
                    bookmarkPatch[key] = b;
                }

                const patch: Record<string, unknown> = {
                    ...ensure.folderSetPatch,
                    [LEGACY_STORAGE_KEYS.folderPathsIndex]: ensure.updatedFolderPaths,
                    ...bookmarkPatch,
                    [STORAGE_KEYS.bookmarksIndexV1]: plan.updatedIndex,
                };
                await localStoragePort.set(patch);

                return {
                    response: ok(request.id, request.type, {
                        imported: bookmarksToUpsert.length,
                        skippedDuplicates: plan.skippedDuplicates,
                        renamed: plan.renamedTitles.length,
                        warnings: plan.warnings,
                        folderCreateFailures: ensure.failedPaths.length,
                    }),
                };
            });
        }
        case 'bookmarks:folders:list': {
            const [{ folderPaths, folders }, bookmarks] = await Promise.all([
                loadAllFolders(),
                loadAllBookmarks(now),
            ]);

            const requiredPaths = Array.from(new Set([
                ...folderPaths,
                ...collectRequiredFolderPaths(bookmarks),
            ])).sort((a, b) => PathUtils.getDepth(a) - PathUtils.getDepth(b));

            if (requiredPaths.length === 0) {
                return { response: ok(request.id, request.type, { folderPaths, folders }) };
            }

            const ensure = await ensureFolderRecordsExist({
                requiredPaths,
                folderPaths,
                folders,
                now,
            });

            if (Object.keys(ensure.folderSetPatch).length > 0 || ensure.updatedFolderPaths.length !== folderPaths.length) {
                await localStoragePort.set({
                    ...ensure.folderSetPatch,
                    [LEGACY_STORAGE_KEYS.folderPathsIndex]: ensure.updatedFolderPaths,
                });
                await folderIndexStore.setFolderPaths(ensure.updatedFolderPaths);
            }

            const folderByPath = new Map<string, Folder>();
            for (const f of folders) folderByPath.set(f.path, f);
            for (const v of Object.values(ensure.folderSetPatch)) folderByPath.set(v.path, v);

            const nextFolders = ensure.updatedFolderPaths
                .map((p) => folderByPath.get(p))
                .filter(Boolean) as Folder[];

            return { response: ok(request.id, request.type, { folderPaths: ensure.updatedFolderPaths, folders: nextFolders }) };
        }
        case 'bookmarks:folders:create': {
            return backgroundStorageQueue.enqueue(async () => {
                try {
                    const { folderPaths, folders } = await loadAllFolders();
                    const plan = planCreateFolder({ path: request.payload.path, existingFolders: folders, folderPaths, now });
                    await localStoragePort.set({
                        ...plan.setPatch,
                        [LEGACY_STORAGE_KEYS.folderPathsIndex]: plan.updatedFolderPaths,
                    });
                    return { response: ok(request.id, request.type, { created: request.payload.path }) };
                } catch (e) {
                    const mapped = toProtocolErrorCode(e);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        case 'bookmarks:folders:delete': {
            return backgroundStorageQueue.enqueue(async () => {
                try {
                    const lastSelected = await readLastSelectedFolderPath();
                    const { folderPaths } = await loadAllFolders();
                    const bookmarks = await loadAllBookmarks(now);
                    const plan = planDeleteFolder({ path: request.payload.path, folderPaths, bookmarks });
                    const removeKeys = [...plan.removeKeys];

                    if (lastSelected) {
                        const deletedPath = PathUtils.normalize(request.payload.path);
                        if (lastSelected === deletedPath || PathUtils.isDescendantOf(lastSelected, deletedPath)) {
                            const parent = PathUtils.getParentPath(deletedPath);
                            if (parent) {
                                await localStoragePort.set({ [LEGACY_STORAGE_KEYS.lastSelectedFolderPath]: parent });
                            } else {
                                removeKeys.push(LEGACY_STORAGE_KEYS.lastSelectedFolderPath);
                            }
                        }
                    }

                    await localStoragePort.remove(removeKeys);
                    await folderIndexStore.setFolderPaths(plan.updatedFolderPaths);
                    return { response: ok(request.id, request.type, { deleted: request.payload.path }) };
                } catch (e) {
                    const mapped = toProtocolErrorCode(e);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        case 'bookmarks:folders:rename': {
            const newName = String(request.payload.newName ?? '').trim();
            if (!PathUtils.isValidFolderName(newName)) {
                return { response: err(request.id, request.type, 'INVALID_PATH', 'Invalid folder name') };
            }
            try {
                const oldPath = PathUtils.normalize(request.payload.oldPath);
                const parentPath = PathUtils.getParentPath(oldPath);
                const newPath = parentPath ? `${parentPath}${PathUtils.SEPARATOR}${newName}` : newName;
                if (oldPath !== newPath && PathUtils.isDescendantOf(newPath, oldPath)) {
                    return { response: err(request.id, request.type, 'INVALID_PATH', 'Cannot move folder into its own descendant') };
                }
                await applyFolderRelocateWithJournal({ oldPath, newPath, now });
                return { response: ok(request.id, request.type, { oldPath, newPath }) };
            } catch (e) {
                const mapped = toProtocolErrorCode(e);
                return { response: err(request.id, request.type, mapped.code, mapped.message) };
            }
        }
        case 'bookmarks:folders:move': {
            try {
                const sourcePath = PathUtils.normalize(request.payload.sourcePath);
                const folderName = PathUtils.getFolderName(sourcePath);
                const targetParent = request.payload.targetParentPath ? PathUtils.normalize(request.payload.targetParentPath) : '';
                const newPath = targetParent ? `${targetParent}${PathUtils.SEPARATOR}${folderName}` : folderName;
                if (sourcePath !== newPath && PathUtils.isDescendantOf(newPath, sourcePath)) {
                    return { response: err(request.id, request.type, 'INVALID_PATH', 'Cannot move folder into its own descendant') };
                }
                await applyFolderRelocateWithJournal({ oldPath: sourcePath, newPath, now });
                return { response: ok(request.id, request.type, { oldPath: sourcePath, newPath }) };
            } catch (e) {
                const mapped = toProtocolErrorCode(e);
                return { response: err(request.id, request.type, mapped.code, mapped.message) };
            }
        }
        case 'bookmarks:storageUsage': {
            const usedBytes = await localStoragePort.getBytesInUse(null);
            const quota = checkQuota({ usedBytes, quotaBytes });
            return {
                response: ok(request.id, request.type, {
                    usedBytes,
                    quotaBytes,
                    usedPercentage: quota.usedPercentage,
                    warningLevel: quota.warningLevel,
                }),
            };
        }
        case 'bookmarks:uiState:get': {
            if (request.payload.key !== 'lastSelectedFolderPath') {
                return { response: err(request.id, request.type, 'INVALID_REQUEST', 'Unknown uiState key') };
            }
            return backgroundStorageQueue.enqueue(async () => {
                const value = await readLastSelectedFolderPath();
                return { response: ok(request.id, request.type, { value }) };
            });
        }
        case 'bookmarks:uiState:set': {
            if (request.payload.key !== 'lastSelectedFolderPath') {
                return { response: err(request.id, request.type, 'INVALID_REQUEST', 'Unknown uiState key') };
            }

            const value = request.payload.value;
            if (value !== null && typeof value !== 'string') {
                return { response: err(request.id, request.type, 'INVALID_REQUEST', 'Invalid uiState value') };
            }

            return backgroundStorageQueue.enqueue(async () => {
                if (value === null) {
                    await localStoragePort.remove([LEGACY_STORAGE_KEYS.lastSelectedFolderPath]);
                    return { response: ok(request.id, request.type, { value: null }) };
                }

                try {
                    PathUtils.validatePath(value);
                    const normalized = PathUtils.normalize(value);
                    await localStoragePort.set({ [LEGACY_STORAGE_KEYS.lastSelectedFolderPath]: normalized });
                    return { response: ok(request.id, request.type, { value: normalized }) };
                } catch (e) {
                    const mapped = toProtocolErrorCode(e);
                    return { response: err(request.id, request.type, mapped.code, mapped.message) };
                }
            });
        }
        default:
            return { response: err(request.id, request.type, 'UNKNOWN_TYPE', 'Unknown bookmarks request') };
    }
}
