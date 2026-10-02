import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const locale = vi.hoisted(() => ({ current: 'zh_CN' as 'en' | 'zh_CN' }));
vi.mock('@/ui/content/components/i18n', () => {
    const catalogs = Object.fromEntries(['en', 'zh_CN'].map(language => [language,
        JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `public/_locales/${language}/messages.json`), 'utf8')),
    ]));
    return { t: (key: string) => catalogs[locale.current][key]?.message ?? key };
});

import { getFeatureOverviewSections } from '@/ui/content/bookmarks/content/featureOverview';

describe('feature overview content', () => {
    it('has the complete user-facing groups and stable unique feature identities across languages', () => {
        locale.current = 'zh_CN';
        const chinese = getFeatureOverviewSections();
        locale.current = 'en';
        const english = getFeatureOverviewSections();
        const ids = chinese.flatMap(section => section.items.map(item => item.id));

        expect(chinese.map(section => section.id)).toEqual([
            'reader', 'navigation', 'copyExport', 'input', 'formula', 'library', 'marks', 'settingsBackup',
        ]);
        expect(ids).toHaveLength(50);
        expect(new Set(ids).size).toBe(ids.length);
        expect(english.map(section => [section.id, section.items.map(item => item.id)]))
            .toEqual(chinese.map(section => [section.id, section.items.map(item => item.id)]));
    });

    it.each(['zh_CN', 'en'] as const)('localizes every title, description, entry and note in %s', (language) => {
        locale.current = language;
        for (const section of getFeatureOverviewSections()) {
            expect(['reading', 'input', 'controls', 'data', 'export', 'marks', 'appearance', 'advanced'])
                .toContain(section.settingsCategory);
            const copy = [section.title, section.summary, ...section.items.flatMap(item => [
                item.title, item.description, item.entry, ...(item.note ? [item.note] : []),
            ])];
            for (const text of copy) {
                expect(text.trim()).not.toBe('');
                expect(text).not.toMatch(/^featureOverview/);
                expect(text).not.toMatch(/SSOT|canonical|hydration|Repository|Observer|runtime protocol|水合|内容池|观察器/i);
            }
        }
    });

    it('states the important saving and availability boundaries without promoting absent workflows', () => {
        locale.current = 'zh_CN';
        const items = getFeatureOverviewSections().flatMap(section => section.items);
        const find = (id: string) => items.find(item => item.id === id)!;
        expect(find('reader-excerpts').note).toContain('刷新后清空');
        expect(find('reader-separate').note).toContain('原 ChatGPT 标签页保持打开');
        expect(find('navigation-directory').note).toContain('需要开启');
        expect(find('marks-save-annotations').note).toContain('默认关闭');
        expect(find('library-save-page').note).toContain('不保存整个对话正文');
        expect(find('library-summaries').note).toContain('开头 250 和结尾 250');
        expect(find('backup-local').note).toContain('未保存的临时注释');
        expect(find('backup-settings-transfer').note).toContain('不含资料库');
        expect(items.map(item => item.title).join('\n')).not.toMatch(/提示词导入|提示词导出|Mermaid|自动云同步/);
    });

    it('keeps all overview keys paired and uses distinct terms for questions and reusable prompts', () => {
        const load = (language: string) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `public/_locales/${language}/messages.json`), 'utf8'));
        const chinese = load('zh_CN');
        const english = load('en');
        const keys = (catalog: Record<string, unknown>) => Object.keys(catalog).filter(key => key.startsWith('featureOverview')).sort();
        expect(keys(chinese)).toEqual(keys(english));
        expect(chinese.promptManagerTitle.message).toBe('提示词');
        expect(chinese.readerUserMessageLabel.message).toBe('提问');
        expect(chinese.readerCommentUserPrompt.message).toBe('提示词');
        expect(chinese.btnCopyPromptReply.message).toBe('复制提问＋回复');
        expect(chinese.readerStickyTitle.message).toBe('摘录区');
        expect(chinese.contextOnlySaveDesc.message).toContain('开头 250 和结尾 250');
    });
});
