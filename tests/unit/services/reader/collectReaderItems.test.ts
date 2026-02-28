import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectReaderItems } from '@/services/reader/collectReaderItems';

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
              <div data-message-author-role="assistant">
                <div class="markdown prose">Hi</div>
              </div>
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const assistant = document.querySelector('article[data-turn="assistant"]') as HTMLElement;
        expect(assistant).toBeTruthy();

        const res = collectReaderItems(adapter, assistant, () => 'md');
        expect(res.items.length).toBe(1);
        expect(res.startIndex).toBe(0);
        expect(res.items[0].userPrompt).toBe('Hello from user');
    });
});

