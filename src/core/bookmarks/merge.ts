import type {
    Bookmark,
    ImportMergeEntry,
    ImportMergeStatus,
} from './types';
import { buildBookmarkIdentityKeyFromParts } from './keys';

type MergeResult = {
    entries: ImportMergeEntry[];
    accepted: Bookmark[];
    skippedDuplicates: number;
    renamed: Array<{ folderPath: string; from: string; to: string }>;
    redirectedToImport: number;
};

function normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase();
}

function generateUniqueTitle(baseTitle: string, usedTitles: Set<string>): string {
    const trimmedBase = baseTitle.trim() || 'Untitled';
    let candidate = trimmedBase;
    let counter = 1;
    while (usedTitles.has(normalizeTitle(candidate))) {
        candidate = `${trimmedBase}-${counter}`;
        counter += 1;
    }
    return candidate;
}

export function planImportMerge(params: {
    incoming: Bookmark[];
    existing: Bookmark[];
    importFolderKeys: Set<string>;
}): MergeResult {
    const existingByIdentity = new Map<string, Bookmark>();
    for (const b of params.existing) {
        existingByIdentity.set(buildBookmarkIdentityKeyFromParts(b), b);
    }

    const usedTitlesByFolder = new Map<string, Set<string>>();
    const getUsedTitles = (folderPath: string): Set<string> => {
        const key = folderPath || 'Import';
        let set = usedTitlesByFolder.get(key);
        if (!set) {
            set = new Set<string>();
            usedTitlesByFolder.set(key, set);
        }
        return set;
    };

    for (const b of params.existing) {
        getUsedTitles(b.folderPath).add(normalizeTitle(b.title));
    }

    const accepted: Bookmark[] = [];
    const entries: ImportMergeEntry[] = [];
    const renamed: Array<{ folderPath: string; from: string; to: string }> = [];
    let skippedDuplicates = 0;
    let redirectedToImport = 0;

    // Track accepted import entries so duplicates inside the same file are detected.
    const seenIdentity = new Map<string, Bookmark>(existingByIdentity);

    for (const bookmark of params.incoming) {
        const identity = buildBookmarkIdentityKeyFromParts(bookmark);
        const folderPath = bookmark.folderPath || 'Import';

        let status: ImportMergeStatus = 'normal';
        let renameTo: string | undefined;
        let existingTitle: string | undefined;
        let existingFolderPath: string | undefined;

        const existingDuplicate = seenIdentity.get(identity);
        if (existingDuplicate) {
            status = 'duplicate';
            existingTitle = existingDuplicate.title;
            existingFolderPath = existingDuplicate.folderPath;
            skippedDuplicates += 1;
        } else {
            const usedTitles = getUsedTitles(folderPath);
            const normalizedTitle = normalizeTitle(bookmark.title);

            if (normalizedTitle && usedTitles.has(normalizedTitle)) {
                status = 'rename';
                renameTo = generateUniqueTitle(bookmark.title, usedTitles);
                usedTitles.add(normalizeTitle(renameTo));
                renamed.push({ folderPath, from: bookmark.title, to: renameTo });
            } else if (normalizedTitle) {
                usedTitles.add(normalizedTitle);
            }

            if (status !== 'rename' && params.importFolderKeys.has(identity)) {
                status = 'import';
                redirectedToImport += 1;
            }

            const next: Bookmark = renameTo ? { ...bookmark, title: renameTo } : bookmark;
            accepted.push(next);
            seenIdentity.set(identity, next);
        }

        entries.push({ bookmark, status, renameTo, existingTitle, existingFolderPath });
    }

    return { entries, accepted, skippedDuplicates, renamed, redirectedToImport };
}

