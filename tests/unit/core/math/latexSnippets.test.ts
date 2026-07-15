import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    compileLatexSnippet,
    parseLatexSnippetCatalog,
    searchLatexSnippets,
} from '@/core/math/latexSnippets';

const catalog = parseLatexSnippetCatalog({
    version: 1,
    source: {
        project: 'LaTeX Workshop',
        commit: 'd4b1410b82cc634fef18989dfc53db58a55484c9',
        license: 'MIT',
    },
    items: [
        { id: 'frac', label: '\\frac', insertText: '\\frac{${1:a}}{${2:b}}$0', detail: 'fraction', category: 'structure', priority: 100 },
        { id: 'alpha', label: '\\alpha', insertText: '\\alpha', detail: 'Greek alpha', category: 'symbol', priority: 80 },
        { id: 'aligned', label: 'aligned', insertText: '\\begin{aligned}\n\t${1:formula}\n\\end{aligned}$0', detail: 'aligned environment', category: 'environment', priority: 40 },
    ],
});

describe('LaTeX formula snippets', () => {
    it('compiles VS Code-style tab stops without implementing @ shortcuts', () => {
        expect(compileLatexSnippet('\\frac{${1:a}}{${2:b}}$0')).toEqual({
            text: '\\frac{a}{b}',
            tabStops: [
                { index: 1, start: 6, end: 7 },
                { index: 2, start: 9, end: 10 },
            ],
            finalCursor: 11,
        });
    });

    it('supports the selected-text variable used by upstream snippets', () => {
        expect(compileLatexSnippet('\\mathbf{${1:${TM_SELECTED_TEXT}}}$0', 'v')).toMatchObject({
            text: '\\mathbf{v}',
            tabStops: [{ index: 1, start: 8, end: 9 }],
            finalCursor: 10,
        });
    });

    it('ranks exact and prefix command matches ahead of detail matches', () => {
        expect(searchLatexSnippets(catalog, 'frac').map((item) => item.id)).toEqual(['frac']);
        expect(searchLatexSnippets(catalog, 'al').map((item) => item.id)).toEqual(['alpha', 'aligned']);
    });

    it('rejects catalog entries that expose an @ trigger', () => {
        expect(() => parseLatexSnippetCatalog({
            version: 1,
            source: { project: 'x', commit: 'x', license: 'MIT' },
            items: [{ id: '@frac', label: '@frac', insertText: '\\frac{}{}', detail: '', category: 'structure' }],
        })).toThrow(/@/);
    });

    it('ships a large fixed-commit formula catalog with no @ shortcuts', () => {
        const payload = JSON.parse(readFileSync('public/vendor/latex-workshop/formula-snippets.json', 'utf8'));
        const shipped = parseLatexSnippetCatalog(payload);

        expect(shipped.source.commit).toBe('d4b1410b82cc634fef18989dfc53db58a55484c9');
        expect(shipped.items.length).toBeGreaterThan(1000);
        expect(shipped.items.some((item) => item.id.includes('@') || item.label.startsWith('@'))).toBe(false);
        expect(searchLatexSnippets(shipped, 'frac')[0]?.label).toBe('\\frac');
    });
});
