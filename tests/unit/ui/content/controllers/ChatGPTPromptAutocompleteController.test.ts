import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTPromptAutocompleteController } from '@/ui/content/controllers/ChatGPTPromptAutocompleteController';
import { parseContenteditableToPlainText, setContenteditablePlainTextSelection } from '@/core/sending/contenteditable';
import type { PromptRecord } from '@/core/prompts/promptLibrary';

function createPrompt(patch: Partial<PromptRecord>): PromptRecord {
    return {
        id: patch.id ?? 'prompt-1',
        title: patch.title ?? 'Rewrite',
        content: patch.content ?? 'Rewrite this:\n{{cursor}}',
        triggerText: patch.triggerText ?? 'rewrite',
        contexts: patch.contexts ?? ['composer', 'readerComment'],
        favorite: patch.favorite ?? false,
        enabled: patch.enabled ?? true,
        createdAt: patch.createdAt ?? 1,
        updatedAt: patch.updatedAt ?? 1,
        lastUsedAt: patch.lastUsedAt ?? null,
    };
}

function createComposer(text: string): HTMLElement {
    const composer = document.createElement('div');
    composer.id = 'prompt-textarea';
    composer.className = 'ProseMirror';
    composer.setAttribute('contenteditable', 'true');
    composer.innerHTML = text.split('\n').map((line) => `<p>${line || '<br>'}</p>`).join('');
    document.body.appendChild(composer);
    setContenteditablePlainTextSelection(composer, text.length, text.length);
    return composer;
}

function createTextareaComposer(text: string): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.className = 'send-popover__input';
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.setSelectionRange(text.length, text.length);
    return textarea;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function installVisualViewportMock(frame: { left?: number; top?: number; width: number; height: number }): VisualViewport {
    const visualViewport = new EventTarget() as VisualViewport;
    updateVisualViewportMock(visualViewport, frame);
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
    return visualViewport;
}

function updateVisualViewportMock(visualViewport: VisualViewport, frame: { left?: number; top?: number; width: number; height: number }): void {
    Object.defineProperties(visualViewport, {
        offsetLeft: { configurable: true, value: frame.left ?? 0 },
        offsetTop: { configurable: true, value: frame.top ?? 0 },
        width: { configurable: true, value: frame.width },
        height: { configurable: true, value: frame.height },
    });
}

function installAutocompleteLayoutMock(options: {
    caretRect?: DOMRect | null;
    popoverHeight?: number;
    composerRect?: DOMRect;
}): () => void {
    const originalGetClientRects = Range.prototype.getClientRects;
    const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
    const originalElementRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        value: vi.fn(() => (options.caretRect ? [options.caretRect] : [])),
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: vi.fn(() => options.caretRect ?? rect(0, 0, 0, 0)),
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
        if (this.classList.contains('prompt-popover')) {
            return rect(0, 0, 420, options.popoverHeight ?? 96);
        }
        if (this.id === 'prompt-textarea' || this.classList.contains('send-popover__input')) {
            return options.composerRect ?? rect(100, 400, 420, 60);
        }
        return originalElementRect.call(this);
    });
    return () => {
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: originalGetClientRects,
        });
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: originalGetBoundingClientRect,
        });
    };
}

function setComposerText(composer: HTMLElement, text: string): void {
    composer.innerHTML = text.split('\n').map((line) => `<p>${line || '<br>'}</p>`).join('');
    setContenteditablePlainTextSelection(composer, text.length, text.length);
}

async function tick(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ChatGPTPromptAutocompleteController', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        document.documentElement.removeAttribute('data-aimd-theme');
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
        setViewport(1024, 768);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not mount the prompt popover when only theme overrides are synced', () => {
        const composer = createComposer('');
        const client = {
            listPrompts: vi.fn(async () => []),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        controller.setThemeOverrides({ baseFontScale: 1.1 });

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('does not open autocomplete or query prompts while disabled', async () => {
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        controller.setEnabled(false);

        composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await tick();

        expect(client.listPrompts).not.toHaveBeenCalled();
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('yields backslash completion to formula authoring while the caret is inside math', async () => {
        const composer = createComposer('$\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        controller.setFormulaAuthoringEnabled(true);
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(client.listPrompts).not.toHaveBeenCalled();
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('positions autocomplete above the contenteditable caret using the rendered popover height', async () => {
        setViewport(800, 600);
        const restoreRange = installAutocompleteLayoutMock({
            caretRect: rect(250, 300, 0, 18),
            popoverHeight: 96,
        });
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(host.style.left).toBe('250px');
        expect(host.style.top).toBe('196px');
        expect(host.style.width).toBe('420px');
        controller.dispose();
        restoreRange();
    });

    it('flips autocomplete below the caret when there is not enough space above', async () => {
        setViewport(800, 600);
        const restoreRange = installAutocompleteLayoutMock({
            caretRect: rect(250, 40, 0, 18),
            popoverHeight: 96,
        });
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(host.style.left).toBe('250px');
        expect(host.style.top).toBe('66px');
        controller.dispose();
        restoreRange();
    });

    it('falls back to composer positioning when the caret rect cannot be resolved', async () => {
        setViewport(800, 600);
        const restoreRange = installAutocompleteLayoutMock({
            caretRect: null,
            popoverHeight: 96,
            composerRect: rect(100, 400, 420, 60),
        });
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(host.style.left).toBe('100px');
        expect(host.style.top).toBe('172px');
        controller.dispose();
        restoreRange();
    });

    it('opens backslash suggestions from a textarea composer and positions them near the textarea caret', async () => {
        setViewport(900, 700);
        const restoreRange = installAutocompleteLayoutMock({
            popoverHeight: 96,
            composerRect: rect(120, 340, 420, 120),
        });
        const offsetLeftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function getOffsetLeft(this: HTMLElement) {
            return this.dataset.aimdTextareaCaret === '1' ? 80 : 0;
        });
        const offsetTopSpy = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function getOffsetTop(this: HTMLElement) {
            return this.dataset.aimdTextareaCaret === '1' ? 40 : 0;
        });
        const textarea = createTextareaComposer('\\tr');
        textarea.scrollLeft = 5;
        textarea.scrollTop = 10;
        const prompt = createPrompt({
            id: 'translate',
            title: 'Translate Naturally',
            triggerText: 'translate',
            content: 'Translate naturally:\n{{cursor}}',
        });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'reader',
            getComposerInputElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        const detach = controller.attachExternalComposer(textarea);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        expect(shadow.querySelector('[data-role="prompt-suggestion"]')?.textContent).toContain('Translate Naturally');
        expect(host.style.left).toBe('195px');
        expect(host.style.top).toBe('266px');

        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        textarea.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(true);
        expect(textarea.value).toBe('Translate naturally:\n');
        expect(textarea.selectionStart).toBe('Translate naturally:\n'.length);
        expect(client.recordUse).toHaveBeenCalledWith('translate');
        detach();
        controller.dispose();
        restoreRange();
        offsetLeftSpy.mockRestore();
        offsetTopSpy.mockRestore();
    });

    it('matches external textarea autocomplete only against trigger text', async () => {
        const textarea = createTextareaComposer('\\tran');
        const prompt = createPrompt({
            id: 'translate-title-only',
            title: 'Translate Naturally',
            triggerText: 'xx',
            content: 'Translate this text.',
        });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'reader',
            getComposerInputElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        const detach = controller.attachExternalComposer(textarea);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        detach();
        controller.dispose();
    });

    it('opens backslash suggestions and replaces the current token with Tab', async () => {
        const composer = createComposer('\\re');
        const prompt = createPrompt({
            id: 'rewrite',
            title: 'Rewrite Clearly',
            triggerText: 'rewrite',
            content: 'Rewrite this clearly:\n{{cursor}}',
        });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        expect(shadow.querySelector('[data-role="prompt-suggestion"]')?.textContent).toContain('Rewrite Clearly');

        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(true);
        expect(parseContenteditableToPlainText(composer)).toBe('Rewrite this clearly:\n');
        const selection = window.getSelection();
        expect(selection?.isCollapsed).toBe(true);
        expect(client.recordUse).toHaveBeenCalledWith('rewrite');
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('keeps a hovered suggestion mounted so a pointer click inserts it', async () => {
        const composer = createComposer('\\');
        const prompts = [
            createPrompt({
                id: 'rewrite',
                title: 'Rewrite Clearly',
                triggerText: 'rewrite',
                content: 'Rewrite this clearly.',
            }),
            createPrompt({
                id: 'translate',
                title: 'Translate Naturally',
                triggerText: 'translate',
                content: 'Translate this naturally.',
            }),
        ];
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const shadow = document.getElementById('aimd-chatgpt-prompt-popover-host')!.shadowRoot!;
        const suggestion = shadow.querySelectorAll<HTMLButtonElement>('[data-role="prompt-suggestion"]')[1]!;
        suggestion.dispatchEvent(new MouseEvent('mouseenter'));

        expect(suggestion.isConnected).toBe(true);
        suggestion.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        suggestion.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await tick();

        expect(parseContenteditableToPlainText(composer)).toBe('Translate this naturally.');
        expect(client.recordUse).toHaveBeenCalledWith('translate');
        controller.dispose();
    });

    it('matches ChatGPT composer autocomplete only against trigger text', async () => {
        const composer = createComposer('\\tran');
        const prompt = createPrompt({
            id: 'translate-title-only',
            title: 'Translate Naturally',
            triggerText: 'xx',
            content: 'Translate this text.',
        });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('lets the prompt candidate box claim Enter before ChatGPT composer handlers', async () => {
        const composer = createComposer('\\re');
        const nativeComposerEnter = vi.fn((event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.defaultPrevented) {
                event.preventDefault();
            }
        });
        composer.addEventListener('keydown', nativeComposerEnter as EventListener, { capture: true });
        const prompt = createPrompt({
            id: 'rewrite',
            title: 'Rewrite Clearly',
            triggerText: 'rewrite',
            content: 'Rewrite this clearly:\n{{cursor}}',
        });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(true);
        expect(nativeComposerEnter).not.toHaveBeenCalled();
        expect(parseContenteditableToPlainText(composer)).toBe('Rewrite this clearly:\n');
        expect(client.recordUse).toHaveBeenCalledWith('rewrite');
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('does not open for slash tokens reserved by ChatGPT', async () => {
        const composer = createComposer('/re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite', triggerText: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('closes when the current trigger token has no matches and does not intercept Tab', async () => {
        const composer = createComposer('\\zz');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'sum', title: 'Summarize', triggerText: 'sum' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();
        expect(event.defaultPrevented).toBe(false);
        controller.dispose();
    });

    it('keeps IME and composing keyboard input native while suggestions are open', async () => {
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 229, bubbles: true, cancelable: true } as any);
        Object.defineProperty(event, 'isComposing', { value: true });
        composer.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(false);
        expect(parseContenteditableToPlainText(composer)).toBe('\\re');
        expect(client.recordUse).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('keeps autocomplete dismissed for the same token after Escape', async () => {
        const composer = createComposer('\\re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite' })]),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).not.toBeNull();

        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await tick();
        composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true }));
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();

        setComposerText(composer, '\\rew');
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).not.toBeNull();
        controller.dispose();
    });

    it('opens the unified prompt manager and edits from search results', async () => {
        const composer = createComposer('');
        const prompt = createPrompt({ id: 'sum', title: 'Summarize', triggerText: 'sum', content: 'Summarize:\n{{cursor}}' });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(async (next) => createPrompt(next as Partial<PromptRecord>)),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const search = shadow.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.value = 'sum';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        shadow.querySelector<HTMLButtonElement>('[data-action="edit-prompt"]')!.click();
        await tick();

        expect(shadow.querySelector<HTMLInputElement>('[data-role="prompt-title"]')?.value).toBe('Summarize');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="prompt-trigger"]')?.value).toBe('sum');
        expect(parseContenteditableToPlainText(composer)).toBe('');
        expect(client.recordUse).not.toHaveBeenCalled();

        shadow.querySelector<HTMLInputElement>('[data-role="prompt-title"]')!.value = 'Summarize briefly';
        shadow.querySelector<HTMLButtonElement>('[data-action="save-prompt"]')!.click();
        await tick();

        expect(client.savePrompt).toHaveBeenCalledWith(expect.objectContaining({
            id: 'sum',
            title: 'Summarize briefly',
            triggerText: 'sum',
        }));
        controller.dispose();
    });

    it('opens the same editable manager from a settings shadow anchor', async () => {
        const composer = createComposer('');
        const prompt = createPrompt({ id: 'translate', title: 'Translate Naturally', triggerText: 'translate', content: 'Translate:\n{{cursor}}' });
        const client = {
            listPrompts: vi.fn(async () => [prompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(async (next) => createPrompt(next as Partial<PromptRecord>)),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;
        const settingsHost = document.createElement('div');
        const settingsShadow = settingsHost.attachShadow({ mode: 'open' });
        const settingsAnchor = document.createElement('button');
        settingsAnchor.textContent = 'Prompts';
        settingsShadow.append(settingsAnchor);
        document.body.append(settingsHost);

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        await controller.openManager(settingsAnchor);
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('.manager-row__main')!.click();
        await tick();

        expect(shadow.querySelector<HTMLInputElement>('[data-role="prompt-title"]')?.value).toBe('Translate Naturally');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="prompt-trigger"]')?.value).toBe('translate');
        expect(shadow.querySelector('[data-action="insert-prompt"]')).toBeNull();

        shadow.querySelector<HTMLInputElement>('[data-role="prompt-title"]')!.value = 'Translate Carefully';
        shadow.querySelector<HTMLButtonElement>('[data-action="save-prompt"]')!.click();
        await tick();

        expect(client.savePrompt).toHaveBeenCalledWith(expect.objectContaining({
            id: 'translate',
            title: 'Translate Carefully',
            contexts: ['composer', 'readerComment'],
        }));
        expect(client.recordUse).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('opens the same manager with disabled prompts and saves the enabled toggle', async () => {
        const composer = createComposer('');
        const disabledPrompt = createPrompt({ id: 'disabled', title: 'Disabled', triggerText: 'disabled', enabled: false });
        const client = {
            listPrompts: vi.fn(async () => [disabledPrompt]),
            recordUse: vi.fn(async () => undefined),
            savePrompt: vi.fn(async (prompt) => createPrompt(prompt as Partial<PromptRecord>)),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const toggle = shadow.querySelector<HTMLInputElement>('[data-action="toggle-prompt-enabled"]')!;

        expect(client.listPrompts).toHaveBeenCalledWith({ context: 'all', includeDisabled: true });
        expect(shadow.querySelector('[data-action="insert-prompt"]')).toBeNull();
        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        await tick();

        expect(client.savePrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'disabled', enabled: true }));
        controller.dispose();
    });

    it('keeps the prompt manager wider with a taller capped height and clamps above the viewport bottom', async () => {
        setViewport(1000, 900);
        const restoreRange = installAutocompleteLayoutMock({
            popoverHeight: 800,
            composerRect: rect(100, 780, 420, 60),
        });
        const composer = createComposer('');
        const anchor = document.createElement('button');
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rect(920, 852, 44, 32));
        document.body.appendChild(anchor);
        const prompts = Array.from({ length: 18 }, (_, index) => createPrompt({
            id: `prompt-${index}`,
            title: `Prompt ${index}`,
            triggerText: `p${index}`,
        }));
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        await controller.openManager(anchor);
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const styles = Array.from(shadow.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\n');

        expect(host.style.width).toBe('520px');
        expect(host.style.top).toBe('214px');
        expect(host.style.zIndex).toBe('var(--aimd-z-tooltip)');
        expect(host.style.getPropertyValue('--aimd-prompt-popover-max-height')).toBe('630px');
        expect(styles).toContain('.prompt-popover--manager');
        expect(styles).toContain('grid-template-rows: auto auto auto minmax(0, 1fr);');
        expect(styles).toContain('.manager-list');
        expect(styles).toContain('overflow-y: auto;');
        controller.dispose();
        restoreRange();
    });

    it('shows a simplified editor with a cursor placeholder insertion button', async () => {
        const composer = createComposer('');
        const client = {
            listPrompts: vi.fn(async () => []),
            recordUse: vi.fn(),
            savePrompt: vi.fn(async (prompt) => createPrompt(prompt as Partial<PromptRecord>)),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')!.click();
        await tick();

        expect(shadow.querySelector('[data-role="prompt-context-composer"]')).toBeNull();
        expect(shadow.querySelector('[data-role="prompt-context-reader"]')).toBeNull();
        expect(shadow.querySelector('[data-role="prompt-enabled"]')).toBeNull();
        expect(shadow.querySelector('[data-role="prompt-favorite"]')).toBeNull();
        expect(shadow.querySelector<HTMLInputElement>('[data-role="prompt-trigger"]')?.placeholder).toBe('translate');
        expect(shadow.querySelector('.prompt-editor-body')).toBeTruthy();
        const styles = Array.from(shadow.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\n');
        expect(styles).toContain('.prompt-popover--editor');
        expect(styles).toContain('grid-template-rows: auto minmax(0, 1fr) auto;');
        expect(styles).toContain('.prompt-editor-body');
        expect(styles).toContain('overflow-y: auto;');
        expect(styles).toContain('max-height: min(320px, calc(var(--aimd-prompt-popover-max-height, 630px) - 220px));');

        const textarea = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!;
        const insertCursorButton = shadow.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]')!;
        textarea.value = 'Before  after';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.setSelectionRange('Before '.length, 'Before '.length);
        insertCursorButton.click();

        expect(textarea.value).toBe('Before {{cursor}} after');
        expect(insertCursorButton.disabled).toBe(true);

        textarea.value = 'Before after';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        expect(insertCursorButton.disabled).toBe(false);
        controller.dispose();
    });

    it('drags the prompt manager by the header, clamps to the viewport, and keeps page-session placement', async () => {
        setViewport(1000, 900);
        const restoreRange = installAutocompleteLayoutMock({
            popoverHeight: 300,
            composerRect: rect(100, 780, 420, 60),
        });
        const composer = createComposer('');
        const anchor = document.createElement('button');
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rect(900, 700, 44, 32));
        document.body.appendChild(anchor);
        const prompts = Array.from({ length: 20 }, (_, index) => createPrompt({
            id: `prompt-${index}`,
            title: `Prompt ${index}`,
            triggerText: `p${index}`,
        }));
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        await controller.openManager(anchor);
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('.prompt-header')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 2000,
            clientY: 2000,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 2000,
            clientY: 2000,
        }));

        expect(host.style.left).toBe('464px');
        expect(host.style.top).toBe('254px');

        controller.close();
        await controller.openManager(anchor);
        await tick();
        const reopened = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(reopened.style.left).toBe('464px');
        expect(reopened.style.top).toBe('254px');

        setViewport(700, 500);
        window.dispatchEvent(new Event('resize'));
        expect(reopened.style.left).toBe('164px');
        expect(reopened.style.top).toBe('16px');

        controller.dispose();
        restoreRange();
    });

    it('reclamps a dragged prompt manager when the visual viewport changes', async () => {
        setViewport(1000, 900);
        const visualViewport = installVisualViewportMock({ width: 1000, height: 900 });
        const restoreRange = installAutocompleteLayoutMock({
            popoverHeight: 300,
            composerRect: rect(100, 780, 420, 60),
        });
        const composer = createComposer('');
        const prompts = Array.from({ length: 20 }, (_, index) => createPrompt({
            id: `prompt-${index}`,
            title: `Prompt ${index}`,
            triggerText: `p${index}`,
        }));
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('.prompt-header')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 2000,
            clientY: 2000,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 2000,
            clientY: 2000,
        }));

        updateVisualViewportMock(visualViewport, { left: 20, top: 30, width: 700, height: 500 });
        visualViewport.dispatchEvent(new Event('resize'));

        expect(host.style.left).toBe('184px');
        expect(host.style.top).toBe('46px');
        controller.dispose();
        restoreRange();
    });

    it('does not start panel dragging from header buttons or the prompt reorder handle', async () => {
        setViewport(1000, 900);
        const restoreRange = installAutocompleteLayoutMock({
            popoverHeight: 300,
            composerRect: rect(100, 780, 420, 60),
        });
        const composer = createComposer('');
        const prompts = [
            createPrompt({ id: 'first', title: 'First', triggerText: 'first' }),
            createPrompt({ id: 'second', title: 'Second', triggerText: 'second' }),
        ];
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
            reorderPrompts: vi.fn(async (ids: string[]) => ids.map((id) => prompts.find((prompt) => prompt.id === id)!)),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const initialLeft = host.style.left;
        const initialTop = host.style.top;
        shadow.querySelector<HTMLButtonElement>('[data-action="close-prompts"]')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 100,
            clientY: 100,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 2000,
            clientY: 2000,
        }));

        expect(host.style.left).toBe(initialLeft);
        expect(host.style.top).toBe(initialTop);

        const rows = Array.from(shadow.querySelectorAll<HTMLElement>('.manager-row'));
        rows.forEach((row, index) => {
            Object.assign(row, {
                getBoundingClientRect: () => rect(0, 100 + (index * 72), 520, 64),
            });
        });
        rows[0]!.querySelector<HTMLButtonElement>('[data-action="reorder-prompt"]')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 12,
            clientY: 110,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 12,
            clientY: 180,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 12,
            clientY: 180,
        }));
        await tick();

        expect(host.style.left).toBe(initialLeft);
        expect(host.style.top).toBe(initialTop);
        expect(client.reorderPrompts).toHaveBeenCalledWith(['second', 'first']);
        controller.dispose();
        restoreRange();
    });

    it('reorders prompts with the manager drag handle and persists the new order', async () => {
        const composer = createComposer('');
        const prompts = [
            createPrompt({ id: 'first', title: 'First', triggerText: 'first' }),
            createPrompt({ id: 'second', title: 'Second', triggerText: 'second' }),
            createPrompt({ id: 'third', title: 'Third', triggerText: 'third' }),
        ];
        const client = {
            listPrompts: vi.fn(async () => prompts),
            recordUse: vi.fn(),
            savePrompt: vi.fn(),
            deletePrompt: vi.fn(),
            restoreDefaults: vi.fn(),
            reorderPrompts: vi.fn(async (ids: string[]) => ids.map((id) => prompts.find((prompt) => prompt.id === id)!)),
        };
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getComposerInputElement: () => composer,
            getComposerKind: () => 'contenteditable',
        } as any;

        const controller = new ChatGPTPromptAutocompleteController(adapter, client);
        controller.init();
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const rows = Array.from(shadow.querySelectorAll<HTMLElement>('.manager-row'));
        rows.forEach((row, index) => {
            Object.assign(row, {
                getBoundingClientRect: () => rect(0, 100 + (index * 72), 520, 64),
            });
        });

        rows[0]!.querySelector<HTMLButtonElement>('[data-action="reorder-prompt"]')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 12,
            clientY: 110,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 12,
            clientY: 250,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 12,
            clientY: 250,
        }));
        await tick();

        expect(client.reorderPrompts).toHaveBeenCalledWith(['second', 'third', 'first']);
        controller.dispose();
    });
});
