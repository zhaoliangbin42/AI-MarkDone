import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTComposerEnterController } from '@/ui/content/controllers/ChatGPTComposerEnterController';
import { armChatGPTSendPositionRestore } from '@/drivers/content/chatgpt/sendPositionRestoreEvents';

vi.mock('@/drivers/content/chatgpt/sendPositionRestoreEvents', () => ({
    armChatGPTSendPositionRestore: vi.fn(),
}));

class FakeMutationObserver {
    static instances: FakeMutationObserver[] = [];
    callback: MutationCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: MutationCallback) {
        this.callback = callback;
        FakeMutationObserver.instances.push(this);
    }

    trigger(records: MutationRecord[] = []): void {
        this.callback(records, this as any);
    }
}

function createAdapter(inputRef: { current: HTMLElement | HTMLTextAreaElement | HTMLInputElement | null }) {
    return {
        getComposerInputElement: () => inputRef.current,
    } as any;
}

describe('ChatGPTComposerEnterController', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        FakeMutationObserver.instances = [];
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
        vi.useFakeTimers();
        vi.mocked(armChatGPTSendPositionRestore).mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('leaves plain Enter alone while disabled', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEnterController(createAdapter({ current: composer }));
        controller.init();
        controller.setEnabled(false);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    it('converts plain Enter in contenteditable composer into native Shift+Enter events', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEnterController(createAdapter({ current: composer }));
        const shiftedEvents: string[] = [];
        composer.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).shiftKey) shiftedEvents.push('keydown');
        });
        composer.addEventListener('keypress', (event) => {
            if ((event as KeyboardEvent).shiftKey) shiftedEvents.push('keypress');
        });
        composer.addEventListener('keyup', (event) => {
            if ((event as KeyboardEvent).shiftKey) shiftedEvents.push('keyup');
        });
        controller.init();
        controller.setEnabled(true);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(shiftedEvents).toEqual(['keydown', 'keypress', 'keyup']);
    });

    it('does not convert Shift/Alt Enter or composing Enter', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEnterController(createAdapter({ current: composer }));
        controller.init();
        controller.setEnabled(true);

        const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
        const altEnter = new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true });
        const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true });
        composer.dispatchEvent(shiftEnter);
        composer.dispatchEvent(altEnter);
        composer.dispatchEvent(composingEnter);

        expect(shiftEnter.defaultPrevented).toBe(false);
        expect(altEnter.defaultPrevented).toBe(false);
        expect(composingEnter.defaultPrevented).toBe(false);
    });

    it('sends with Cmd/Ctrl+Enter by dispatching native plain Enter', async () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEnterController(createAdapter({ current: composer }));
        const nativeEnterEvents: KeyboardEvent[] = [];
        composer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                nativeEnterEvents.push(event);
            }
        });
        controller.init();
        controller.setEnabled(true);

        const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(armChatGPTSendPositionRestore).toHaveBeenCalledTimes(1);
        expect(nativeEnterEvents).toHaveLength(1);
        expect(nativeEnterEvents[0]!.defaultPrevented).toBe(false);

        await vi.advanceTimersByTimeAsync(50);
    });

    it('inserts a newline into textarea fallback composers', () => {
        const composer = document.createElement('textarea');
        composer.value = 'hello world';
        composer.selectionStart = 5;
        composer.selectionEnd = 5;
        document.body.appendChild(composer);
        const inputSpy = vi.fn();
        const changeSpy = vi.fn();
        composer.addEventListener('input', inputSpy);
        composer.addEventListener('change', changeSpy);
        const controller = new ChatGPTComposerEnterController(createAdapter({ current: composer }));
        controller.init();
        controller.setEnabled(true);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('hello\n world');
        expect(composer.selectionStart).toBe(6);
        expect(inputSpy).toHaveBeenCalledTimes(1);
        expect(changeSpy).toHaveBeenCalledTimes(1);
    });

    it('rebinds when ChatGPT replaces the composer element', async () => {
        const first = document.createElement('div');
        first.id = 'prompt-textarea';
        first.setAttribute('contenteditable', 'true');
        const second = document.createElement('div');
        second.id = 'prompt-textarea';
        second.setAttribute('contenteditable', 'true');
        const inputRef = { current: first as HTMLElement | null };
        document.body.appendChild(first);
        const controller = new ChatGPTComposerEnterController(createAdapter(inputRef));
        controller.init();
        controller.setEnabled(true);

        inputRef.current = second;
        first.replaceWith(second);
        FakeMutationObserver.instances[0]!.trigger();
        await vi.advanceTimersByTimeAsync(200);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        second.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });
});
