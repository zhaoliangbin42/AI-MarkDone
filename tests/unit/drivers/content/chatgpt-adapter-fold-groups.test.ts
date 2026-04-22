import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';

describe('ChatGPTAdapter fold groups', () => {
    it('pairs assistant turns with their preceding user turns on the fold fixture', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-fold.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs.length).toBeGreaterThan(0);
        expect(refs[0]?.assistantRootEl.getAttribute('data-turn')).toBe('assistant');
        expect(refs[0]?.userRootEl).toBeTruthy();
        expect(refs[0]?.userRootEl?.getAttribute('data-turn')).toBe('user');
        expect(refs.every((ref) => ref.userRootEl instanceof HTMLElement)).toBe(true);
    });
});
