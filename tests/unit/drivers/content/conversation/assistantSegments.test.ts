import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { listAssistantSegmentElements } from '@/drivers/content/conversation/assistantSegments';

describe('listAssistantSegmentElements', () => {
    it('matches querySelectorAll order and length (ChatGPT Thinking fixture)', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-Thinking.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const selector = adapter.getMessageSelector();

        const expected = Array.from(document.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
        const actual = listAssistantSegmentElements(adapter);

        expect(actual).toHaveLength(expected.length);
        expect(actual.map((el) => el.getAttribute('data-message-id'))).toEqual(expected.map((el) => el.getAttribute('data-message-id')));
    });
});

