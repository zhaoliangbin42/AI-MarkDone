import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildPdfPrintPlan } from '../../../../src/services/export/saveMessagesPdf';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

describe('buildPdfPrintPlan (sanitization)', () => {
    it('escapes metadata and user prompt before HTML interpolation, and sanitizes assistant HTML', () => {
        const turns: ChatTurn[] = [
            {
                user: '<script>promptXss()</script>',
                assistant: 'Hello <img src=x onerror="assistantXss()" />',
                index: 0,
            },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: '<img src=x onerror="titleXss()" />',
            count: 1,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0], meta, t);
        expect(plan).not.toBeNull();
        const html = plan!.html;

        expect(html).toContain('&lt;img');
        expect(html).toContain('&lt;script');
        expect(html).toContain('class="markdown-body"');
        // Title is escaped text and may contain the substring "onerror=" safely.
        // The assistant HTML must be sanitized so event handlers don't survive.
        expect(html).not.toContain('assistantXss()');
    });

    it('falls back to escaped raw markdown when renderer throws', () => {
        const turns: ChatTurn[] = [{ user: 'u1', assistant: 'raw **md** text', index: 0 }];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'PDF Fallback',
            count: 1,
            platform: 'ChatGPT',
        };

        const plan = buildPdfPrintPlan(turns, [0], meta, t, { renderMarkdown: () => { throw new Error('render-fail'); } });
        expect(plan).not.toBeNull();
        expect(plan!.html).toContain('raw **md** text');
    });
});
