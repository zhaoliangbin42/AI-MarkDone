import { describe, expect, it, vi } from 'vitest';

import { BookmarksTabView } from '@/ui/content/bookmarks/ui/tabs/BookmarksTabView';

describe('BookmarksTabView', () => {
    it('keeps distinct platform icons in the filter menu', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT', 'Gemini', 'Claude', 'DeepSeek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const root = view.getElement();
        const options = Array.from(root.querySelectorAll<HTMLElement>('.aimd-platform-option'));
        const optionByLabel = new Map(
            options.map((opt) => [opt.querySelector('.aimd-platform-option-label')?.textContent ?? '', opt] as const)
        );

        const chatgptIconHtml = optionByLabel.get('ChatGPT')?.querySelector('.aimd-platform-option-icon')?.innerHTML;
        const geminiIconHtml = optionByLabel.get('Gemini')?.querySelector('.aimd-platform-option-icon')?.innerHTML;
        const claudeIconHtml = optionByLabel.get('Claude')?.querySelector('.aimd-platform-option-icon')?.innerHTML;
        const deepseekIconHtml = optionByLabel.get('DeepSeek')?.querySelector('.aimd-platform-option-icon')?.innerHTML;

        expect(chatgptIconHtml).toBeTruthy();
        expect(geminiIconHtml).toBeTruthy();
        expect(claudeIconHtml).toBeTruthy();
        expect(deepseekIconHtml).toBeTruthy();
        expect(geminiIconHtml).not.toBe(chatgptIconHtml);
        expect(claudeIconHtml).not.toBe(chatgptIconHtml);
        expect(deepseekIconHtml).not.toBe(chatgptIconHtml);
    });

    it('shows the ascending alphabetical icon when sort mode is alpha-asc', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'alpha-asc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const root = view.getElement();
        const sortButtons = root.querySelectorAll<HTMLButtonElement>('.aimd-toolbar-group--sort .aimd-icon-btn');
        const alphaBtn = sortButtons[1];

        expect(alphaBtn.innerHTML).toContain('m3 8 4-4 4 4');
        expect(alphaBtn.innerHTML).toContain('M7 4v16');
        expect(alphaBtn.innerHTML).not.toContain('m3 16 4 4 4-4');
    });

    it('allows a selected folder to render as collapsed when its node state is collapsed', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Personal/Ideas', name: 'Ideas', depth: 2, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: false,
                        isSelected: true,
                    },
                ],
                selectedFolderPath: 'Personal/Ideas',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const row = view.getElement().querySelector<HTMLElement>('.aimd-tree-item--folder');
        const children = view.getElement().querySelector<HTMLElement>('.aimd-tree-children');

        expect(row?.getAttribute('aria-expanded')).toBe('false');
        expect(children?.dataset.expanded).toBe('0');
    });
});
