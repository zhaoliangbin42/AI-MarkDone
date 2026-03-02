import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildMarkdownExport } from '../../../../src/services/export/saveMessagesMarkdown';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

describe('buildMarkdownExport', () => {
    it('returns null when no selected messages', () => {
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'Conversation',
            count: 0,
            platform: 'ChatGPT',
        };
        const res = buildMarkdownExport([], [], meta, t);
        expect(res).toBeNull();
    });

    it('sanitizes filename and triggers markdown build', () => {
        const turns: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'A/B:C* D?',
            count: 1,
            platform: 'ChatGPT',
        };
        const res = buildMarkdownExport(turns, [0], meta, t);
        expect(res).not.toBeNull();
        expect(res!.filename).toBe('A_B_C__D_.md');
        expect(res!.markdown).toContain('# A/B:C* D?');
    });

    it('truncates very long filename to max length before extension', () => {
        const turns: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'x'.repeat(150),
            count: 1,
            platform: 'ChatGPT',
        };
        const res = buildMarkdownExport(turns, [0], meta, t);
        expect(res).not.toBeNull();
        const base = res!.filename.replace(/\.md$/, '');
        expect(base.length).toBeLessThanOrEqual(100);
        expect(res!.filename.endsWith('.md')).toBe(true);
    });

    it('normalizes markdown title heading to a single safe line', () => {
        const turns: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: '### Line1\nLine2',
            count: 1,
            platform: 'ChatGPT',
        };
        const res = buildMarkdownExport(turns, [0], meta, t);
        expect(res).not.toBeNull();
        expect(res!.markdown).toContain('# Line1 Line2');
        expect(res!.markdown).not.toContain('# ### Line1');
    });

    it('uses sequential numbering regardless of original indices', () => {
        const turns: ChatTurn[] = [
            { user: 'u1', assistant: 'a1', index: 0 },
            { user: 'u2', assistant: 'a2', index: 1 },
            { user: 'u3', assistant: 'a3', index: 2 },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'Conversation',
            count: 3,
            platform: 'ChatGPT',
        };
        const res = buildMarkdownExport(turns, [2, 0], meta, t);
        expect(res).not.toBeNull();
        expect(res!.markdown).toContain('# exportMessagePrefix:1');
        expect(res!.markdown).toContain('# exportMessagePrefix:2');
        expect(res!.markdown).not.toContain('# exportMessagePrefix:3');
    });
});

