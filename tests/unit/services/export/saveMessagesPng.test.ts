import { describe, expect, it } from 'vitest';
import type { ChatTurn, ConversationMetadata } from '../../../../src/services/export/saveMessagesTypes';
import { buildPngExportPlans } from '../../../../src/services/export/saveMessagesPng';

function t(key: string, args?: any): string {
    if (args === undefined) return key;
    if (Array.isArray(args)) return `${key}:${args.join('|')}`;
    return `${key}:${String(args)}`;
}

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
        expect(result!.plans[0].html).toContain('reader-code-block');
        expect(result!.plans[0].html).toContain('hljs');
        expect(result!.plans[0].html).not.toContain('reader-copy-code');
        expect(result!.plans[0].html).toContain('<table>');
        expect(result!.plans[1].html).toContain('&lt;script&gt;');
        expect(result!.options.width).toBe(800);
        expect(result!.options.pixelRatio).toBe(2);
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
});
