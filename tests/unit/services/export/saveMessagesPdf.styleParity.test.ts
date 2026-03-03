import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildPdfPrintPlan } from '../../../../src/services/export/saveMessagesPdf';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

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
        expect(html).toContain('katex-styles-bundled');
        expect(html).toContain('class="markdown-body"');
        expect(html).toContain('中文用户');
        expect(html).toContain('中文内容');
    });
});
