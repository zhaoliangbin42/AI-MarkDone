import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseImportData, buildExportPayload } from '../../../../src/core/bookmarks/importExport';
import type { Bookmark } from '../../../../src/core/bookmarks/types';

function loadFixture(name: string): unknown {
    return JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/bookmarks', name), 'utf-8'));
}

describe('bookmarks import/export', () => {
    it('parses legacy array format and preserves identity + folderPath', () => {
        const source = loadFixture('bookmarks-200.json') as Bookmark[];
        const result = parseImportData(source);
        expect(result.bookmarks).toHaveLength(200);
        expect(result.bookmarks.every((b) => Boolean(b.folderPath))).toBe(true);

        const sourceKeys = new Set(source.map((b) => `${b.urlWithoutProtocol}:${b.position}:${b.folderPath}`));
        const importedKeys = new Set(result.bookmarks.map((b) => `${b.urlWithoutProtocol}:${b.position}:${b.folderPath}`));
        expect(importedKeys).toEqual(sourceKeys);
    });

    it('parses v2 payload format', () => {
        const source = loadFixture('bookmarks-200.json') as Bookmark[];
        const payload = { version: '2.0', exportDate: new Date(0).toISOString(), bookmarks: source };
        const result = parseImportData(payload);
        expect(result.bookmarks).toHaveLength(200);
    });

    it('buildExportPayload emits v2.0 wrapper and supports flat export', () => {
        const source = loadFixture('bookmarks-200.json') as Bookmark[];
        const preserve = buildExportPayload(source, true);
        expect(preserve.version).toBe('2.0');
        expect(preserve.bookmarks).toHaveLength(200);
        expect(preserve.bookmarks.every((b) => typeof b.folderPath === 'string')).toBe(true);

        const flat = buildExportPayload(source, false);
        expect(flat.bookmarks.every((b) => b.folderPath === null)).toBe(true);
    });

    it('round-trips page bookmarks without requiring message fields', () => {
        const page: Bookmark = {
            kind: 'page',
            url: 'https://chatgpt.com/c/page-1',
            urlWithoutProtocol: 'chatgpt.com/c/page-1',
            pageKey: 'chatgpt.com/c/page-1',
            timestamp: 1,
            title: 'Conversation page',
            platform: 'ChatGPT',
            folderPath: 'Pages',
        };

        const payload = buildExportPayload([page], true);
        const parsed = parseImportData(payload);

        expect(parsed.bookmarks).toHaveLength(1);
        expect(parsed.bookmarks[0]).toMatchObject({
            kind: 'page',
            title: 'Conversation page',
            folderPath: 'Pages',
        });
    });
});
