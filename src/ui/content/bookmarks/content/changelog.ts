import { loadBookmarksDoc } from './loader';
import { parseChangelogDoc } from './parser';
import type { ParsedChangelogDoc, ParsedChangelogEntry } from './types';

export function loadParsedChangelogDoc(): ParsedChangelogDoc {
    return parseChangelogDoc(loadBookmarksDoc('changelog'));
}

export function loadLatestChangelogEntry(): ParsedChangelogEntry | null {
    return loadParsedChangelogDoc().entries[0] ?? null;
}
