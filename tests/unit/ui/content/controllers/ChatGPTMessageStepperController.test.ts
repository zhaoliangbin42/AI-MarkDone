import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatGPTMessageStepperController as ProductionChatGPTMessageStepperController } from '@/ui/content/controllers/ChatGPTMessageStepperController';
import { setLocale } from '@/ui/content/components/i18n';

const navigationMocks = vi.hoisted(() => ({
    collectChatGPTRoundPositions: vi.fn(),
    navigateChatGPTDirectoryTarget: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/ui/content/chatgptDirectory/navigation', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/ui/content/chatgptDirectory/navigation')>(),
    collectChatGPTRoundPositions: navigationMocks.collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget: navigationMocks.navigateChatGPTDirectoryTarget,
}));

let activeSurface: any;

class ChatGPTMessageStepperController extends ProductionChatGPTMessageStepperController {
    constructor(adapter: any, options: any = {}) {
        super(adapter, { surface: activeSurface, onNavigationControlsReady: (previous: HTMLButtonElement, next: HTMLButtonElement) => document.body.append(previous, next), ...options });
    }
}

function createRound(position: number, top: number, bottom: number) {
    const el = document.createElement('section');
    el.id = `round-${position}`;
    el.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: top,
        top,
        bottom,
        left: 0,
        right: 100,
        width: 100,
        height: bottom - top,
        toJSON: () => ({}),
    }));
    document.body.appendChild(el);
    return {
        position,
        id: `round-${position}`,
        messageId: `message-${position}`,
        roundId: `round-${position}`,
        userMessageId: `user-${position}`,
        assistantMessageId: `message-${position}`,
        userPromptText: `Prompt ${position}`,
        jumpAnchor: el,
        userAnchor: el,
        assistantRoot: el,
        groupEls: [el],
    };
}

function createNavigationTarget(position: number) {
    return {
        position,
        messageId: `message-${position}`,
        roundId: `round-${position}`,
        userMessageId: `user-${position}`,
        assistantMessageId: `message-${position}`,
    };
}

function setConversationUrl(): void {
    Object.defineProperty(window, 'location', {
        value: new URL('https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc'),
        configurable: true,
    });
}

async function waitForAnimationFrame(): Promise<void> {
    await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

describe('ChatGPTMessageStepperController', () => {
    const adapter = { getPlatformId: () => 'chatgpt' } as any;
    const controllers: ChatGPTMessageStepperController[] = [];
    let surfaceListener: (() => void) | null = null;
    let unsubscribeSurface = vi.fn();
    let surfaceDocument: any;
    const surface = {
        readFrame: () => ({
            frameToken: `frame:${surfaceDocument?.key ?? 'none'}`,
            surfaceToken: 'surface:test',
            contentKind: 'ready' as const,
            document: surfaceDocument,
            snapshot: null,
            projectionId: 'projection:test',
            contentToken: 'content:test',
            obtainedTurns: [],
            pendingSurfaces: [],
        }),
        subscribeFrame: vi.fn((listener: () => void) => {
            surfaceListener = listener;
            listener();
            return unsubscribeSurface;
        }),
        refreshSurface: vi.fn(),
        materialization: {} as any,
    };

    beforeEach(() => {
        setConversationUrl();
        navigationMocks.collectChatGPTRoundPositions.mockReset();
        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
        surfaceListener = null;
        unsubscribeSurface = vi.fn();
        surface.subscribeFrame.mockClear();
        surfaceDocument = {
            key: 'chatgpt:conversation:12345678-1234-1234-1234-123456789abc',
            platformId: 'chatgpt',
            identityKind: 'canonical',
            conversationId: '12345678-1234-1234-1234-123456789abc',
            canonicalUrl: 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        };
        activeSurface = surface;
        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -300, -100),
            createRound(2, 180, 420),
            createRound(3, 700, 920),
        ]);
    });

    afterEach(() => {
        for (const controller of controllers.splice(0)) controller.dispose();
        document.body.innerHTML = '';
    });

    it('shows the shared tooltip when a page control is hovered', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();
        const trigger = document.querySelector<HTMLElement>('#aimd-chatgpt-message-stepper [data-action="open-bookmarks-panel"]')!;
        trigger.getBoundingClientRect = vi.fn(() => ({
            left: 100, right: 130, top: 600, bottom: 630, width: 30, height: 30,
            x: 100, y: 600, toJSON: () => ({}),
        }));

        trigger.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
        await vi.waitFor(() => {
            expect(document.querySelector('.aimd-tooltip')?.textContent).toBe(trigger.getAttribute('aria-label'));
        });
    });

    it('pins the existing action, keeps it callable when collapsed, and respects visibility preferences', async () => {
        const onOpenInputEnhancement = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenInputEnhancement });
        controllers.push(controller); controller.init();
        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const trigger = host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')!;
        trigger.dispatchEvent(new Event('pointerenter'));
        controller.setPinnedActions(['open-input-enhancement']);
        expect(host.querySelector('[data-pin]')).toBeNull();
        host.dispatchEvent(new Event('pointerleave'));
        const action = host.querySelector<HTMLButtonElement>('[data-action="open-input-enhancement"]')!;
        expect(action.closest<HTMLElement>('.aimd-chatgpt-message-stepper__slot')!.hidden).toBe(false);
        action.click(); expect(onOpenInputEnhancement).toHaveBeenCalledWith(action);
        controller.setInputEnhancementControlVisible(false);
        expect(action.closest<HTMLElement>('.aimd-chatgpt-message-stepper__slot')!.hidden).toBe(true);
        controller.setInputEnhancementControlVisible(true);
        expect(action.closest<HTMLElement>('.aimd-chatgpt-message-stepper__slot')!.hidden).toBe(false);
        expect(host.querySelectorAll('[data-action="open-input-enhancement"]')).toHaveLength(1);
    });

    it('shows the effective enhancement state without changing its settings trigger or pinned node', () => {
        const onOpenInputEnhancement = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenInputEnhancement });
        controllers.push(controller);
        controller.setInputEnhancementEnabled(true);
        controller.init();
        controller.setPinnedActions(['open-input-enhancement']);
        const button = document.getElementById('aimd-chatgpt-message-stepper')!.querySelector<HTMLButtonElement>('[data-action="open-input-enhancement"]')!;
        expect(button.dataset.active).toBe('1');
        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        button.click();
        expect(onOpenInputEnhancement).toHaveBeenCalledWith(button);
        controller.setInputEnhancementEnabled(false);
        expect(button.dataset.active).toBe('0');
        expect(button.closest<HTMLElement>('.aimd-chatgpt-message-stepper__slot')!.hidden).toBe(false);
    });

    it('keeps the page controls floating when ChatGPT replaces the document head', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller); controller.init();
        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const trigger = host.querySelector<HTMLElement>('[data-action="open-bookmarks-panel"]')!;
        controller.setPinnedActions(['open-input-enhancement']);
        trigger.dispatchEvent(new Event('pointerenter'));

        document.getElementById('aimd-chatgpt-message-stepper-style')!.remove();
        document.getElementById('aimd-chatgpt-message-stepper-tokens')!.remove();
        surfaceListener?.();
        await waitForAnimationFrame();

        expect(document.getElementById('aimd-chatgpt-message-stepper')).toBe(host);
        expect(document.getElementById('aimd-chatgpt-message-stepper-style')?.textContent)
            .toContain('position: fixed;');
        expect(document.getElementById('aimd-chatgpt-message-stepper-tokens')?.textContent)
            .toContain('.aimd-chatgpt-message-stepper[data-aimd-theme="light"]');
        expect(getComputedStyle(host).position).toBe('fixed');
        expect(host.dataset.expanded).toBe('1');
        host.dispatchEvent(new Event('pointerleave'));
        expect(host.dataset.expanded).toBe('0');
        expect(host.dataset.hasPins).toBe('1');
        expect(getComputedStyle(host).position).toBe('fixed');
    });

    it('opens on hover and focus, preserves action order, and closes with Escape or an outside pointer', async () => {
        const onOpenBookmarksPanel = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenBookmarksPanel });
        controllers.push(controller);
        controller.init();
        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const trigger = host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')!;
        const actions = host.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__actions')!;
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(actions.hasAttribute('inert')).toBe(true);
        trigger.dispatchEvent(new Event('pointerenter'));
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(actions.hasAttribute('inert')).toBe(false);
        host.dispatchEvent(new Event('pointerleave'));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        trigger.focus();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(actions.querySelector('[data-action="open-bookmarks-panel"]')).toBeNull();
        const bookmark = trigger;
        bookmark.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        bookmark.click();
        expect(onOpenBookmarksPanel).toHaveBeenCalledOnce();
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.activeElement).toBe(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(onOpenBookmarksPanel).toHaveBeenCalledTimes(2);
        trigger.dispatchEvent(new Event('pointerenter'));
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('hands navigation controls to the directory and routes clicks around the active round', async () => {
        const onOpenBookmarksPanel = vi.fn();
        const onOpenDetachedReader = vi.fn(async () => undefined);
        const onOpenPrompts = vi.fn();
        const onRefreshMessageNavigation = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, {
            onOpenBookmarksPanel,
            onOpenDetachedReader,
            onOpenPrompts,
            onRefreshMessageNavigation,
        });
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const bookmarksPanel = host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')!;
        const split = host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')!;
        const prompts = host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')!;
        const messageNavigation = host.querySelector<HTMLButtonElement>('[data-action="chatgpt-refresh-message-navigation"]')!;
        const previous = document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')!;
        const next = document.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;

        expect(host).toBeTruthy();
        expect(Array.from(host.querySelectorAll<HTMLButtonElement>('.aimd-chatgpt-message-stepper__actions button[data-action]')).map((button) => button.dataset.action)).toEqual([
            'toggle-page-bookmark',
            'open-detached-reader',
            'open-prompts',
            'open-input-enhancement',
            'chatgpt-refresh-message-navigation',
        ]);
        expect(bookmarksPanel.getAttribute('aria-label')).toBe('Settings');
        expect(bookmarksPanel.querySelector('img')?.getAttribute('alt')).toBe('AI-MarkDone');
        expect(split.getAttribute('aria-label')).toBe('Open separate reader');
        expect(prompts.getAttribute('aria-label')).toBe('Prompts');
        expect(messageNavigation.getAttribute('aria-label')).toBe('Refresh message navigation');
        expect(previous.getAttribute('aria-label')).toBe('Previous message · ←');
        expect(next.getAttribute('aria-label')).toBe('Next message · →');
        expect(host.contains(previous)).toBe(false);
        expect(host.contains(next)).toBe(false);
        const style = document.getElementById('aimd-chatgpt-message-stepper-style')?.textContent ?? '';
        const tokens = document.getElementById('aimd-chatgpt-message-stepper-tokens')?.textContent ?? '';
        expect(tokens).toContain('.aimd-chatgpt-message-stepper[data-aimd-theme="light"]');
        expect(tokens).toContain('.aimd-chatgpt-message-stepper[data-aimd-theme="dark"]');
        expect(style).toContain('bottom: calc(var(--aimd-space-3) / 2);');
        expect(style).toContain('border-radius: var(--aimd-radius-full);');
        expect(style).toContain('background: var(--aimd-button-icon-hover);');
        expect(style).not.toContain('--aimd-ref-color-neutral-0');

        bookmarksPanel.click();
        expect(onOpenBookmarksPanel).toHaveBeenCalledTimes(1);
        split.click();
        await Promise.resolve();
        expect(onOpenDetachedReader).toHaveBeenCalledTimes(1);
        prompts.click();
        expect(onOpenPrompts).toHaveBeenCalledTimes(1);
        expect(onOpenPrompts).toHaveBeenCalledWith(prompts);

        previous.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenLastCalledWith(
            adapter,
            createNavigationTarget(1),
            { surface },
        );

        controller.dispose();
        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
        const nextController = new ChatGPTMessageStepperController(adapter);
        controllers.push(nextController);
        nextController.init();
        const nextHost = document.getElementById('aimd-chatgpt-message-stepper')!;
        const nextOnly = document.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;
        nextOnly.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenLastCalledWith(
            adapter,
            createNavigationTarget(3),
            { surface },
        );
    });

    it('exposes a message-navigation refresh action instead of the retired top-scroll action', async () => {
        const onRefreshMessageNavigation = vi.fn(async () => undefined);
        const controller = new ChatGPTMessageStepperController(adapter, { onRefreshMessageNavigation });
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const button = host.querySelector<HTMLButtonElement>('[data-action="chatgpt-refresh-message-navigation"]');

        expect(button).toBeTruthy();
        expect(host.querySelector('[data-action="chatgpt-scroll-to-top"]')).toBeNull();
        button?.click();
        await Promise.resolve();
        expect(onRefreshMessageNavigation).toHaveBeenCalledTimes(1);
    });

    it('keeps page bookmarks unavailable without an id and restores them after identity promotion', async () => {
        const mounted = createRound(1, 120, 500);
        const pageDocument = {
            key: 'chatgpt:page:stepper-test',
            platformId: 'chatgpt',
            identityKind: 'page' as const,
            conversationId: null,
            canonicalUrl: 'https://chatgpt.com/',
        };
        const canonicalDocument = {
            key: 'chatgpt:conversation:conversation-stepper',
            platformId: 'chatgpt',
            identityKind: 'canonical' as const,
            conversationId: 'conversation-stepper',
            canonicalUrl: 'https://chatgpt.com/c/conversation-stepper',
        };
        const buildFrame = (documentRef: typeof pageDocument | typeof canonicalDocument) => ({
            frameToken: `frame:${documentRef.key}`,
            surfaceToken: 'surface:1',
            contentKind: 'ready' as const,
            document: documentRef,
            snapshot: null,
            projectionId: 'projection:1',
            contentToken: 'content:1',
            obtainedTurns: [{
                status: 'obtained' as const,
                turn: {
                    key: 'turn-1:assistant-1',
                    ordinal: 1,
                    identity: { turnId: 'round-1', userMessageId: 'user-1', assistantMessageId: 'message-1' },
                    userText: 'Prompt 1',
                    assistantMarkdown: 'Answer 1',
                },
                target: {
                    documentKey: documentRef.key,
                    turnId: 'round-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'message-1',
                },
                materialization: {
                    anchorElement: mounted.jumpAnchor,
                    messageElement: mounted.assistantRoot,
                    jumpAnchorElement: mounted.jumpAnchor,
                    userElement: mounted.userAnchor,
                    assistantElement: mounted.assistantRoot,
                    groupElements: mounted.groupEls,
                },
            }],
            pendingSurfaces: [],
        });
        let frame = buildFrame(pageDocument);
        const listeners = new Set<(next: any) => void>();
        const surface = {
            readFrame: () => frame,
            subscribeFrame: (listener: (next: any) => void) => {
                listeners.add(listener);
                listener(frame);
                return () => listeners.delete(listener);
            },
            refreshSurface: vi.fn(),
            materialization: {} as any,
        };
        const onTogglePageBookmark = vi.fn(async () => ({ ok: true as const, saved: true }));
        const onRefreshPageBookmarkState = vi.fn(async () => ({ ok: true as const, saved: false }));
        const controller = new ChatGPTMessageStepperController(adapter, {
            surface,
            onTogglePageBookmark,
            onRefreshPageBookmarkState,
        });
        controllers.push(controller);
        controller.init();

        const pageBookmark = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(pageBookmark.hidden).toBe(true);
        pageBookmark.click();
        await Promise.resolve();
        expect(onTogglePageBookmark).not.toHaveBeenCalled();
        expect(onRefreshPageBookmarkState).not.toHaveBeenCalled();

        frame = buildFrame(canonicalDocument);
        listeners.forEach((listener) => listener(frame));
        await waitForAnimationFrame();
        await Promise.resolve();

        expect(pageBookmark.hidden).toBe(false);
        expect(onRefreshPageBookmarkState).toHaveBeenCalledWith(canonicalDocument.canonicalUrl);
    });

    it('refreshes every page-control label after a locale change', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const locale = String(url).includes('/zh_CN/') ? 'zh_CN' : 'en';
            const messages = JSON.parse(readFileSync(resolve(process.cwd(), `public/_locales/${locale}/messages.json`), 'utf8'));
            return { ok: true, json: async () => messages } as Response;
        }));
        await setLocale('en');
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        await setLocale('zh_CN');

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(host.querySelector('[data-action="open-bookmarks-panel"]')?.getAttribute('aria-label')).toBe('设置');
        expect(host.querySelector('[data-action="toggle-page-bookmark"]')?.getAttribute('aria-label')).toBe('收藏当前页面');
        expect(host.querySelector('[data-action="open-detached-reader"]')?.getAttribute('aria-label')).toBe('打开独立阅读器');
        expect(host.querySelector('[data-action="open-prompts"]')?.getAttribute('aria-label')).toBe('提示词');
        expect(host.querySelector('[data-action="chatgpt-refresh-message-navigation"]')?.getAttribute('aria-label')).toBe('刷新消息导航');
        expect(document.querySelector('[data-action="previous-message"]')?.getAttribute('aria-label')).toBe('上一条消息 · ←');
        expect(document.querySelector('[data-action="next-message"]')?.getAttribute('aria-label')).toBe('下一条消息 · →');

        await setLocale('en');
        vi.unstubAllGlobals();
    });

    it('keeps boundary buttons disabled at the first and last visible rounds', async () => {
        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, 120, 500),
            createRound(2, 720, 900),
        ]);
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(true);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(false);

        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -420, -120),
            createRound(2, 120, 500),
        ]);
        window.dispatchEvent(new Event('scroll'));
        await waitForAnimationFrame();

        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(true);
    });

    it('refreshes through the shared round-change subscription when a new final round appears', async () => {
        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -420, -120),
            createRound(2, 120, 500),
        ]);
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        const next = document.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;
        expect(next.disabled).toBe(true);

        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -420, -120),
            createRound(2, 120, 500),
            createRound(3, 720, 900),
        ]);
        surfaceListener?.();
        await waitForAnimationFrame();

        expect(next.disabled).toBe(false);
        controller.dispose();
        expect(unsubscribeSurface).toHaveBeenCalledTimes(1);
    });

    it('keeps the detached Reader button available when message step buttons are hidden', async () => {
        const onOpenDetachedReader = vi.fn(async () => undefined);
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenDetachedReader });
        controllers.push(controller);
        controller.init();
        controller.setVisible(false);

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const split = host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')!;
        const previous = document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')!;
        const next = document.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;

        expect(host.dataset.visible).toBe('1');
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.hidden).toBe(false);
        expect(split.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
        expect(previous.hidden).toBe(true);
        expect(next.hidden).toBe(true);

        split.click();
        await Promise.resolve();
        expect(onOpenDetachedReader).toHaveBeenCalledTimes(1);

        previous.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).not.toHaveBeenCalled();
    });

    it('keeps the lower-right page controls visible when no message rounds are present', async () => {
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/'),
            configurable: true,
        });
        surfaceDocument = {
            key: 'chatgpt:page:stepper-empty',
            platformId: 'chatgpt',
            identityKind: 'page',
            conversationId: null,
            canonicalUrl: 'https://chatgpt.com/',
        };
        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([]);
        const onOpenBookmarksPanel = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenBookmarksPanel });
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;

        expect(host.dataset.visible).toBe('1');
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')?.hidden).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(true);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(true);

        host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.click();
        expect(onOpenBookmarksPanel).toHaveBeenCalledTimes(1);
    });

    it('uses the Runtime-bound snapshot for page identity when the visible URL has no conversation segment', async () => {
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/workspace/shell'),
            configurable: true,
        });
        const onRefreshPageBookmarkState = vi.fn(async () => ({ ok: true as const, saved: false }));
        const controller = new ChatGPTMessageStepperController(adapter, { onRefreshPageBookmarkState });
        controllers.push(controller);

        controller.init();
        await Promise.resolve();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(button.hidden).toBe(false);
        expect(onRefreshPageBookmarkState).toHaveBeenCalledWith(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        );
    });

    it('lets settings hide the page bookmark button without hiding other controls', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        controller.setPageBookmarkControlVisible(false);

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(host.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')?.hidden).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
    });

    it('lets settings hide Split View and Prompts without hiding navigation buttons', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        controller.setDetachedReaderControlVisible(false);
        controller.setPromptControlVisible(false);

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);

        controller.setDetachedReaderControlVisible(true);
        controller.setPromptControlVisible(true);

        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
    });

    it('toggles page bookmark state through the lower-right button', async () => {
        const onTogglePageBookmark = vi.fn(async () => ({ ok: true as const, saved: true }));
        const controller = new ChatGPTMessageStepperController(adapter, {
            onRefreshPageBookmarkState: async () => ({ ok: true, saved: false }),
            onTogglePageBookmark,
        });
        controllers.push(controller);
        controller.init();
        await Promise.resolve();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(button.dataset.active).toBe('0');

        button.click();
        await Promise.resolve();

        expect(onTogglePageBookmark).toHaveBeenCalledTimes(1);
        expect(onTogglePageBookmark).toHaveBeenCalledWith(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        );
        expect(button.dataset.active).toBe('1');
        expect(button.getAttribute('aria-label')).toBe('Remove page bookmark');
    });

    it('keeps page bookmark state unknown and exposes the error when status refresh fails', async () => {
        const onRefreshPageBookmarkState = vi.fn(async () => ({
            ok: false as const,
            message: 'Extension context invalidated.',
        }));
        const controller = new ChatGPTMessageStepperController(adapter, { onRefreshPageBookmarkState });
        controllers.push(controller);
        controller.init();

        await Promise.resolve();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(onRefreshPageBookmarkState).toHaveBeenCalledWith(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        );
        expect(button.dataset.active).toBe('unknown');
        expect(button.dataset.bookmarkState).toBe('error');
        expect(button.getAttribute('aria-pressed')).toBeNull();
        expect(button.dataset.tooltip).toBe('Extension context invalidated.');
    });

    it('prevents duplicate page bookmark clicks and exposes mutation failures without changing last-known state', async () => {
        let resolveToggle!: (result: { ok: false; message: string }) => void;
        const onTogglePageBookmark = vi.fn(() => new Promise<{ ok: false; message: string }>((resolve) => {
            resolveToggle = resolve;
        }));
        const controller = new ChatGPTMessageStepperController(adapter, {
            onRefreshPageBookmarkState: async () => ({ ok: true, saved: false }),
            onTogglePageBookmark,
        });
        controllers.push(controller);
        controller.init();
        await Promise.resolve();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(button.dataset.active).toBe('0');

        button.click();
        button.click();

        expect(onTogglePageBookmark).toHaveBeenCalledTimes(1);
        expect(onTogglePageBookmark).toHaveBeenCalledWith(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        );
        expect(button.disabled).toBe(true);

        resolveToggle({ ok: false, message: 'Could not save bookmark.' });
        await Promise.resolve();
        await Promise.resolve();

        expect(button.disabled).toBe(false);
        expect(button.dataset.active).toBe('0');
        expect(button.dataset.bookmarkState).toBe('error');
        expect(button.dataset.tooltip).toBe('Could not save bookmark.');
        expect(document.body.querySelector<HTMLElement>('.aimd-toast')?.textContent).toContain('Could not save bookmark.');
    });

    it('ignores a page bookmark mutation result after the Runtime binds another conversation', async () => {
        let resolveToggle!: (result: { ok: true; saved: boolean }) => void;
        const onTogglePageBookmark = vi.fn(() => new Promise<{ ok: true; saved: boolean }>((resolve) => {
            resolveToggle = resolve;
        }));
        const controller = new ChatGPTMessageStepperController(adapter, {
            onRefreshPageBookmarkState: async () => ({ ok: true, saved: false }),
            onTogglePageBookmark,
        });
        controllers.push(controller);
        controller.init();
        await Promise.resolve();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        button.click();

        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/c/87654321-4321-4321-4321-cba987654321'),
            configurable: true,
        });
        surfaceDocument = {
            key: 'chatgpt:conversation:87654321-4321-4321-4321-cba987654321',
            platformId: 'chatgpt',
            identityKind: 'canonical',
            conversationId: '87654321-4321-4321-4321-cba987654321',
            canonicalUrl: 'https://chatgpt.com/c/87654321-4321-4321-4321-cba987654321',
        };
        surfaceListener?.();
        await waitForAnimationFrame();
        await Promise.resolve();

        resolveToggle({ ok: true, saved: true });
        await Promise.resolve();
        await Promise.resolve();

        expect(onTogglePageBookmark).toHaveBeenCalledWith(
            'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
        );
        expect(button.disabled).toBe(false);
        expect(button.dataset.active).toBe('0');
        expect(button.dataset.bookmarkState).toBe('unsaved');
    });

    it('uses left and right arrow keys for message navigation outside editable targets', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        document.dispatchEvent(event);
        await Promise.resolve();

        expect(event.defaultPrevented).toBe(true);
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            adapter,
            createNavigationTarget(3),
            { surface },
        );
    });

    it('keeps repeated arrow-key steps aligned with the last requested target while scrolling settles', async () => {
        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -500, -260),
            createRound(2, 180, 420),
            createRound(3, 720, 960),
            createRound(4, 1180, 1420),
        ]);
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenNthCalledWith(
            1,
            adapter,
            createNavigationTarget(3),
            { surface },
        );
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenNthCalledWith(
            2,
            adapter,
            createNavigationTarget(4),
            { surface },
        );
    });

    it('does not intercept arrow keys from editable targets or modified keyboard input', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true }));
        document.body.appendChild(Object.assign(document.createElement('div'), { contentEditable: 'true' }));
        const editable = document.body.lastElementChild as HTMLElement;
        editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(navigationMocks.navigateChatGPTDirectoryTarget).not.toHaveBeenCalled();
    });

    it('lets settings disable keyboard navigation without disabling the visible buttons', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();
        controller.setKeyboardEnabled(false);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).not.toHaveBeenCalled();

        document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            adapter,
            createNavigationTarget(3),
            { surface },
        );
    });

    it('lets settings hide Previous/Next without hiding Split View or disabling keyboard navigation', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        expect(document.getElementById('aimd-chatgpt-message-stepper')).toBeTruthy();

        controller.setVisible(false);

        const hiddenHost = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(hiddenHost).toBeTruthy();
        expect(hiddenHost.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.hidden).toBe(false);
        expect(hiddenHost.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(hiddenHost.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(true);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            adapter,
            createNavigationTarget(3),
            { surface },
        );

        controller.setVisible(true);

        const visibleHost = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(document.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(document.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
    });
});
