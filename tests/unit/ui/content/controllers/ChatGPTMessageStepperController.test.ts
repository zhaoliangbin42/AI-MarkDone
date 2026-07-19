import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatGPTMessageStepperController } from '@/ui/content/controllers/ChatGPTMessageStepperController';
import { setLocale } from '@/ui/content/components/i18n';

const navigationMocks = vi.hoisted(() => ({
    collectChatGPTRoundPositions: vi.fn(),
    navigateChatGPTDirectoryTarget: vi.fn(async () => ({ ok: true })),
}));

const roundChangeMocks = vi.hoisted(() => ({
    subscribe: vi.fn(),
}));

vi.mock('@/ui/content/chatgptDirectory/navigation', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/ui/content/chatgptDirectory/navigation')>(),
    collectChatGPTRoundPositions: navigationMocks.collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget: navigationMocks.navigateChatGPTDirectoryTarget,
}));

vi.mock('@/drivers/content/chatgpt/ChatGPTConversationIndex', () => ({
    getChatGPTConversationIndex: () => ({ subscribe: roundChangeMocks.subscribe }),
}));

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
    let roundChangeListener: (() => void) | null = null;
    let unsubscribeRoundChanges = vi.fn();

    beforeEach(() => {
        setConversationUrl();
        navigationMocks.collectChatGPTRoundPositions.mockReset();
        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
        roundChangeListener = null;
        unsubscribeRoundChanges = vi.fn();
        roundChangeMocks.subscribe.mockReset();
        roundChangeMocks.subscribe.mockImplementation((listener: () => void) => {
            roundChangeListener = listener;
            return unsubscribeRoundChanges;
        });
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

    it('renders left and right message step buttons and routes clicks around the active round', async () => {
        const onOpenBookmarksPanel = vi.fn();
        const onOpenDetachedReader = vi.fn(async () => undefined);
        const onOpenPrompts = vi.fn();
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenBookmarksPanel, onOpenDetachedReader, onOpenPrompts });
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const bookmarksPanel = host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')!;
        const split = host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')!;
        const prompts = host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')!;
        const previous = host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')!;
        const next = host.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;

        expect(host).toBeTruthy();
        expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).map((button) => button.dataset.action)).toEqual([
            'open-bookmarks-panel',
            'toggle-page-bookmark',
            'open-detached-reader',
            'open-prompts',
            'previous-message',
            'next-message',
        ]);
        expect(bookmarksPanel.getAttribute('aria-label')).toBe('Bookmarks');
        expect(bookmarksPanel.querySelector('img')?.getAttribute('alt')).toBe('AI-MarkDone');
        expect(split.getAttribute('aria-label')).toBe('Open Reader in split view');
        expect(prompts.getAttribute('aria-label')).toBe('Prompts');
        expect(previous.getAttribute('aria-label')).toBe('Previous message');
        expect(next.getAttribute('aria-label')).toBe('Next message');
        const style = document.getElementById('aimd-chatgpt-message-stepper-style')?.textContent ?? '';
        const tokens = document.getElementById('aimd-chatgpt-message-stepper-tokens')?.textContent ?? '';
        expect(tokens).toContain('.aimd-chatgpt-message-stepper[data-aimd-theme="light"]');
        expect(tokens).toContain('.aimd-chatgpt-message-stepper[data-aimd-theme="dark"]');
        expect(style).toContain('bottom: 0;');
        expect(style).toContain('border-radius: var(--aimd-radius-lg);');
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
        );

        controller.dispose();
        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
        const nextController = new ChatGPTMessageStepperController(adapter);
        controllers.push(nextController);
        nextController.init();
        const nextHost = document.getElementById('aimd-chatgpt-message-stepper')!;
        const nextOnly = nextHost.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;
        nextOnly.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenLastCalledWith(
            adapter,
            createNavigationTarget(3),
        );
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
        expect(host.querySelector('[data-action="open-bookmarks-panel"]')?.getAttribute('aria-label')).toBe('书签');
        expect(host.querySelector('[data-action="toggle-page-bookmark"]')?.getAttribute('aria-label')).toBe('收藏当前页面');
        expect(host.querySelector('[data-action="open-detached-reader"]')?.getAttribute('aria-label')).toBe('在分屏中打开阅读器');
        expect(host.querySelector('[data-action="open-prompts"]')?.getAttribute('aria-label')).toBe('提示词');
        expect(host.querySelector('[data-action="previous-message"]')?.getAttribute('aria-label')).toBe('上一条消息');
        expect(host.querySelector('[data-action="next-message"]')?.getAttribute('aria-label')).toBe('下一条消息');

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
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(false);

        navigationMocks.collectChatGPTRoundPositions.mockReturnValue([
            createRound(1, -420, -120),
            createRound(2, 120, 500),
        ]);
        window.dispatchEvent(new Event('scroll'));
        await waitForAnimationFrame();

        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(true);
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
        roundChangeListener?.();
        await waitForAnimationFrame();

        expect(next.disabled).toBe(false);
        controller.dispose();
        expect(unsubscribeRoundChanges).toHaveBeenCalledTimes(1);
    });

    it('keeps the detached Reader button available when message step buttons are hidden', async () => {
        const onOpenDetachedReader = vi.fn(async () => undefined);
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenDetachedReader });
        controllers.push(controller);
        controller.init();
        controller.setVisible(false);

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const split = host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')!;
        const previous = host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')!;
        const next = host.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;

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
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.disabled).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.disabled).toBe(true);

        host.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.click();
        expect(onOpenBookmarksPanel).toHaveBeenCalledTimes(1);
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
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
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
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);

        controller.setDetachedReaderControlVisible(true);
        controller.setPromptControlVisible(true);

        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-prompts"]')?.hidden).toBe(false);
    });

    it('toggles page bookmark state through the lower-right button', async () => {
        const onTogglePageBookmark = vi.fn(async () => ({ saved: true }));
        const controller = new ChatGPTMessageStepperController(adapter, { onTogglePageBookmark });
        controllers.push(controller);
        controller.init();

        const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-page-bookmark"]')!;
        expect(button.dataset.active).toBe('0');

        button.click();
        await Promise.resolve();

        expect(onTogglePageBookmark).toHaveBeenCalledTimes(1);
        expect(button.dataset.active).toBe('1');
        expect(button.getAttribute('aria-label')).toBe('Remove page bookmark');
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
        );
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenNthCalledWith(
            2,
            adapter,
            createNavigationTarget(4),
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
        expect(hiddenHost.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(true);
        expect(hiddenHost.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            adapter,
            createNavigationTarget(3),
        );

        controller.setVisible(true);

        const visibleHost = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(visibleHost.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(visibleHost.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
    });
});
