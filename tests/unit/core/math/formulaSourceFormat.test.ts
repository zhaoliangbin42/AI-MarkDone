import { describe, expect, it } from 'vitest';
import {
    formatFormulaSource,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
} from '@/core/math/formulaSourceFormat';

describe('formulaSourceFormat', () => {
    it('formats inline formulas with the supported source wrappers', () => {
        expect(formatFormulaSource(' x_1 + y ', false, 'markdown-dollar')).toBe('$x_1 + y$');
        expect(formatFormulaSource(' x_1 + y ', false, 'latex-brackets')).toBe('\\(x_1 + y\\)');
        expect(formatFormulaSource(' x_1 + y ', false, 'raw')).toBe('x_1 + y');
        expect(formatFormulaSource(' x_1 + y ', false, 'equation')).toBe('\\(x_1 + y\\)');
        expect(formatFormulaSource(' x_1 + y ', false, 'equation-star')).toBe('\\(x_1 + y\\)');
    });

    it('formats display formulas with the supported source wrappers', () => {
        expect(formatFormulaSource('a^2 + b^2 = c^2', true, 'markdown-dollar')).toBe('$$\na^2 + b^2 = c^2\n$$');
        expect(formatFormulaSource('a^2 + b^2 = c^2', true, 'latex-brackets')).toBe('\\[\na^2 + b^2 = c^2\n\\]');
        expect(formatFormulaSource('a^2 + b^2 = c^2', true, 'raw')).toBe('a^2 + b^2 = c^2');
        expect(formatFormulaSource('a^2 + b^2 = c^2', true, 'equation')).toBe('\\begin{equation}\na^2 + b^2 = c^2\n\\end{equation}');
        expect(formatFormulaSource('a^2 + b^2 = c^2', true, 'equation-star')).toBe('\\begin{equation*}\na^2 + b^2 = c^2\n\\end{equation*}');
    });

    it('normalizes invalid source format values to the default', () => {
        expect(normalizeFormulaSourceFormat('equation')).toBe('equation');
        expect(normalizeFormulaSourceFormat('align')).toBe('markdown-dollar');
    });

    it('rewrites inline and display math in markdown while preserving code', () => {
        const markdown = [
            'Inline $x_1 + y$ and display:',
            '',
            '$$',
            'a^2 + b^2 = c^2',
            '$$',
            '',
            '`$do_not_touch$`',
            '',
            '```md',
            '$$',
            'do_not_touch',
            '$$',
            '```',
        ].join('\n');

        const rewritten = rewriteMarkdownFormulaSources(markdown, 'latex-brackets');

        expect(rewritten).toContain('Inline \\(x_1 + y\\) and display:');
        expect(rewritten).toContain('\\[\na^2 + b^2 = c^2\n\\]');
        expect(rewritten).toContain('`$do_not_touch$`');
        expect(rewritten).toContain('do_not_touch');
    });

    it('keeps table formulas inline-safe when using display-only wrappers', () => {
        const markdown = [
            '| Formula | Meaning |',
            '| --- | --- |',
            '| $x_1 + y$ | inline |',
        ].join('\n');

        expect(rewriteMarkdownFormulaSources(markdown, 'equation')).toContain('| \\(x_1 + y\\) | inline |');
        expect(rewriteMarkdownFormulaSources(markdown, 'equation')).not.toContain('\\begin{equation}');
    });
});
