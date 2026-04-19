import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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

    it('renders a compiled preview and copy action without configuration fields', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onCopy = vi.fn(async () => true);

        popover.open({
            shadow,
            container,
            theme: 'light',
            preview: 'Header\n\n1. Compiled comment',
            canCopy: true,
            onCopy,
            labels: {
                title: 'Copy comments',
                copy: 'Copy comments',
                empty: 'No comments yet.',
            },
        });

        const preview = shadow.querySelector<HTMLElement>('[data-role="preview"]');
        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        const closeButton = shadow.querySelector<HTMLButtonElement>('[data-action="close"]');

        expect(preview?.textContent).toContain('1. Compiled comment');
        expect(copyButton?.className).toContain('secondary-btn');
        expect(copyButton?.className).toContain('secondary-btn--primary');
        expect(closeButton?.className).toContain('icon-btn');
        expect(shadow.querySelector('[data-role="userPrompt"]')).toBeNull();
        expect(shadow.querySelector('[data-role="commentTemplate"]')).toBeNull();
        expect(shadow.querySelector('[data-action="insert-selected-source"]')).toBeNull();

        copyButton?.click();
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('uses the same rounded surface and field tokens as the main comment popover', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/ReaderCommentExportPopover.ts'), 'utf8');

        expect(source).toContain('border-radius: var(--aimd-radius-2xl);');
        expect(source).toContain('box-shadow: var(--aimd-shadow-lg);');
        expect(source).toContain('border-radius: var(--aimd-radius-xl);');
        expect(source).not.toContain('[data-role="commentTemplate"]');
    });
});
