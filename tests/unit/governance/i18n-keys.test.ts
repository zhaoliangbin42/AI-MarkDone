import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type MessagesJson = Record<string, { message?: string }>;

function readJson(filePath: string): any {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFilesRecursive(root: string): string[] {
    const out: string[] = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop()!;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) stack.push(abs);
            else if (ent.isFile()) out.push(abs);
        }
    }
    return out;
}

function extractI18nKeys(source: string): string[] {
    const keys = new Set<string>();

    // Matches: t('key'), t("key"), t(`key`)
    const re = /\bt\s*\(\s*(['"`])([^'"`]+)\1/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
        const key = match[2]?.trim();
        if (key) keys.add(key);
    }
    return [...keys];
}

function loadCatalog(locale: 'en' | 'zh_CN'): Set<string> {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    const json = readJson(filePath) as MessagesJson;
    return new Set(Object.keys(json));
}

describe('governance: i18n key coverage', () => {
    it('all UI t() keys exist in en and zh_CN catalogs', () => {
        const uiRoot = path.resolve(process.cwd(), 'src/ui');
        const files = listFilesRecursive(uiRoot).filter((p) => p.endsWith('.ts'));

        const keys = new Set<string>();
        for (const filePath of files) {
            const src = fs.readFileSync(filePath, 'utf8');
            extractI18nKeys(src).forEach((k) => keys.add(k));
        }

        const en = loadCatalog('en');
        const zh = loadCatalog('zh_CN');

        const missingEn: string[] = [];
        const missingZh: string[] = [];

        for (const key of keys) {
            if (!en.has(key)) missingEn.push(key);
            if (!zh.has(key)) missingZh.push(key);
        }

        missingEn.sort();
        missingZh.sort();

        expect(
            { missingEn, missingZh, keyCount: keys.size },
            `Missing i18n keys detected (en: ${missingEn.length}, zh_CN: ${missingZh.length}).`,
        ).toEqual({ missingEn: [], missingZh: [], keyCount: keys.size });
    });

    it('high-risk UI files do not keep shipped hardcoded English copy', () => {
        const fileChecks = [
            {
                filePath: path.resolve(process.cwd(), 'src/ui/content/bookmarks/BookmarksPanel.ts'),
                banned: [
                    'Search bookmarks',
                    'Import merge review',
                    'Summary',
                    'Details',
                    'Storage used',
                    'Open source support',
                    'Create first folder',
                    'All platforms',
                ],
            },
            {
                filePath: path.resolve(process.cwd(), 'src/ui/content/sending/SendPopover.ts'),
                banned: [
                    'Resize send popover',
                ],
            },
        ];

        const failures: Array<{ filePath: string; literal: string }> = [];

        for (const check of fileChecks) {
            const src = fs.readFileSync(check.filePath, 'utf8');
            for (const literal of check.banned) {
                const quotedLiteral = new RegExp(`['"\`]${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
                if (quotedLiteral.test(src)) failures.push({ filePath: check.filePath, literal });
            }
        }

        expect(failures).toEqual([]);
    });
});
