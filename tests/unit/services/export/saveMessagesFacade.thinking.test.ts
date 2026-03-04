import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectConversationTurns } from '@/services/export/saveMessagesFacade';

describe('collectConversationTurns (ChatGPT Thinking)', () => {
    it(
        'merges multiple assistant segments under the same conversation turn so exports do not double-count messages',
        () => {
            const html = readFileSync('mocks/ChatGPT/ChatGPT-Thinking.html', 'utf-8');
            document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

            const adapter = new ChatGPTAdapter();
            const { turns } = collectConversationTurns(adapter);

            expect(turns).toHaveLength(3);

            const uniqueUsers = new Set(turns.map((t) => t.user));
            expect(uniqueUsers.size).toBe(3);

            // First assistant turn in the fixture is split into a short preface + a long body.
            // We keep both by concatenating markdown outputs in DOM order.
            expect(turns[0]!.assistant).toContain('我会先查苹果官方的用户指南');
            expect(turns[0]!.assistant).toContain('Benko，你说的这个功能');
        },
        60_000
    );
});
