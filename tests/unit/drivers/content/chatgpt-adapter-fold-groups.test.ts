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
            const assistantMessageId = ref.assistantMessageEl.getAttribute('data-message-id');
            expect(userContainer).toBeInstanceOf(HTMLElement);
            expect(assistantContainer).toBeInstanceOf(HTMLElement);
            expect(ref.barAnchorEl).toBe(userContainer);
            expect(ref.groupEls).toEqual([userContainer, assistantContainer]);
            expect(ref.id).toBe(assistantMessageId || ref.assistantRootEl.getAttribute('data-turn-id'));
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
            const assistantMessageId = ref.assistantMessageEl.getAttribute('data-message-id');
            expect(ref.id).toBe(assistantMessageId || ref.assistantRootEl.getAttribute('data-turn-id'));
        }
    });

    it('merges container-backed turns with legacy article turns in document order', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <article data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">legacy prompt</div></div>
                </article>
                <article data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a-legacy"></div>
                </article>
                <div data-turn-id-container id="modern-user-1">
                  <section data-turn="user">
                    <div data-message-author-role="user"><div class="whitespace-pre-wrap">modern prompt</div></div>
                  </section>
                </div>
                <div data-turn-id-container id="modern-assistant-1">
                  <section data-turn="assistant">
                    <div data-message-author-role="assistant" data-message-id="a-modern"></div>
                  </section>
                </div>
              </main>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs.map((ref) => ref.id)).toEqual(['a-legacy', 'a-modern']);
        expect(refs.map((ref) => ref.userPromptText)).toEqual(['legacy prompt', 'modern prompt']);
    });

    it('ignores assistant-like nodes outside the conversation observer scope', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <article data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">real prompt</div></div>
                </article>
                <article data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a-real"></div>
                </article>
              </main>
              <div id="portal">
                <div data-message-author-role="assistant" data-message-id="a-noise"></div>
              </div>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs.map((ref) => ref.id)).toEqual(['a-real']);
    });

    it('discovers virtualized ChatGPT turns from structured React turn data on turn containers', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-turn-id-container id="u1"></div>
                <div data-turn-id-container id="a1"></div>
                <div data-turn-id-container id="u2"></div>
                <div data-turn-id-container id="a2"></div>
              </main>
            </body>
        `;

        const attachTurn = (id: string, turn: Record<string, unknown>) => {
            const element = document.getElementById(id) as any;
            element.__reactFiber$aimd = {
                pendingProps: { value: { currentTurn: turn } },
                return: null,
            };
        };

        attachTurn('u1', {
            id: 'turn-u1',
            author: { role: 'user' },
            messages: [{ id: 'u1-message', author: { role: 'user' }, content: { content_type: 'text', parts: ['Prompt 1'] } }],
        });
        attachTurn('a1', {
            id: 'turn-a1',
            author: { role: 'assistant' },
            messages: [{ id: 'a1-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 1'] } }],
        });
        attachTurn('u2', {
            id: 'turn-u2',
            role: 'user',
            messages: [{ id: 'u2-message', author: { role: 'user' }, content: { content_type: 'multimodal_text', parts: ['Prompt 2'] } }],
        });
        attachTurn('a2', {
            id: 'turn-a2',
            role: 'assistant',
            messages: [{ id: 'a2-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 2'] } }],
        });

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(2);
        expect(refs.map((ref) => ref.id)).toEqual(['a1-message', 'a2-message']);
        expect(refs.map((ref) => ref.userPromptText)).toEqual(['Prompt 1', 'Prompt 2']);
        expect(refs.map((ref) => ref.assistantRootEl.id)).toEqual(['a1', 'a2']);
    });
});
