import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';

const navigationMocks = vi.hoisted(() => ({
    scrollToBookmarkTargetWithRetry: vi.fn(),
    highlightElement: vi.fn(),
}));

vi.mock('@/drivers/content/bookmarks/navigation', () => ({
    scrollToBookmarkTargetWithRetry: navigationMocks.scrollToBookmarkTargetWithRetry,
    highlightElement: navigationMocks.highlightElement,
}));

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class ChatGPTNavigationTestAdapter extends SiteAdapter {
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
    getMessageId(): string | null { return null; }
    getObserverContainer(): HTMLElement | null { return document.body; }
    getConversationGroupRefs(): ConversationGroupRef[] {
        const refs: ConversationGroupRef[] = [];
        const turnContainers = Array.from(document.querySelectorAll('[data-turn-id-container]')).filter(
            (node): node is HTMLElement => node instanceof HTMLElement,
        );
        let pendingUser: HTMLElement | null = null;
        for (const container of turnContainers) {
            const userRootEl = container.querySelector('[data-turn="user"]');
            const assistantRootEl = container.querySelector('[data-turn="assistant"]');
            if (userRootEl instanceof HTMLElement && !(assistantRootEl instanceof HTMLElement)) {
                pendingUser = container;
                continue;
            }
            if (!(assistantRootEl instanceof HTMLElement)) continue;
            refs.push({
                id: `group-${refs.length + 1}`,
                assistantRootEl,
                assistantMessageEl: assistantRootEl,
                userRootEl: pendingUser,
                userPromptText: pendingUser?.textContent?.trim() ?? null,
                barAnchorEl: pendingUser ?? container,
                groupEls: [pendingUser, container].filter((node): node is HTMLElement => node instanceof HTMLElement),
                assistantIndex: refs.length,
                isStreaming: false,
            });
            pendingUser = null;
        }
        if (refs.length > 0) return refs;

        let pendingRoleUser: HTMLElement | null = null;
        for (const roleNode of Array.from(document.querySelectorAll('[data-message-author-role]'))) {
            if (!(roleNode instanceof HTMLElement)) continue;
            const role = roleNode.getAttribute('data-message-author-role');
            if (role === 'user') {
                pendingRoleUser = roleNode;
                continue;
            }
            if (role !== 'assistant') continue;
            if (!pendingRoleUser) {
                const previousRef = refs[refs.length - 1];
                if (previousRef) previousRef.groupEls.push(roleNode);
                continue;
            }
            refs.push({
                id: roleNode.getAttribute('data-message-id') ?? `group-${refs.length + 1}`,
                assistantRootEl: roleNode,
                assistantMessageEl: roleNode,
                userRootEl: pendingRoleUser,
                userPromptText: pendingRoleUser.textContent?.trim() ?? null,
                barAnchorEl: pendingRoleUser,
                groupEls: [pendingRoleUser, roleNode],
                assistantIndex: refs.length,
                isStreaming: false,
            });
            pendingRoleUser = null;
        }
        return refs;
    }
}

class GroupAwareChatGPTNavigationTestAdapter extends ChatGPTNavigationTestAdapter {
    getConversationGroupRefs(): ConversationGroupRef[] {
        const refs: ConversationGroupRef[] = [];
        for (const group of Array.from(document.querySelectorAll('[data-group-root]'))) {
            if (!(group instanceof HTMLElement)) continue;
            const userRootEl = group.querySelector('[data-turn="user"]');
            const assistantRootEl = group.querySelector('[data-turn="assistant"]');
            const assistantMessageEl = assistantRootEl?.querySelector('[data-message-author-role="assistant"]');
            if (!(userRootEl instanceof HTMLElement) || !(assistantRootEl instanceof HTMLElement) || !(assistantMessageEl instanceof HTMLElement)) continue;
            refs.push({
                id: assistantMessageEl.getAttribute('data-message-id') ?? `group-${refs.length + 1}`,
                assistantRootEl,
                assistantMessageEl,
                userRootEl,
                userPromptText: userRootEl.textContent?.trim() ?? null,
                barAnchorEl: userRootEl,
                groupEls: [userRootEl, assistantRootEl],
                assistantIndex: refs.length,
                isStreaming: false,
            });
        }
        return refs;
    }
}

function buildSkeletonDom(): HTMLElement {
    document.body.innerHTML = `
      <div data-turn-id-container id="user-1"><section data-turn="user"></section></div>
      <div data-turn-id-container id="assistant-1"><section data-turn="assistant"></section></div>
    `;
    return document.getElementById('user-1') as HTMLElement;
}

describe('ChatGPT directory navigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        navigationMocks.scrollToBookmarkTargetWithRetry.mockReset();
        navigationMocks.highlightElement.mockReset();
        window.localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        window.localStorage.clear();
    });

    it('realigns the skeleton anchor when host hydration shifts it after the first scroll', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildSkeletonDom();
        let top = 0;
        anchor.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: top,
            top,
            left: 0,
            right: 100,
            bottom: top + 40,
            width: 100,
            height: 40,
            toJSON: () => ({}),
        }));
        anchor.scrollIntoView = vi.fn(() => {
            top = 0;
            if ((anchor.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length === 1) {
                window.setTimeout(() => {
                    top = 36;
                }, 20);
            }
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 1 }, {
            alignmentTimeoutMs: 240,
            alignmentQuietMs: 40,
            alignmentTolerancePx: 8,
            maxAlignmentAttempts: 3,
        });

        await vi.advanceTimersByTimeAsync(260);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(2);
        expect(navigationMocks.highlightElement).toHaveBeenCalledWith(anchor);
    });

    it('does not keep realigning after the user starts navigating manually', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildSkeletonDom();
        let top = 0;
        anchor.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: top,
            top,
            left: 0,
            right: 100,
            bottom: top + 40,
            width: 100,
            height: 40,
            toJSON: () => ({}),
        }));
        anchor.scrollIntoView = vi.fn(() => {
            top = 0;
            window.setTimeout(() => {
                top = 36;
            }, 20);
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 1 }, {
            alignmentTimeoutMs: 240,
            alignmentQuietMs: 40,
            alignmentTolerancePx: 8,
            maxAlignmentAttempts: 3,
        });

        await vi.advanceTimersByTimeAsync(30);
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(260);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('uses ChatGPT user role nodes as directory anchors when turn containers are absent', async () => {
        const { collectChatGPTSkeletonAnchors } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        document.body.innerHTML = `
          <main>
            <div id="user-1" data-message-author-role="user">Prompt one</div>
            <div id="assistant-1a" data-message-author-role="assistant" data-message-id="a1">Partial response</div>
            <div id="assistant-1b" data-message-author-role="assistant" data-message-id="a2">Final response</div>
            <div id="user-2" data-message-author-role="user">Prompt two</div>
            <div id="assistant-2" data-message-author-role="assistant" data-message-id="a3">Response two</div>
          </main>
        `;

        const anchors = collectChatGPTSkeletonAnchors(adapter);

        expect(anchors).toHaveLength(2);
        expect(anchors.map((anchor) => anchor.position)).toEqual([1, 2]);
        expect(anchors.map((anchor) => anchor.anchorEl.id)).toEqual(['user-1', 'user-2']);
    });

    it('resolves assistant role nodes to the preceding ChatGPT user-role directory position', async () => {
        const { resolveChatGPTSkeletonPositionForMessage } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        document.body.innerHTML = `
          <main>
            <div id="user-1" data-message-author-role="user">Prompt one</div>
            <div id="assistant-1a" data-message-author-role="assistant" data-message-id="a1">Partial response</div>
            <div id="assistant-1b" data-message-author-role="assistant" data-message-id="a2">Final response</div>
            <div id="user-2" data-message-author-role="user">Prompt two</div>
            <div id="assistant-2" data-message-author-role="assistant" data-message-id="a3">Response two</div>
          </main>
        `;

        expect(resolveChatGPTSkeletonPositionForMessage(
            adapter,
            document.getElementById('assistant-1b') as HTMLElement,
        )).toBe(1);
        expect(resolveChatGPTSkeletonPositionForMessage(
            adapter,
            document.getElementById('assistant-2') as HTMLElement,
        )).toBe(2);
    });

    it('uses adapter-owned conversation anchors instead of assistant selector count', async () => {
        const { collectChatGPTSkeletonAnchors } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new GroupAwareChatGPTNavigationTestAdapter();
        document.body.innerHTML = `
          <main>
            <div data-group-root>
              <section id="user-1" data-turn="user">Prompt one</section>
              <section id="assistant-1a" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1a"></div>
              </section>
              <section id="assistant-1b" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1b"></div>
              </section>
            </div>
            <div data-group-root>
              <section id="user-2" data-turn="user">Prompt two</section>
              <section id="assistant-2" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a2"></div>
              </section>
            </div>
          </main>
        `;

        const anchors = collectChatGPTSkeletonAnchors(adapter);

        expect(anchors).toHaveLength(2);
        expect(anchors.map((anchor) => anchor.anchorEl.id)).toEqual(['user-1', 'user-2']);
    });

    it('builds round positions with jump anchors and full group ranges from adapter-owned refs', async () => {
        const { collectChatGPTRoundPositions } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new GroupAwareChatGPTNavigationTestAdapter();
        document.body.innerHTML = `
          <main>
            <div data-group-root>
              <section id="user-1" data-turn="user">Prompt one</section>
              <section id="assistant-1a" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1a"></div>
              </section>
              <section id="assistant-1b" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1b"></div>
              </section>
            </div>
            <div data-group-root>
              <section id="user-2" data-turn="user">Prompt two</section>
              <section id="assistant-2" data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a2"></div>
              </section>
            </div>
          </main>
        `;

        const positions = collectChatGPTRoundPositions(adapter);

        expect(positions).toHaveLength(2);
        expect(positions[0]?.position).toBe(1);
        expect(positions[0]?.jumpAnchor.id).toBe('user-1');
        expect(positions[0]?.userAnchor?.id).toBe('user-1');
        expect(positions[0]?.assistantRoot?.id).toBe('assistant-1a');
        expect(positions[0]?.groupEls.map((node) => node.id)).toEqual(['user-1', 'assistant-1a']);
    });
});
