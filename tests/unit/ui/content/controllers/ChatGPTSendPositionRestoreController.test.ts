import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTSendPositionRestoreController } from '@/ui/content/controllers/ChatGPTSendPositionRestoreController';
import { ChatGPTComposerEditingController } from '@/ui/content/controllers/ChatGPTComposerEditingController';
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
        y: 180 - root.scrollTop,
        top: 180 - root.scrollTop,
        left: 0,
        right: 100,
        bottom: 220 - root.scrollTop,
        width: 100,
        height: 40,
        toJSON: () => ({}),
    }));
    root.appendChild(anchor);
    document.body.appendChild(root);
    return root;
}

function appendSendForm(): { form: HTMLFormElement; composer: HTMLTextAreaElement; button: HTMLButtonElement } {
    const form = document.createElement('form');
    const composer = document.createElement('textarea');
    composer.id = 'prompt-textarea';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.testid = 'send-button';
    form.append(composer, button);
    document.body.append(form);
    return { form, composer, button };
}

function setReadingPosition(root: HTMLElement, reversed: boolean): number {
    if (reversed) {
        root.style.display = 'flex';
        root.style.flexDirection = 'column-reverse';
    }
    const savedTop = reversed ? -900 : 100;
    root.scrollTop = savedTop;
    return savedTop;
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

    it('restores negative scroll positions after the real send-button event sequence in a reversed layout', async () => {
        const root = appendConversation();
        root.style.display = 'flex';
        root.style.flexDirection = 'column-reverse';
        root.scrollTop = -900;
        const button = document.createElement('button');
        button.setAttribute('aria-label', '发送');
        document.body.appendChild(button);
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        button.click();
        root.scrollTop = 0;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(-900);
    });

    it.each([0, -100])('does not capture a reversed container near its bottom (%s)', (top) => {
        const root = appendConversation();
        root.style.display = 'flex';
        root.style.flexDirection = 'column-reverse';
        root.scrollTop = top;
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

    it.each([false, true])('preserves the anchor when hydration already compensated its visual position (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const anchor = root.querySelector<HTMLElement>('[data-message]')!;
        let contentOffset = savedTop + 80;
        anchor.getBoundingClientRect = vi.fn(() => ({
            x: 0, y: contentOffset - root.scrollTop, top: contentOffset - root.scrollTop,
            left: 0, right: 100, bottom: contentOffset - root.scrollTop + 40,
            width: 100, height: 40, toJSON: () => ({}),
        }));
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        contentOffset += 300;
        root.scrollTop = savedTop + 300;
        FakeMutationObserver.instances[0]!.trigger();
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(savedTop + 300);
        expect(anchor.getBoundingClientRect().top).toBe(80);
    });

    it.each([false, true])('preserves reading offset after anchor replacement and reply growth (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const metrics = { scrollTop: savedTop, scrollHeight: 2000, clientHeight: 500 };
        defineScrollRoot(root, metrics);
        const anchor = root.querySelector<HTMLElement>('[data-message]')!;
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        anchor.replaceWith(anchor.cloneNode(true));
        metrics.scrollHeight += 700;
        root.scrollTop = reversed ? 0 : metrics.scrollHeight - metrics.clientHeight;
        FakeMutationObserver.instances[0]!.trigger();
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(reversed ? savedTop - 700 : savedTop);

        // The scrollable extent can also change when the viewport becomes taller.
        metrics.clientHeight += 100;
        root.scrollTop = reversed ? 0 : metrics.scrollHeight - metrics.clientHeight;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(reversed ? savedTop - 600 : savedTop);
    });

    it.each([
        { invalidation: 'hidden', reversed: false },
        { invalidation: 'hidden', reversed: true },
        { invalidation: 'moved outside root', reversed: false },
        { invalidation: 'moved outside root', reversed: true },
    ])('uses the fallback for a connected anchor $invalidation (reverse=$reversed)', async ({ invalidation, reversed }) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const metrics = { scrollTop: savedTop, scrollHeight: 2000, clientHeight: 500 };
        defineScrollRoot(root, metrics);
        const anchor = root.querySelector<HTMLElement>('[data-message]')!;
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        armChatGPTSendPositionRestore();

        if (invalidation === 'hidden') {
            anchor.style.display = 'none';
            anchor.getBoundingClientRect = vi.fn(() => ({
                x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
                width: 0, height: 0, toJSON: () => ({}),
            }));
        } else {
            document.body.append(anchor);
            anchor.getBoundingClientRect = vi.fn(() => ({
                x: 0, y: 10, top: 10, left: 0, right: 100, bottom: 50,
                width: 100, height: 40, toJSON: () => ({}),
            }));
        }
        expect(anchor.isConnected).toBe(true);
        metrics.scrollHeight += 700;
        root.scrollTop = reversed ? 0 : metrics.scrollHeight - metrics.clientHeight;
        FakeMutationObserver.instances[0]!.trigger();
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(reversed ? savedTop - 700 : savedTop);
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

    it.each([false, true])('captures before send-button focus and preserves it through click and submit (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const { form, button } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        // Native focus can move the conversation before the click handler runs.
        root.scrollTop = reversed ? 0 : 1500;
        root.dispatchEvent(new Event('scroll'));
        button.click();
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(savedTop);
        expect(FakeMutationObserver.instances).toHaveLength(1);
    });

    it.each([false, true])('keeps the original position when click and submit both arm (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const { form, button } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        button.click();
        root.scrollTop = reversed ? -300 : 1000;
        root.dispatchEvent(new Event('scroll'));
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(savedTop);
        expect(FakeMutationObserver.instances).toHaveLength(1);
    });

    it.each([false, true])('keeps keyboard and Reader before-send positions through later host signals (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const { form, composer, button } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        root.scrollTop = reversed ? -300 : 1000;
        armChatGPTSendPositionRestore();
        button.click();
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(savedTop);
        expect(FakeMutationObserver.instances).toHaveLength(1);
    });

    it('keeps an explicit before-send capture through the synthetic Enter used in newline mode', async () => {
        const root = appendConversation();
        const { composer } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        controller.setEnterKeyNewlineEnabled(true);

        armChatGPTSendPositionRestore();
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        expect(root.scrollTop).toBe(100);
    });

    it.each([false, true])('keeps Cmd/Ctrl+Enter sending from the real editing controller before composer focus (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const { form, composer } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        controller.setEnterKeyNewlineEnabled(true);
        const editing = new ChatGPTComposerEditingController({
            ...adapter,
            getComposerInputElement: () => composer,
        });
        editing.init();
        vi.spyOn(composer, 'focus').mockImplementation(() => {
            root.scrollTop = reversed ? 0 : 1500;
        });
        composer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.defaultPrevented) {
                form.dispatchEvent(new Event('submit', { bubbles: true }));
            }
        });
        try {
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
            root.dispatchEvent(new Event('scroll'));
            await vi.advanceTimersByTimeAsync(20);
            expect(root.scrollTop).toBe(savedTop);
        } finally {
            editing.dispose();
        }
    });

    it.each([false, true])('continues restoring through a long stream until user navigation (reverse=%s)', async (reversed) => {
        const root = appendConversation();
        const savedTop = setReadingPosition(root, reversed);
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        for (let i = 0; i < 25; i += 1) {
            root.scrollTop = reversed ? 0 : 1200;
            FakeMutationObserver.instances[0]!.trigger();
            root.dispatchEvent(new Event('scroll'));
            await vi.advanceTimersByTimeAsync(20);
            expect(root.scrollTop).toBe(savedTop);
        }
        expect(document.documentElement.getAttribute('data-aimd-chatgpt-send-restore-active')).toBe('true');

        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        root.scrollTop = reversed ? -400 : 600;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(reversed ? -400 : 600);
        expect(FakeMutationObserver.instances[0]!.disconnect).toHaveBeenCalled();
    });

    it.each(['pointerdown', 'touchmove', 'keydown'])('stops for intentional user interaction: %s', async (type) => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        document.dispatchEvent(type === 'keydown'
            ? new KeyboardEvent(type, { key: 'ArrowDown', bubbles: true })
            : new Event(type, { bubbles: true }));
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(1200);
        expect(FakeMutationObserver.instances[0]!.disconnect).toHaveBeenCalled();
    });

    it.each([
        { shiftKey: true },
        { isComposing: true },
        { keyCode: 229 },
    ])('does not treat modified or IME Enter as sending: %j', (options) => {
        appendConversation();
        const { composer } = appendSendForm();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...options }));
        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('does not capture a disabled send-button gesture', () => {
        appendConversation();
        const { button } = appendSendForm();
        button.disabled = true;
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('captures a new position after the user explicitly leaves the prior send session', async () => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        armChatGPTSendPositionRestore();
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        root.scrollTop = 600;
        armChatGPTSendPositionRestore();
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(600);
        expect(FakeMutationObserver.instances).toHaveLength(2);
    });

    it('cancels an already scheduled restoration when the feature is disabled', async () => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);
        armChatGPTSendPositionRestore();
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        controller.setEnabled(false);
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(1200);
        expect(FakeMutationObserver.instances[0]!.disconnect).toHaveBeenCalled();
    });

    it('releases at the bounded timeout even without a user interaction', async () => {
        const root = appendConversation();
        const controller = createController();
        controller.init();
        controller.setEnabled(true);

        armChatGPTSendPositionRestore();
        await vi.advanceTimersByTimeAsync(90_000);
        expect(document.documentElement.getAttribute('data-aimd-chatgpt-send-restore-active')).toBe('false');
        root.scrollTop = 1200;
        root.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);
        expect(root.scrollTop).toBe(1200);
    });
});
