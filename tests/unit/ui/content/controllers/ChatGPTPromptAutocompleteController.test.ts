import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTPromptAutocompleteController } from '@/ui/content/controllers/ChatGPTPromptAutocompleteController';
import { parseContenteditableToPlainText, setContenteditablePlainTextSelection } from '@/core/sending/contenteditable';
import type { PromptRecord } from '@/core/prompts/promptLibrary';

function createPrompt(patch: Partial<PromptRecord>): PromptRecord {
    return {
        id: patch.id ?? 'prompt-1',
        title: patch.title ?? 'Rewrite',
        content: patch.content ?? 'Rewrite this:\n{{cursor}}',
        triggerText: patch.triggerText ?? '\\rewrite',
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
        if (this.id === 'prompt-textarea') {
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

    it('opens backslash suggestions and replaces the current token with Tab', async () => {
        const composer = createComposer('\\re');
        const prompt = createPrompt({
            id: 'rewrite',
            title: 'Rewrite Clearly',
            triggerText: '\\rewrite',
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

    it('does not open for slash tokens reserved by ChatGPT', async () => {
        const composer = createComposer('/re');
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ id: 'rewrite', triggerText: '\\rewrite' })]),
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
            listPrompts: vi.fn(async () => [createPrompt({ id: 'sum', title: 'Summarize', triggerText: '\\sum' })]),
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

    it('opens the prompt manager and inserts from search results', async () => {
        const composer = createComposer('');
        const prompt = createPrompt({ id: 'sum', title: 'Summarize', triggerText: '\\sum', content: 'Summarize:\n{{cursor}}' });
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
        await controller.openManager();
        await tick();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const shadow = host.shadowRoot!;
        const search = shadow.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.value = 'sum';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        shadow.querySelector<HTMLButtonElement>('[data-action="insert-prompt"]')!.click();
        await tick();

        expect(parseContenteditableToPlainText(composer)).toBe('Summarize:\n');
        expect(client.recordUse).toHaveBeenCalledWith('sum');
        controller.dispose();
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

        const textarea = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!;
        textarea.value = 'Before  after';
        textarea.setSelectionRange('Before '.length, 'Before '.length);
        shadow.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]')!.click();

        expect(textarea.value).toBe('Before {{cursor}} after');
        controller.dispose();
    });
});
