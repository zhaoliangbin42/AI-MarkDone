import { describe, expect, it } from 'vitest';
import { renderMarkdownForReader, renderMarkdownToSanitizedHtml } from '@/services/renderer/renderMarkdown';

describe('renderMarkdownToSanitizedHtml', () => {
    it('sanitizes dangerous HTML', () => {
        const html = renderMarkdownToSanitizedHtml(
            `<img src="x" onerror="alert(1)">\n<script>alert(1)</script>\n<a href="javascript:alert(1)">x</a>`
        );

        expect(html).not.toContain('onerror=');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:');
    });

    it('renders safe links with explicit external target and rel attributes', () => {
        const html = renderMarkdownToSanitizedHtml('[repo](https://example.com/repo)');

        expect(html).toContain('href="https://example.com/repo"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });

    it('renders inline math via katex extension', () => {
        const html = renderMarkdownToSanitizedHtml('Inline: $x_1 + y$');
        expect(html).toContain('katex');
    });

    it('renders gfm tables, task lists, code highlighting, and display math in one pass', () => {
        const html = renderMarkdownToSanitizedHtml(
            [
                '| Col | Value |',
                '| --- | --- |',
                '| alpha | beta |',
                '',
                '- [x] shipped',
                '- [ ] pending',
                '',
                '```ts',
                'const answer = 42;',
                '```',
                '',
                '$$',
                '\\int_0^1 x^2 \\\\, dx = \\\\frac{1}{3}',
                '$$',
            ].join('\n')
        );

        expect(html).toContain('<table>');
        expect(html).toContain('task-list-item');
        expect(html).toContain('hljs');
        expect(html).toContain('hljs-keyword');
        expect(html).toContain('katex-display');
    });

    it('renders math inside GFM table cells', () => {
        const html = renderMarkdownToSanitizedHtml(
            [
                '| Formula | Meaning |',
                '| --- | --- |',
                '| $x_1 + y$ | inline math in table |',
                '| $\\\\frac{a}{b}$ | fraction in table |',
            ].join('\n')
        );

        expect(html).toContain('<table>');
        expect(html).toContain('katex');
        expect(html).toContain('x_1');
        expect(html).toContain('frac');
    });

    it('supports optional soft line breaks for print-style rendering', () => {
        const html = renderMarkdownToSanitizedHtml('line 1\nline 2', { softBreaks: true });
        expect(html).toContain('line 1<br');
    });

    it('preserves language classes for fenced code blocks', () => {
        const html = renderMarkdownToSanitizedHtml('```json\n{\"ok\":true}\n```\n\n```ts\nconst x = 1;\n```');

        expect(html).toContain('language-json');
        expect(html).toContain('language-ts');
        expect(html).toContain('data-code-language="ts"');
        expect(html).toContain('data-code-language="json"');
    });

    it('produces reader atomic unit metadata for closed markdown units', () => {
        const rendered = renderMarkdownForReader(
            [
                'Text with `code` and $x_1 + y$.',
                '',
                '$$',
                'x^2',
                '$$',
                '',
                '| A | B |',
                '| --- | --- |',
                '| 1 | 2 |',
                '',
                '```ts',
                'const answer = 42;',
                '```',
                '',
                '![Alt](https://example.com/image.png)',
            ].join('\n')
        );

        expect(rendered.html).toContain('katex');
        expect(rendered.atomicUnits.map((unit) => unit.kind)).toEqual([
            'inline-code',
            'inline-math',
            'display-math',
            'table',
            'code-block',
            'image',
        ]);
        expect(rendered.atomicUnits.every((unit) => unit.end > unit.start)).toBe(true);
    });

    it('produces structural metadata without treating paragraphs as units', () => {
        const rendered = renderMarkdownForReader(
            [
                'Plain paragraph should stay selectable by text slice.',
                '',
                '## Heading',
                '',
                '- First item',
                '  - Nested item',
                '- Second item',
                '',
                '> Quoted note',
                '',
                '---',
            ].join('\n')
        );

        expect(rendered.atomicUnits.map((unit) => unit.kind)).toEqual([
            'heading',
            'list-item',
            'list-item',
            'list-item',
            'blockquote',
            'thematic-break',
        ]);
        expect(rendered.atomicUnits.map((unit) => unit.mode)).toEqual([
            'structural',
            'structural',
            'structural',
            'structural',
            'structural',
            'structural',
        ]);
        expect(rendered.atomicUnits.some((unit) => unit.source.includes('Plain paragraph'))).toBe(false);
        expect(rendered.atomicUnits[0]?.source).toBe('## Heading');
        expect(rendered.atomicUnits.some((unit) => unit.kind === 'list-item' && unit.source.includes('Nested item'))).toBe(true);
    });

    it('produces heading outline metadata from the same structural heading units', () => {
        const rendered = renderMarkdownForReader(
            [
                '# Main **Title**',
                '',
                '## Setup [`config`](https://example.com)',
                '',
                '### Setup',
                '',
                '###### Deep `code` title',
                '',
                '#',
            ].join('\n')
        );

        const headingUnits = rendered.atomicUnits.filter((unit) => unit.kind === 'heading');

        expect(rendered.outlineItems).toEqual([
            {
                id: headingUnits[0]?.id,
                level: 1,
                text: 'Main Title',
                start: headingUnits[0]?.start,
                end: headingUnits[0]?.end,
            },
            {
                id: headingUnits[1]?.id,
                level: 2,
                text: 'Setup config',
                start: headingUnits[1]?.start,
                end: headingUnits[1]?.end,
            },
            {
                id: headingUnits[2]?.id,
                level: 3,
                text: 'Setup',
                start: headingUnits[2]?.start,
                end: headingUnits[2]?.end,
            },
            {
                id: headingUnits[3]?.id,
                level: 6,
                text: 'Deep code title',
                start: headingUnits[3]?.start,
                end: headingUnits[3]?.end,
            },
        ]);
        expect(new Set(rendered.outlineItems.map((item) => item.id)).size).toBe(rendered.outlineItems.length);
        expect(headingUnits).toHaveLength(5);
    });
});
