import { describe, expect, it, vi } from 'vitest';

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
import fs from 'node:fs';
import path from 'node:path';

describe('BookmarkSaveDialog', () => {
    it('resolves with title + folderPath on save', async () => {
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
});
