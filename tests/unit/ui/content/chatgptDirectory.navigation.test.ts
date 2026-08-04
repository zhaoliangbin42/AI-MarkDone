import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import { createConversationContentSource } from '../../../helpers/chatgptContentFixtures';

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

function setCanonicalSnapshot(
    adapter: SiteAdapter,
    snapshot: any,
): void {
    getChatGPTConversationIndex(adapter).bindConversationSource(createConversationContentSource(snapshot));
}

function publishCanonicalRounds(adapter: SiteAdapter, assistantMessageIds: string[]): void {
    setCanonicalSnapshot(adapter, {
        conversationId: '12345678-1234-1234-1234-123456789abc',
        revision: 1,
        proof: 'observed-graph' as const,
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

function buildCanonicalSnapshot(roundCount: number): any {
    return {
        conversationId: '12345678-1234-1234-1234-123456789abc',
        revision: 1,
        proof: 'observed-graph' as const,
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

function mountVirtualizedTurnSlots(
    roundCount: number,
    mountedPositions: number[],
): {
    userSlots: Map<number, HTMLElement>;
    assistantSlots: Map<number, HTMLElement>;
    hydrateRound: (position: number) => HTMLElement;
} {
    document.body.innerHTML = '<main><div data-chatgpt-turn-slot-root></div></main>';
    const root = document.querySelector('[data-chatgpt-turn-slot-root]');
    if (!(root instanceof HTMLElement)) throw new Error('slot root is missing');
    root.insertAdjacentHTML('beforeend', '<div data-turn-id-container data-slot-sentinel></div>');

    const userSlots = new Map<number, HTMLElement>();
    const assistantSlots = new Map<number, HTMLElement>();
    for (let position = 1; position <= roundCount; position += 1) {
        const userSlot = document.createElement('div');
        const assistantSlot = document.createElement('div');
        userSlot.setAttribute('data-turn-id-container', `user-${position}`);
        assistantSlot.setAttribute('data-turn-id-container', `assistant-${position}`);
        root.append(userSlot, assistantSlot);
        userSlots.set(position, userSlot);
        assistantSlots.set(position, assistantSlot);
    }

    const hydrateRound = (position: number): HTMLElement => {
        const userSlot = userSlots.get(position);
        const assistantSlot = assistantSlots.get(position);
        if (!userSlot || !assistantSlot) throw new Error(`round ${position} slots are missing`);
        userSlot.innerHTML = `
            <section id="user-${position}" data-testid="conversation-turn-${position * 2 - 1}" data-turn="user" data-turn-id="round-${position}" data-turn-id-container="user-${position}">
                <div data-message-author-role="user" data-message-id="user-${position}">Prompt ${position}</div>
            </section>
        `;
        assistantSlot.innerHTML = `
            <section id="assistant-${position}" data-testid="conversation-turn-${position * 2}" data-turn="assistant" data-turn-id="assistant-turn-${position}" data-turn-id-container="assistant-${position}">
                <div data-message-author-role="assistant" data-message-id="assistant-${position}">Answer ${position}</div>
            </section>
        `;
        return document.getElementById(`user-${position}`) as HTMLElement;
    };

    for (const position of mountedPositions) hydrateRound(position);
    return { userSlots, assistantSlots, hydrateRound };
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

    it('does not report success when the exact anchor remains outside the alignment tolerance', async () => {
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
            alignmentTimeoutMs: 180,
            alignmentQuietMs: 40,
            alignmentTolerancePx: 8,
            maxAlignmentAttempts: 2,
        });
        await vi.advanceTimersByTimeAsync(220);
        const result = await resultPromise;

        expect(result).toEqual({ ok: false, message: 'Navigation target did not stabilize' });
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(2);
        expect(navigationMocks.highlightNavigationTarget).not.toHaveBeenCalled();
    });

    it('does not attach whole-page diagnostic observers during normal navigation', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const NativeMutationObserver = window.MutationObserver;
        const mutationObserverConstructor = vi.fn(function MutationObserverMock(
            callback: MutationCallback,
        ) {
            return new NativeMutationObserver(callback);
        });
        const resizeObserverConstructor = vi.fn(function ResizeObserverMock() {
            return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
            };
        });
        vi.stubGlobal('MutationObserver', mutationObserverConstructor);
        vi.stubGlobal('ResizeObserver', resizeObserverConstructor);

        try {
            const adapter = new ChatGPTNavigationTestAdapter();
            const anchor = buildMaterializedRoundDom();
            publishCanonicalRounds(adapter, ['a1']);
            anchor.scrollIntoView = vi.fn();
            anchor.getBoundingClientRect = vi.fn(() => ({
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: 100,
                bottom: 40,
                width: 100,
                height: 40,
                toJSON: () => ({}),
            }));
            const observerCountBeforeNavigation = mutationObserverConstructor.mock.calls.length;

            const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 1 }, {
                alignmentTimeoutMs: 160,
                alignmentQuietMs: 40,
            });
            await vi.advanceTimersByTimeAsync(200);
            const result = await resultPromise;

            expect(result).toEqual({ ok: true });
            expect(mutationObserverConstructor).toHaveBeenCalledTimes(observerCountBeforeNavigation);
            expect(resizeObserverConstructor).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('materializes an unmounted canonical target and succeeds only after exact identity appears', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(60));

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

    it('materializes an unmounted canonical target through its persistent host slot without pixel probing', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const slots = mountVirtualizedTurnSlots(14, [1, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));
        const scrollRoot = attachTestScrollRoot(adapter);
        const targetSlot = slots.userSlots.get(10);
        if (!targetSlot) throw new Error('target slot is missing');
        targetSlot.scrollIntoView = vi.fn(() => {
            const anchor = slots.hydrateRound(10);
            anchor.scrollIntoView = vi.fn();
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 10 }, {
            timeoutMs: 300,
            intervalMs: 20,
            maxSeekAttempts: 3,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(targetSlot.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-10'));
    });

    it('reuses the same persistent host slot when hydration needs another attempt', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const slots = mountVirtualizedTurnSlots(14, [1, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));
        const scrollRoot = attachTestScrollRoot(adapter);
        const targetSlot = slots.userSlots.get(10);
        if (!targetSlot) throw new Error('target slot is missing');
        targetSlot.scrollIntoView = vi.fn(() => {
            if ((targetSlot.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length < 2) return;
            const anchor = slots.hydrateRound(10);
            anchor.scrollIntoView = vi.fn();
        });
        const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');

        try {
            const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 10 }, {
                timeoutMs: 300,
                intervalMs: 20,
                maxSeekAttempts: 3,
                alignmentTimeoutMs: 0,
            });
            await vi.advanceTimersByTimeAsync(100);
            const result = await resultPromise;
            const slotDiscoveryQueries = querySelectorAll.mock.calls.filter(
                ([selector]) => selector === '[data-turn-id-container]',
            );

            expect(result).toEqual({ ok: true });
            expect(targetSlot.scrollIntoView).toHaveBeenCalledTimes(2);
            expect(slotDiscoveryQueries).toHaveLength(1);
            expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
        } finally {
            querySelectorAll.mockRestore();
        }
    });

    it('keeps using the calibrated host slot during slow long-distance hydration instead of pixel fallback', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const slots = mountVirtualizedTurnSlots(14, [1, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));
        const scrollRoot = attachTestScrollRoot(adapter);
        const targetSlot = slots.userSlots.get(2);
        if (!targetSlot) throw new Error('target slot is missing');
        targetSlot.scrollIntoView = vi.fn(() => {
            if ((targetSlot.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length < 5) return;
            const anchor = slots.hydrateRound(2);
            anchor.scrollIntoView = vi.fn();
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 2 }, {
            timeoutMs: 500,
            intervalMs: 20,
            maxSeekAttempts: 8,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(520);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(targetSlot.scrollIntoView).toHaveBeenCalledTimes(5);
        expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
    });

    it('fails closed without pixel fallback when a calibrated host slot never hydrates', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const slots = mountVirtualizedTurnSlots(14, [1, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));
        const scrollRoot = attachTestScrollRoot(adapter);
        const targetSlot = slots.userSlots.get(2);
        if (!targetSlot) throw new Error('target slot is missing');
        targetSlot.scrollIntoView = vi.fn();

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 2 }, {
            timeoutMs: 200,
            intervalMs: 20,
            maxSeekAttempts: 4,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(220);
        const result = await resultPromise;

        expect(result).toEqual({ ok: false, message: 'Canonical target was not materialized' });
        expect(targetSlot.scrollIntoView).toHaveBeenCalledTimes(4);
        expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
    });

    it('keeps 200-round host-slot discovery single-pass and avoids pixel scrolling', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const slots = mountVirtualizedTurnSlots(200, [1, 199, 200]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(200));
        const scrollRoot = attachTestScrollRoot(adapter);
        const targetSlot = slots.userSlots.get(100);
        if (!targetSlot) throw new Error('target slot is missing');
        targetSlot.scrollIntoView = vi.fn(() => {
            const anchor = slots.hydrateRound(100);
            anchor.scrollIntoView = vi.fn();
        });
        const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');

        try {
            const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 100 }, {
                timeoutMs: 300,
                intervalMs: 20,
                maxSeekAttempts: 8,
                alignmentTimeoutMs: 0,
            });
            await vi.advanceTimersByTimeAsync(100);
            const result = await resultPromise;
            const slotDiscoveryQueries = querySelectorAll.mock.calls.filter(
                ([selector]) => selector === '[data-turn-id-container]',
            );

            expect(result).toEqual({ ok: true });
            expect(slotDiscoveryQueries).toHaveLength(1);
            expect(targetSlot.scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
        } finally {
            querySelectorAll.mockRestore();
        }
    });

    it('uses the bottom of the nearest mounted round before seeking to its next target', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));

        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 10010 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });
        const assistant = document.getElementById('assistant-1') as HTMLElement;
        assistant.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: 4960 - scrollRoot.scrollTop,
            top: 4960 - scrollRoot.scrollTop,
            left: 0,
            right: 100,
            bottom: 5000 - scrollRoot.scrollTop,
            width: 100,
            height: 40,
            toJSON: () => ({}),
        }));
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop >= 4900 && scrollRoot.scrollTop <= 5200) {
                mountRoleWindow([2, 3]);
                (document.getElementById('user-2') as HTMLElement).scrollIntoView = vi.fn();
                return;
            }
            mountRoleWindow([1]);
            const mountedAssistant = document.getElementById('assistant-1') as HTMLElement;
            mountedAssistant.getBoundingClientRect = assistant.getBoundingClientRect;
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 2 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-2'));
    });

    it('continues seeking through a non-contiguous virtualized window until the exact target appears', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 8, 9, 10]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(10));

        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 10010 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop < 5000) return;
            mountRoleWindow([4, 5, 6]);
            (document.getElementById('user-5') as HTMLElement).scrollIntoView = vi.fn();
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 5 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(scrollRoot.scrollTo).toHaveBeenCalledTimes(2);
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-5'));
    });

    it('uses the geometry of the nearest mounted anchors across an uneven-height gap', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 20010 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });
        const contentTopByPosition = new Map([
            [1, 0],
            [2, 400],
            [3, 2000],
            [8, 8000],
            [9, 12000],
            [10, 20000],
        ]);
        const mountMeasuredWindow = (positions: number[]): void => {
            mountRoleWindow(positions);
            for (const position of positions) {
                const anchor = document.getElementById(`user-${position}`) as HTMLElement;
                const contentTop = contentTopByPosition.get(position) ?? 0;
                anchor.getBoundingClientRect = vi.fn(() => ({
                    x: 0,
                    y: contentTop - scrollRoot.scrollTop,
                    top: contentTop - scrollRoot.scrollTop,
                    left: 0,
                    right: 100,
                    bottom: contentTop - scrollRoot.scrollTop + 40,
                    width: 100,
                    height: 40,
                    toJSON: () => ({}),
                }));
            }
        };
        mountMeasuredWindow([1, 2, 3, 8, 9, 10]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(10));
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop >= 4500 && scrollRoot.scrollTop <= 6500) {
                mountRoleWindow([4, 5, 6]);
                const target = document.getElementById('user-5') as HTMLElement;
                target.scrollIntoView = vi.fn();
                return;
            }
            mountMeasuredWindow([1, 2, 3, 8, 9, 10]);
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 5 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        const seekTops = (scrollRoot.scrollTo as ReturnType<typeof vi.fn>).mock.calls
            .map((call) => Number(call[0]?.top ?? 0));
        expect(seekTops.length).toBeGreaterThan(1);
        expect(seekTops.some((top) => top >= 4000 && top <= 4800)).toBe(true);
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-5'));
    });

    it('walks through an intermediate virtualized window instead of stopping after a large jump', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 3, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));

        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 41092 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop >= 30000 && scrollRoot.scrollTop <= 32000) {
                mountRoleWindow([10, 11, 13, 14]);
                (document.getElementById('user-10') as HTMLElement).scrollIntoView = vi.fn();
                return;
            }
            mountRoleWindow([1, 3, 13, 14]);
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 10 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(scrollRoot.scrollTo).toHaveBeenCalled();
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-10'));
    });

    it('re-centers from a later materialized window before probing back through a virtualized gap', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 3, 13, 14]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(14));

        const scrollRoot = document.createElement('div');
        Object.defineProperties(scrollRoot, {
            clientHeight: { configurable: true, value: 10 },
            scrollHeight: { configurable: true, value: 41092 },
            scrollTop: { configurable: true, writable: true, value: 40000 },
        });
        scrollRoot.scrollTo = vi.fn((options: ScrollToOptions) => {
            scrollRoot.scrollTop = Number(options.top ?? 0);
            if (scrollRoot.scrollTop >= 28500 && scrollRoot.scrollTop <= 31500) {
                mountRoleWindow([10, 11, 13, 14]);
                (document.getElementById('user-10') as HTMLElement).scrollIntoView = vi.fn();
                return;
            }
            mountRoleWindow([1, 3, 13, 14]);
        });
        adapter.getConversationScrollRoot = () => scrollRoot;

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 10 }, {
            timeoutMs: 300,
            intervalMs: 20,
            alignmentTimeoutMs: 0,
        });
        await vi.advanceTimersByTimeAsync(320);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(navigationMocks.highlightNavigationTarget).toHaveBeenCalledWith(document.getElementById('user-10'));
    });

    it('cancels materialization when the user takes over scrolling', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        mountRoleWindow([1, 2, 3, 4, 5, 6]);
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(60));
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
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(60));
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
        setCanonicalSnapshot(adapter, buildCanonicalSnapshot(60));
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
