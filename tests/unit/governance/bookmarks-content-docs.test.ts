import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBookmarksDoc, parseChangelogDoc, parseFaqDoc } from '@/ui/content/bookmarks/content/parser';

function readContentFile(fileName: string): string {
    const filePath = path.resolve(process.cwd(), `src/ui/content/bookmarks/content/${fileName}`);
    return fs.readFileSync(filePath, 'utf8');
}

describe('governance: bookmarks content docs', () => {
    it('keeps changelog docs aligned across locales', () => {
        const zh = parseChangelogDoc(readContentFile('changelog.zh.md'));
        const en = parseChangelogDoc(readContentFile('changelog.en.md'));

        expect(zh.title).toBeTruthy();
        expect(en.title).toBeTruthy();
        expect(zh.entries.length).toBeGreaterThan(0);
        expect(en.entries.length).toBeGreaterThan(0);
        expect(zh.entries[0]?.version).toBeTruthy();
        expect(en.entries[0]?.version).toBeTruthy();
        expect(zh.entries.map((entry) => entry.version)).toEqual(en.entries.map((entry) => entry.version));
        expect(zh.entries[0]?.leadBlocks.length).toBeGreaterThan(0);
        expect(en.entries[0]?.leadBlocks.length).toBeGreaterThan(0);
        expect(zh.entries.every((entry) => entry.date)).toBe(true);
        expect(en.entries.every((entry) => entry.date)).toBe(true);
    });

    it('keeps about docs parseable in both locales', () => {
        const zh = parseBookmarksDoc(readContentFile('about.zh.md'));
        const en = parseBookmarksDoc(readContentFile('about.en.md'));

        expect(zh.title).toBeTruthy();
        expect(en.title).toBeTruthy();
        expect(zh.leadBlocks.length).toBeGreaterThan(0);
        expect(en.leadBlocks.length).toBeGreaterThan(0);
        expect(zh.sections.length).toBeGreaterThan(0);
        expect(en.sections.length).toBeGreaterThan(0);
    });

    it('keeps faq docs parseable in both locales', () => {
        const zh = parseFaqDoc(readContentFile('faq.zh.md'));
        const en = parseFaqDoc(readContentFile('faq.en.md'));

        expect(zh.title).toBeTruthy();
        expect(en.title).toBeTruthy();
        expect(zh.items.length).toBeGreaterThan(0);
        expect(en.items.length).toBeGreaterThan(0);
        expect(zh.items.every((item) => item.question)).toBe(true);
        expect(en.items.every((item) => item.question)).toBe(true);
    });
});
