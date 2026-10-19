import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTPromptAutocompleteController } from '@/ui/content/controllers/ChatGPTPromptAutocompleteController';
import { createAppearanceSnapshot } from '@/style/appearance';
import { parseContenteditableToPlainText, setContenteditablePlainTextSelection } from '@/core/sending/contenteditable';
import type { PromptRecord } from '@/core/prompts/promptLibrary';
import { setLocale } from '@/ui/content/components/i18n';
import { ChatGPTShortcutController } from '@/ui/content/shortcuts/ChatGPTShortcutController';
import { getEffectiveBinding, getShortcutPlatform } from '@/core/shortcuts';

function bindManualShortcut(controller: ChatGPTPromptAutocompleteController) {
    const settings = { enabled: true, overrides: {}, disabled: [] };
    const shortcuts = new ChatGPTShortcutController({ copy: () => false, selection: () => false, navigate: () => false, prompts: controller });
    shortcuts.setSettings(settings); shortcuts.setActive(true); shortcuts.init();
    return {
        press(input: HTMLElement) {
            const platform = getShortcutPlatform(navigator.platform);
            const binding = getEffectiveBinding(settings, 'prompts.openSuggestions', platform)!;
            const event = new KeyboardEvent('keydown', { key: binding.code.replace(/^Key/, '').toLowerCase(), code: binding.code,
                ctrlKey: Boolean(binding.control) || (platform !== 'mac' && binding.primary), metaKey: platform === 'mac' && binding.primary,
                shiftKey: binding.shift, altKey: binding.alt, bubbles: true, composed: true, cancelable: true });
            input.dispatchEvent(event); return event;
        },
        dispose: () => shortcuts.dispose(),
    };
}

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

    it.each([{ text: '', caret: 0 }, { text: 'before after', caret: 7 }, { text: 'first line\nsecond line', caret: 11 }])('opens manual candidates through the real shortcut at caret $caret and inserts without losing surrounding text', async ({ text, caret }) => {
        const composer = createTextareaComposer(text); composer.focus(); composer.setSelectionRange(caret, caret);
        const client = { listPrompts: vi.fn(async () => [createPrompt({ title: '整理资料', triggerText: '', content: 'Inserted{{cursor}}' })]), recordUse: vi.fn(async () => undefined), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init();
        const shortcut = bindManualShortcut(controller);
        try {
            expect(shortcut.press(composer).defaultPrevented).toBe(true);
            await tick();
            const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
            expect(host.shadowRoot!.querySelector('[data-role="prompt-suggestion"]')?.textContent).toContain('整理资料');
            expect(host.shadowRoot!.querySelector('[data-role="prompt-search"]')).toBeNull();
            expect(composer.value).toBe(text);
            composer.value = `${text.slice(0, caret)}整理${text.slice(caret)}`;
            composer.setSelectionRange(caret + 2, caret + 2);
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            await tick();
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
            await tick();
            expect(composer.value).toBe(`${text.slice(0, caret)}Inserted${text.slice(caret)}`);
            expect(composer.selectionStart).toBe(caret + 8);
            expect(document.activeElement).toBe(composer);
            expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        } finally { shortcut.dispose(); controller.dispose(); }
    });

    it.each([{ text: '', caret: 0 }, { text: 'first line\nsecond line', caret: 13 }])('preserves a contenteditable draft and its middle caret through manual candidates and Escape at $caret', async ({ text, caret }) => {
        const composer = createComposer(text); composer.focus(); setContenteditablePlainTextSelection(composer, caret, caret);
        const client = { listPrompts: vi.fn(async () => [createPrompt({ triggerText: '', content: 'Inserted{{cursor}}' })]), recordUse: vi.fn(async () => undefined), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'contenteditable' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        try {
            expect(shortcut.press(composer).defaultPrevented).toBe(true); await tick();
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
            expect(document.activeElement).toBe(composer); expect(parseContenteditableToPlainText(composer)).toBe(text);
            expect(shortcut.press(composer).defaultPrevented).toBe(true); await tick();
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick();
            expect(parseContenteditableToPlainText(composer)).toBe(`${text.slice(0, caret)}Inserted${text.slice(caret)}`);
            expect(document.activeElement).toBe(composer);
        } finally { shortcut.dispose(); controller.dispose(); }
    });

    it('keeps zero-match candidates open, does not submit on Enter, and restores the draft and caret on Escape', async () => {
        const composer = createTextareaComposer('before after'); composer.focus(); composer.setSelectionRange(7, 7);
        const client = { listPrompts: vi.fn(async () => [createPrompt({})]), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        const send = vi.fn(); document.addEventListener('keydown', send);
        try {
            shortcut.press(composer); await tick();
            composer.value = 'before no-matchafter'; composer.setSelectionRange(15, 15); composer.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
            expect(host.shadowRoot!.querySelector('[role="status"]')).toBeTruthy();
            const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }); composer.dispatchEvent(enter);
            expect(enter.defaultPrevented).toBe(true); expect(send).not.toHaveBeenCalled();
            host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="open-prompt-library"]')!.focus();
            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
            expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
            expect(document.activeElement).toBe(composer); expect(composer.value).toBe('before no-matchafter'); expect(composer.selectionStart).toBe(15);
            expect(client.recordUse).not.toHaveBeenCalled();
        } finally { shortcut.dispose(); controller.dispose(); document.removeEventListener('keydown', send); }
    });

    it('opens the library only through the explicit empty-candidate action and restores its composer on Escape', async () => {
        const composer = createTextareaComposer('draft'); composer.focus();
        const client = { listPrompts: vi.fn(async () => []), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        try {
            shortcut.press(composer); await tick();
            let host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
            expect(host.shadowRoot!.querySelector('[role="status"]')).toBeTruthy();
            expect(host.shadowRoot!.querySelector('[data-role="prompt-search"]')).toBeNull();
            host.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="open-prompt-library"]')!.click(); await tick();
            host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
            const search = host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
            expect(search).toBeTruthy(); search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
            expect(document.activeElement).toBe(composer); expect(composer.value).toBe('draft');
        } finally { shortcut.dispose(); controller.dispose(); }
    });

    it('keeps the same internally scrolling candidate list through real arrow keydown and keyup events', async () => {
        const composer = createTextareaComposer(''); composer.focus();
        const client = { listPrompts: vi.fn(async () => Array.from({ length: 8 }, (_, index) => createPrompt({ id: String(index), title: `Prompt ${index}` }))), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        try {
            shortcut.press(composer); await tick();
            const shadow = document.getElementById('aimd-chatgpt-prompt-popover-host')!.shadowRoot!;
            const list = shadow.querySelector<HTMLElement>('.prompt-list')!;
            const last = list.querySelector<HTMLElement>('[data-index="7"]')!;
            Object.defineProperties(list, { clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 480 } });
            vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100 } as DOMRect);
            vi.spyOn(last, 'getBoundingClientRect').mockReturnValue({ top: 360, bottom: 400 } as DOMRect);
            const pageScroll = vi.spyOn(window, 'scrollTo');
            for (let index = 0; index < 7; index += 1) {
                composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }));
                composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true, composed: true }));
                await tick();
            }
            expect(shadow.querySelector('.prompt-list')).toBe(list);
            expect(last.getAttribute('aria-selected')).toBe('true'); expect(list.scrollTop).toBe(300);
            expect(pageScroll).not.toHaveBeenCalled(); expect(document.activeElement).toBe(composer);
        } finally { shortcut.dispose(); controller.dispose(); }
    });

    it('keeps the selected candidate visible when resizing reduces the internal list height', async () => {
        const composer = createTextareaComposer(''); composer.focus();
        const client = { listPrompts: vi.fn(async () => Array.from({ length: 12 }, (_, index) => createPrompt({ id: String(index) }))), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        try {
            shortcut.press(composer); await tick();
            const shadow = document.getElementById('aimd-chatgpt-prompt-popover-host')!.shadowRoot!;
            const list = shadow.querySelector<HTMLElement>('.prompt-list')!;
            let visibleHeight = 180;
            Object.defineProperties(list, { clientHeight: { configurable: true, get: () => visibleHeight }, scrollHeight: { configurable: true, value: 480 } });
            vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({ top: 0, bottom: visibleHeight } as DOMRect));
            list.querySelectorAll<HTMLElement>('[data-role="prompt-suggestion"]').forEach((row, index) => {
                vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => ({ top: index * 40 - list.scrollTop, bottom: (index + 1) * 40 - list.scrollTop } as DOMRect));
            });
            for (let index = 0; index < 9; index += 1) composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }));
            expect(list.scrollTop).toBe(220);
            visibleHeight = 100; setViewport(390, 600);
            const pageScroll = vi.spyOn(window, 'scrollTo');
            window.dispatchEvent(new Event('resize'));
            expect(shadow.querySelector('.prompt-list')).toBe(list);
            expect(list.scrollTop).toBe(300);
            const selected = list.querySelector<HTMLElement>('[aria-selected="true"]')!;
            expect(selected.dataset.index).toBe('9');
            expect(selected.getBoundingClientRect().bottom).toBeLessThanOrEqual(visibleHeight);
            expect(pageScroll).not.toHaveBeenCalled(); expect(document.activeElement).toBe(composer);
        } finally { shortcut.dispose(); controller.dispose(); }
    });

    it.each(['selection', 'composition', 'formula'])('does not claim the real manual shortcut during %s', async mode => {
        const composer = createTextareaComposer(mode === 'formula' ? '$\\re' : 'draft'); composer.focus();
        const client = { listPrompts: vi.fn(async () => [createPrompt({})]), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init(); const shortcut = bindManualShortcut(controller);
        try {
            if (mode === 'selection') composer.setSelectionRange(0, 3);
            if (mode === 'composition') composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            if (mode === 'formula') controller.setFormulaAuthoringEnabled(true);
            expect(shortcut.press(composer).defaultPrevented).toBe(false); await tick();
            expect(client.listPrompts).not.toHaveBeenCalled(); expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        } finally { shortcut.dispose(); controller.dispose(); }
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
        controller.setAppearance(createAppearanceSnapshot('light', { baseFontScale: 1.1 }));

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

    it('manually opens and accepts suggestions while automatic completion is disabled, preserving surrounding text', async () => {
        const composer = createTextareaComposer('before after');
        composer.focus();
        composer.setSelectionRange(7, 7);
        const client = {
            listPrompts: vi.fn(async () => [createPrompt({ content: 'Rewrite {{cursor}}' })]),
            recordUse: vi.fn(async () => undefined), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn(),
        };
        const controller = new ChatGPTPromptAutocompleteController({
            getComposerInputElement: () => composer, getComposerKind: () => 'textarea',
        } as any, client);
        controller.setEnabled(false);
        controller.init();
        expect(controller.canOpenSuggestions()).toBe(true);
        expect(await controller.openSuggestions()).toBe(true);
        expect(composer.value).toBe('before after');
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();
        expect(event.defaultPrevented).toBe(true);
        expect(composer.value).toBe('before Rewrite after');
        expect(composer.selectionStart).toBe(15);
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        controller.dispose();
    });

    it('does not manually open during composition, inside formula authoring, or for another focused input', async () => {
        const composer = createTextareaComposer('$\\re');
        composer.focus();
        const client = { listPrompts: vi.fn(async () => [createPrompt({})]), recordUse: vi.fn(), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.init();
        controller.setFormulaAuthoringEnabled(true);
        expect(controller.canOpenSuggestions()).toBe(false);
        composer.value = '';
        composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        expect(await controller.openSuggestions()).toBe(false);
        composer.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        const input = document.createElement('input'); document.body.append(input); input.focus();
        expect(controller.canOpenSuggestions()).toBe(false);
        expect(client.listPrompts).not.toHaveBeenCalled();
        controller.dispose();
    });

    it.each(['Enter', 'Tab', 'ArrowRight'])('keeps accepted %s repeats away from the host until keyup', async (key) => {
        const composer = createTextareaComposer(''); composer.focus();
        const client = { listPrompts: vi.fn(async () => [createPrompt({ content: 'Inserted {{cursor}}' })]), recordUse: vi.fn(async () => undefined), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init();
        controller.setAnnotationComposer(content => content);
        const hostKeydown = vi.fn(); document.addEventListener('keydown', hostKeydown);
        const press = (repeat = false, isComposing = false) => {
            const event = new KeyboardEvent('keydown', { key, code: key, repeat, isComposing, bubbles: true, composed: true, cancelable: true });
            composer.dispatchEvent(event); return event;
        };
        try {
            expect(await controller.openSuggestions()).toBe(true);
            expect(press().defaultPrevented).toBe(true);
            expect(press(true).defaultPrevented).toBe(true);
            await tick();
            expect(composer.value).toBe('Inserted ');
            expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
            expect(press(true).defaultPrevented).toBe(true);
            expect(hostKeydown).not.toHaveBeenCalled();
            expect(client.recordUse).toHaveBeenCalledTimes(1);
            composer.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, composed: true }));
            expect(press().defaultPrevented).toBe(false);
            expect(hostKeydown).toHaveBeenCalledTimes(1);
        } finally { controller.dispose(); document.removeEventListener('keydown', hostKeydown); }
    });

    it.each(['blur', 'dispose'])('clears the accepted-key guard on %s and leaves IME input alone', async cleanup => {
        const composer = createTextareaComposer(''); composer.focus();
        const client = { listPrompts: vi.fn(async () => [createPrompt({ content: 'Inserted' })]), recordUse: vi.fn(async () => undefined), savePrompt: vi.fn(), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getComposerInputElement: () => composer, getComposerKind: () => 'textarea' } as any, client);
        controller.setEnabled(false); controller.init();
        await controller.openSuggestions();
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
        await tick();
        const ime = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, isComposing: true, bubbles: true, composed: true, cancelable: true });
        composer.dispatchEvent(ime);
        expect(ime.defaultPrevented).toBe(false);
        if (cleanup === 'dispose') controller.dispose(); else window.dispatchEvent(new Event('blur'));
        const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, composed: true, cancelable: true });
        composer.dispatchEvent(repeat);
        expect(repeat.defaultPrevented).toBe(false);
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
        expect(host.style.top).toBe('296px');
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
        const hint = shadow.querySelector<HTMLElement>('[data-role="prompt-autocomplete-hint"]');
        expect(hint?.textContent).toContain('\\');
        expect(hint?.textContent).toContain('→');

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

    it('uses ArrowRight to insert the selected prompt composed with current annotations', async () => {
        const composer = createComposer('\\re');
        const prompt = createPrompt({
            id: 'rewrite-with-annotations',
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
        const composeAnnotations = vi.fn((userPrompt: string) => (
            `${userPrompt.replace('{{cursor}}', '').trim()}\n\n1. **Selected quote**\n   Keep this context`
        ));
        controller.setAnnotationComposer(composeAnnotations);
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(true);
        expect(composeAnnotations).toHaveBeenCalledWith(prompt.content);
        expect(parseContenteditableToPlainText(composer)).toBe('Rewrite this clearly:\n\n1. **Selected quote**\n   Keep this context');
        expect(client.recordUse).toHaveBeenCalledWith(prompt.id);
        controller.dispose();
    });

    it('does not claim ArrowRight when the annotation provider has no current annotations', async () => {
        const composer = createComposer('\\re');
        const prompt = createPrompt({ id: 'rewrite-empty', triggerText: 'rewrite' });
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
        controller.setAnnotationComposer(() => '');
        controller.init();
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        await tick();

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        composer.dispatchEvent(event);
        await tick();

        expect(event.defaultPrevented).toBe(false);
        expect(parseContenteditableToPlainText(composer)).toBe('\\re');
        expect(client.recordUse).not.toHaveBeenCalled();
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

    it('keeps compact manager actions named and opens the editor through pointerdown and click', async () => {
        setViewport(320, 360);
        const composer = createComposer('');
        const trigger = document.createElement('button');
        document.body.append(trigger);
        const prompt = createPrompt({ id: 'long', title: '很长的提示词名称 with an English explanation', enabled: false });
        const client = { listPrompts: vi.fn(async () => [prompt]), recordUse: vi.fn(), savePrompt: vi.fn(async value => value), deletePrompt: vi.fn(), restoreDefaults: vi.fn() };
        const controller = new ChatGPTPromptAutocompleteController({ getPlatformId: () => 'chatgpt', getComposerInputElement: () => composer } as any, client as any);
        controller.init();
        try {
            await controller.openManager(trigger);
            const shadow = document.getElementById('aimd-chatgpt-prompt-popover-host')!.shadowRoot!;
            const add = shadow.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')!;
            expect(add.getAttribute('aria-label')).toBeTruthy();
            expect(shadow.querySelector('[data-role="prompt-search"]')?.getAttribute('aria-label')).toBeTruthy();
            expect(shadow.querySelector('[data-action="toggle-prompt-enabled"]')?.getAttribute('aria-label')).toContain(prompt.title);
            add.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            add.click();
            await tick();
            const content = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!;
            expect(content).toBeTruthy();
            expect(shadow.querySelector('[data-action="save-prompt"]')?.getAttribute('aria-label')).toBeTruthy();
            content.value = '保留这段正文 and its cursor position';
            content.setSelectionRange(4, 4);
            const insert = shadow.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]')!;
            insert.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            insert.click();
            expect(content.value).toBe('保留这段{{cursor}}正文 and its cursor position');
            expect(insert.disabled).toBe(true);
        } finally { controller.dispose(); }
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

    it('rerenders an open prompt manager on locale changes without losing its search state or focus', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
            const url = String(input);
            const messages = url.includes('/zh_CN/')
                ? { promptSearchPlaceholder: { message: '搜索 Prompt' } }
                : { promptSearchPlaceholder: { message: 'Search prompts' } };
            return { ok: true, json: async () => messages } as Response;
        }));
        await setLocale('en');
        const composer = createComposer('');
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
        await controller.openManager();

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        let search = host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.value = 'rewrite';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search = host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.focus();

        await setLocale('zh_CN');

        const translatedSearch = host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        expect(translatedSearch.placeholder).toBe('搜索 Prompt');
        expect(translatedSearch.value).toBe('rewrite');
        expect(host.shadowRoot!.activeElement).toBe(translatedSearch);

        controller.dispose();
        await setLocale('auto');
        vi.unstubAllGlobals();
    });

    it('opens the real prompt manager as an anchored Surface and restores its trigger on Escape', async () => {
        const composer = createComposer('');
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        anchor.focus();
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
        await controller.openManager(anchor);

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        const root = host.shadowRoot!.querySelector<HTMLElement>('.prompt-popover')!;
        expect(root.dataset.motionState).toBe('opening');
        expect(root.style.getPropertyValue('--_surface-motion-open-duration')).toBe('180ms');

        const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            composed: true,
            cancelable: true,
        });
        host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!.dispatchEvent(escape);

        expect(escape.defaultPrevented).toBe(true);
        expect(document.getElementById('aimd-chatgpt-prompt-popover-host')).toBeNull();
        expect(document.activeElement).toBe(anchor);
        controller.dispose();
    });

    it('keeps the prompt manager within a 320px viewport without enforcing a wider minimum', async () => {
        setViewport(320, 568);
        const restoreRange = installAutocompleteLayoutMock({ popoverHeight: 500 });
        const composer = createComposer('');
        const anchor = document.createElement('button');
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rect(280, 500, 32, 32));
        document.body.appendChild(anchor);
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
        await controller.openManager(anchor);

        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(host.style.width).toBe('288px');
        expect(Number.parseFloat(host.style.left)).toBeGreaterThanOrEqual(16);
        expect(Number.parseFloat(host.style.left) + 288).toBeLessThanOrEqual(304);

        controller.dispose();
        restoreRange();
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
        expect(host.style.getPropertyValue('--_prompt-popover-max-height')).toBe('630px');
        expect(host.style.getPropertyValue('--aimd-prompt-popover-max-height')).toBe('');
        expect(styles).toContain('.prompt-popover--manager');
        expect(host.shadowRoot!.querySelector('.prompt-manager-body .manager-list')).toBeTruthy();
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
        expect(styles).toContain('max-height: min(320px, calc(var(--_prompt-popover-max-height, 630px) - 220px));');

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
