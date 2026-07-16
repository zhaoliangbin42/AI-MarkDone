import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { collectUiStyleSources, isTokenLayerSource, isUiStyleSource } from '../../support/uiStyleInventory';
import { auditUiStyleValues } from '../../support/uiStyleValueGovernance';
import { UI_STYLE_VALUE_STATIC_EXCEPTIONS } from '../../support/uiStyleValueExceptions';

const repoRoot = path.resolve(__dirname, '../../..');

const uiFiles = [
    'src/ui/content/MessageToolbar.ts',
    'src/ui/content/reader/ReaderPanel.ts',
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
    'src/ui/content/bookmarks/save/bookmarkSaveDialogCss.ts',
    'src/ui/content/export/saveMessagesDialogCss.ts',
    'src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts',
];

const shippedStyleSources = collectUiStyleSources(repoRoot);
const styleValueAudit = auditUiStyleValues(shippedStyleSources);

const sansFiles = [
    'src/ui/content/MessageToolbar.ts',
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
    'src/ui/content/bookmarks/save/bookmarkSaveDialogCss.ts',
    'src/ui/content/export/saveMessagesDialogCss.ts',
    'src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts',
];

const monoWhitelist = [
    'src/ui/content/reader/readerPanelTemplate.ts',
    'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts',
];

describe('UI style governance', () => {
    const externalUtilityFrameworkPattern = new RegExp('tail' + 'wind', 'i');
    const prefixedUtilityClassPattern = new RegExp('\\b' + 't' + 'w:');

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

    it('does not use external utility framework classes or imports in shipped UI styling', () => {
        for (const { source } of shippedStyleSources) {
            expect(source).not.toMatch(prefixedUtilityClassPattern);
            expect(source).not.toMatch(externalUtilityFrameworkPattern);
            expect(source).not.toMatch(new RegExp('@tail' + 'wind', 'i'));
        }
    });

    it('does not let components consume reference or system tokens directly', () => {
        for (const { relativePath, source } of shippedStyleSources) {
            if (isTokenLayerSource(relativePath)) continue;
            expect(source).not.toMatch(/var\(--aimd-ref-/);
            expect(source).not.toMatch(/var\(--aimd-sys-/);
        }
    });

    it('keeps the unsupported popup on public tokens instead of a copied reference token table', () => {
        const source = fs.readFileSync(path.join(repoRoot, 'src/popup/popup.html'), 'utf8');
        expect(source).toContain('--aimd-bg-primary');
        expect(source).not.toContain('--aimd-ref-');
        expect(source).not.toContain('--aimd-sys-');
    });

    it('audits real shipped CSS templates instead of a hand-maintained file allowlist', () => {
        expect(styleValueAudit.scannedFiles).toContain('src/ui/content/MessageToolbar.ts');
        expect(styleValueAudit.auditedDeclarations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relativePath: 'src/ui/content/MessageToolbar.ts',
                property: 'padding',
            }),
        ]));
        expect(isUiStyleSource('src/ui/newSurface.ts', 'const css = `.surface { padding: 6px; }`;')).toBe(true);
    });

    it('classifies raw style values while allowing tokens, resets, and print-only important rules', () => {
        const audit = auditUiStyleValues([{
            relativePath: 'src/ui/example.ts',
            source: `
                .raw {
                    color: #123456;
                    padding: 6px;
                    border-radius: 10px;
                    box-shadow: 0 2px 8px var(--aimd-border-default);
                    z-index: 999;
                    transition: opacity 150ms ease;
                    margin: 0 auto;
                }
                .tokenized {
                    color: var(--aimd-text-primary);
                    padding: var(--aimd-space-2);
                    border-radius: var(--aimd-radius-lg);
                    box-shadow: var(--aimd-shadow-lg);
                    z-index: calc(var(--aimd-z-panel) + 1);
                    transition: opacity var(--aimd-duration-fast) var(--aimd-ease-out);
                }
                .bad { display: block !important; }
                @media print { .print-only { display: block !important; } }
            `,
        }]);

        expect(audit.violations.map(({ kind }) => kind).sort()).toEqual([
            'color',
            'important',
            'motion-duration',
            'motion-easing',
            'radius',
            'shadow',
            'spacing',
            'z-index',
        ]);
    });

    it('audits imperative style assignments and excludes token implementation ownership', () => {
        const audit = auditUiStyleValues([
            {
                relativePath: 'src/ui/imperative.ts',
                source: `
                    element.style.paddingInline = '6px';
                    element.style.setProperty('border-radius', '10px');
                `,
            },
            {
                relativePath: 'src/style/reference-tokens.ts',
                source: ':host { --aimd-ref-color-test: #ffffff; --aimd-ref-space-test: 6px; }',
            },
        ]);

        expect(audit.scannedFiles).toEqual(['src/ui/imperative.ts']);
        expect(audit.violations.map(({ kind, property }) => ({ kind, property }))).toEqual([
            { kind: 'spacing', property: 'padding-inline' },
            { kind: 'radius', property: 'border-radius' },
        ]);

        const fallbackAudit = auditUiStyleValues([{
            relativePath: 'src/ui/fallbacks.ts',
            source: '.surface { color: var(--aimd-text-primary, #ffffff); transition: opacity var(--aimd-duration-fast, 150ms) var(--aimd-ease-out, ease-out); }',
        }]);
        expect(fallbackAudit.violations.map(({ kind }) => kind).sort()).toEqual([
            'color',
            'motion-duration',
            'motion-easing',
        ]);
    });

    it('keeps every current raw value in an exact static-document exception entry', () => {
        const actual = styleValueAudit.violations.map(({ signature }) => signature).sort();
        const expected = UI_STYLE_VALUE_STATIC_EXCEPTIONS.map(({ signature }) => signature).sort();

        expect(actual).toEqual(expected);
    });

    it('keeps static style-value exceptions auditable and narrowly scoped', () => {
        const entries = [...UI_STYLE_VALUE_STATIC_EXCEPTIONS];
        expect(new Set(entries.map(({ signature }) => signature)).size).toBe(entries.length);
        for (const entry of entries) {
            expect(entry.signature).toMatch(/^src\/.+::(?:color|spacing|radius|shadow|z-index|motion-duration|motion-easing|important)::.+::".+"::#\d+$/);
            expect(entry.owner.length).toBeGreaterThan(2);
            expect(entry.reason.length).toBeGreaterThan(20);
        }
        for (const entry of UI_STYLE_VALUE_STATIC_EXCEPTIONS) {
            expect(entry.signature).toMatch(/^src\/(?:popup\/popup\.html|drivers\/content\/export\/renderFormulaDomAsset\.ts|runtimes\/export-renderer\/[^:]+|services\/export\/(?:messageCardProfile|saveMessagesDocument|saveMessagesPdf)\.ts)::/);
            expect(entry.owner).toBe('Static export and popup contracts');
        }
    });

});
