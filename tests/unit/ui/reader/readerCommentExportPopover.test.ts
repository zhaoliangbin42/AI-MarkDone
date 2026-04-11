import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderCommentExportPopover } from '@/ui/content/reader/ReaderCommentExportPopover';

function createHost(): { host: HTMLElement; shadow: ShadowRoot; container: HTMLElement } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.className = 'panel-window--reader';
    shadow.appendChild(container);
    return { host, shadow, container };
}

describe('ReaderCommentExportPopover', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('supports multiline prompt fields and keeps preview line breaks intact', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onChange = vi.fn();

        popover.open({
            shadow,
            container,
            theme: 'light',
            prompts: {
                userPrompt: 'Header',
                prompt1: 'Regarding',
                prompt2: 'comment:',
                prompt3: 'Thanks',
            },
            preview: 'Header\n1. Regarding source\ncomment: note\nThanks',
            canCopy: true,
            onChange,
            onCopy: async () => true,
        });

        const prompt1 = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt1"]');
        const prompt2 = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt2"]');
        const prompt3 = shadow.querySelector<HTMLTextAreaElement>('[data-role="prompt3"]');
        const preview = shadow.querySelector<HTMLElement>('[data-role="preview"]');

        expect(prompt1?.tagName).toBe('TEXTAREA');
        expect(prompt2?.tagName).toBe('TEXTAREA');
        expect(prompt3?.tagName).toBe('TEXTAREA');
        expect(preview?.textContent).toContain('\n1. ');

        prompt1!.value = 'Regarding\n';
        prompt1!.dispatchEvent(new Event('input', { bubbles: true }));
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            prompt1: 'Regarding\n',
        }));
    });
});
