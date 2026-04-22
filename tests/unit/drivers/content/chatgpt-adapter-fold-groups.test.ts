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
        expect(refs.length).toBeGreaterThanOrEqual(3);
        expect(refs.some((ref) => Boolean(ref.userPromptText?.trim()))).toBe(true);
        for (const ref of refs) {
            const userContainer = ref.userRootEl?.closest('[data-turn-id-container]');
            const assistantContainer = ref.assistantRootEl.closest('[data-turn-id-container]');
            expect(userContainer).toBeInstanceOf(HTMLElement);
            expect(assistantContainer).toBeInstanceOf(HTMLElement);
            expect(ref.barAnchorEl).toBe(userContainer);
            expect(ref.groupEls).toEqual([userContainer, assistantContainer]);
            expect(ref.id).toBe(ref.assistantMessageEl.getAttribute('data-message-id'));
        }
    });

    it('uses assistant message ids as stable group ids even when the fixture already contains stale fold metadata', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-fold.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs.length).toBeGreaterThan(0);
        expect(new Set(refs.map((ref) => ref.id)).size).toBe(refs.length);
        for (const ref of refs) {
            expect(ref.id).toBe(ref.assistantMessageEl.getAttribute('data-message-id'));
        }
    });
});
