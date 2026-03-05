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

describe('BookmarkSaveDialog', () => {
    it('resolves with title + folderPath on save', async () => {
        const dialog = new BookmarkSaveDialog();
        const promise = dialog.open({ theme: 'light', userPrompt: 'Hello world', currentFolderPath: 'Import' });

        // Wait for mount + initial render.
        await new Promise((r) => setTimeout(r, 0));

        const host = document.documentElement.querySelector<HTMLElement>('.aimd-bookmark-save-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        const title = shadow.querySelector<HTMLInputElement>('[data-role="title"]')!;
        title.value = 'My title';
        title.dispatchEvent(new Event('input', { bubbles: true }));

        // Select a folder row (Research).
        const row = Array.from(shadow.querySelectorAll<HTMLElement>('.row')).find((r) => r.dataset.path === 'Work/Research');
        expect(row).toBeTruthy();
        row!.click();

        const save = shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!;
        expect(save.disabled).toBe(false);
        save.click();

        const res = await promise;
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.folderPath).toBe('Work/Research');
            expect(res.title).toBe('My title');
        }
    });
});

