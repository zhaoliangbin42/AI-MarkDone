import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import type { ChatGPTConversationSnapshot } from '@/drivers/content/chatgpt/types';

const navigationMocks = vi.hoisted(() => ({
    scrollToBookmarkTargetWithRetry: vi.fn(),
    highlightNavigationTarget: vi.fn(),
}));

vi.mock('@/drivers/content/bookmarks/navigation', () => ({
    scrollToBookmarkTargetWithRetry: navigationMocks.scrollToBookmarkTargetWithRetry,
}));

vi.mock('@/drivers/content/conversation/highlight', () => ({
    highlightNavigationTarget: navigationMocks.highlightNavigationTarget,
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

function buildMaterializedRoundDom(): HTMLElement {
    document.body.innerHTML = `
      <div data-turn-id-container><section id="user-1" data-turn="user" data-message-author-role="user" data-message-id="u1"></section></div>
      <div data-turn-id-container><section id="assistant-1" data-turn="assistant" data-message-author-role="assistant" data-message-id="a1"></section></div>
    `;
    return document.getElementById('user-1') as HTMLElement;
}

function publishCanonicalRounds(adapter: SiteAdapter, assistantMessageIds: string[]): void {
    getChatGPTConversationIndex(adapter).setSnapshot({
        conversationId: '12345678-1234-1234-1234-123456789abc',
        buildFingerprint: 'test-build',
        source: 'runtime-bridge',
        origin: 'conversation-graph',
        coverage: 'complete',
        branchKey: 'branch-test',
        capturedAt: Date.now(),
        rounds: assistantMessageIds.map((assistantMessageId, index) => ({
            id: `canonical-round-${index + 1}`,
            position: index + 1,
            userPrompt: `Prompt ${index + 1}`,
            assistantContent: `Answer ${index + 1}`,
            preview: `Prompt ${index + 1}`,
            messageId: assistantMessageId,
            userMessageId: null,
            assistantMessageId,
        })),
    });
}

function buildCanonicalSnapshot(roundCount: number): ChatGPTConversationSnapshot {
    return {
        conversationId: '12345678-1234-1234-1234-123456789abc',
        buildFingerprint: 'test-build',
        source: 'runtime-bridge',
        origin: 'conversation-graph',
        coverage: 'complete',
        branchKey: 'branch-test',
        capturedAt: Date.now(),
        rounds: Array.from({ length: roundCount }, (_, index) => {
            const position = index + 1;
            return {
                id: `round-${position}`,
                position,
                userPrompt: `Prompt ${position}`,
                assistantContent: `Answer ${position}`,
                preview: `Prompt ${position}`,
                messageId: `assistant-${position}`,
                userMessageId: `user-${position}`,
                assistantMessageId: `assistant-${position}`,
            };
        }),
    };
}

function mountRoleWindow(positions: number[]): void {
    let main = document.querySelector('main');
    if (!(main instanceof HTMLElement)) {
        main = document.createElement('main');
        document.body.appendChild(main);
    }
    main.innerHTML = positions.map((position) => `
      <div id="user-${position}" data-turn="user" data-turn-id="round-${position}">
        <div data-message-author-role="user" data-message-id="user-${position}">Prompt ${position}</div>
      </div>
      <div id="assistant-${position}" data-turn="assistant" data-turn-id="round-${position}">
        <div data-message-author-role="assistant" data-message-id="assistant-${position}">Answer ${position}</div>
      </div>
    `).join('');
}

function attachTestScrollRoot(adapter: ChatGPTNavigationTestAdapter): HTMLElement {
    const scrollRoot = document.createElement('div');
    Object.defineProperties(scrollRoot, {
        clientHeight: { configurable: true, value: 500 },
        scrollHeight: { configurable: true, value: 5000 },
        scrollTop: { configurable: true, writable: true, value: 0 },
    });
    scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
        scrollRoot.scrollTop = Number(options.top ?? 0);
    });
    adapter.getConversationScrollRoot = () => scrollRoot;
    return scrollRoot;
}

describe('ChatGPT directory navigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/c/12345678-1234-1234-1234-123456789abc');
        navigationMocks.scrollToBookmarkTargetWithRetry.mockReset();
        navigationMocks.highlightNavigationTarget.mockReset();
        window.localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        window.localStorage.clear();
    });

    it('realigns the materialized anchor when host hydration shifts it after the first scroll', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildMaterializedRoundDom();
        publishCanonicalRounds(adapter, ['a1']);
        const releaseListener = vi.fn();
        window.addEventListener('aimd:chatgpt-send-position-restore:release', releaseListener);
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
        expect(releaseListener).toHaveBeenCalled();
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(2);
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(anchor);
        window.removeEventListener('aimd:chatgpt-send-position-restore:release', releaseListener);
    });

    it('does not keep realigning after the user starts navigating manually', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildMaterializedRoundDom();
        publishCanonicalRounds(adapter, ['a1']);
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

    it('materializes an unmounted canonical target and succeeds only after exact identity appears', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        getChatGPTConversationIndex(adapter).setSnapshot(buildCanonicalSnapshot(60));

        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 4510 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop < 4000) {
                mountRoleWindow([10, 11, 12, 13, 14, 15]);
                return;
            }
            if (scrollRoot.scrollTop < 4250) {
                mountRoleWindow([30, 31, 32, 33, 34, 35]);
                return;
            }
            if (scrollRoot.scrollTop < 4350) {
                mountRoleWindow([45, 46, 47, 48, 49]);
                return;
            }
            mountRoleWindow([46, 47, 48, 49, 50]);
            (document.getElementById('user-50') as HTMLElement).scrollIntoView = vi.fn();
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 50 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(scrollRoot.scrollTo).toHaveBeenCalledTimes(4);
        const firstTop = Number((scrollRoot.scrollTo as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.top ?? 0);
        const secondTop = Number((scrollRoot.scrollTo as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]?.top ?? 0);
        expect(secondTop).toBeGreaterThan(firstTop);
        expect(navigationMocks.scrollToBookmarkTargetWithRetry).not.toHaveBeenCalled();
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-50'));
    });

    it('cancels materialization when the user takes over scrolling', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        getChatGPTConversationIndex(adapter).setSnapshot(buildCanonicalSnapshot(60));
        attachTestScrollRoot(adapter);

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 50 }, {
            timeoutMs: 300,
            intervalMs: 20,
        });
        await Promise.resolve();
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(40);

        await expect(resultPromise).resolves.toEqual({ ok: false, message: 'Navigation cancelled' });
    });

    it('cancels materialization when the conversation route changes', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        window.history.replaceState({}, '', '/c/12345678-1234-1234-1234-123456789abc');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        getChatGPTConversationIndex(adapter).setSnapshot(buildCanonicalSnapshot(60));
        attachTestScrollRoot(adapter);

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 50 }, {
            timeoutMs: 300,
            intervalMs: 20,
        });
        await Promise.resolve();
        window.setTimeout(() => window.history.replaceState({}, '', '/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), 10);
        await vi.advanceTimersByTimeAsync(60);

        await expect(resultPromise).resolves.toEqual({ ok: false, message: 'Conversation route changed' });
    });

    it('fails closed when bounded materialization never exposes the exact identity', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        getChatGPTConversationIndex(adapter).setSnapshot(buildCanonicalSnapshot(60));
        attachTestScrollRoot(adapter);

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 50 }, {
            timeoutMs: 100,
            intervalMs: 20,
            maxSeekAttempts: 2,
        });
        await vi.advanceTimersByTimeAsync(120);

        await expect(resultPromise).resolves.toEqual({ ok: false, message: 'Canonical target was not materialized' });
        expect(navigationMocks.scrollToBookmarkTargetWithRetry).not.toHaveBeenCalled();
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
        publishCanonicalRounds(adapter, ['a1a', 'a2']);

        const positions = collectChatGPTRoundPositions(adapter);

        expect(positions).toHaveLength(2);
        expect(positions[0]?.position).toBe(1);
        expect(positions[0]?.jumpAnchor.id).toBe('user-1');
        expect(positions[0]?.userAnchor?.id).toBe('user-1');
        expect(positions[0]?.assistantRoot?.id).toBe('assistant-1a');
        expect(positions[0]?.groupEls.map((node) => node.id)).toEqual(['user-1', 'assistant-1a', 'assistant-1b']);
    });

    it('resolves active position in canonical coordinates for a virtualized window', async () => {
        const { resolveChatGPTActivePosition } = await import('@/ui/content/chatgptDirectory/navigation');
        const first = document.createElement('div');
        const second = document.createElement('div');
        document.body.append(first, second);
        first.getBoundingClientRect = vi.fn(() => ({ top: -100, bottom: 100 } as DOMRect));
        second.getBoundingClientRect = vi.fn(() => ({ top: 120, bottom: 400 } as DOMRect));
        const rounds = [
            { position: 20, jumpAnchor: first, groupEls: [first] },
            { position: 21, jumpAnchor: second, groupEls: [second] },
        ] as any;

        expect(resolveChatGPTActivePosition(rounds, 180)).toBe(21);
    });
});
