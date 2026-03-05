import { describe, expect, it } from 'vitest';
import { SiteAdapter } from '@/drivers/content/adapters/base';
import { getAssistantPosition } from '@/drivers/content/bookmarks/position';

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
    extractUserPrompt(): string | null {
        return null;
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
    getMessageId(): string | null {
        return null;
    }
    getObserverContainer(): HTMLElement | null {
        return null;
    }
}

describe('getAssistantPosition', () => {
    it('returns 1-based index in DOM order', () => {
        document.body.innerHTML = `
          <div class="assistant" data-id="a1"></div>
          <div class="assistant" data-id="a2"></div>
          <div class="assistant" data-id="a3"></div>
        `;
        const adapter = new TestAdapter();
        const nodes = Array.from(document.querySelectorAll('.assistant')).filter((n): n is HTMLElement => n instanceof HTMLElement);
        expect(getAssistantPosition(adapter, nodes[0]!)).toBe(1);
        expect(getAssistantPosition(adapter, nodes[1]!)).toBe(2);
        expect(getAssistantPosition(adapter, nodes[2]!)).toBe(3);
    });
});

