import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectConversationTurnRefs } from '@/drivers/content/conversation/collectConversationTurnRefs';
import { copyMarkdownFromTurn } from '@/services/copy/copy-turn-markdown';

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
            const assistantMessageId = ref.assistantMessageEl.getAttribute('data-message-id');
            expect(ref.userRootEl).toBeInstanceOf(HTMLElement);
            expect(ref.assistantRootEl).toBeInstanceOf(HTMLElement);
            expect(ref.barAnchorEl).toBe(ref.userRootEl);
            expect(ref.groupEls).toEqual([ref.userRootEl, ref.assistantRootEl]);
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

    it('discovers user-round groups from current role/testid turns when legacy turn containers are absent', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-testid="conversation-turn-1" id="turn-u1" data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt one</div></div>
                </div>
                <div data-testid="conversation-turn-2" id="turn-a1a" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a1a"></div>
                </div>
                <div data-testid="conversation-turn-3" id="turn-a1b" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a1b"></div>
                </div>
                <div data-testid="conversation-turn-4" id="turn-u2" data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt two</div></div>
                </div>
                <div data-testid="conversation-turn-5" id="turn-a2" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a2"></div>
                </div>
              </main>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(2);
        expect(refs.map((ref) => ref.id)).toEqual(['a1a', 'a2']);
        expect(refs.map((ref) => ref.userPromptText)).toEqual(['Prompt one', 'Prompt two']);
        expect(refs.map((ref) => ref.barAnchorEl?.id)).toEqual(['turn-u1', 'turn-u2']);
        expect(refs.map((ref) => ref.assistantRootEl.id)).toEqual(['turn-a1a', 'turn-a2']);
    });

    it('discovers Deep Research rounds when assistant turn wrappers lack assistant role nodes', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-testid="conversation-turn-1" id="turn-u1" data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">Thesis prompt one</div></div>
                </div>
                <div data-testid="conversation-turn-2" id="turn-a1" data-turn="assistant">
                  <div>internal://deep-research</div>
                  <pre><code>h_{r,t}(\\tau,\\nu)</code></pre>
                </div>
                <div data-testid="conversation-turn-3" id="turn-u2" data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">Thesis prompt two</div></div>
                </div>
                <div data-testid="conversation-turn-4" id="turn-a2" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a2">
                    <div class="markdown prose">
                      <p>Answer two <span class="katex"><annotation encoding="application/x-tex">w_k</annotation></span></p>
                    </div>
                  </div>
                </div>
                <div data-testid="conversation-turn-5" id="turn-u3" data-turn="user">
                  <div data-message-author-role="user"><div class="whitespace-pre-wrap">Thesis prompt three</div></div>
                </div>
                <div data-testid="conversation-turn-6" id="turn-a3" data-turn="assistant">
                  <div>internal://deep-research</div>
                </div>
              </main>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(3);
        expect(refs.map((ref) => ref.userPromptText)).toEqual([
            'Thesis prompt one',
            'Thesis prompt two',
            'Thesis prompt three',
        ]);
        expect(refs.map((ref) => ref.barAnchorEl?.id)).toEqual(['turn-u1', 'turn-u2', 'turn-u3']);
        expect(refs.map((ref) => ref.assistantRootEl.id)).toEqual(['turn-a1', 'turn-a2', 'turn-a3']);
        expect(refs.map((ref) => ref.assistantMessageEl.id)).toEqual(['', '', '']);
        expect(refs[0]?.assistantMessageEl).not.toBe(refs[0]?.assistantRootEl);
        expect(refs[0]?.assistantMessageEl.getAttribute('data-aimd-empty-assistant-message')).toBe('true');
        expect(refs.map((ref) => ref.id)).toEqual(['turn-a1', 'a2', 'turn-a3']);

        const turns = collectConversationTurnRefs(adapter);
        expect(turns).toHaveLength(1);
        expect(turns[0]?.userPrompt).toBe('Thesis prompt two');

        const realMarkdown = copyMarkdownFromTurn(adapter, turns[0]!.messageEls);
        expect(realMarkdown.ok).toBe(true);
        if (realMarkdown.ok) expect(realMarkdown.markdown).toContain('$w_k$');
    });

    it('extracts user prompts from the text body without file-card labels', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-testid="conversation-turn-1" id="turn-u1" data-turn="user">
                  <div data-message-author-role="user">
                    <div>
                      <button type="button">
                        <span>粘贴的文本 (1)(20).txt</span>
                        <span>Document</span>
                      </button>
                      <div class="whitespace-pre-wrap">该论文介绍了 O-OTFS ，请帮我对 Introduction 部分进行详细的总结</div>
                    </div>
                  </div>
                </div>
                <div data-testid="conversation-turn-2" id="turn-a1" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a1">
                    <div class="markdown prose">Answer one</div>
                  </div>
                </div>
              </main>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(1);
        expect(refs[0]?.userPromptText).toBe('该论文介绍了 O-OTFS ，请帮我对 Introduction 部分进行详细的总结');
        expect(refs[0]?.userPromptText).not.toContain('粘贴的文本');
        expect(refs[0]?.userPromptText).not.toContain('Document');
    });

    it('ignores role nodes outside the scoped ChatGPT conversation root', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-testid="conversation-turn-1" id="turn-u1" data-turn="user">
                  <div data-message-author-role="user">Prompt one</div>
                </div>
                <div data-testid="conversation-turn-2" id="turn-a1" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a1"></div>
                </div>
              </main>
              <div id="portal">
                <div data-message-author-role="user">Noise prompt</div>
                <div data-message-author-role="assistant" data-message-id="noise"></div>
              </div>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(1);
        expect(refs[0]?.id).toBe('a1');
        expect(refs[0]?.userPromptText).toBe('Prompt one');
    });

    it('ignores turn wrappers outside the scoped ChatGPT conversation root', () => {
        document.documentElement.innerHTML = `
            <head></head>
            <body>
              <main>
                <div data-testid="conversation-turn-1" id="turn-u1" data-turn="user">
                  <div data-message-author-role="user">Prompt one</div>
                </div>
                <div data-testid="conversation-turn-2" id="turn-a1" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="a1"></div>
                </div>
              </main>
              <div id="portal">
                <div data-testid="conversation-turn-noise-1" data-turn="user">
                  <div data-message-author-role="user">Noise prompt</div>
                </div>
                <div data-testid="conversation-turn-noise-2" data-turn="assistant">
                  <div data-message-author-role="assistant" data-message-id="noise"></div>
                </div>
              </div>
            </body>
        `;

        const adapter = new ChatGPTAdapter();
        const refs = adapter.getConversationGroupRefs();

        expect(refs).toHaveLength(1);
        expect(refs[0]?.id).toBe('a1');
        expect(refs[0]?.userPromptText).toBe('Prompt one');
    });
});
