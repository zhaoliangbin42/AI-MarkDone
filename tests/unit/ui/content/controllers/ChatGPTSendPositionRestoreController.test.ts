import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTSendPositionRestoreController } from '@/ui/content/controllers/ChatGPTSendPositionRestoreController';
import { armChatGPTSendPositionRestore, releaseChatGPTSendPositionRestore } from '@/drivers/content/chatgpt/sendPositionRestoreEvents';

const adapter = {
    getPlatformId: () => 'chatgpt',
    getMessageSelector: () => '[data-message]',
} as any;

const controllers: ChatGPTSendPositionRestoreController[] = [];

function createController(): ChatGPTSendPositionRestoreController {
    const controller = new ChatGPTSendPositionRestoreController(adapter);
    controllers.push(controller);
    return controller;
}

class FakeMutationObserver {
    static instances: FakeMutationObserver[] = [];
    callback: MutationCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: MutationCallback) {
        this.callback = callback;
        FakeMutationObserver.instances.push(this);
    }

    trigger(): void {
        this.callback([], this as any);
    }
}

function defineScrollRoot(el: HTMLElement, metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }): HTMLElement {
    let top = metrics.scrollTop;
    Object.defineProperties(el, {
        scrollTop: {
            configurable: true,
            get: () => top,
            set: (value) => {
                top = Number(value);
            },
        },
        scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
        clientHeight: { configurable: true, get: () => metrics.clientHeight },
    });
    el.style.overflowY = 'auto';
    return el;
}

function appendConversation(): HTMLElement {
    const root = defineScrollRoot(document.createElement('main'), {
        scrollTop: 100,
        scrollHeight: 2000,
        clientHeight: 500,
    });
    const anchor = document.createElement('div');
    anchor.dataset.message = '1';
    anchor.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 80,
        top: 80,
        left: 0,
        right: 100,
        bottom: 120,
        width: 100,
        height: 40,
        toJSON: () => ({}),
    }));
    root.appendChild(anchor);
    document.body.appendChild(root);
    return root;
}

describe('ChatGPTSendPositionRestoreController', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        FakeMutationObserver.instances = [];
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
        vi.useFakeTimers();
    });

    afterEach(() => {
        for (const controller of controllers.splice(0)) controller.dispose();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.documentElement.removeAttribute('data-aimd-chatgpt-send-restore-active');
    });

    it('does not register a MutationObserver while disabled', async () => {
        appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(false);

        armChatGPTSendPositionRestore();
        await vi.runOnlyPendingTimersAsync();

        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('arms from official Enter and restores a jump back to the saved scrollTop', async () => {
        const root = appendConversation();
        const composer = document.createElement('textarea');
        composer.id = 'prompt-textarea';
        document.body.appendChild(composer);
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.runOnlyPendingTimersAsync();

        expect(root.scrollTop).toBe(100);
        expect(FakeMutationObserver.instances).toHaveLength(1);
    });

    it('does not arm from official Enter when Enter-newline mode is enabled', async () => {
        const root = appendConversation();
        const composer = document.createElement('textarea');
        composer.id = 'prompt-textarea';
        document.body.appendChild(composer);
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        controller.setEnterKeyNewlineEnabled(true);

        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.runOnlyPendingTimersAsync();

        expect(root.scrollTop).toBe(1200);
        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('does not arm when already near the bottom', () => {
        const root = appendConversation();
        defineScrollRoot(root, { scrollTop: 1370, scrollHeight: 2000, clientHeight: 500 });
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();

        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('uses anchor delta when the saved anchor is still connected', async () => {
        const root = appendConversation();
        const anchor = root.querySelector<HTMLElement>('[data-message]')!;
        (anchor.getBoundingClientRect as any).mockReturnValueOnce({
            x: 0, y: 80, top: 80, left: 0, right: 100, bottom: 120, width: 100, height: 40, toJSON: () => ({}),
        }).mockReturnValue({
            x: 0, y: -420, top: -420, left: 0, right: 100, bottom: -380, width: 100, height: 40, toJSON: () => ({}),
        });
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        root.scrollTop = 1200;
        FakeMutationObserver.instances[0]!.trigger();
        await vi.runOnlyPendingTimersAsync();

        expect(root.scrollTop).toBe(700);
    });

    it('releases on explicit navigation and stops restoring', async () => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        releaseChatGPTSendPositionRestore();
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.runOnlyPendingTimersAsync();

        expect(root.scrollTop).toBe(1200);
        expect(FakeMutationObserver.instances[0]?.disconnect).toHaveBeenCalled();
    });

    it('releases after too many restore attempts', async () => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        for (let i = 0; i < 21; i += 1) {
            root.scrollTop = 1200;
            root.dispatchEvent(new Event('scroll'));
            await vi.runOnlyPendingTimersAsync();
        }

        expect(document.documentElement.getAttribute('data-aimd-chatgpt-send-restore-active')).toBe('false');
    });
});
