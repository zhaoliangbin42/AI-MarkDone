import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');

function read(relativePath: string): string {
    return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Reader architecture closure', () => {
    it('routes the Reader panel through workflow, view-model, rendering, and host-adapter modules', () => {
        for (const relativePath of [
            'src/ui/content/reader/ReaderWorkflow.ts',
            'src/ui/content/reader/ReaderViewModel.ts',
            'src/ui/content/reader/ReaderRendering.ts',
            'src/ui/content/reader/ReaderHostAdapter.ts',
        ]) {
            expect(existsSync(resolve(repoRoot, relativePath)), relativePath).toBe(true);
        }

        const panel = read('src/ui/content/reader/ReaderPanel.ts');
        expect(panel).toContain("from './ReaderWorkflow'");
        expect(panel).toContain("from './ReaderViewModel'");
        expect(panel).toContain("from './ReaderRendering'");
        expect(panel).toContain("from './ReaderHostAdapter'");
        expect(panel).not.toContain("from '../../../services/renderer/renderMarkdown'");
        expect(panel).not.toContain("from '../../../services/reader/userPromptDisplay'");
        expect(panel).not.toContain("from './readerPanelTemplate'");
        expect(panel).not.toContain("from '../../../drivers/shared/browser'");
        expect(panel).not.toMatch(/(^|[^\w.])(?:window|document)\./m);
        expect(panel).not.toContain('state.theme');
        expect(panel).not.toContain('private themeOverrides');
        expect(panel).toContain('this.appearance.theme');
        expect(panel).toContain('this.appearance.overrides');
    });

    it('keeps the public Reader port independent from the ReaderPanel implementation', () => {
        const port = read('src/ui/content/reader/ReaderPanelPort.ts');

        expect(port).not.toContain("from './ReaderPanel'");
        expect(port).toContain('export interface ReaderPanelPort');
    });

    it('keeps one markdown theme owner with no UI compatibility shim', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/components/markdownTheme.ts'))).toBe(false);

        const sourceFiles = [
            'src/services/renderer/markdownTheme.ts',
            'src/services/export/saveMessagesDocument.ts',
            'src/ui/content/reader/readerPanelTemplate.ts',
            'mocks/components/reader-comments/main.ts',
        ];
        const owners = sourceFiles.filter((relativePath) => /(?:export\s+)?function\s+getMarkdownThemeCss\s*\(/.test(read(relativePath)));

        expect(owners).toEqual(['src/services/renderer/markdownTheme.ts']);
        for (const relativePath of sourceFiles.slice(1)) {
            expect(read(relativePath), relativePath).not.toContain('ui/content/components/markdownTheme');
        }
    });
});
