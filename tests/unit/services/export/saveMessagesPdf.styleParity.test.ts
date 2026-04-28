import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildPdfPrintPlan } from '../../../../src/services/export/saveMessagesPdf';

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

describe('buildPdfPrintPlan (legacy parity structure)', () => {
    it('includes cover page, per-message page breaks, and stable print container', () => {
        const turns: ChatTurn[] = [
            { user: '中文用户', assistant: '中文内容', index: 0 },
            { user: 'u2', assistant: 'a2', index: 1 },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 2,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0, 1], meta, t);
        expect(plan).not.toBeNull();
        expect(plan!.containerId).toBe('aimd-pdf-export-container');

        const html = plan!.html;
        expect(html).toContain('class="pdf-title-page"');
        expect(html).toContain('class="message-section"');
        expect(html).toContain('break-before: page');
        expect(html).toContain('@media print');
        expect(html).toContain('--aimd-text-primary: #000000');
        expect(html).not.toContain('katex-styles-bundled');
        expect(html).toContain('class="reader-markdown markdown-body"');
        expect(html).toContain('#aimd-pdf-export-container .reader-markdown {\n  font-family: inherit;');
        expect(html).toContain('中文用户');
        expect(html).toContain('中文内容');
        expect(html).toContain('body > *:not(#aimd-pdf-export-container) { display: none !important; }');
    });

    it('preserves KaTeX equation tag markup while leaving official KaTeX CSS to the print driver', () => {
        const turns: ChatTurn[] = [
            {
                user: 'u1',
                assistant: ['$$', 'E=mc^2 \\tag{1}', '$$'].join('\n'),
                index: 0,
            },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 1,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0], meta, t);
        expect(plan).not.toBeNull();
        expect(plan!.html).toContain('class="katex-display"');
        expect(plan!.html).toContain('class="tag"');
        expect(plan!.html).not.toContain('katex-styles-bundled');
    });

    it('aligns PDF markdown rendering with the Reader theme without exporting Reader copy controls', () => {
        const turns: ChatTurn[] = [
            {
                user: 'u1',
                assistant: '```ts\nconst value = 1;\n```',
                index: 0,
            },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 1,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0], meta, t);
        expect(plan).not.toBeNull();

        const html = plan!.html;
        expect(html).toContain('reader-code-block');
        expect(html).toContain('reader-code-block__header');
        expect(html).not.toContain('class="hljs');
        expect(html).not.toContain('reader-copy-code');
    });

    it('keeps basic CommonMark and GFM structures in the real PDF export plan', () => {
        const turns: ChatTurn[] = [
            {
                user: 'u1',
                assistant: BASIC_MARKDOWN_SAMPLE,
                index: 0,
            },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 1,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0], meta, t);
        expect(plan).not.toBeNull();
        const html = plan!.html;

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
