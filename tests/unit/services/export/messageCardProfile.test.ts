import { describe, expect, it } from 'vitest';
import type { ExportDocumentV1 } from '../../../../src/services/export/imageExportContracts';
import { renderMessageCardProfile } from '../../../../src/services/export/messageCardProfile';

describe('renderMessageCardProfile', () => {
    it('renders all selected sections into one sanitized message-card document', () => {
        const document: ExportDocumentV1 = {
            schemaVersion: 1,
            profile: 'message-card-v1',
            title: 'Long export',
            labels: { user: 'You', assistant: 'Assistant' },
            sections: [
                {
                    sourceIndex: 0,
                    heading: 'Message 1',
                    userText: '<script>prompt()</script>',
                    assistantMarkdown: '**first**',
                },
                {
                    sourceIndex: 4,
                    heading: 'Message 2',
                    userText: 'second prompt',
                    assistantMarkdown: '| A | B |\n| - | - |\n| 1 | 2 |\n\n$$\nE=mc^2\n$$',
                },
            ],
        };

        const rendered = renderMessageCardProfile(document, { widthCssPx: 640 });

        expect(rendered.rootClass).toBe('aimd-png-export-card');
        expect(rendered.html.match(/class="message-section"/g)).toHaveLength(2);
        expect(rendered.html).toContain('&lt;script&gt;prompt()&lt;/script&gt;');
        expect(rendered.html).toContain('<strong>first</strong>');
        expect(rendered.html).toContain('<table>');
        expect(rendered.html).toContain('class="katex-display"');
        expect(rendered.html).toContain('width: 640px;');
        expect(rendered.html).toContain('overflow-wrap: anywhere');
        expect(rendered.html).not.toContain(':root');
        expect(rendered.html).toContain('.aimd-png-export-card {\n  --aimd-ref-color-neutral-0:');
        expect(rendered.html).not.toContain('<script>prompt()');
    });

    it('preserves CommonMark, GFM, code, links, tables, task lists, and tagged equations', () => {
        const assistantMarkdown = [
            '# Heading 1',
            '',
            'Paragraph with **bold**, *emphasis*, `inline code`, and [a link](https://example.com).',
            '',
            '- bullet one',
            '  - nested bullet',
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
            '```ts',
            'const answer = 42;',
            '```',
            '',
            '$$',
            'E=mc^2 \\tag{1}',
            '$$',
        ].join('\n');
        const rendered = renderMessageCardProfile({
            schemaVersion: 1,
            profile: 'message-card-v1',
            title: 'Markdown fixture',
            labels: { user: 'You', assistant: 'Assistant' },
            sections: [{
                sourceIndex: 0,
                heading: 'Message 1',
                userText: 'Prompt',
                assistantMarkdown,
            }],
        }, { widthCssPx: 800 });

        expect(rendered.html).toContain('<h1>Heading 1</h1>');
        expect(rendered.html).toContain('<strong>bold</strong>');
        expect(rendered.html).toContain('<em>emphasis</em>');
        expect(rendered.html).toContain('href="https://example.com"');
        expect(rendered.html).toContain('<ol>');
        expect(rendered.html).toContain('contains-task-list');
        expect(rendered.html).toContain('<blockquote>');
        expect(rendered.html).toContain('<table>');
        expect(rendered.html).toContain('reader-code-block');
        expect(rendered.html).toContain('hljs');
        expect(rendered.html).toContain('class="katex-display"');
        expect(rendered.html).toContain('class="tag"');
        expect(rendered.html).toContain('.reader-code-block__scroll,\n.aimd-png-export-card .reader-code-block__scroll pre');
        expect(rendered.html).toContain('.aimd-png-export-card .reader-markdown pre code');
        expect(rendered.html).toContain('display: table;');
        expect(rendered.html).toContain('overflow: visible;');
        expect(rendered.html).not.toContain('reader-copy-code');
        expect(rendered.html).not.toContain('katex-styles-bundled');
    });
});
