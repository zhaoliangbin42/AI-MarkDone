import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import {
    collectChatGPTDomHostSlots,
    collectChatGPTDomRoundRefs,
    resolveChatGPTDomRoundHostSlotId,
} from '@/drivers/content/chatgpt/domConversationDiscovery';

function hydratedSlot(index: number, role: 'user' | 'assistant'): string {
    const slotId = `${role}-slot-${index}`;
    const messageId = `${role}-${index}`;
    return `
        <div data-turn-id-container="${slotId}">
            <section data-turn="${role}" data-turn-id="${slotId}" data-turn-id-container="${slotId}">
                <div data-message-author-role="${role}" data-message-id="${messageId}">
                    <div class="${role === 'assistant' ? 'markdown prose' : 'whitespace-pre-wrap'}">
                        ${role === 'assistant' ? `Answer ${index}` : `Question ${index}`}
                    </div>
                </div>
                ${role === 'assistant' ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
            </section>
        </div>
    `;
}

describe('ChatGPT persistent host-slot seam', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        document.documentElement.innerHTML = '<head></head><body><main><div id="host-slots"></div></main></body>';
        adapter = new ChatGPTAdapter();
    });

    afterEach(() => {
        adapter.dispose();
    });

    it('collects only deduplicated outer slots and excludes nested markers and sentinels', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-id-container="client-created-root"></div>
            ${hydratedSlot(1, 'user')}
            <div data-turn-id-container="assistant-slot-1"></div>
            ${hydratedSlot(1, 'assistant')}
            <div data-turn-id-container="future-slot"></div>
        `;

        expect(collectChatGPTDomHostSlots(adapter).map((slot) => slot.id)).toEqual([
            'user-slot-1',
            'assistant-slot-1',
            'future-slot',
        ]);
    });

    it('binds a hydrated assistant round to its containing outer slot', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-id-container="empty-history-slot"></div>
            ${hydratedSlot(1, 'user')}
            ${hydratedSlot(1, 'assistant')}
        `;
        const slots = collectChatGPTDomHostSlots(adapter);
        const [round] = collectChatGPTDomRoundRefs(adapter);

        expect(resolveChatGPTDomRoundHostSlotId(round!, slots)).toBe('assistant-slot-1');
    });

    it('keeps old and current outer slots in document order during a host transition', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            ${hydratedSlot(1, 'user')}
            ${hydratedSlot(1, 'assistant')}
            <div data-turn-key="user-2">
              <div data-content-search-turn-key="round-2">
                <div data-chatgpt-search-unit-key="round-2:0:user" data-chatgpt-search-message-ids="user-2">Question 2</div>
                <div class="group flex flex-col pb-2 pt-2">
                  <div data-chatgpt-search-unit-key="round-2:2:assistant" data-chatgpt-search-message-ids="assistant-2 assistant-2">
                    <div data-markdown-text-style="assistant-message">Answer 2</div>
                  </div>
                  <div class="turn-action-controls"><button aria-label="复制">Copy</button></div>
                </div>
              </div>
            </div>`;
        const slots = collectChatGPTDomHostSlots(adapter);
        expect(slots.map((slot) => slot.id)).toEqual(['user-slot-1', 'assistant-slot-1', 'user-2']);
        const rounds = collectChatGPTDomRoundRefs(adapter);
        expect(rounds.map((round) => resolveChatGPTDomRoundHostSlotId(round, slots))).toEqual([
            'assistant-slot-1', 'user-2',
        ]);
    });

    it('derives one logical position from exact modern IDs with repeated identical assistant tokens', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-key="fallback-turn-0">
                <div data-content-search-turn-key="fallback-turn-0">
                    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="user-1">Question 1</div>
                    <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-1 assistant-1">
                        <div data-markdown-text-style="assistant-message">Answer 1</div>
                    </div>
                </div>
            </div>`;
        const slots = collectChatGPTDomHostSlots(adapter);
        const [round] = collectChatGPTDomRoundRefs(adapter);

        expect(slots.map((slot) => slot.id)).toEqual(['chatgpt-message-slot:user-1']);
        expect(resolveChatGPTDomRoundHostSlotId(round!, slots)).toBe('chatgpt-message-slot:user-1');
    });

    it.each([
        ['nested message', '<div data-turn-key="fallback-turn-0"><div data-message-author-role="assistant" data-message-id="assistant-1"></div></div>'],
        ['owner itself', '<div data-turn-key="fallback-turn-0" data-message-author-role="assistant" data-message-id="assistant-1"></div>'],
    ])('derives an assistant-only position from an exact identity on the %s', (_name, html) => {
        document.querySelector('#host-slots')!.innerHTML = html;

        expect(collectChatGPTDomHostSlots(adapter).map((slot) => slot.id)).toEqual([
            'chatgpt-message-slot:assistant-1',
        ]);
    });

    it.each([
        ['distinct search tokens', '<div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-1 assistant-2"></div>'],
        ['distinct assistant nodes', '<div data-message-author-role="assistant" data-message-id="assistant-1"></div><div data-message-author-role="assistant" data-message-id="assistant-2"></div>'],
        ['distinct user nodes', '<div data-message-author-role="user" data-message-id="user-1"></div><div data-message-author-role="user" data-message-id="user-2"></div>'],
        ['conflicting exact attributes', '<div data-message-author-role="assistant" data-message-id="assistant-1" data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-2"></div>'],
    ])('does not derive ownership from %s', (_name, contents) => {
        document.querySelector('#host-slots')!.innerHTML = `<div data-turn-key="fallback-turn-0">${contents}</div>`;

        expect(collectChatGPTDomHostSlots(adapter)).toEqual([]);
    });

    it('uses a real second outer attribute when the first one is only a provisional display key', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-id-container="fallback-turn-0" data-turn-key="stable-slot"></div>
        `;

        expect(collectChatGPTDomHostSlots(adapter).map((slot) => slot.id)).toEqual(['stable-slot']);
    });

    it('does not create a provisional assistant position from an exact user identity alone', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-key="fallback-turn-0">
                <div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="user-1">Question 1</div>
            </div>`;

        expect(collectChatGPTDomHostSlots(adapter)).toEqual([]);
    });

    it('discovers a native assistant-only search unit using its exact message identity', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-key="fallback-turn-0">
                <div data-content-search-turn-key="fallback-turn-0">
                    <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-1 assistant-1">
                        <div data-markdown-text-style="assistant-message">Answer 1</div>
                    </div>
                </div>
            </div>`;

        const rounds = collectChatGPTDomRoundRefs(adapter);
        expect(rounds).toHaveLength(1);
        expect(rounds[0]).toMatchObject({
            id: 'assistant-1', source: 'assistant-only',
            identity: { userMessageId: null, assistantMessageId: 'assistant-1' },
        });
        expect(resolveChatGPTDomRoundHostSlotId(rounds[0]!, collectChatGPTDomHostSlots(adapter))).toBe('chatgpt-message-slot:assistant-1');
    });

    it('does not replace conflicting native assistant tokens with a synthetic identity', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-key="stable-slot">
                <div data-content-search-turn-key="fallback-turn-0">
                    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="user-1">Question 1</div>
                    <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-1 assistant-2">
                        <div data-markdown-text-style="assistant-message">Answer 1</div>
                    </div>
                </div>
            </div>`;

        expect(collectChatGPTDomRoundRefs(adapter)).toEqual([]);
    });
});
