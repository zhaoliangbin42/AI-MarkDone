import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTComposerEditingController } from '@/ui/content/controllers/ChatGPTComposerEditingController';
import { armChatGPTSendPositionRestore } from '@/drivers/content/chatgpt/sendPositionRestoreEvents';
import {
    parseContenteditableToPlainText,
    setContenteditablePlainTextSelection,
} from '@/core/sending/contenteditable';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '@/core/settings/types';

vi.mock('@/drivers/content/chatgpt/sendPositionRestoreEvents', () => ({
    armChatGPTSendPositionRestore: vi.fn(),
}));

class FakeMutationObserver {
    static instances: FakeMutationObserver[] = [];
    callback: MutationCallback;
    observedTarget: Node | null = null;
    observedTargets: Array<{ target: Node; options?: MutationObserverInit }> = [];
    observe = vi.fn((target: Node, options?: MutationObserverInit) => {
        this.observedTarget = target;
        this.observedTargets.push({ target, options });
    });
    disconnect = vi.fn(() => {
        this.observedTarget = null;
        this.observedTargets = [];
    });

    constructor(callback: MutationCallback) {
        this.callback = callback;
        FakeMutationObserver.instances.push(this);
    }

    trigger(records: MutationRecord[] = []): void {
        this.callback(records, this as any);
    }

    triggerMutationAt(target: Node): void {
        const isObserved = this.observedTargets.some((entry) => (
            entry.target === target
            || (Boolean(entry.options?.subtree) && entry.target.contains(target))
        ));
        if (isObserved) this.trigger();
    }
}

function createAdapter(inputRef: { current: HTMLElement | HTMLTextAreaElement | HTMLInputElement | null }) {
    return {
        getComposerInputElement: () => inputRef.current,
    } as any;
}

function installNativeTextCommand(editable: HTMLElement): () => void {
    const realExecCommand = document.execCommand;
    (document as any).execCommand = vi.fn((command: string, _showUi: boolean, value?: string) => {
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (!range) return false;
        if (command === 'delete') {
            range.deleteContents();
        } else if (command === 'insertText') {
            range.deleteContents();
            const inserted = document.createTextNode(value ?? '');
            range.insertNode(inserted);
            range.setStartAfter(inserted);
            range.collapse(true);
            selection!.removeAllRanges();
            selection!.addRange(range);
        } else {
            return false;
        }
        editable.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: command === 'delete' ? 'deleteContentBackward' : 'insertText',
            data: command === 'insertText' ? value ?? '' : null,
        }));
        return true;
    });
    return () => {
        (document as any).execCommand = realExecCommand;
    };
}

describe('ChatGPTComposerEditingController behavior', () => {
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
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: false,
        });
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    it('does not convert plain Enter merely because list and bold authoring are enabled', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enterKeyNewline: false,
        });
        const shiftedEvents: KeyboardEvent[] = [];
        composer.addEventListener('keydown', (event) => {
            if (event.shiftKey) shiftedEvents.push(event);
        });
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(shiftedEvents).toHaveLength(0);
    });

    it('intercepts Enter only inside an enabled list when ordinary Enter-newline is disabled', () => {
        const composer = document.createElement('textarea');
        composer.value = 'plain';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enterKeyNewline: false,
        });
        controller.init();

        const plainEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(plainEnter);
        expect(plainEnter.defaultPrevented).toBe(false);

        composer.value = '1. first';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        const listEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(listEnter);

        expect(listEnter.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. first\n2. ');
    });

    it('keeps ordered, unordered, and bold capabilities independently configurable', () => {
        const composer = document.createElement('textarea');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enterKeyNewline: false,
            boldShortcut: false,
            lists: { enabled: true, ordered: false, unordered: true },
        });
        controller.init();

        composer.value = '1. first';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        const orderedEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(orderedEnter);
        expect(orderedEnter.defaultPrevented).toBe(false);

        composer.value = '- first';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        const unorderedEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(unorderedEnter);
        expect(unorderedEnter.defaultPrevented).toBe(true);
        expect(composer.value).toBe('- first\n- ');

        composer.value = 'bold';
        composer.setSelectionRange(0, composer.value.length);
        const bold = new KeyboardEvent('keydown', {
            key: 'b',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        composer.dispatchEvent(bold);
        expect(bold.defaultPrevented).toBe(false);
        expect(composer.value).toBe('bold');
    });

    it('continues a Markdown list through a native composer range edit', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>- first</p>';
        document.body.appendChild(composer);
        const paragraph = composer.firstElementChild;
        const restoreExecCommand = installNativeTextCommand(composer);

        try {
            expect(setContenteditablePlainTextSelection(composer, 7)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();

            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
            composer.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(parseContenteditableToPlainText(composer)).toBe('- first\n- ');
            expect(composer.firstElementChild).toBe(paragraph);
        } finally {
            restoreExecCommand();
        }
    });

    it('renumbers following ordered items through one textarea range edit on Enter', () => {
        const composer = document.createElement('textarea');
        composer.value = '1. first\n2. second';
        composer.setSelectionRange(8, 8);
        document.body.appendChild(composer);
        const setRangeText = vi.spyOn(composer, 'setRangeText');
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. first\n2. \n3. second');
        expect(composer.selectionStart).toBe(12);
        expect(setRangeText).toHaveBeenCalledTimes(1);
    });

    it('renumbers a blockquoted ordered list through the real composer key path', () => {
        const composer = document.createElement('textarea');
        composer.value = '> 1. first\n> 2. second';
        composer.setSelectionRange(10, 10);
        document.body.appendChild(composer);
        const setRangeText = vi.spyOn(composer, 'setRangeText');
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('> 1. first\n> 2. \n> 3. second');
        expect(setRangeText).toHaveBeenCalledTimes(1);
    });

    it('uses a plain newline instead of list markup inside a CommonMark code block', () => {
        const composer = document.createElement('textarea');
        composer.value = '1.     code';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const setRangeText = vi.spyOn(composer, 'setRangeText');
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1.     code\n');
        expect(setRangeText).not.toHaveBeenCalled();
    });

    it('renumbers ordered items in the ProseMirror composer without rebuilding its paragraph', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.className = 'ProseMirror';
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>1. first\n2. second</p>';
        document.body.appendChild(composer);
        const paragraph = composer.firstElementChild;
        const restoreExecCommand = installNativeTextCommand(composer);

        try {
            expect(setContenteditablePlainTextSelection(composer, 8)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();

            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
            composer.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(parseContenteditableToPlainText(composer)).toBe('1. first\n2. \n3. second');
            expect(composer.firstElementChild).toBe(paragraph);
        } finally {
            restoreExecCommand();
        }
    });

    it('falls back to a plain newline when a native list edit is rejected', () => {
        const composer = document.createElement('div');
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>- first</p>';
        document.body.appendChild(composer);
        const realExecCommand = document.execCommand;
        (document as any).execCommand = vi.fn(() => false);
        const shiftedEvents: KeyboardEvent[] = [];
        composer.addEventListener('keydown', (event) => {
            if (event.shiftKey) shiftedEvents.push(event);
        });

        try {
            expect(setContenteditablePlainTextSelection(composer, 7)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();
            composer.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            }));

            expect(parseContenteditableToPlainText(composer)).toBe('- first');
            expect(shiftedEvents).toHaveLength(1);
        } finally {
            (document as any).execCommand = realExecCommand;
        }
    });

    it('wraps the current selection in visible bold markers with Cmd/Ctrl+B', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>hello world</p>';
        document.body.appendChild(composer);
        const restoreExecCommand = installNativeTextCommand(composer);

        try {
            expect(setContenteditablePlainTextSelection(composer, 6, 11)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();

            const event = new KeyboardEvent('keydown', {
                key: 'b',
                metaKey: true,
                bubbles: true,
                cancelable: true,
            });
            composer.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(parseContenteditableToPlainText(composer)).toBe('hello **world**');
        } finally {
            restoreExecCommand();
        }
    });

    it('opens input enhancement settings beside the official plus button and persists the runtime master', async () => {
        const form = document.createElement('form');
        const leadingContainer = document.createElement('div');
        const buttonRow = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.id = 'composer-plus-btn';
        plus.dataset.testid = 'composer-plus-btn';
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        buttonRow.appendChild(plus);
        leadingContainer.appendChild(buttonRow);
        form.append(leadingContainer, composer);
        document.body.appendChild(form);
        const persist = vi.fn(async () => true);
        const controller = new ChatGPTComposerEditingController(
            createAdapter({ current: composer }),
            { onInputEnhancementChange: persist },
        );

        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: false,
        });
        controller.init();
        const host = leadingContainer.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-button"]');
        const button = host?.shadowRoot?.querySelector<HTMLButtonElement>('button');
        const officialHover = vi.fn();
        buttonRow.addEventListener('pointerover', officialHover);

        expect(buttonRow.contains(host)).toBe(false);
        expect(buttonRow.nextElementSibling).toBe(host);
        expect(leadingContainer.dataset.aimdInputEnhancementMount).toBe('1');
        expect(button?.getAttribute('aria-expanded')).toBe('false');
        button?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        expect(officialHover).not.toHaveBeenCalled();
        button?.click();
        expect(button?.getAttribute('aria-expanded')).toBe('true');
        expect(persist).not.toHaveBeenCalled();

        const master = document.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-popover"]')
            ?.shadowRoot?.querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]');
        master!.checked = true;
        master!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(button?.dataset.active).toBe('1');
        await Promise.resolve();
        expect(persist).toHaveBeenCalledWith({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: true,
        });

        document.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-popover"]')
            ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="input-enhancement-close"]')?.click();
        expect(button?.getAttribute('aria-expanded')).toBe('false');
        expect(host?.shadowRoot?.activeElement).toBe(button);

        controller.dispose();
        expect(leadingContainer.dataset.aimdInputEnhancementMount).toBeUndefined();
        expect(document.getElementById('aimd-chatgpt-input-enhancement-mount-style')).toBeNull();
    });

    it('opens the syntax guide modal through the real composer button and popover trigger path', () => {
        const form = document.createElement('form');
        const buttonRow = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.dataset.testid = 'composer-plus-btn';
        composer.setAttribute('contenteditable', 'true');
        buttonRow.appendChild(plus);
        form.append(buttonRow, composer);
        document.body.appendChild(form);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS);
        controller.init();

        buttonRow.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-button"]')
            ?.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click();
        document.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-popover"]')
            ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="input-enhancement-guide"]')?.click();

        const guideHost = document.getElementById('aimd-input-enhancement-guide');
        expect(guideHost?.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull();
        expect(guideHost?.shadowRoot?.textContent).toContain('chatgptInputEnhancementGuideBoldSyntax');
        controller.dispose();
        expect(document.getElementById('aimd-input-enhancement-guide')).toBeNull();
    });

    it('rolls input enhancement settings back when persistence fails', async () => {
        const form = document.createElement('form');
        const buttonRow = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.dataset.testid = 'composer-plus-btn';
        composer.setAttribute('contenteditable', 'true');
        buttonRow.appendChild(plus);
        form.append(buttonRow, composer);
        document.body.appendChild(form);
        const controller = new ChatGPTComposerEditingController(
            createAdapter({ current: composer }),
            { onInputEnhancementChange: async () => false },
        );
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: false,
        });
        controller.init();
        const button = buttonRow
            .querySelector<HTMLElement>('[data-aimd-role="input-enhancement-button"]')
            ?.shadowRoot?.querySelector<HTMLButtonElement>('button');

        button?.click();
        const master = document.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-popover"]')
            ?.shadowRoot?.querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]');
        master!.checked = true;
        master!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(button?.dataset.active).toBe('1');
        await Promise.resolve();
        await Promise.resolve();

        expect(button?.dataset.active).toBe('0');
        expect(button?.disabled).toBe(false);
    });

    it('removes the entry and pauses every capability when availability is disabled', () => {
        const form = document.createElement('form');
        const buttonRow = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('textarea');
        plus.dataset.testid = 'composer-plus-btn';
        composer.value = '1. first';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        buttonRow.appendChild(plus);
        form.append(buttonRow, composer);
        document.body.appendChild(form);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            available: false,
        });
        controller.init();

        expect(buttonRow.querySelector('[data-aimd-role="input-enhancement-button"]')).toBeNull();
        const disabledEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(disabledEnter);
        expect(disabledEnter.defaultPrevented).toBe(false);

        controller.setInputEnhancementSettings(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS);
        expect(buttonRow.querySelectorAll('[data-aimd-role="input-enhancement-button"]')).toHaveLength(1);
        const enabledEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(enabledEnter);
        expect(enabledEnter.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. first\n2. ');
    });

    it('reconciles a removed input enhancement button without creating duplicates', async () => {
        const form = document.createElement('form');
        const buttonRow = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.id = 'composer-plus-btn';
        composer.setAttribute('contenteditable', 'true');
        buttonRow.appendChild(plus);
        form.append(buttonRow, composer);
        document.body.appendChild(form);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const selector = '[data-aimd-role="input-enhancement-button"]';
        expect(buttonRow.querySelectorAll(selector)).toHaveLength(1);
        FakeMutationObserver.instances[0]!.trigger();
        await vi.advanceTimersByTimeAsync(200);
        expect(buttonRow.querySelectorAll(selector)).toHaveLength(1);

        buttonRow.querySelector(selector)?.remove();
        FakeMutationObserver.instances[0]!.trigger();
        await vi.advanceTimersByTimeAsync(200);
        expect(buttonRow.querySelectorAll(selector)).toHaveLength(1);
        expect(plus.nextElementSibling?.matches(selector)).toBe(true);
    });

    it('rebinds Enter and the input enhancement button when ChatGPT replaces the observed hydration shell', async () => {
        const firstShell = document.createElement('section');
        const secondShell = document.createElement('section');
        const firstRoot = document.createElement('div');
        const secondRoot = document.createElement('div');
        const firstForm = document.createElement('form');
        const firstButtonRow = document.createElement('span');
        const firstPlus = document.createElement('button');
        const firstComposer = document.createElement('div');
        const secondForm = document.createElement('form');
        const secondButtonRow = document.createElement('span');
        const secondPlus = document.createElement('button');
        const secondComposer = document.createElement('div');
        firstPlus.dataset.testid = 'composer-plus-btn';
        firstComposer.id = 'prompt-textarea';
        firstComposer.setAttribute('contenteditable', 'true');
        secondPlus.dataset.testid = 'composer-plus-btn';
        secondComposer.id = 'prompt-textarea';
        secondComposer.setAttribute('contenteditable', 'true');
        firstButtonRow.appendChild(firstPlus);
        firstForm.append(firstButtonRow, firstComposer);
        firstRoot.appendChild(firstForm);
        firstShell.appendChild(firstRoot);
        secondButtonRow.appendChild(secondPlus);
        secondForm.append(secondButtonRow, secondComposer);
        secondRoot.appendChild(secondForm);
        secondShell.appendChild(secondRoot);
        document.body.appendChild(firstShell);

        let observerRoot: HTMLElement = firstRoot;
        let composer: HTMLElement = firstComposer;
        const adapter = {
            getComposerInputElement: () => composer,
            getObserverContainer: () => observerRoot,
        } as any;
        const controller = new ChatGPTComposerEditingController(adapter);
        controller.init();

        const observer = FakeMutationObserver.instances[0]!;
        const selector = '[data-aimd-role="input-enhancement-button"]';
        expect(firstButtonRow.querySelectorAll(selector)).toHaveLength(1);
        controller.setInputEnhancementSettings(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS);

        observerRoot = secondRoot;
        composer = secondComposer;
        firstShell.replaceWith(secondShell);
        observer.triggerMutationAt(document.body);
        await vi.advanceTimersByTimeAsync(200);

        const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        });
        secondComposer.dispatchEvent(enter);

        expect(enter.defaultPrevented).toBe(true);
        expect(firstButtonRow.querySelectorAll(selector)).toHaveLength(0);
        expect(secondButtonRow.querySelectorAll(selector)).toHaveLength(1);
        expect(secondPlus.nextElementSibling?.matches(selector)).toBe(true);
    });

    it('converts plain Enter in contenteditable composer into native Shift+Enter events', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.setAttribute('contenteditable', 'true');
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
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
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

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
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        const nativeEnterEvents: KeyboardEvent[] = [];
        composer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                nativeEnterEvents.push(event);
            }
        });
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(armChatGPTSendPositionRestore).toHaveBeenCalledTimes(1);
        expect(nativeEnterEvents).toHaveLength(1);
        expect(nativeEnterEvents[0]!.defaultPrevented).toBe(false);

        await vi.advanceTimersByTimeAsync(50);
    });

    it('does not intercept the bold shortcut during IME composition', () => {
        const composer = document.createElement('div');
        composer.setAttribute('contenteditable', 'true');
        composer.textContent = '输入中';
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', {
            key: 'b',
            metaKey: true,
            isComposing: true,
            bubbles: true,
            cancelable: true,
        });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(composer.textContent).toBe('输入中');
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
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('hello\n world');
        expect(composer.selectionStart).toBe(6);
        expect(inputSpy).toHaveBeenCalledTimes(1);
        expect(changeSpy).toHaveBeenCalledTimes(1);
    });

    it('rebinds when ChatGPT replaces the composer element', async () => {
        const firstForm = document.createElement('form');
        const firstRow = document.createElement('span');
        const firstPlus = document.createElement('button');
        const first = document.createElement('div');
        firstPlus.dataset.testid = 'composer-plus-btn';
        first.id = 'prompt-textarea';
        first.setAttribute('contenteditable', 'true');
        firstRow.appendChild(firstPlus);
        firstForm.append(firstRow, first);
        const secondForm = document.createElement('form');
        const secondRow = document.createElement('span');
        const secondPlus = document.createElement('button');
        const second = document.createElement('div');
        secondPlus.dataset.testid = 'composer-plus-btn';
        second.id = 'prompt-textarea';
        second.setAttribute('contenteditable', 'true');
        secondRow.appendChild(secondPlus);
        secondForm.append(secondRow, second);
        const inputRef = { current: first as HTMLElement | null };
        document.body.appendChild(firstForm);
        const controller = new ChatGPTComposerEditingController(createAdapter(inputRef));
        controller.init();

        inputRef.current = second;
        firstForm.replaceWith(secondForm);
        FakeMutationObserver.instances[0]!.trigger();
        await vi.advanceTimersByTimeAsync(200);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        second.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(firstRow.querySelectorAll('[data-aimd-role="input-enhancement-button"]')).toHaveLength(0);
        expect(secondRow.querySelectorAll('[data-aimd-role="input-enhancement-button"]')).toHaveLength(1);
        expect(secondPlus.nextElementSibling?.matches('[data-aimd-role="input-enhancement-button"]')).toBe(true);
    });

    it('removes a list marker as one unit on Backspace at the item body', () => {
        const composer = document.createElement('textarea');
        composer.value = '  12. item';
        composer.setSelectionRange(6, 6);
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('  item');
        expect(composer.selectionStart).toBe(2);
    });

    it('uses two native Backspace edits to outdent then join a middle ordered item', () => {
        const composer = document.createElement('textarea');
        composer.value = '1. one\n2. two\n3. three';
        composer.setSelectionRange(10, 10);
        document.body.appendChild(composer);
        const setRangeText = vi.spyOn(composer, 'setRangeText');
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const first = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        composer.dispatchEvent(first);

        expect(first.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. one\n   two\n2. three');
        expect(composer.selectionStart).toBe(10);
        expect(setRangeText).toHaveBeenCalledTimes(1);

        const second = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        composer.dispatchEvent(second);

        expect(second.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. onetwo\n2. three');
        expect(composer.selectionStart).toBe(6);
        expect(setRangeText).toHaveBeenCalledTimes(2);
    });

    it('leaves ordered-list Backspace to the host during IME and modified deletion', () => {
        const composer = document.createElement('textarea');
        composer.value = '1. one\n2. two\n3. three';
        composer.setSelectionRange(10, 10);
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const composing = new KeyboardEvent('keydown', {
            key: 'Backspace',
            bubbles: true,
            cancelable: true,
            isComposing: true,
        });
        const legacyIme = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        Object.defineProperty(legacyIme, 'keyCode', { value: 229 });
        const modified = new KeyboardEvent('keydown', {
            key: 'Backspace',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        composer.dispatchEvent(composing);
        composer.dispatchEvent(legacyIme);
        composer.dispatchEvent(modified);

        expect(composing.defaultPrevented).toBe(false);
        expect(legacyIme.defaultPrevented).toBe(false);
        expect(modified.defaultPrevented).toBe(false);
        expect(composer.value).toBe('1. one\n2. two\n3. three');
    });

    it('does not consume ordered-list Backspace when the native edit is rejected unchanged', () => {
        const composer = document.createElement('div');
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>1. one\n2. two\n3. three</p>';
        document.body.appendChild(composer);
        const realExecCommand = document.execCommand;
        (document as any).execCommand = vi.fn(() => false);

        try {
            expect(setContenteditablePlainTextSelection(composer, 10)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();

            const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
            composer.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
            expect(parseContenteditableToPlainText(composer)).toBe('1. one\n2. two\n3. three');
        } finally {
            (document as any).execCommand = realExecCommand;
        }
    });

    it('uses the same two-step ordered-list Backspace behavior in a ProseMirror fixture', () => {
        const composer = document.createElement('div');
        composer.id = 'prompt-textarea';
        composer.className = 'ProseMirror';
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>1. one\n2. two\n3. three</p>';
        document.body.appendChild(composer);
        const paragraph = composer.firstElementChild;
        const restoreExecCommand = installNativeTextCommand(composer);

        try {
            expect(setContenteditablePlainTextSelection(composer, 10)).toBe(true);
            const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
            controller.init();

            const first = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
            composer.dispatchEvent(first);
            expect(first.defaultPrevented).toBe(true);
            expect(parseContenteditableToPlainText(composer)).toBe('1. one\n   two\n2. three');
            expect(composer.firstElementChild).toBe(paragraph);

            const second = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
            composer.dispatchEvent(second);
            expect(second.defaultPrevented).toBe(true);
            expect(parseContenteditableToPlainText(composer)).toBe('1. onetwo\n2. three');
            expect(composer.firstElementChild).toBe(paragraph);
            expect(document.execCommand).toHaveBeenCalledTimes(2);
        } finally {
            restoreExecCommand();
        }
    });

    it('renumbers a contiguous ordered block when a complete middle line is deleted', () => {
        const composer = document.createElement('textarea');
        composer.value = '1. one\n2. two\n3. three\n4. four';
        composer.setSelectionRange(7, 14);
        document.body.appendChild(composer);
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }));
        controller.init();

        const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('1. one\n2. three\n3. four');
    });

    it('opens formula-only completion, previews with MathJax, and inserts a snippet with tab stops', async () => {
        const composer = document.createElement('textarea');
        composer.value = '$\\fra';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const renderFormula = vi.fn(async ({ source, displayMode }: { source: string; displayMode: boolean }) => ({
            source,
            displayMode,
            fontSizePx: 36,
            width: 72,
            height: 36,
            viewBox: '0 0 72 36',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><path d="M0 0h1v1z"/></svg>',
        }));
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), {
            loadFormulaSnippets: async () => ({
                version: 1,
                source: { project: 'LaTeX Workshop', commit: 'fixed', license: 'MIT' },
                items: [{
                    id: 'frac',
                    label: '\\frac',
                    insertText: '\\frac{${1:a}}{${2:b}}$0',
                    detail: 'fraction',
                    category: 'structure',
                    priority: 100,
                }],
            }),
            renderFormula,
        });
        controller.init();

        composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'a' }));
        await vi.advanceTimersByTimeAsync(160);
        await Promise.resolve();
        await Promise.resolve();

        const host = document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]');
        expect(host?.hidden).toBe(false);
        expect(host?.shadowRoot?.querySelector('[data-role="formula-suggestion"]')?.textContent).toContain('\\frac');
        expect(renderFormula).toHaveBeenCalledWith(expect.objectContaining({ source: '\\fra', displayMode: false }));

        const insert = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        composer.dispatchEvent(insert);
        expect(insert.defaultPrevented).toBe(true);
        expect(composer.value).toBe('$\\frac{a}{b}');
        expect([composer.selectionStart, composer.selectionEnd]).toEqual([7, 8]);

        const nextTabStop = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        composer.dispatchEvent(nextTabStop);
        expect([composer.selectionStart, composer.selectionEnd]).toEqual([10, 11]);
        controller.dispose();
    });

    it('does not open formula completion for the same backslash token outside math', async () => {
        const composer = document.createElement('textarea');
        composer.value = '\\fra';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const loadFormulaSnippets = vi.fn(async () => ({
            version: 1 as const,
            source: { project: 'x', commit: 'x', license: 'MIT' },
            items: [],
        }));
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), { loadFormulaSnippets });
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(160);

        expect(loadFormulaSnippets).not.toHaveBeenCalled();
        expect(document.querySelector('[data-aimd-role="formula-composer-assistant"]')).toBeNull();
        controller.dispose();
    });

    it('shows formula suggestions without invoking the preview renderer when preview is disabled', async () => {
        const composer = document.createElement('textarea');
        composer.value = '$\\fra';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const renderFormula = vi.fn();
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), {
            loadFormulaSnippets: async () => ({
                version: 1,
                source: { project: 'LaTeX Workshop', commit: 'fixed', license: 'MIT' },
                items: [{
                    id: 'frac',
                    label: '\\frac',
                    insertText: '\\frac{$1}{$2}',
                    detail: 'fraction',
                    category: 'structure',
                    priority: 100,
                }],
            }),
            renderFormula,
        });
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            formulaSuggestions: true,
            formulaPreview: false,
        });
        controller.init();

        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(160);
        await Promise.resolve();
        await Promise.resolve();

        const shadow = document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]')?.shadowRoot;
        expect(shadow?.querySelector('[data-role="formula-suggestion"]')).not.toBeNull();
        expect(shadow?.querySelector('[data-role="formula-preview"]')).toBeNull();
        expect(renderFormula).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('renders a formula preview without loading snippets when suggestions are disabled', async () => {
        const composer = document.createElement('textarea');
        composer.value = '$x';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const loadFormulaSnippets = vi.fn();
        const renderFormula = vi.fn(async () => ({
            source: 'x',
            displayMode: false,
            fontSizePx: 36,
            width: 30,
            height: 20,
            viewBox: '0 0 30 20',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"></svg>',
        }));
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), {
            loadFormulaSnippets,
            renderFormula,
        });
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            formulaSuggestions: false,
            formulaPreview: true,
        });
        controller.init();

        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(160);
        await Promise.resolve();
        await Promise.resolve();

        const shadow = document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]')?.shadowRoot;
        expect(shadow?.querySelector('[data-role="formula-preview"]')).not.toBeNull();
        expect(shadow?.querySelector('[data-role="formula-suggestion"]')).toBeNull();
        expect(loadFormulaSnippets).not.toHaveBeenCalled();
        expect(renderFormula).toHaveBeenCalledOnce();
        controller.dispose();
    });

    it('does not schedule formula work when both formula capabilities are disabled', async () => {
        const composer = document.createElement('textarea');
        composer.value = '$\\fra';
        composer.setSelectionRange(composer.value.length, composer.value.length);
        document.body.appendChild(composer);
        const loadFormulaSnippets = vi.fn();
        const renderFormula = vi.fn();
        const prewarmFormula = vi.fn();
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), {
            loadFormulaSnippets,
            renderFormula,
            prewarmFormula,
        });
        controller.setInputEnhancementSettings({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            formulaSuggestions: false,
            formulaPreview: false,
        });
        controller.init();

        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(200);

        expect(loadFormulaSnippets).not.toHaveBeenCalled();
        expect(renderFormula).not.toHaveBeenCalled();
        expect(prewarmFormula).not.toHaveBeenCalled();
        expect(document.querySelector('[data-aimd-role="formula-composer-assistant"]')).toBeNull();
        controller.dispose();
    });

    it('previews a closed formula after pointer dwell without moving the composer selection', async () => {
        const composer = document.createElement('div');
        composer.setAttribute('contenteditable', 'true');
        composer.innerHTML = '<p>Before $x+y$ after</p>';
        document.body.appendChild(composer);
        const textNode = composer.querySelector('p')!.firstChild!;
        Object.defineProperty(document, 'caretPositionFromPoint', {
            configurable: true,
            value: vi.fn(() => ({ offsetNode: textNode, offset: 9 })),
        });
        expect(setContenteditablePlainTextSelection(composer, 0)).toBe(true);
        const renderFormula = vi.fn(async ({ source, displayMode }: { source: string; displayMode: boolean }) => ({
            source,
            displayMode,
            fontSizePx: 36,
            width: 30,
            height: 20,
            viewBox: '0 0 30 20',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"></svg>',
        }));
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), { renderFormula });
        controller.init();

        composer.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 220 }));
        await vi.advanceTimersByTimeAsync(160);
        await Promise.resolve();
        await Promise.resolve();

        expect(renderFormula).toHaveBeenCalledWith(expect.objectContaining({ source: 'x+y', displayMode: false }));
        expect(document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]')?.hidden).toBe(false);
        expect(window.getSelection()?.isCollapsed).toBe(true);
        controller.dispose();
        delete (document as any).caretPositionFromPoint;
    });

    it('ignores a stale formula render that completes after a newer preview', async () => {
        const composer = document.createElement('textarea');
        composer.value = '$x';
        composer.setSelectionRange(2, 2);
        document.body.appendChild(composer);
        let resolveFirst!: (asset: any) => void;
        let resolveSecond!: (asset: any) => void;
        const first = new Promise<any>((resolve) => { resolveFirst = resolve; });
        const second = new Promise<any>((resolve) => { resolveSecond = resolve; });
        const renderFormula = vi.fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const asset = (source: string, id: string) => ({
            source,
            displayMode: false,
            fontSizePx: 36,
            width: 30,
            height: 20,
            viewBox: '0 0 30 20',
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path id="${id}" d="M0 0h1v1z"/></svg>`,
        });
        const controller = new ChatGPTComposerEditingController(createAdapter({ current: composer }), {
            renderFormula,
            prewarmFormula: vi.fn(),
        });
        controller.init();

        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(120);
        composer.value = '$y';
        composer.setSelectionRange(2, 2);
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(120);

        resolveSecond(asset('y', 'new-preview'));
        await Promise.resolve();
        await Promise.resolve();
        resolveFirst(asset('x', 'stale-preview'));
        await Promise.resolve();
        await Promise.resolve();

        const shadow = document.querySelector<HTMLElement>('[data-aimd-role="formula-composer-assistant"]')?.shadowRoot;
        expect(shadow?.querySelector('#new-preview')).not.toBeNull();
        expect(shadow?.querySelector('#stale-preview')).toBeNull();
        controller.dispose();
    });
});
