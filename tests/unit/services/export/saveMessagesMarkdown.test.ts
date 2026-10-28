import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildMarkdownExport } from '../../../../src/services/export/saveMessagesMarkdown';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

describe('buildMarkdownExport', () => {
    it('includes safe original image links only when requested and preserves code literals', () => {
        const metadata = { url: 'https://chatgpt.com/c/1', exportedAt: '2026-10-28T00:00:00Z', title: 'Images', count: 1, platform: 'ChatGPT' };
        const block = { id: 'photo', kind: 'image' as const, label: 'Photo [one]', visualDigest: 'v1', fallbackMarkdown: 'Photo unavailable', source: { kind: 'loaded-image' as const, url: 'https://example.com/photo.png' } };
        const turns = [{ user: 'Question', assistant: 'Before\n\n![Photo](aimd-rich:photo)\n\nAfter\n\n`![Photo](aimd-rich:photo)`', richBlocks: [block], index: 0 }];
        const plain = buildMarkdownExport(turns, [0], metadata, t, { includeImages: false })!;
        expect(plain.markdown).not.toContain('https://example.com/photo.png');
        const linked = buildMarkdownExport(turns, [0], metadata, t, { includeImages: true })!;
        expect(linked.markdown).toContain('(<https://example.com/photo.png>)');
        expect(linked.markdown).toContain('`![Photo](aimd-rich:photo)`');
        for (const url of ['javascript:alert(1)', 'blob:https://example.com/transient', 'https://user:secret@example.com/photo.png']) {
            const out = buildMarkdownExport([{ ...turns[0], richBlocks: [{ ...block, source: { kind: 'loaded-image', url } }] }], [0], metadata, t, { includeImages: true })!;
            expect(out.markdown).not.toContain(url);
            expect(out.markdown).toContain('Photo unavailable');
        }
        expect(turns[0].assistant).toContain('![Photo](aimd-rich:photo)');
    });

    it('projects bound rich blocks to readable text while preserving marker-like code literals', () => {
        const block = { id: 'chart-1', kind: 'svg' as const, label: 'Leakage chart',
            visualDigest: 'v1', fallbackMarkdown: '> [Leakage chart]\n\n| SNR | Probability |\n| --- | --- |\n| 20 dB | 51.3% |',
            source: { kind: 'unavailable' as const, reason: 'not-rendered' as const } };
        const result = buildMarkdownExport([{ user: 'Question', assistant: 'Before\n\n![Leakage chart](aimd-rich:chart-1)\n\nAfter\n\n`aimd-rich:literal`', richBlocks: [block], index: 0 }], [0], {
            url: 'https://chatgpt.com/c/1', exportedAt: '2026-03-01T00:00:00Z', title: 'Rich reply', count: 1, platform: 'ChatGPT',
        }, t)!;
        expect(result.markdown).toContain('| 20 dB | 51.3% |');
        expect(result.markdown).not.toContain('aimd-rich:chart-1');
        expect(result.markdown).toContain('`aimd-rich:literal`');
        expect(result.markdown.indexOf('Before')).toBeLessThan(result.markdown.indexOf('Leakage chart'));
        expect(result.markdown.indexOf('51.3%')).toBeLessThan(result.markdown.indexOf('After'));
    });

    it('uses the same deduplicated source-order selection as PDF and PNG', () => {
        const turns: ChatTurn[] = [
            { user: 'first question', assistant: 'first answer', index: 10 },
            { user: 'second question', assistant: 'second answer', index: 20 },
        ];
        const meta: ConversationMetadata = {
            url: 'https://chatgpt.com/c/1', exportedAt: '2026-03-01T00:00:00.000Z',
            title: 'Conversation', count: 2, platform: 'ChatGPT',
        };
        const result = buildMarkdownExport(turns, [1, 0, 1, -1, 0.5, 99], meta, t)!;
        expect(result.markdown.match(/## exportAssistantLabel/g)).toHaveLength(2);
        expect(result.markdown.indexOf('first question')).toBeLessThan(result.markdown.indexOf('second question'));
    });

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
