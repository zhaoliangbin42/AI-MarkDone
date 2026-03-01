import { describe, expect, it } from 'vitest';
import type { Bookmark, Folder } from '../../../../src/core/bookmarks/types';
import { buildFolderTree, countBookmarks } from '../../../../src/core/bookmarks/tree';

function folder(path: string): Folder {
    const depth = path.split('/').length;
    return { path, name: path.split('/').slice(-1)[0], depth, createdAt: 1, updatedAt: 1 };
}

function bookmark(position: number, folderPath: string): Bookmark {
    const url = `https://chatgpt.com/c/${position}`;
    return {
        url,
        urlWithoutProtocol: url.replace(/^https?:\/\//, ''),
        position,
        userMessage: `u-${position}`,
        aiResponse: `a-${position}`,
        timestamp: 1000 + position,
        title: `t-${position}`,
        platform: 'ChatGPT',
        folderPath,
    };
}

describe('bookmarks tree', () => {
    it('builds tree in O(F+B) style (grouping) and counts bookmarks correctly', () => {
        const folders: Folder[] = [folder('Import'), folder('Work'), folder('Work/AI')];
        const bookmarks: Bookmark[] = [bookmark(1, 'Import'), bookmark(2, 'Work'), bookmark(3, 'Work/AI')];
        const tree = buildFolderTree({ folders, bookmarks, expandedPaths: new Set(['Import', 'Work', 'Work/AI']) });
        expect(countBookmarks(tree)).toBe(3);
    });
});

