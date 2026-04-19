import { describe, expect, it } from 'vitest';

import { parseBookmarksDoc, parseChangelogDoc, parseFaqDoc } from '@/ui/content/bookmarks/content/parser';
import { loadBookmarksDoc } from '@/ui/content/bookmarks/content/loader';

describe('bookmarks content parser', () => {
    it('parses changelog markdown for both locales', () => {
        const zh = parseChangelogDoc(loadBookmarksDoc('changelog', 'zh_CN'));
        const en = parseChangelogDoc(loadBookmarksDoc('changelog', 'en'));

        expect(zh.title).toBe('更新日志');
        expect(en.title).toBe('Changelog');
        expect(zh.entries.map((entry) => entry.version)).toEqual(['4.1.0', '4.0.0', '3.0.0']);
        expect(en.entries.map((entry) => entry.version)).toEqual(['4.1.0', '4.0.0', '3.0.0']);
        expect(zh.entries[0]?.date).toBe('2026-04-19');
        expect(en.entries[0]?.leadBlocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
                text: expect.stringContaining('Dynamic Annotation'),
            }),
        );
        expect(zh.entries[0]?.highlights.length).toBeGreaterThan(5);
    });

    it('parses about markdown into title, lead, and sections', () => {
        const zh = parseBookmarksDoc(loadBookmarksDoc('about', 'zh_CN'));

        expect(zh.title).toBe('关于我');
        expect(zh.leadBlocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
        expect(zh.sections.map((section) => section.heading)).toEqual([
            '为什么我会做 AI-MarkDone',
            '反馈与联系',
        ]);
        expect(zh.sections[0]?.blocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
        expect(zh.sections[1]?.blocks[1]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
                text: expect.stringContaining('zhaoliangbin42@gmail.com'),
            }),
        );
    });

    it('parses faq markdown into question and answer groups', () => {
        const en = parseFaqDoc(loadBookmarksDoc('faq', 'en'));

        expect(en.title).toBe('FAQ');
        expect(en.leadBlocks).toEqual([]);
        expect(en.items).toHaveLength(15);
        expect(en.items[0]?.question).toContain('Which platforms does this extension support');
        expect(en.items[0]?.blocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
    });

    it('parses standalone static markdown images as image blocks', () => {
        const parsed = parseBookmarksDoc(`
# About

Lead paragraph.

![Project mark](icons/icon128.png)

## Section

![Workflow](images/bookmarks/about/workflow.png)
`.trim());

        expect(parsed.leadBlocks).toEqual([
            { type: 'paragraph', text: 'Lead paragraph.' },
            { type: 'image', alt: 'Project mark', src: 'icons/icon128.png' },
        ]);
        expect(parsed.sections[0]?.blocks).toEqual([
            { type: 'image', alt: 'Workflow', src: 'images/bookmarks/about/workflow.png' },
        ]);
    });

    it('falls back to plain text when markdown image paths are not allowed', () => {
        const parsed = parseBookmarksDoc(`
# About

![Remote](https://example.com/remote.png)
![Absolute](/icons/icon128.png)
![Traversal](../secret.png)
`.trim());

        expect(parsed.leadBlocks).toEqual([
            { type: 'paragraph', text: '![Remote](https://example.com/remote.png) ![Absolute](/icons/icon128.png) ![Traversal](../secret.png)' },
        ]);
    });

    it('keeps parsing predictable when changelog entries omit optional parts', () => {
        const parsed = parseChangelogDoc(`
# Changelog

# 1.0.0
2026-01-01

- Added the first thing

# 0.9.0

Short summary only.
`.trim());

        expect(parsed.entries).toEqual([
            {
                version: '1.0.0',
                date: '2026-01-01',
                leadBlocks: [],
                highlights: ['Added the first thing'],
            },
            {
                version: '0.9.0',
                date: '',
                leadBlocks: [{ type: 'paragraph', text: 'Short summary only.' }],
                highlights: [],
            },
        ]);
    });
});
