import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ChatGPTComposerBindingSource,
    type ChatGPTComposerInput,
} from '@/ui/content/controllers/ChatGPTComposerBindingSource';

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
        this.callback(records, this as unknown as MutationObserver);
    }
}

describe('ChatGPTComposerBindingSource', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        FakeMutationObserver.instances = [];
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('does not rebind for mutations unrelated to the current composer', async () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        document.body.appendChild(composer);
        const unrelated = document.createElement('article');
        document.body.appendChild(unrelated);
        const readInput = vi.fn(() => composer as ChatGPTComposerInput);
        const source = new ChatGPTComposerBindingSource(readInput);
        const unsubscribe = source.subscribe(() => undefined);
        const initialCalls = readInput.mock.calls.length;

        FakeMutationObserver.instances[0]!.trigger([{
            type: 'childList',
            target: unrelated,
            addedNodes: [],
            removedNodes: [],
        } as unknown as MutationRecord]);
        await vi.advanceTimersByTimeAsync(32);

        expect(readInput).toHaveBeenCalledTimes(initialCalls);
        unsubscribe();
        source.dispose();
    });

    it('still refreshes when the composer subtree changes', async () => {
        const form = document.createElement('form');
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        form.appendChild(composer);
        document.body.appendChild(form);
        const readInput = vi.fn(() => composer as ChatGPTComposerInput);
        const source = new ChatGPTComposerBindingSource(readInput);
        const unsubscribe = source.subscribe(() => undefined);
        const initialCalls = readInput.mock.calls.length;

        FakeMutationObserver.instances[0]!.trigger([{
            type: 'childList',
            target: form,
            addedNodes: [document.createElement('span')],
            removedNodes: [],
        } as unknown as MutationRecord]);
        await vi.advanceTimersByTimeAsync(32);

        expect(readInput.mock.calls.length).toBeGreaterThan(initialCalls);
        unsubscribe();
        source.dispose();
    });
});
