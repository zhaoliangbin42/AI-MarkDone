import type { Bookmark, QuarantineEntry, RepairStats } from './types';
import { normalizeUrlWithoutProtocol } from './keys';
import { DEFAULT_FOLDER_PATH, DEFAULT_PLATFORM } from './importExport';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function validateBookmarkRecord(bookmark: unknown): bookmark is Partial<Bookmark> {
    if (!isRecord(bookmark)) return false;
    const rec = bookmark as Record<string, unknown>;

    return (
        typeof rec.url === 'string'
        && typeof rec.position === 'number'
        && typeof rec.userMessage === 'string'
        && typeof rec.timestamp === 'number'
        && (rec.aiResponse === undefined || typeof rec.aiResponse === 'string')
        && (rec.title === undefined || typeof rec.title === 'string')
        && (rec.platform === undefined || typeof rec.platform === 'string')
        && (rec.folderPath === undefined || typeof rec.folderPath === 'string')
        && (rec.urlWithoutProtocol === undefined || typeof rec.urlWithoutProtocol === 'string')
    );
}

export function buildRepairPlan(params: {
    rawStorage: Record<string, unknown>;
    now: number;
    bookmarkKeyPrefix?: string;
}): {
    setPatch: Record<string, Bookmark>;
    removeKeys: string[];
    quarantine: QuarantineEntry[];
    stats: RepairStats;
} {
    const bookmarkKeyPrefix = params.bookmarkKeyPrefix ?? 'bookmark:';

    const setPatch: Record<string, Bookmark> = {};
    const removeKeys: string[] = [];
    const quarantine: QuarantineEntry[] = [];

    let examined = 0;
    let repaired = 0;
    let removed = 0;
    let quarantined = 0;

    for (const key of Object.keys(params.rawStorage)) {
        if (!key.startsWith(bookmarkKeyPrefix)) continue;
        examined += 1;
        const rawValue = params.rawStorage[key];

        if (validateBookmarkRecord(rawValue)) {
            const bm = rawValue as any;
            const next: Bookmark = {
                url: bm.url,
                urlWithoutProtocol: bm.urlWithoutProtocol || normalizeUrlWithoutProtocol(bm.url),
                position: bm.position,
                userMessage: bm.userMessage,
                aiResponse: bm.aiResponse,
                timestamp: bm.timestamp,
                title: bm.title || bm.userMessage?.substring(0, 50) || 'Untitled',
                platform: bm.platform || DEFAULT_PLATFORM,
                folderPath: (!bm.folderPath || bm.folderPath === '/' ? DEFAULT_FOLDER_PATH : bm.folderPath) || DEFAULT_FOLDER_PATH,
            };

            const changed = JSON.stringify(next) !== JSON.stringify(rawValue);
            if (changed) {
                setPatch[key] = next;
                repaired += 1;
            }
            continue;
        }

        // Invalid bookmark: attempt best-effort repair, else quarantine + remove.
        if (isRecord(rawValue)) {
            const bm = rawValue as any;
            const candidate: Bookmark = {
                url: typeof bm.url === 'string' ? bm.url : '',
                urlWithoutProtocol: typeof bm.urlWithoutProtocol === 'string'
                    ? bm.urlWithoutProtocol
                    : normalizeUrlWithoutProtocol(typeof bm.url === 'string' ? bm.url : ''),
                position: typeof bm.position === 'number' ? bm.position : 0,
                userMessage: typeof bm.userMessage === 'string' ? bm.userMessage : '',
                aiResponse: typeof bm.aiResponse === 'string' ? bm.aiResponse : undefined,
                timestamp: typeof bm.timestamp === 'number' ? bm.timestamp : params.now,
                title: typeof bm.title === 'string'
                    ? bm.title
                    : (typeof bm.userMessage === 'string' ? bm.userMessage.substring(0, 50) : 'Untitled'),
                platform: typeof bm.platform === 'string' ? bm.platform : DEFAULT_PLATFORM,
                folderPath: (typeof bm.folderPath === 'string' && bm.folderPath !== '/' && bm.folderPath.trim().length > 0)
                    ? bm.folderPath
                    : DEFAULT_FOLDER_PATH,
            };

            if (validateBookmarkRecord(candidate)) {
                setPatch[key] = candidate;
                repaired += 1;
                continue;
            }
        }

        quarantine.push({ originalKey: key, rawValue });
        quarantined += 1;
        removeKeys.push(key);
        removed += 1;
    }

    return {
        setPatch,
        removeKeys,
        quarantine,
        stats: { examined, repaired, removed, quarantined },
    };
}

