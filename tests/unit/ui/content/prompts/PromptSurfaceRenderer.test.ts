import { describe, expect, it, vi } from 'vitest';
import type { PromptRecord } from '@/core/prompts/promptLibrary';
import { PromptSurfaceRenderer } from '@/ui/content/prompts/PromptSurfaceRenderer';

const prompt: PromptRecord = {
    id: 'rewrite', title: 'Rewrite', content: 'Rewrite this:\n{{cursor}}', triggerText: 'rewrite',
    contexts: ['composer', 'readerComment'], favorite: false, enabled: true,
    createdAt: 1, updatedAt: 1, lastUsedAt: null,
};

describe('PromptSurfaceRenderer', () => {
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
