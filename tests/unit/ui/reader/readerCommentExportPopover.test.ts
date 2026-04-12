import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createDefaultCommentTemplate } from '@/services/reader/commentExport';
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

    it('renders token insertion controls and emits structured template updates', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onChange = vi.fn();

        popover.open({
            shadow,
            container,
            theme: 'light',
            prompts: {
                userPrompt: 'Header',
                commentTemplate: createDefaultCommentTemplate(),
            },
            preview: 'Header\n\n1. Regarding\n   source\n   My comment is:\n   note',
            canCopy: true,
            onChange,
            onCopy: async () => true,
            labels: {
                template: 'Comment template',
                templateHint: 'Use token buttons.',
                insertSelectedSource: 'Insert selected source',
                insertUserComment: 'Insert user comment',
                tokenSelectedSource: 'Selected source',
                tokenUserComment: 'User comment',
            },
        });

        const insertSelectedSource = shadow.querySelector<HTMLButtonElement>('[data-action="insert-selected-source"]');
        const insertUserComment = shadow.querySelector<HTMLButtonElement>('[data-action="insert-user-comment"]');
        const editor = shadow.querySelector<HTMLElement>('[data-role="commentTemplate"]');
        const preview = shadow.querySelector<HTMLElement>('[data-role="preview"]');
        const closeButton = shadow.querySelector<HTMLButtonElement>('[data-action="close"]');
        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        const hint = shadow.querySelector<HTMLElement>('.reader-comment-export__hint');

        expect(insertSelectedSource?.textContent).toContain('Insert selected source');
        expect(insertUserComment?.textContent).toContain('Insert user comment');
        expect(editor?.querySelectorAll('[data-token-key]').length).toBe(2);
        expect(preview?.textContent).toContain('\n\n1. ');
        expect(closeButton?.className).toContain('icon-btn');
        expect(copyButton?.className).toContain('secondary-btn');
        expect(copyButton?.className).toContain('secondary-btn--primary');
        expect(hint?.textContent).toContain('Use token buttons.');

        insertSelectedSource!.click();
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
            commentTemplate: expect.arrayContaining([
                expect.objectContaining({ type: 'token', key: 'selected_source' }),
            ]),
        }));
    });

    it('does not insert tokens when the editor itself is clicked', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onChange = vi.fn();

        popover.open({
            shadow,
            container,
            theme: 'light',
            prompts: {
                userPrompt: 'Header',
                commentTemplate: createDefaultCommentTemplate(),
            },
            preview: 'Header',
            canCopy: true,
            onChange,
            onCopy: async () => true,
        });

        const editor = shadow.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;
        const beforeCount = editor.querySelectorAll('[data-token-key="selected_source"]').length;

        editor.click();

        const afterCount = editor.querySelectorAll('[data-token-key="selected_source"]').length;
        expect(afterCount).toBe(beforeCount);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('uses the same rounded surface and field tokens as the main comment popover', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/ReaderCommentExportPopover.ts'), 'utf8');

        expect(source).toContain('border-radius: var(--aimd-radius-2xl);');
        expect(source).toContain('box-shadow: var(--aimd-shadow-lg);');
        expect(source).toContain('border-radius: var(--aimd-radius-xl);');
        expect(source).not.toContain('border-radius: var(--aimd-radius-lg);');
    });
});
