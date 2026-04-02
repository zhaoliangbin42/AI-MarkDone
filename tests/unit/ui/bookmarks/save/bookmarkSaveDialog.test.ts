import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/drivers/shared/clients/bookmarksClient', () => {
    return {
        bookmarksClient: {
            foldersList: vi.fn(async () => ({
                ok: true,
                data: {
                    folderPaths: ['Import', 'Work', 'Work/Research'],
                    folders: [
                        { path: 'Import', name: 'Import', depth: 1 },
                        { path: 'Work', name: 'Work', depth: 1 },
                        { path: 'Work/Research', name: 'Research', depth: 2 },
                    ],
                },
            })),
            uiStateGetLastSelectedFolderPath: vi.fn(async () => ({ ok: true, data: { value: 'Work' } })),
            uiStateSetLastSelectedFolderPath: vi.fn(async () => ({ ok: true, data: { value: 'Work' } })),
            foldersCreate: vi.fn(async () => ({ ok: true, data: {} })),
        },
    };
});

import { BookmarkSaveDialog } from '@/ui/content/bookmarks/save/BookmarkSaveDialog';
import { setLocale } from '@/ui/content/components/i18n';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('BookmarkSaveDialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                const target = String(url);
                if (target.includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('zh_CN') } as any;
                }
                if (target.includes('_locales/en/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('en') } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );
    });

    afterEach(async () => {
        document.body.innerHTML = '';
        await setLocale('en');
        vi.unstubAllGlobals();
    });

    it('resolves with title + folderPath on save', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        // Wait for mount + initial render.
        await new Promise((r) => setTimeout(r, 0));

        const host = document.getElementById('aimd-bookmark-save-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/save/BookmarkSaveDialog.ts'), 'utf8');

        expect(shadow.querySelector('[data-role="overlay-backdrop-root"] .panel-stage__overlay')).toBeTruthy();
        expect(shadow.querySelector('[data-role="overlay-surface-root"] .panel-window.panel-window--dialog.panel-window--bookmark-save')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--bookmark-save .panel-header__meta--reader h2')?.textContent).toBe('Save Bookmark');
        expect(shadow.querySelector('.panel-window--bookmark-save .panel-footer')?.className).toContain('panel-footer--bookmark-save');
        expect(source).toContain('OverlaySession');
        expect(source).not.toContain('BookmarksOverlaySession');
        expect(source).not.toContain('overlayCssText');

        const title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
        title.value = 'My title';
        title.dispatchEvent(new Event('input', { bubbles: true }));

        // Select a folder row (Research).
        const row = Array.from(shadow.querySelectorAll<HTMLElement>('.picker-row')).find((r) => r.dataset.path === 'Work/Research');
        const pickerMain = row?.querySelector<HTMLElement>('.picker-main');
        expect(row).toBeTruthy();
        expect(pickerMain).toBeTruthy();
        pickerMain!.click();

        const save = shadow.querySelector<HTMLButtonElement>('[data-action="bookmark-save-submit"]')!;
        expect(save.disabled).toBe(false);
        save.click();

        const res = await promise;
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.folderPath).toBe('Work/Research');
            expect(res.title).toBe('My title');
        }
    });

    it('hides the title input when opened in folder-select mode', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({
            theme: 'light',
            userPrompt: 'Ignored title',
            currentFolderPath: 'Import',
            mode: 'folder-select',
        });

        await new Promise((r) => setTimeout(r, 0));

        const host = document.getElementById('aimd-bookmark-save-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        expect(shadow.querySelector('[data-role="bookmark-save-title"]')).toBeNull();
        expect(shadow.textContent).not.toContain('Title');

        const row = Array.from(shadow.querySelectorAll<HTMLElement>('.picker-row')).find((r) => r.dataset.path === 'Work');
        row?.querySelector<HTMLElement>('.picker-main')?.click();

        const save = shadow.querySelector<HTMLButtonElement>('[data-action="bookmark-save-submit"]')!;
        expect(save.disabled).toBe(false);
        save.click();

        const res = await promise;
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.folderPath).toBe('Work');
        }
    });

    it('updates visible copy when the locale changes while open', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        void dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        const host = document.getElementById('aimd-bookmark-save-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        expect(shadow.querySelector('.panel-window--bookmark-save .panel-header__meta--reader h2')?.textContent).toBe('Save Bookmark');
        expect(shadow.textContent).toContain('Folder');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.panel-window--bookmark-save .panel-header__meta--reader h2')?.textContent).toBe('保存书签');
        expect(shadow.textContent).toContain('文件夹');
    });

    it('stops reacting to locale changes after close', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        document.getElementById('aimd-bookmark-save-dialog-host')!
            .shadowRoot!
            .querySelector<HTMLButtonElement>('[data-action="close-panel"]')!
            .click();
        const host = document.getElementById('aimd-bookmark-save-dialog-host');
        const panel = host?.shadowRoot?.querySelector<HTMLElement>('.panel-window--bookmark-save');
        expect(host).toBeTruthy();
        expect(panel?.dataset.motionState).toBe('closing');
        panel?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await flushUi();

        expect(document.getElementById('aimd-bookmark-save-dialog-host')).toBeNull();

        await setLocale('zh_CN');
        await flushUi();

        expect(document.getElementById('aimd-bookmark-save-dialog-host')).toBeNull();

        await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
    });

    it('keeps primary save hover distinct from neutral secondary hover in the css contract', async () => {
        const { getBookmarkSaveDialogCss } = await import('@/ui/content/bookmarks/save/bookmarkSaveDialogCss');
        const css = getBookmarkSaveDialogCss('light');

        expect(css).not.toContain('.secondary-btn:hover,');
        expect(css).not.toContain('.icon-btn:hover,\n.secondary-btn:hover,');
        expect(css).toContain('.tree-caret:hover');
        expect(css).toContain('.picker-row:hover');
        expect(css).toContain('.picker-row[data-selected="1"]');
        expect(css).not.toContain('.modal-title');
        expect(css).toContain('.mock-modal__title-copy strong');
    });

    it('keeps bookmark save inputs and nested new-folder modal interactions local to the dialog', async () => {
        await setLocale('en');
        const documentClick = vi.fn();
        const documentInput = vi.fn();
        const documentFocusIn = vi.fn();
        const documentKeydown = vi.fn();
        document.addEventListener('click', documentClick);
        document.addEventListener('input', documentInput);
        document.addEventListener('focusin', documentFocusIn);
        document.addEventListener('keydown', documentKeydown);

        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        try {
            const host = document.getElementById('aimd-bookmark-save-dialog-host');
            expect(host).toBeTruthy();
            const shadow = host!.shadowRoot!;
            documentClick.mockClear();
            documentInput.mockClear();
            documentFocusIn.mockClear();
            documentKeydown.mockClear();

            const title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            title.value = 'Research Notes';
            title.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
            title.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
            title.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            expect(documentFocusIn).not.toHaveBeenCalled();
            expect(documentKeydown).not.toHaveBeenCalled();
            expect(documentInput).not.toHaveBeenCalled();

            shadow.querySelector<HTMLElement>('[data-action="bookmark-save-new-root-folder"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await flushUi();

            expect(documentClick).not.toHaveBeenCalled();
            documentFocusIn.mockClear();
            documentKeydown.mockClear();
            documentInput.mockClear();

            const nestedInput = shadow.querySelector<HTMLInputElement>('[data-role="root_folder_input"]');
            expect(nestedInput).toBeTruthy();
            nestedInput!.value = 'Archive';
            nestedInput!.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
            nestedInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
            nestedInput!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            expect(documentFocusIn).not.toHaveBeenCalled();
            expect(documentKeydown).not.toHaveBeenCalled();
            expect(documentInput).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener('click', documentClick);
            document.removeEventListener('input', documentInput);
            document.removeEventListener('focusin', documentFocusIn);
            document.removeEventListener('keydown', documentKeydown);
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
                ?.click();
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLElement>('.panel-window--bookmark-save')
                ?.dispatchEvent(new Event('animationend', { bubbles: true }));
            await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
        }
    });

    it('opens root-folder creation on the shared modal host stack instead of rendering a hand-built modal subtree', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        try {
            const host = document.getElementById('aimd-bookmark-save-dialog-host');
            expect(host).toBeTruthy();
            const shadow = host!.shadowRoot!;

            shadow.querySelector<HTMLElement>('[data-action="bookmark-save-new-root-folder"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await flushUi();

            const modalRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-modal-root"]');
            expect(modalRoot?.querySelector('.mock-modal-host .mock-modal-overlay')).toBeTruthy();
            expect(modalRoot?.querySelector('.mock-modal-host .mock-modal')).toBeTruthy();
            expect(modalRoot?.querySelector('.mock-modal-host [data-action="modal-cancel"]')).toBeTruthy();
            expect(modalRoot?.childElementCount ?? 0).toBeGreaterThan(0);
        } finally {
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
                ?.click();
            await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
        }
    });

    it('keeps focus and selection on the title input across rerenders while typing', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        try {
            const host = document.getElementById('aimd-bookmark-save-dialog-host');
            expect(host).toBeTruthy();
            const shadow = host!.shadowRoot!;

            let title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            title.focus();
            title.value = 'Alpha';
            title.setSelectionRange(2, 2);
            title.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            expect(shadow.activeElement).toBe(title);
            expect(title.value).toBe('Alpha');
            expect(title.selectionStart).toBe(2);
            expect(title.selectionEnd).toBe(2);

            title.value = 'AlXpha';
            title.setSelectionRange(3, 3);
            title.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            expect(shadow.activeElement).toBe(title);
            expect(title.value).toBe('AlXpha');
            expect(title.selectionStart).toBe(3);
            expect(title.selectionEnd).toBe(3);
        } finally {
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
                ?.click();
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLElement>('.panel-window--bookmark-save')
                ?.dispatchEvent(new Event('animationend', { bubbles: true }));
            await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
        }
    });

    it('keeps the same title input node while typing so composition is not interrupted', async () => {
        await setLocale('en');
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        try {
            const host = document.getElementById('aimd-bookmark-save-dialog-host');
            expect(host).toBeTruthy();
            const shadow = host!.shadowRoot!;

            const title = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            title.focus();
            title.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true, data: 'ni' }));
            title.value = '你';
            title.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            const nextTitle = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')!;
            expect(nextTitle).toBe(title);
            expect(shadow.activeElement).toBe(title);

            title.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '你' }));
        } finally {
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
                ?.click();
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLElement>('.panel-window--bookmark-save')
                ?.dispatchEvent(new Event('animationend', { bubbles: true }));
            await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
        }
    });

    it('keeps focus on the inline subfolder input after a failed submit rerender', async () => {
        await setLocale('en');
        const { bookmarksClient } = await import('@/drivers/shared/clients/bookmarksClient');
        vi.mocked(bookmarksClient.foldersCreate).mockResolvedValueOnce({
            ok: false,
            errorCode: 'VALIDATION_FAILED' as any,
            message: 'Already exists',
        } as any);

        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        await new Promise((r) => setTimeout(r, 0));

        try {
            const host = document.getElementById('aimd-bookmark-save-dialog-host');
            expect(host).toBeTruthy();
            const shadow = host!.shadowRoot!;

            shadow.querySelector<HTMLElement>('[data-action="bookmark-save-inline-folder"][data-path="Work"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await new Promise((r) => setTimeout(r, 0));

            let inline = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-inline-draft"][data-parent="Work"]')!;
            inline.focus();
            inline.value = 'Archive';
            inline.setSelectionRange(7, 7);
            inline.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            shadow.querySelector<HTMLElement>('[data-action="bookmark-save-inline-confirm"][data-path="Work"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await flushUi();

            inline = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-inline-draft"][data-parent="Work"]')!;
            expect(shadow.activeElement).toBe(inline);
            expect(inline.value).toBe('Archive');
            expect(inline.selectionStart).toBe(7);
            expect(inline.selectionEnd).toBe(7);
        } finally {
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
                ?.click();
            document.getElementById('aimd-bookmark-save-dialog-host')
                ?.shadowRoot
                ?.querySelector<HTMLElement>('.panel-window--bookmark-save')
                ?.dispatchEvent(new Event('animationend', { bubbles: true }));
            await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
        }
    });
});
