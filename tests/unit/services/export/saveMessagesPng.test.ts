import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildPngExportPlans } from '../../../../src/services/export/saveMessagesPng';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

const BASIC_MARKDOWN_SAMPLE = [
    '# Heading 1',
    '',
    'Paragraph with **bold**, *emphasis*, `inline code`, and [a link](https://example.com).',
    '',
    '- bullet one',
    '  - nested bullet',
    '- bullet two',
    '',
    '1. ordered one',
    '2. ordered two',
    '',
    '- [x] shipped',
    '- [ ] pending',
    '',
    '> quoted note',
    '',
    '| Name | Value |',
    '| --- | --- |',
    '| alpha | beta |',
    '',
    '---',
    '',
    '$$',
    'E=mc^2 \\tag{1}',
    '$$',
].join('\n');

describe('buildPngExportPlans', () => {
    const meta: ConversationMetadata = {
        url: 'https://chatgpt.com/c/1',
        exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        title: 'A/B:C* D?',
        count: 2,
        platform: 'ChatGPT',
    };

    const turns: ChatTurn[] = [
        { user: 'u1 <script>x</script>', assistant: '**a1**', index: 0 },
        { user: 'u2', assistant: '| A | B |\n| - | - |\n| 1 | 2 |', index: 1 },
    ];

    it('returns null when no selected messages', () => {
        expect(buildPngExportPlans(turns, [], meta, t)).toBeNull();
    });

    it('builds one PNG card plan per selected message with sanitized filenames and rendered markdown', () => {
        const result = buildPngExportPlans(turns, [1, 0], meta, t);

        expect(result).not.toBeNull();
        expect(result!.zipFilename).toBe('A_B_C__D_-png.zip');
        expect(result!.plans).toHaveLength(2);
        expect(result!.plans[0].filename).toBe('A_B_C__D_-message-001.png');
        expect(result!.plans[1].filename).toBe('A_B_C__D_-message-002.png');
        expect(result!.plans[0].html).toContain('class="message-section');
        expect(result!.plans[0].html).toContain('class="reader-markdown markdown-body"');
        expect(result!.plans[0].html).toContain('.aimd-png-export-card .reader-markdown {\n  font-family: inherit;');
        expect(result!.plans[0].html).toContain('reader-code-block');
        expect(result!.plans[0].html).not.toContain('katex-styles-bundled');
        expect(result!.plans[0].html).toContain('hljs');
        expect(result!.plans[0].html).not.toContain('reader-copy-code');
        expect(result!.plans[0].html).toContain('<table>');
        expect(result!.plans[1].html).toContain('&lt;script&gt;');
        expect(result!.options.width).toBe(800);
        expect(result!.options.pixelRatio).toBe(1);
        expect(result!.options.backgroundColor).toBe('#ffffff');
    });

    it('writes custom width and pixel ratio into the generated PNG plans', () => {
        const result = buildPngExportPlans(turns, [0], meta, t, { width: 420, pixelRatio: 3 });

        expect(result).not.toBeNull();
        expect(result!.options.width).toBe(420);
        expect(result!.options.pixelRatio).toBe(3);
        expect(result!.plans[0].width).toBe(420);
        expect(result!.plans[0].pixelRatio).toBe(3);
        expect(result!.plans[0].html).toContain('width: 420px;');
    });

    it('preserves KaTeX equation tag markup without embedding handwritten KaTeX CSS in the plan', () => {
        const result = buildPngExportPlans([
            { user: 'u1', assistant: ['$$', 'E=mc^2 \\tag{1}', '$$'].join('\n'), index: 0 },
        ], [0], meta, t);

        expect(result).not.toBeNull();
        expect(result!.plans[0].html).toContain('class="katex-display"');
        expect(result!.plans[0].html).toContain('class="tag"');
        expect(result!.plans[0].html).not.toContain('katex-styles-bundled');
    });

    it('keeps basic CommonMark and GFM structures in the real PNG export plan', () => {
        const result = buildPngExportPlans([
            { user: 'u1', assistant: BASIC_MARKDOWN_SAMPLE, index: 0 },
        ], [0], meta, t);

        expect(result).not.toBeNull();
        const html = result!.plans[0].html;

        expect(html).toContain('<h1>Heading 1</h1>');
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('<em>emphasis</em>');
        expect(html).toContain('<code>inline code</code>');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('<ul>');
        expect(html).toContain('nested bullet');
        expect(html).toContain('<ol>');
        expect(html).toContain('.reader-markdown :where(ul:not(.contains-task-list)) {\n  list-style-type: disc;');
        expect(html).toContain('.reader-markdown :where(ol) {\n  list-style-type: decimal;');
        expect(html).toContain('.reader-markdown :where(li:not(.task-list-item)) {\n  display: list-item;');
        expect(html).toContain('contains-task-list');
        expect(html).toContain('task-list-item');
        expect(html).toContain('.reader-markdown :where(.contains-task-list) {\n  padding-left: 0;\n  list-style: none;');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('<table>');
        expect(html).toContain('<hr>');
        expect(html).toContain('class="katex-display"');
        expect(html).toContain('class="tag"');
    });
});
