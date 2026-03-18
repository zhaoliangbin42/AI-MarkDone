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
        expect(source).toContain('tailwind-overlay.css?inline');

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

        expect(document.getElementById('aimd-bookmark-save-dialog-host')).toBeNull();

        await setLocale('zh_CN');
        await flushUi();

        expect(document.getElementById('aimd-bookmark-save-dialog-host')).toBeNull();

        await expect(promise).resolves.toEqual({ ok: false, reason: 'cancel' });
    });
});
