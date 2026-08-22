import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTTopScrollController } from '@/ui/content/controllers/ChatGPTTopScrollController';

function createScrollRoot(): HTMLElement & {
    scrollTo: ReturnType<typeof vi.fn>;
    setHeight: (value: number) => void;
} {
    const root = document.createElement('div') as HTMLElement & {
        scrollTo: ReturnType<typeof vi.fn>;
        setHeight: (value: number) => void;
    };
    let scrollHeight = 10_000;
    Object.defineProperties(root, {
        clientHeight: { configurable: true, value: 700 },
        scrollHeight: {
            configurable: true,
            get: () => scrollHeight,
        },
        scrollTop: { configurable: true, writable: true, value: 8_000 },
    });
    root.scrollTo = vi.fn((options: ScrollToOptions) => {
        root.scrollTop = Number(options.top ?? 0);
    });
    root.setHeight = (value: number) => {
        scrollHeight = value;
    };
    return root;
}

function createTopButton(): HTMLButtonElement {
    const host = document.createElement('div');
    host.dataset.aimdRole = 'chatgpt-message-stepper';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'chatgpt-scroll-to-top';
    host.appendChild(button);
    document.body.appendChild(host);
    return button;
}

describe('ChatGPTTopScrollController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('jumps immediately, retries after async history moves the root, and completes after quiet top', async () => {
        const root = createScrollRoot();
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getConversationScrollRoot: () => root,
        };
        const controller = new ChatGPTTopScrollController(adapter as any);
        controller.init();
        const button = createTopButton();
        controller.bindButton(button);
        button.click();
        expect(root.scrollTo).toHaveBeenNthCalledWith(1, { top: 0, behavior: 'auto' });
        expect(button.dataset.running).toBe('1');

        root.scrollTop = 2_000;
        root.setHeight(12_000);
        await vi.advanceTimersByTimeAsync(100);
        expect(root.scrollTo).toHaveBeenCalledTimes(2);
        expect(root.scrollTop).toBe(0);

        await vi.advanceTimersByTimeAsync(3_100);
        expect(button.dataset.running).toBe('0');
        controller.dispose();
    });

    it('binds the existing stepper slot without creating another host', () => {
        const root = createScrollRoot();
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getConversationScrollRoot: () => root,
        };
        const controller = new ChatGPTTopScrollController(adapter as any);
        controller.init();
        const button = createTopButton();
        controller.bindButton(button);

        expect(document.querySelector('#aimd-chatgpt-top-scroll')).toBeNull();
        expect(button.dataset.running).toBe('0');
        controller.dispose();
        expect(button.isConnected).toBe(true);
    });

    it('allows mouse movement, pointer press, and touchstart, but stops on click, wheel, or keyboard input', async () => {
        const root = createScrollRoot();
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getConversationScrollRoot: () => root,
        };
        const controller = new ChatGPTTopScrollController(adapter as any);
        controller.init();
        const button = createTopButton();
        controller.bindButton(button);

        button.click();
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        document.dispatchEvent(new Event('touchstart', { bubbles: true }));
        expect(button.dataset.running).toBe('1');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(button.dataset.running).toBe('0');

        button.click();
        expect(button.dataset.running).toBe('1');
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(button.dataset.running).toBe('0');

        button.click();
        expect(button.dataset.running).toBe('1');
        document.dispatchEvent(new Event('wheel'));
        expect(button.dataset.running).toBe('0');

        button.click();
        expect(button.dataset.running).toBe('1');
        button.click();
        expect(button.dataset.running).toBe('0');
        const callsAfterTakeover = root.scrollTo.mock.calls.length;
        await vi.advanceTimersByTimeAsync(1_000);
        expect(root.scrollTo).toHaveBeenCalledTimes(callsAfterTakeover);
        controller.dispose();
    });

    it('stops at the configured deadline when the page never reaches the top', async () => {
        const root = createScrollRoot();
        root.scrollTo.mockImplementation(() => {
            root.scrollTop = 2;
        });
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getConversationScrollRoot: () => root,
        };
        const controller = new ChatGPTTopScrollController(adapter as any);
        controller.setTimeoutMs(5_000);
        controller.init();
        const button = createTopButton();
        controller.bindButton(button);
        button.click();
        await vi.advanceTimersByTimeAsync(5_000);

        expect(button.dataset.running).toBe('0');
        expect(root.scrollTo.mock.calls.length).toBeGreaterThan(1);
        controller.dispose();
    });

    it('uses the twenty-second default deadline', async () => {
        const root = createScrollRoot();
        root.scrollTo.mockImplementation(() => {
            root.scrollTop = 2;
        });
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getConversationScrollRoot: () => root,
        };
        const controller = new ChatGPTTopScrollController(adapter as any);
        controller.init();
        const button = createTopButton();
        controller.bindButton(button);
        button.click();

        await vi.advanceTimersByTimeAsync(19_900);
        expect(button.dataset.running).toBe('1');
        await vi.advanceTimersByTimeAsync(100);
        expect(button.dataset.running).toBe('0');
        controller.dispose();
    });
});
