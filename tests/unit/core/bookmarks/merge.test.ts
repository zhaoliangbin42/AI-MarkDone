import { describe, expect, it } from 'vitest';
import { planImportMerge } from '../../../../src/core/bookmarks/merge';
import type { Bookmark } from '../../../../src/core/bookmarks/types';

function seedBookmark(params: Partial<Bookmark> & { url: string; position: number; title: string; folderPath: string }): Bookmark {
    const urlWithoutProtocol = params.url.replace(/^https?:\/\//, '');
    return {
        url: params.url,
        urlWithoutProtocol,
        position: params.position,
        userMessage: params.userMessage ?? 'u',
        aiResponse: params.aiResponse,
        timestamp: params.timestamp ?? 1,
        title: params.title,
        platform: params.platform ?? 'ChatGPT',
        folderPath: params.folderPath,
    };
}

describe('bookmarks import merge', () => {
    it('skips url+position duplicates and auto-renames title conflicts in same folder', () => {
        const existing: Bookmark[] = [
            seedBookmark({ url: 'https://chatgpt.com/c/1', position: 1, title: 'Same', folderPath: 'Import' }),
        ];

        const incoming: Bookmark[] = [
            seedBookmark({ url: 'https://chatgpt.com/c/1', position: 1, title: 'Dup', folderPath: 'Import' }), // duplicate identity
            seedBookmark({ url: 'https://chatgpt.com/c/2', position: 2, title: 'Same', folderPath: 'Import' }), // title conflict
            seedBookmark({ url: 'https://chatgpt.com/c/3', position: 3, title: 'Same', folderPath: 'Work' }),   // no conflict (different folder)
        ];

        const result = planImportMerge({ incoming, existing, importFolderKeys: new Set() });
        expect(result.skippedDuplicates).toBe(1);
        expect(result.accepted).toHaveLength(2);
        expect(result.accepted.find((b) => b.position === 2)?.title).toBe('Same-1');
        expect(result.accepted.find((b) => b.position === 3)?.title).toBe('Same');
    });
});

