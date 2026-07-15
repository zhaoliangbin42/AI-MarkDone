import { describe, expect, it, vi } from 'vitest';

import {
    ContentFeatureModuleLoader,
    createLazyBookmarkSaveDialog,
    createLazyBookmarksPanel,
    createLazyCopyMessagePng,
    createLazyRenderFormulaSvgAsset,
    createLazyReaderPanel,
    createLazyRunFormulaAssetAction,
    createLazySaveMessagesDialog,
} from '@/runtimes/content/lazyContentFeatures';

describe('lazy content features', () => {
    it('keeps Reader code unloaded until show and replays current configuration before rendering', async () => {
        const actualReader = {
            setTheme: vi.fn(),
            setThemeOverrides: vi.fn(),
            setReaderSettings: vi.fn(),
            setReaderSettingsController: vi.fn(),
            setPromptManagerController: vi.fn(),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => []),
            appendItem: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => null),
        };
        const createReaderPanel = vi.fn(() => actualReader);
        const importer = vi.fn(async () => ({
            createReaderPanel,
            createBookmarksPanel: vi.fn(),
        }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const reader = createLazyReaderPanel(loader);
        const settingsController = { onChange: vi.fn() };
        const promptController = { onOpenManager: vi.fn(), listReaderPrompts: vi.fn(async () => []) };

        reader.setTheme('dark');
        reader.setThemeOverrides({ accentColor: '#2563eb' });
        reader.setReaderSettings({ contentMaxWidthPx: 900 } as any);
        reader.setReaderSettingsController(settingsController as any);
        reader.setPromptManagerController(promptController as any);

        expect(importer).not.toHaveBeenCalled();

        await reader.show([], 0, 'dark');

        expect(importer).toHaveBeenCalledTimes(1);
        expect(createReaderPanel).toHaveBeenCalledTimes(1);
        expect(actualReader.setTheme).toHaveBeenCalledWith('dark');
        expect(actualReader.setThemeOverrides).toHaveBeenCalledWith({ accentColor: '#2563eb' });
        expect(actualReader.setReaderSettings).toHaveBeenCalledWith({ contentMaxWidthPx: 900 });
        expect(actualReader.setReaderSettingsController).toHaveBeenCalledWith(settingsController);
        expect(actualReader.setPromptManagerController).toHaveBeenCalledWith(promptController);
        expect(actualReader.show).toHaveBeenCalledWith([], 0, 'dark', undefined);
    });

    it('shares the imported feature module between Reader and Bookmarks triggers', async () => {
        const actualReader = {
            setTheme: vi.fn(),
            setThemeOverrides: vi.fn(),
            setReaderSettings: vi.fn(),
            setReaderSettingsController: vi.fn(),
            setPromptManagerController: vi.fn(),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isShowingConversationReader: vi.fn(() => false),
            getItemsSnapshot: vi.fn(() => []),
            appendItem: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => null),
        };
        const actualBookmarks = {
            toggle: vi.fn(async () => undefined),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isVisible: vi.fn(() => true),
        };
        const createReaderPanel = vi.fn(() => actualReader);
        const createBookmarksPanel = vi.fn(() => actualBookmarks);
        const importer = vi.fn(async () => ({ createReaderPanel, createBookmarksPanel }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const reader = createLazyReaderPanel(loader);
        const bookmarks = createLazyBookmarksPanel({} as any, reader, {}, loader);

        expect(importer).not.toHaveBeenCalled();

        await reader.show([], 0, 'light');
        await bookmarks.toggle();

        expect(importer).toHaveBeenCalledTimes(1);
        expect(createReaderPanel).toHaveBeenCalledTimes(1);
        expect(createBookmarksPanel).toHaveBeenCalledWith({}, reader, {});
        expect(actualBookmarks.toggle).toHaveBeenCalledTimes(1);
    });

    it('defers export and bookmark dialogs while replaying their latest configuration on first use', async () => {
        const actualSaveMessages = {
            setTheme: vi.fn(),
            setThemeOverrides: vi.fn(),
            setExportSettings: vi.fn(),
            setMarkdownFormulaFormat: vi.fn(),
            open: vi.fn(async () => undefined),
        };
        const actualBookmarkSave = {
            setTheme: vi.fn(),
            setThemeOverrides: vi.fn(),
            open: vi.fn(async () => ({ ok: false as const })),
        };
        const copyMessagePng = vi.fn(async () => ({ ok: true as const, noop: false }));
        const runFormulaAssetAction = vi.fn(async () => ({ ok: true as const, status: 'copied' as const }));
        const renderFormulaSvgAsset = vi.fn(async () => ({
            source: 'x',
            displayMode: false,
            fontSizePx: 36,
            width: 10,
            height: 5,
            viewBox: '0 0 10 5',
            svg: '<svg/>',
        }));
        const importer = vi.fn(async () => ({
            createReaderPanel: vi.fn(),
            createBookmarksPanel: vi.fn(),
            getSaveMessagesDialog: () => actualSaveMessages,
            getBookmarkSaveDialog: () => actualBookmarkSave,
            copyMessagePng,
            runFormulaAssetAction,
            renderFormulaSvgAsset,
        }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const saveMessages = createLazySaveMessagesDialog(loader);
        const bookmarkSave = createLazyBookmarkSaveDialog(loader);
        const lazyCopyMessagePng = createLazyCopyMessagePng(loader);
        const lazyRunFormulaAssetAction = createLazyRunFormulaAssetAction(loader);
        const lazyRenderFormulaSvgAsset = createLazyRenderFormulaSvgAsset(loader);

        saveMessages.setTheme('dark');
        saveMessages.setThemeOverrides({ accentColor: '#2563eb' });
        saveMessages.setExportSettings({ pngWidthPreset: 'desktop' } as any);
        saveMessages.setMarkdownFormulaFormat('raw');
        bookmarkSave.setTheme('dark');
        bookmarkSave.setThemeOverrides({ accentColor: '#2563eb' });
        expect(importer).not.toHaveBeenCalled();

        await saveMessages.open({} as any, 'dark');
        await bookmarkSave.open({
            theme: 'dark',
            userPrompt: 'Prompt',
            existingTitle: 'Prompt',
            currentFolderPath: 'Root',
            mode: 'create',
        });
        await lazyCopyMessagePng({ user: '', assistant: '', index: 0 }, {} as any, { t: (key: string) => key });
        await lazyRunFormulaAssetAction({
            action: 'copy_svg',
            source: { kind: 'tex', value: 'x', confidence: 'authoritative' },
            displayMode: false,
        });
        await lazyRenderFormulaSvgAsset({ source: 'x', displayMode: false });

        expect(importer).toHaveBeenCalledTimes(1);
        expect(actualSaveMessages.setTheme).toHaveBeenCalledWith('dark');
        expect(actualSaveMessages.setThemeOverrides).toHaveBeenCalledWith({ accentColor: '#2563eb' });
        expect(actualSaveMessages.setExportSettings).toHaveBeenCalledWith({ pngWidthPreset: 'desktop' });
        expect(actualSaveMessages.setMarkdownFormulaFormat).toHaveBeenCalledWith('raw');
        expect(actualSaveMessages.open).toHaveBeenCalledWith({}, 'dark');
        expect(actualBookmarkSave.setTheme).toHaveBeenCalledWith('dark');
        expect(actualBookmarkSave.setThemeOverrides).toHaveBeenCalledWith({ accentColor: '#2563eb' });
        expect(copyMessagePng).toHaveBeenCalledTimes(1);
        expect(runFormulaAssetAction).toHaveBeenCalledTimes(1);
        expect(renderFormulaSvgAsset).toHaveBeenCalledTimes(1);
    });
});
