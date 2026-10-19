import { describe, expect, it, vi } from 'vitest';
import type { PromptRecord } from '@/core/prompts/promptLibrary';
import { PromptSurfaceRenderer } from '@/ui/content/prompts/PromptSurfaceRenderer';

const prompt: PromptRecord = {
    id: 'rewrite', title: 'Rewrite', content: 'Rewrite this:\n{{cursor}}', triggerText: 'rewrite',
    contexts: ['composer', 'readerComment'], favorite: false, enabled: true,
    createdAt: 1, updatedAt: 1, lastUsedAt: null,
};

describe('PromptSurfaceRenderer', () => {
    it('keeps manual empty candidates distinct from the manager and exposes an explicit library action', () => {
        const root = document.createElement('div');
        const onAction = vi.fn();
        const renderer = new PromptSurfaceRenderer(root, { onAction });
        renderer.render({ mode: 'autocomplete', prompts: [], suggestions: [], selectedIndex: 0, managerQuery: '', editPrompt: null, statusMessage: '', manualAutocomplete: true });
        expect(root.querySelector('[role="status"]')).toBeTruthy();
        expect(root.querySelector('[data-role="prompt-search"]')).toBeNull();
        root.querySelector<HTMLButtonElement>('[data-action="open-prompt-library"]')!.click();
        expect(onAction).toHaveBeenCalledWith({ type: 'open-library' });
        renderer.destroy();
    });

    it('updates active candidates in place and scrolls only their internal list', () => {
        const root = document.createElement('div'); document.body.append(root);
        const renderer = new PromptSurfaceRenderer(root, { onAction: vi.fn() });
        renderer.render({ mode: 'autocomplete', prompts: [prompt], suggestions: Array.from({ length: 8 }, (_, index) => ({ ...prompt, id: String(index) })), selectedIndex: 0, managerQuery: '', editPrompt: null, statusMessage: '' });
        const list = root.querySelector<HTMLElement>('.prompt-list')!;
        const selected = list.querySelector<HTMLElement>('[data-index="7"]')!;
        list.scrollTop = 40;
        Object.defineProperties(list, { clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 480 } });
        vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 100 } as DOMRect);
        vi.spyOn(selected, 'getBoundingClientRect').mockReturnValue({ top: 360, bottom: 400 } as DOMRect);
        const pageScroll = vi.spyOn(window, 'scrollTo');
        renderer.syncAutocompleteSelection(7, true);
        expect(root.querySelector('.prompt-list')).toBe(list);
        expect(selected.getAttribute('aria-selected')).toBe('true');
        expect(list.scrollTop).toBe(340);
        expect(pageScroll).not.toHaveBeenCalled();
        renderer.destroy(); root.remove();
    });

    it('aligns an oversized candidate to its top without alternating scroll positions', () => {
        const root = document.createElement('div'); document.body.append(root);
        const renderer = new PromptSurfaceRenderer(root, { onAction: vi.fn() });
        renderer.render({ mode: 'autocomplete', prompts: [prompt], suggestions: [prompt], selectedIndex: 0, managerQuery: '', editPrompt: null, statusMessage: '' });
        const list = root.querySelector<HTMLElement>('.prompt-list')!;
        const row = list.querySelector<HTMLElement>('[data-index="0"]')!;
        Object.defineProperties(list, { clientHeight: { configurable: true, value: 80 }, scrollHeight: { configurable: true, value: 1000 } });
        vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 80 } as DOMRect);
        vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => ({ top: 200 - list.scrollTop, bottom: 360 - list.scrollTop } as DOMRect));
        renderer.syncAutocompleteSelection(0, true);
        expect(list.scrollTop).toBe(200);
        renderer.syncAutocompleteSelection(0, true);
        renderer.syncAutocompleteSelection(0, true);
        expect(list.scrollTop).toBe(200);
        renderer.destroy(); root.remove();
    });

    it('renders retry rather than a false empty state after manager load failure', () => {
        const root = document.createElement('div');
        const onAction = vi.fn();
        const renderer = new PromptSurfaceRenderer(root, { onAction });
        renderer.render({
            mode: 'manager', prompts: [], suggestions: [], selectedIndex: 0,
            managerQuery: '', editPrompt: null, statusMessage: 'Extension context invalidated.',
            dataState: 'error',
        });

        expect(root.textContent).not.toContain('promptNoPrompts');
        root.querySelector<HTMLButtonElement>('[data-action="retry-prompts"]')!.click();
        expect(onAction).toHaveBeenCalledWith({ type: 'retry-load' });
        renderer.destroy();
    });

    it('renders manager DOM through one delegated action interface', () => {
        const root = document.createElement('div');
        const onAction = vi.fn();
        const renderer = new PromptSurfaceRenderer(root, { onAction });
        renderer.render({
            mode: 'manager', prompts: [prompt], suggestions: [], selectedIndex: 0,
            managerQuery: '', editPrompt: null, statusMessage: '',
        });

        root.querySelector<HTMLButtonElement>('[data-action="edit-prompt"]')?.click();
        const search = root.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.value = 'rew';
        search.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(onAction).toHaveBeenCalledWith({ type: 'edit', promptId: 'rewrite' });
        expect(onAction).toHaveBeenCalledWith({ type: 'search', query: 'rew' });
        renderer.destroy();
    });

    it('keeps editor placeholder mechanics inside rendering and exposes only the semantic draft', () => {
        const root = document.createElement('div');
        const onAction = vi.fn();
        const renderer = new PromptSurfaceRenderer(root, { onAction });
        renderer.render({
            mode: 'edit', prompts: [prompt], suggestions: [], selectedIndex: 0,
            managerQuery: '', editPrompt: { ...prompt, content: 'Body' }, statusMessage: '',
        });
        const content = root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!;
        content.setSelectionRange(4, 4);
        root.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="save-prompt"]')?.click();

        expect(content.value).toBe('Body{{cursor}}');
        expect(onAction).toHaveBeenCalledWith({
            type: 'save',
            draft: { title: 'Rewrite', triggerText: 'rewrite', content: 'Body{{cursor}}' },
        });
        renderer.destroy();
    });

    it('preserves focused search state across locale or appearance rerenders', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const renderer = new PromptSurfaceRenderer(root, { onAction: vi.fn() });
        const view = {
            mode: 'manager' as const, prompts: [prompt], suggestions: [], selectedIndex: 0,
            managerQuery: 'rew', editPrompt: null, statusMessage: '',
        };
        renderer.render(view);
        const search = root.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        search.focus();
        search.setSelectionRange(1, 2);
        renderer.renderPreservingFocus(view);

        const next = root.querySelector<HTMLInputElement>('[data-role="prompt-search"]')!;
        expect(document.activeElement).toBe(next);
        expect([next.selectionStart, next.selectionEnd]).toEqual([1, 2]);
        renderer.destroy();
    });
});
