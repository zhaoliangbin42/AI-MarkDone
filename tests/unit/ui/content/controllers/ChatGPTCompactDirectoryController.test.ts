import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTCompactDirectoryController } from '@/ui/content/controllers/ChatGPTCompactDirectoryController';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class CompactDirectoryTestAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '[data-message-author-role="assistant"]'; }
    getMessageContentSelector(): string { return '.markdown'; }
    getActionBarSelector(): string { return '.toolbar'; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    injectToolbar(): boolean { return false; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
    getConversationGroupRefs(): ConversationGroupRef[] {
        const refs: ConversationGroupRef[] = [];
        let pendingUser: HTMLElement | null = null;
        for (const roleNode of Array.from(document.querySelectorAll('[data-message-author-role]'))) {
            if (!(roleNode instanceof HTMLElement)) continue;
            const role = roleNode.getAttribute('data-message-author-role');
            if (role === 'user') {
                pendingUser = roleNode;
                continue;
            }
            if (role !== 'assistant' || !pendingUser) continue;
            refs.push({
                id: roleNode.getAttribute('data-message-id') ?? `group-${refs.length + 1}`,
                assistantRootEl: roleNode,
                assistantMessageEl: roleNode,
                userRootEl: pendingUser,
                userPromptText: pendingUser.textContent?.trim() ?? null,
                barAnchorEl: pendingUser,
                groupEls: [pendingUser, roleNode],
                assistantIndex: refs.length,
                isStreaming: false,
            });
            pendingUser = null;
        }
        return refs;
    }
}

function makeEngine() {
    return {
        subscribe: vi.fn(() => () => undefined),
        peekCurrentSnapshot: vi.fn(() => null),
    } as any;
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('ChatGPTCompactDirectoryController', () => {
    it('shows the compact rail after ChatGPT mounts conversation DOM following page refresh', async () => {
        vi.useFakeTimers();
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc'),
            configurable: true,
        });

        const controller = new ChatGPTCompactDirectoryController(new CompactDirectoryTestAdapter(), makeEngine());
        controller.init('light');

        const host = document.getElementById('aimd-chatgpt-compact-directory-rail') as HTMLElement;
        expect(host.style.display).toBe('none');

        document.body.insertAdjacentHTML('beforeend', `
          <div data-message-author-role="user">First question</div>
          <div data-message-author-role="assistant" data-message-id="a1">First answer</div>
          <div data-message-author-role="user">Second question</div>
          <div data-message-author-role="assistant" data-message-id="a2">Second answer</div>
        `);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(140);

        expect(host.style.display).toBe('block');
        expect(host.shadowRoot?.querySelectorAll('.compact-rail__item')).toHaveLength(2);

        controller.dispose();
    });
});
