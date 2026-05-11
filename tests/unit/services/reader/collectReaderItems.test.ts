import { describe, expect, it } from 'vitest';
import { SiteAdapter, type ConversationGroupRef } from '@/drivers/content/adapters/base';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectReaderItems } from '@/services/reader/collectReaderItems';

class SkeletonRoundAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): any { return { detect: () => 'light', getObserveTargets: () => [], hasExplicitTheme: () => false }; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '.assistant'; }
    getMessageContentSelector(): string { return ''; }
    getActionBarSelector(): string { return ''; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-id'); }
    getObserverContainer(): HTMLElement | null { return document.getElementById('container'); }
    getConversationGroupRefs(): ConversationGroupRef[] {
        const skeletonRoot = document.getElementById('skeleton-root') as HTMLElement;
        const skeletonMessage = document.createElement('div');
        skeletonMessage.className = 'assistant';
        skeletonMessage.setAttribute('data-aimd-empty-assistant-message', 'true');
        skeletonMessage.setAttribute('data-id', 'skeleton');
        const realMessage = document.querySelector('[data-id="a2"]') as HTMLElement;
        const realRoot = realMessage.closest('[data-turn="assistant"]') as HTMLElement;
        return [
            {
                id: 'skeleton',
                assistantRootEl: skeletonRoot,
                assistantMessageEl: skeletonMessage,
                assistantContentRootEl: null,
                userRootEl: document.querySelector('[data-group-root="1"] [data-turn="user"]') as HTMLElement,
                userPromptText: 'skeleton prompt',
                barAnchorEl: skeletonRoot,
                groupEls: [skeletonRoot],
                assistantIndex: 0,
                isStreaming: false,
            },
            {
                id: 'real',
                assistantRootEl: realRoot,
                assistantMessageEl: realMessage,
                assistantContentRootEl: realMessage,
                userRootEl: document.querySelector('[data-group-root="2"] [data-turn="user"]') as HTMLElement,
                userPromptText: 'real prompt',
                barAnchorEl: realRoot,
                groupEls: [realRoot],
                assistantIndex: 1,
                isStreaming: false,
            },
        ];
    }
}

describe('collectReaderItems', () => {
    it('collects items and extracts corresponding user prompt', () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Hello from user</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        expect(assistant).toBeTruthy();

        const res = collectReaderItems(adapter, assistant, () => 'md');
        expect(res.items.length).toBe(1);
        expect(res.startIndex).toBe(0);
        expect(res.items[0].userPrompt).toBe('Hello from user');
        expect(res.items[0].meta).toMatchObject({
            platformId: 'chatgpt',
            messageId: 'a1',
            position: 1,
            bookmarkable: true,
            bookmarked: false,
        });
        expect(res.items[0].meta?.url).toBe(window.location.href);
    });

    it('keeps Reader items aligned with adapter-owned directory rounds', async () => {
        document.body.innerHTML = `
          <div id="container">
            <div data-group-root="1">
              <section data-turn="user">skeleton prompt</section>
              <section data-turn="assistant" id="skeleton-root"></section>
            </div>
            <div data-group-root="2">
              <section data-turn="user">real prompt</section>
              <section data-turn="assistant">
                <div class="assistant" data-id="a2">Real response</div>
              </section>
            </div>
          </div>
        `;

        const adapter = new SkeletonRoundAdapter();
        const realMessage = document.querySelector('[data-id="a2"]') as HTMLElement;
        const result = collectReaderItems(adapter, realMessage, (messageElement) => (
            messageElement.getAttribute('data-aimd-empty-assistant-message') === 'true'
                ? ''
                : 'real markdown'
        ));

        expect(result.items).toHaveLength(2);
        expect(result.startIndex).toBe(1);
        expect(result.items.map((item) => item.userPrompt)).toEqual(['skeleton prompt', 'real prompt']);
        expect(result.items.map((item) => item.meta?.messageId)).toEqual(['skeleton', 'a2']);
        expect(await result.items[0]?.content()).toBe('');
        expect(await result.items[1]?.content()).toBe('real markdown');
    });
});
