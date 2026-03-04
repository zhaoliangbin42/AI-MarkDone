import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectReaderItems } from '@/services/reader/collectReaderItems';
import { resolveContent } from '@/services/reader/types';

describe('collectReaderItems (ChatGPT Thinking)', () => {
    it(
        'creates one reader page per conversation turn by merging assistant segments inside the same turn',
        async () => {
            const html = readFileSync('mocks/ChatGPT/ChatGPT-Thinking.html', 'utf-8');
            document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

            const adapter = new ChatGPTAdapter();
            const assistantNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"][data-message-id]')).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            expect(assistantNodes.length).toBeGreaterThan(1);

            const { items } = collectReaderItems(adapter, assistantNodes[0]!);
            expect(items).toHaveLength(3);

            const md = await resolveContent(items[0]!.content);
            expect(md).toContain('我会先查苹果官方的用户指南');
            expect(md).toContain('Benko，你说的这个功能');
        },
        20_000
    );
});

