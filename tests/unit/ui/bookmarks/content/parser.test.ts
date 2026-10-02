import { describe, expect, it } from 'vitest';

import { parseBookmarksDoc, parseChangelogDoc, parseFaqDoc } from '@/ui/content/bookmarks/content/parser';
import { loadBookmarksDoc } from '@/ui/content/bookmarks/content/loader';

describe('bookmarks content parser', () => {
    it('parses changelog markdown for both locales', () => {
        const zh = parseChangelogDoc(loadBookmarksDoc('changelog', 'zh_CN'));
        expect(zh.entries[0]?.version).toBe('6.0.0');
        expect(zh.entries[1]?.version).toBe('5.4.1');
        zh.entries = zh.entries.filter(entry => entry.version !== '6.0.0' && entry.version !== '5.4.1');
        const en = parseChangelogDoc(loadBookmarksDoc('changelog', 'en'));
        expect(en.entries[0]?.version).toBe('6.0.0');
        expect(en.entries[1]?.version).toBe('5.4.1');
        en.entries = en.entries.filter(entry => entry.version !== '6.0.0' && entry.version !== '5.4.1');

        expect(zh.title).toBe('更新日志');
        expect(en.title).toBe('Changelog');
        expect(zh.entries.map((entry) => entry.version)).toEqual(['5.4.0', '5.3.0', '5.2.1', '5.2.0', '5.1.1', '5.1.0', '5.0.2', '5.0.1', '5.0.0', '4.8.0', '4.7.0', '4.6.0', '4.5.1', '4.5.0', '4.4.6', '4.4.5', '4.4.1', '4.4.0', '4.3.1', '4.3.0', '4.2.3', '4.2.2', '4.2.1', '4.2.0', '4.1.2', '4.1.1', '4.1.0', '4.0.0', '3.0.0']);
        expect(en.entries.map((entry) => entry.version)).toEqual(['5.4.0', '5.3.0', '5.2.1', '5.2.0', '5.1.1', '5.1.0', '5.0.2', '5.0.1', '5.0.0', '4.8.0', '4.7.0', '4.6.0', '4.5.1', '4.5.0', '4.4.6', '4.4.5', '4.4.1', '4.4.0', '4.3.1', '4.3.0', '4.2.3', '4.2.2', '4.2.1', '4.2.0', '4.1.2', '4.1.1', '4.1.0', '4.0.0', '3.0.0']);
        expect(zh.entries[0]?.date).toBe('2026-08-22');
        expect(zh.entries[1]?.date).toBe('2026-08-20');
        expect(zh.entries[1]?.leadBlocks[0]).toEqual(expect.objectContaining({
            type: 'paragraph',
            text: expect.stringContaining('上周网页又进行了一些更新'),
        }));
        expect(en.entries[1]?.leadBlocks[0]).toEqual(expect.objectContaining({
            type: 'paragraph',
            text: expect.stringContaining('website received some updates last week'),
        }));
        expect(JSON.stringify(zh.entries[2]?.leadBlocks)).toContain('英雄召集贴');
        expect(JSON.stringify(zh.entries[2]?.leadBlocks)).toContain('缓存中对话的存放位置');
        expect(en.entries[2]?.leadBlocks[0]?.text).toContain('Message loading changed');
        expect(zh.entries[2]?.sections.map((section) => section.heading)).toEqual(['修复']);
        expect(en.entries[2]?.sections.map((section) => section.heading)).toEqual(['Fixed']);
        expect(JSON.stringify(zh.entries[2]?.sections[0]?.blocks)).toContain('页面宽度设置刷新后没有恢复');
        expect(JSON.stringify(en.entries[2]?.sections[0]?.blocks)).toContain('page width not being restored');
        expect(zh.entries[8]?.date).toBe('2026-07-19');
        expect(en.entries[16]?.leadBlocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
                text: expect.stringContaining('personalization'),
            }),
        );
        const zhFiveZeroSections = [
            '原理解析',
            '也介绍一下我的 App：好友迹',
            '新增',
            '优化',
            '修复',
        ];
        const enFiveZeroSections = [
            'How the new directory works',
            'A quick introduction to my app: Mappamory',
            'Added',
            'Improved',
            'Fixed',
        ];
        expect(zh.entries[7]?.sections.map((section) => section.heading)).toEqual(zhFiveZeroSections);
        expect(zh.entries[8]?.sections.map((section) => section.heading)).toEqual(zhFiveZeroSections);
        expect(en.entries[7]?.sections.map((section) => section.heading)).toEqual(enFiveZeroSections);
        expect(en.entries[8]?.sections.map((section) => section.heading)).toEqual(enFiveZeroSections);
        expect(zh.entries[7]?.sections[1]?.blocks).toContainEqual({
            type: 'image',
            alt: '好友迹——好友地图通讯录',
            src: 'icons/mappamory-promo-poster.png',
        });
    });

    it('parses about markdown into title, lead, and sections', () => {
        const zh = parseBookmarksDoc(loadBookmarksDoc('about', 'zh_CN'));

        expect(zh.title).toBe('关于作者');
        expect(parseBookmarksDoc(loadBookmarksDoc('about', 'en')).title).toBe('About the author');
        expect(zh.leadBlocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
        expect(zh.sections.map((section) => section.heading)).toEqual([
            '为什么我会做 AI-MarkDone',
        ]);
        expect(zh.sections[0]?.blocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
        expect(zh.sections[0]?.blocks.at(-1)).toEqual(
            expect.objectContaining({
                type: 'paragraph',
                text: expect.not.stringContaining('zhaoliangbin42@gmail.com'),
            }),
        );
    });

    it('parses faq markdown into question and answer groups', () => {
        const en = parseFaqDoc(loadBookmarksDoc('faq', 'en'));

        expect(en.title).toBe('FAQ');
        expect(en.leadBlocks).toEqual([]);
        expect(en.items).toHaveLength(17);
        expect(en.items[0]?.question).toContain('Which platforms does this extension support');
        expect(en.items[0]?.blocks[0]).toEqual(
            expect.objectContaining({
                type: 'paragraph',
            }),
        );
    });

    it('keeps current bilingual guidance aligned with the panel and available workflows', () => {
        const zh = loadBookmarksDoc('faq', 'zh_CN');
        const en = loadBookmarksDoc('faq', 'en');
        expect(parseFaqDoc(zh).items).toHaveLength(parseFaqDoc(en).items.length);
        expect(zh).toContain('功能全览');
        expect(en).toContain('Feature overview');
        expect(zh).toContain('关闭按钮旁的“全屏”');
        expect(en).toContain('Full screen beside Close');
        expect(zh).toContain('Markdown、PDF 或 PNG');
        expect(en).toContain('Markdown, PDF, or PNG');
        expect(zh).toContain('提问和回复分别保留开头 250 与结尾 250');
        expect(en).toContain('questions and replies longer than 500 characters each');
        expect(zh).toContain('阅读器设置中的“保存新建的注释”默认关闭');
        expect(zh).toContain('原 ChatGPT 标签页保持打开');
        expect(zh).not.toMatch(/批注|Prompt|独立窗口 Reader|标记与注释|按钮与快捷键|阅读与导航/);
        expect(en).not.toMatch(/detached Reader|Buttons & shortcuts|Reading & navigation/);
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
            { type: 'paragraph', text: '![Remote](https://example.com/remote.png)\n![Absolute](/icons/icon128.png)\n![Traversal](../secret.png)' },
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
                leadBlocks: [{ type: 'list', items: ['Added the first thing'] }],
                sections: [],
            },
            {
                version: '0.9.0',
                date: '',
                leadBlocks: [{ type: 'paragraph', text: 'Short summary only.' }],
                sections: [],
            },
        ]);
    });

    it('preserves single line breaks inside paragraph blocks', () => {
        const parsed = parseChangelogDoc(`
# Changelog

# 1.0.0
2026-01-01

First line
Second line

- Bullet line one
  still same bullet text
`.trim());

        expect(parsed.entries[0]?.leadBlocks).toEqual([
            { type: 'paragraph', text: 'First line\nSecond line' },
            { type: 'list', items: ['Bullet line one\nstill same bullet text'] },
        ]);
        expect(parsed.entries[0]?.sections).toEqual([]);
    });

    it('parses categorized changelog sections into structured entry sections', () => {
        const parsed = parseChangelogDoc(`
# Changelog

# 1.0.0
2026-01-01

Intro line one
Intro line two

## Added
- First feature

## Fixed
- First fix
  with extra detail
`.trim());

        expect(parsed.entries[0]).toEqual({
            version: '1.0.0',
            date: '2026-01-01',
            leadBlocks: [{ type: 'paragraph', text: 'Intro line one\nIntro line two' }],
            sections: [
                {
                    heading: 'Added',
                    blocks: [{ type: 'list', items: ['First feature'] }],
                },
                {
                    heading: 'Fixed',
                    blocks: [{ type: 'list', items: ['First fix\nwith extra detail'] }],
                },
            ],
        });
    });
});
