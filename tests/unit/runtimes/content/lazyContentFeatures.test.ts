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
import { createAppearanceSnapshot } from '@/style/appearance';

describe('lazy content features', () => {
    it('keeps Reader code unloaded until show and replays current configuration before rendering', async () => {
        const actualReader = {
            setAppearance: vi.fn(),
            setReaderSettings: vi.fn(),
            setReaderSettingsController: vi.fn(),
            setPromptManagerController: vi.fn(),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => []),
            appendItem: vi.fn(async () => undefined),
            replaceItems: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => null),
        };
        const createReaderPanel = vi.fn(() => actualReader);
        const setContentFeatureLocale = vi.fn(async () => undefined);
        const importer = vi.fn(async () => ({
            setContentFeatureLocale,
            createReaderPanel,
            createBookmarksPanel: vi.fn(),
        }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const reader = createLazyReaderPanel(loader);
        const settingsController = { onChange: vi.fn() };
        const promptController = { onOpenManager: vi.fn(), listReaderPrompts: vi.fn(async () => []) };

        reader.setAppearance(createAppearanceSnapshot('dark', { accentColor: '#2563eb' }));
        reader.setReaderSettings({ contentMaxWidthPx: 900 } as any);
        reader.setReaderSettingsController(settingsController as any);
        reader.setPromptManagerController(promptController as any);

        expect(importer).not.toHaveBeenCalled();

        await reader.show([], 0, 'dark');

        expect(importer).toHaveBeenCalledTimes(1);
        expect(createReaderPanel).toHaveBeenCalledTimes(1);
        expect(actualReader.setAppearance).toHaveBeenCalledWith(expect.objectContaining({
            theme: 'dark',
            overrides: { accentColor: '#2563eb' },
        }));
        expect(actualReader.setReaderSettings).toHaveBeenCalledWith({ contentMaxWidthPx: 900 });
        expect(actualReader.setReaderSettingsController).toHaveBeenCalledWith(settingsController);
        expect(actualReader.setPromptManagerController).toHaveBeenCalledWith(promptController);
        expect(actualReader.show).toHaveBeenCalledWith([], 0, 'dark', undefined);

        const replacement = [{ id: 'branch-b', userPrompt: 'B', content: 'new' }];
        await reader.replaceItems(replacement, { preserveCurrentIdentity: true });
        expect(actualReader.replaceItems).toHaveBeenCalledWith(replacement, { preserveCurrentIdentity: true });
    });

    it('shares the imported feature module between Reader and Bookmarks triggers', async () => {
        const actualReader = {
            setAppearance: vi.fn(),
            setReaderSettings: vi.fn(),
            setReaderSettingsController: vi.fn(),
            setPromptManagerController: vi.fn(),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isShowingConversationReader: vi.fn(() => false),
            getItemsSnapshot: vi.fn(() => []),
            appendItem: vi.fn(async () => undefined),
            replaceItems: vi.fn(async () => undefined),
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
        const setContentFeatureLocale = vi.fn(async () => undefined);
        const importer = vi.fn(async () => ({
            setContentFeatureLocale,
            createReaderPanel,
            createBookmarksPanel,
        }));
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

    it('applies the saved locale inside the lazy module graph before opening Bookmarks', async () => {
        const actualBookmarks = {
            toggle: vi.fn(async () => undefined),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isVisible: vi.fn(() => true),
        };
        const setContentFeatureLocale = vi.fn(async () => undefined);
        const createBookmarksPanel = vi.fn(() => actualBookmarks);
        const importer = vi.fn(async () => ({
            setContentFeatureLocale,
            createReaderPanel: vi.fn(),
            createBookmarksPanel,
        }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const reader = createLazyReaderPanel(loader);
        const bookmarks = createLazyBookmarksPanel({} as any, reader, {}, loader);

        loader.setLocale('zh_CN');
        await bookmarks.toggle();

        expect(setContentFeatureLocale).toHaveBeenCalledWith('zh_CN');
        expect(setContentFeatureLocale.mock.invocationCallOrder[0]).toBeLessThan(
            createBookmarksPanel.mock.invocationCallOrder[0]!,
        );
        expect(actualBookmarks.toggle).toHaveBeenCalledTimes(1);
    });

    it('waits for an in-flight locale update before creating another lazy surface', async () => {
        let finishChineseLocale: (() => void) | null = null;
        const setContentFeatureLocale = vi.fn((locale: string) => {
            if (locale !== 'zh_CN') return Promise.resolve();
            return new Promise<void>((resolve) => {
                finishChineseLocale = resolve;
            });
        });
        const actualReader = {
            setAppearance: vi.fn(),
            setReaderSettings: vi.fn(),
            setReaderSettingsController: vi.fn(),
            setPromptManagerController: vi.fn(),
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            isShowingConversationReader: vi.fn(() => false),
            getItemsSnapshot: vi.fn(() => []),
            appendItem: vi.fn(async () => undefined),
            replaceItems: vi.fn(async () => undefined),
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
        const importer = vi.fn(async () => ({
            setContentFeatureLocale,
            createReaderPanel,
            createBookmarksPanel,
        }));
        const loader = new ContentFeatureModuleLoader(importer as any);
        const reader = createLazyReaderPanel(loader);
        const bookmarks = createLazyBookmarksPanel({} as any, reader, {}, loader);

        loader.setLocale('en');
        await reader.show([], 0, 'light');

        loader.setLocale('zh_CN');
        const opening = bookmarks.toggle();
        await Promise.resolve();
        await Promise.resolve();

        expect(setContentFeatureLocale).toHaveBeenLastCalledWith('zh_CN');
        expect(createBookmarksPanel).not.toHaveBeenCalled();

        finishChineseLocale?.();
        await opening;

        expect(createBookmarksPanel).toHaveBeenCalledTimes(1);
        expect(actualBookmarks.toggle).toHaveBeenCalledTimes(1);
    });

    it('defers export and bookmark dialogs while replaying their latest configuration on first use', async () => {
        const actualSaveMessages = {
            setAppearance: vi.fn(),
            setExportSettings: vi.fn(),
            setMarkdownFormulaFormat: vi.fn(),
            open: vi.fn(async () => undefined),
        };
        const actualBookmarkSave = {
            setAppearance: vi.fn(),
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
            setContentFeatureLocale: vi.fn(async () => undefined),
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

        const appearance = createAppearanceSnapshot('dark', { accentColor: '#2563eb' });
        saveMessages.setAppearance(appearance);
        saveMessages.setExportSettings({ pngWidthPreset: 'desktop' } as any);
        saveMessages.setMarkdownFormulaFormat('raw');
        bookmarkSave.setAppearance(appearance);
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
        expect(actualSaveMessages.setAppearance).toHaveBeenCalledWith(appearance);
        expect(actualSaveMessages.setExportSettings).toHaveBeenCalledWith({ pngWidthPreset: 'desktop' });
        expect(actualSaveMessages.setMarkdownFormulaFormat).toHaveBeenCalledWith('raw');
        expect(actualSaveMessages.open).toHaveBeenCalledWith({}, 'dark');
        expect(actualBookmarkSave.setAppearance).toHaveBeenCalledWith(appearance);
        expect(copyMessagePng).toHaveBeenCalledTimes(1);
        expect(runFormulaAssetAction).toHaveBeenCalledTimes(1);
        expect(renderFormulaSvgAsset).toHaveBeenCalledTimes(1);
    });
});
