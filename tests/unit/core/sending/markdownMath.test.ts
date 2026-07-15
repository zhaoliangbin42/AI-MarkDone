import { describe, expect, it } from 'vitest';
import {
    findLatexCommandToken,
    findMarkdownMathAt,
    scanMarkdownMath,
} from '@/core/sending/markdownMath';

describe('Markdown math authoring contexts', () => {
    it('finds closed inline and display formula ranges', () => {
        expect(scanMarkdownMath('Before $x + y$ and $$\\frac{a}{b}$$.')).toEqual([
            expect.objectContaining({
                kind: 'inline',
                source: 'x + y',
                closed: true,
            }),
            expect.objectContaining({
                kind: 'display',
                source: '\\frac{a}{b}',
                closed: true,
            }),
        ]);
    });

    it('allows multiline display formulas but not multiline inline formulas', () => {
        const ranges = scanMarkdownMath('$$a +\nb$$\n$x\ny$');
        expect(ranges).toHaveLength(1);
        expect(ranges[0]).toMatchObject({ kind: 'display', source: 'a +\nb', closed: true });
    });

    it('ignores escaped dollars, inline code, and fenced code blocks', () => {
        const text = '\\$cash$ `$code$`\n```md\n$fenced$\n```\n$real$';
        expect(scanMarkdownMath(text)).toEqual([
            expect.objectContaining({ kind: 'inline', source: 'real', closed: true }),
        ]);
    });

    it('returns an open formula only when authoring lookup permits it', () => {
        const text = String.raw`Type $\alp`;
        expect(scanMarkdownMath(text)).toEqual([]);
        expect(findMarkdownMathAt(text, text.length, { includeOpen: true })).toMatchObject({
            kind: 'inline',
            source: '\\alp',
            closed: false,
        });
    });

    it('finds a backslash command token only inside a formula environment', () => {
        const inline = String.raw`Outside \alpha and $x + \alp`;
        expect(findLatexCommandToken(inline, inline.length)).toEqual({
            start: inline.lastIndexOf('\\'),
            end: inline.length,
            query: 'alp',
            math: expect.objectContaining({ kind: 'inline', closed: false }),
        });
        expect(findLatexCommandToken(String.raw`Outside \alpha`, 14)).toBeNull();
    });

    it('does not treat a LaTeX line break or @ text as a command trigger', () => {
        expect(findLatexCommandToken(String.raw`$x \\`, 5)).toBeNull();
        expect(findLatexCommandToken('$@fra', 5)).toBeNull();
    });
});
