import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(path: string): string {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function runtimeImportSpecifiers(source: string): string[] {
    return Array.from(source.matchAll(/import(?!\s+type\b)[\s\S]*?from\s+['"]([^'"]+)['"];/g))
        .map((match) => match[1] ?? '');
}

describe('content feature bundle boundary', () => {
    it('keeps heavy panels and exporters out of startup runtime imports', () => {
        const startupSources = [
            readSource('src/runtimes/content/entry.ts'),
            readSource('src/runtimes/content/formulaOnlyRuntime.ts'),
        ];
        const forbiddenRuntimeImports = [
            '../../ui/content/reader/ReaderPanel',
            '../../ui/content/bookmarks/BookmarksPanel',
            '../../ui/content/export/SaveMessagesDialog',
            '../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton',
            '../../services/copy/copy-turn-png',
            '../../../services/math/formulaAssetActions',
            '../../../services/math/formulaAssetRenderer',
        ];

        for (const source of startupSources) {
            const imports = runtimeImportSpecifiers(source);
            for (const forbiddenImport of forbiddenRuntimeImports) {
                expect(imports).not.toContain(forbiddenImport);
            }
        }
    });

    it('loads the feature graph only through a runtime-owned extension URL', () => {
        const source = readSource('src/runtimes/content/lazyContentFeatures.ts');

        expect(source).toContain('browser.runtime.getURL(extensionAssets.contentFeaturesEntry)');
        expect(source).toContain('import(/* @vite-ignore */ moduleUrl)');
        expect(source).not.toContain("import('./contentFeatures')");
    });

    it('keeps the feature facade small by importing each heavy feature on its own trigger', () => {
        const source = readSource('src/runtimes/content/contentFeatures.ts');
        const forbiddenRuntimeImports = [
            '../../ui/content/reader/ReaderPanel',
            '../../ui/content/bookmarks/BookmarksPanel',
            '../../ui/content/export/SaveMessagesDialog',
            '../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton',
            '../../services/copy/copy-turn-png',
            '../../services/math/formulaAssetActions',
            '../../services/math/formulaAssetRenderer',
        ];

        const imports = runtimeImportSpecifiers(source);
        for (const forbiddenImport of forbiddenRuntimeImports) {
            expect(imports).not.toContain(forbiddenImport);
        }
        expect(source).toContain("await import('../../ui/content/reader/ReaderPanel')");
        expect(source).toContain("await import('../../ui/content/bookmarks/BookmarksPanel')");
        expect(source).toContain("await import('../../ui/content/export/SaveMessagesDialog')");
        expect(source).toContain("await import('../../services/copy/copy-turn-png')");
        expect(source).toContain("await import('../../services/math/formulaAssetActions')");
        expect(source).toContain("await import('../../services/math/formulaAssetRenderer')");
    });

    it('makes the production entry gate execute and validate the feature facade exports', () => {
        const source = readSource('scripts/verify-extension-entry-format.sh');

        expect(source).toContain('required_exports');
        for (const exportName of [
            'createReaderPanel',
            'createBookmarksPanel',
            'getSaveMessagesDialog',
            'getBookmarkSaveDialog',
            'copyMessagePng',
            'runFormulaAssetAction',
            'renderFormulaSvgAsset',
        ]) {
            expect(source).toContain(exportName);
        }
        expect(source).toContain('typeof featureModule[name] !== "function"');
    });
});
