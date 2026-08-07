import { afterEach, describe, expect, it, vi } from 'vitest';

import { browser } from '@/drivers/shared/browser';
import {
    ContentFeatureModuleLoader,
    createLazyBookmarkSaveDialog,
} from '@/runtimes/content/lazyContentFeatures';

function getDialogShadow(): ShadowRoot {
    return document.getElementById('aimd-bookmark-save-dialog-host')!.shadowRoot!;
}

async function closeDialog(result: Promise<unknown>): Promise<void> {
    const shadow = getDialogShadow();
    const panel = shadow.querySelector<HTMLElement>('.panel-window--bookmark-save')!;
    shadow.querySelector<HTMLButtonElement>('[data-action="close-panel"]')!.click();
    panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    await result;
}

describe('bookmark save dialog runtime boundary', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('reports an invalidated runtime on the first public lazy trigger without showing an empty folder state', async () => {
        vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (request: any) => {
            if (request.type === 'bookmarks:folders:list') {
                throw new Error('Extension context invalidated.');
            }

            return {
                v: request.v,
                id: request.id,
                type: request.type,
                ok: true,
                data: request.type === 'bookmarks:uiState:get' ? { value: null } : {},
            };
        }) as any);

        const loader = new ContentFeatureModuleLoader(async () => ({
            ...(await import('@/runtimes/content/contentFeatures')),
            setContentFeatureLocale: async () => undefined,
        }));
        const dialog = createLazyBookmarkSaveDialog(loader);

        const opening = dialog.open({
            theme: 'light',
            userPrompt: 'Cold start failure',
            currentFolderPath: null,
            mode: 'create',
        });

        await vi.waitFor(() => {
            expect(getDialogShadow().querySelector('[data-role="bookmark-folders-error"]')).toBeTruthy();
        });

        try {
            const shadow = getDialogShadow();
            expect(shadow.querySelector('[data-action="bookmark-save-reload-page"]')).toBeTruthy();
            expect(shadow.querySelector('.picker-row')).toBeNull();
            expect(shadow.textContent).not.toMatch(/No folders yet|暂无文件夹/);
        } finally {
            await closeDialog(opening);
        }
    });

    it('keeps the last folder snapshot and reports a disconnected runtime instead of an empty folder list', async () => {
        let failFolderLoad = false;
        const sendMessage = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation((async (request: any) => {
            const ok = (data: unknown) => ({
                v: request.v,
                id: request.id,
                type: request.type,
                ok: true,
                data,
            });

            if (request.type === 'bookmarks:folders:list') {
                if (failFolderLoad) {
                    throw new Error('Extension context invalidated.');
                }
                return ok({
                    folderPaths: ['Work'],
                    folders: [{
                        path: 'Work',
                        name: 'Work',
                        depth: 1,
                        createdAt: 1,
                        updatedAt: 1,
                    }],
                });
            }

            if (request.type === 'bookmarks:uiState:get') {
                return ok({ value: 'Work' });
            }

            return ok({});
        }) as any);

        const loader = new ContentFeatureModuleLoader(async () => ({
            ...(await import('@/runtimes/content/contentFeatures')),
            setContentFeatureLocale: async () => undefined,
        }));
        const dialog = createLazyBookmarkSaveDialog(loader);

        const firstOpen = dialog.open({
            theme: 'light',
            userPrompt: 'Cached folder test',
            currentFolderPath: 'Work',
            mode: 'create',
        });
        await vi.waitFor(() => {
            expect(getDialogShadow().querySelector('.picker-row[data-path="Work"]')).toBeTruthy();
        });
        await closeDialog(firstOpen);

        failFolderLoad = true;
        const secondOpen = dialog.open({
            theme: 'light',
            userPrompt: 'Cached folder test',
            currentFolderPath: 'Work',
            mode: 'create',
        });

        await vi.waitFor(() => {
            expect(sendMessage.mock.calls.filter(([request]: any[]) => (
                request.type === 'bookmarks:folders:list'
            ))).toHaveLength(2);
        });

        try {
            const shadow = getDialogShadow();
            expect(shadow.querySelector('.picker-row[data-path="Work"][data-selected="1"]')).toBeTruthy();
            expect(shadow.querySelector<HTMLButtonElement>('[data-action="bookmark-save-submit"]')!.disabled).toBe(false);
            expect(shadow.querySelector('[data-role="bookmark-folders-error"]')?.textContent).toContain('Refresh this page');
            expect(shadow.querySelector('[data-action="bookmark-save-reload-page"]')).toBeTruthy();
            expect(shadow.textContent).not.toContain('No folders yet');
        } finally {
            await closeDialog(secondOpen);
        }
    });
});
