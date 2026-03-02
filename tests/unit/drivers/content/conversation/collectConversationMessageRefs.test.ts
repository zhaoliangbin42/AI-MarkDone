import { describe, expect, it } from 'vitest';
import { collectConversationMessageRefs } from '../../../../../src/drivers/content/conversation/collectConversationMessageRefs';
import { SiteAdapter } from '../../../../../src/drivers/content/adapters/base';

class TestAdapter extends SiteAdapter {
    matches(): boolean {
        return true;
    }
    getPlatformId(): any {
        return 'chatgpt';
    }
    getThemeDetector(): any {
        return { detect: () => 'light', getObserveTargets: () => [], hasExplicitTheme: () => false };
    }
    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        return assistantMessageElement.getAttribute('data-prompt');
    }
    getMessageSelector(): string {
        return '.assistant';
    }
    getMessageContentSelector(): string {
        return '';
    }
    getActionBarSelector(): string {
        return '';
    }
    isStreamingMessage(): boolean {
        return false;
    }
    getMessageId(messageElement: HTMLElement): string | null {
        return messageElement.getAttribute('data-id');
    }
    getObserverContainer(): HTMLElement | null {
        return document.getElementById('container');
    }
}

describe('collectConversationMessageRefs', () => {
    it('collects assistant messages, removes nested duplicates, and extracts prompts', () => {
        document.body.innerHTML = `
          <div id="container">
            <div class="assistant" data-id="a1" data-prompt="p1"></div>
            <div class="assistant" data-id="a2" data-prompt="p2">
              <div class="assistant" data-id="nested" data-prompt="pn"></div>
            </div>
          </div>
        `;

        const adapter = new TestAdapter();
        const refs = collectConversationMessageRefs(adapter);

        expect(refs).toHaveLength(2);
        expect(refs[0]?.index).toBe(0);
        expect(refs[0]?.userPrompt).toBe('p1');
        expect(refs[1]?.index).toBe(1);
        expect(refs[1]?.userPrompt).toBe('p2');
        expect(refs.map((r) => r.messageId)).toEqual(['a1', 'a2']);
    });
});

