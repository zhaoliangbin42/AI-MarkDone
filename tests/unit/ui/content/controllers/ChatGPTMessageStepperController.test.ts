import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTMessageStepperController } from '@/ui/content/controllers/ChatGPTMessageStepperController';

const navigationMocks = vi.hoisted(() => ({
    collectChatGPTRoundPositions: vi.fn(),
    navigateChatGPTDirectoryTarget: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/ui/content/chatgptDirectory/navigation', () => ({
    collectChatGPTRoundPositions: navigationMocks.collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget: navigationMocks.navigateChatGPTDirectoryTarget,
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
        userPromptText: `Prompt ${position}`,
        jumpAnchor: el,
        userAnchor: el,
        assistantRoot: el,
        groupEls: [el],
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

    beforeEach(() => {
        setConversationUrl();
        navigationMocks.collectChatGPTRoundPositions.mockReset();
        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
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
        const onOpenDetachedReader = vi.fn(async () => undefined);
        const controller = new ChatGPTMessageStepperController(adapter, { onOpenDetachedReader });
        controllers.push(controller);
        controller.init();

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        const split = host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')!;
        const previous = host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')!;
        const next = host.querySelector<HTMLButtonElement>('[data-action="next-message"]')!;

        expect(host).toBeTruthy();
        expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).map((button) => button.dataset.action)).toEqual([
            'open-detached-reader',
            'previous-message',
            'next-message',
        ]);
        expect(split.getAttribute('aria-label')).toBe('Open Reader in split view');
        expect(previous.getAttribute('aria-label')).toBe('Previous message');
        expect(next.getAttribute('aria-label')).toBe('Next message');
        const style = document.getElementById('aimd-chatgpt-message-stepper-style')?.textContent ?? '';
        expect(style).toContain('bottom: 0;');
        expect(style).toContain('border-radius: var(--aimd-radius-lg);');
        expect(style).toContain('background: var(--aimd-button-icon-hover);');

        split.click();
        await Promise.resolve();
        expect(onOpenDetachedReader).toHaveBeenCalledTimes(1);

        previous.click();
        await Promise.resolve();
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenLastCalledWith(
            adapter,
            { position: 1, messageId: 'message-1' },
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
            { position: 3, messageId: 'message-3' },
        );
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
            { position: 3, messageId: 'message-3' },
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
            { position: 3, messageId: 'message-3' },
        );
        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenNthCalledWith(
            2,
            adapter,
            { position: 4, messageId: 'message-4' },
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
            { position: 3, messageId: 'message-3' },
        );
    });

    it('lets settings hide Previous/Next without hiding Split View or disabling keyboard navigation', async () => {
        const controller = new ChatGPTMessageStepperController(adapter);
        controllers.push(controller);
        controller.init();

        expect(document.getElementById('aimd-chatgpt-message-stepper')).toBeTruthy();

        controller.setVisible(false);

        const host = document.getElementById('aimd-chatgpt-message-stepper')!;
        expect(host).toBeTruthy();
        expect(host.querySelector<HTMLButtonElement>('[data-action="open-detached-reader"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(true);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(true);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(navigationMocks.navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            adapter,
            { position: 3, messageId: 'message-3' },
        );

        controller.setVisible(true);

        expect(host.querySelector<HTMLButtonElement>('[data-action="previous-message"]')?.hidden).toBe(false);
        expect(host.querySelector<HTMLButtonElement>('[data-action="next-message"]')?.hidden).toBe(false);
    });
});
