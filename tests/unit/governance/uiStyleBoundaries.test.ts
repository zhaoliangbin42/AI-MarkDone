import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

const uiFiles = [
    'src/ui/content/MessageToolbar.ts',
    'src/ui/content/reader/ReaderPanel.ts',
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
    'src/ui/content/bookmarks/save/bookmarkSaveDialogCss.ts',
    'src/ui/content/export/saveMessagesDialogCss.ts',
    'src/ui/content/sending/SendModal.ts',
    'src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts',
];

const sansFiles = [
    'src/ui/content/MessageToolbar.ts',
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
    'src/ui/content/bookmarks/save/bookmarkSaveDialogCss.ts',
    'src/ui/content/export/saveMessagesDialogCss.ts',
    'src/ui/content/sending/SendModal.ts',
    'src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts',
];

const monoWhitelist = [
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
];

describe('UI style governance', () => {
    it('does not use explicit sans-serif stacks in rewritten UI components', () => {
        for (const file of uiFiles) {
            const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
            expect(source).not.toMatch(/font-family:\s*ui-sans-serif/i);
            expect(source).not.toMatch(/font-family:\s*var\(--aimd-font-sans\)/i);
            expect(source).not.toMatch(/font-family:\s*.*Segoe UI.*Arial/i);
        }
    });

    it('does not define panel-scoped pseudo system tokens inside bookmarks panel css', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts'), 'utf8');

        expect(source).not.toContain('--aimd-font-sans');
        expect(source).not.toContain('--aimd-shadow-xl:');
        expect(source).not.toContain('--aimd-radius-2xl:');
        expect(source).not.toContain('--aimd-text-base:');
    });

    it('does not ship mock-stage positioning overrides inside the formal bookmarks panel css', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts'), 'utf8');

        expect(source).not.toContain('.panel-stage__overlay.aimd-panel-overlay');
        expect(source).not.toContain('.panel-window.panel-window--bookmarks.aimd-panel');
    });

    it('uses the shared sans token across shadow-root UI surfaces', () => {
        for (const file of sansFiles) {
            const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
            expect(source).toContain('--aimd-font-family-sans');
        }
    });

    it('keeps the mono token only in approved code-oriented surfaces', () => {
        for (const file of uiFiles) {
            const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
            if (monoWhitelist.includes(file)) {
                continue;
            }
            expect(source).not.toContain('--aimd-font-family-mono');
        }
    });

    it('does not apply font-family rules to host-page selectors in page token injection', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/style/pageTokens.ts'), 'utf8');
        expect(source).not.toMatch(/body\s*\{/i);
        expect(source).not.toMatch(/html\s*,\s*body\s*\{/i);
        expect(source).not.toMatch(/\*\s*\{\s*font-family/i);
        expect(source).not.toContain('font-family');
    });

    it('does not introduce toolbar-scoped pseudo tokens now that toolbar tokens are part of the shared contract', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/ui/content/MessageToolbar.ts'), 'utf8');
        expect(source).not.toContain('--aimd-tb-');
        expect(source).toContain('--aimd-toolbar-surface');
        expect(source).toContain('--aimd-toolbar-menu-surface');
    });
});
