import { afterEach, describe, expect, it, vi } from 'vitest';

const ensurePageTokens = vi.fn();
const mathClickEnable = vi.fn();
const mathClickDisable = vi.fn();
const mathClickSetFormulaSettings = vi.fn();
const mathClickCtor = vi.fn(function () {
    return { enable: mathClickEnable, disable: mathClickDisable, setFormulaSettings: mathClickSetFormulaSettings };
});
const themeInit = vi.fn();
const themeSubscribe = vi.fn();
const themeManagerCtor = vi.fn(function () {
    return { init: themeInit, subscribe: themeSubscribe };
});
const readerPanelCtor = vi.fn(function () {
    return {
        setTheme: vi.fn(),
        setThemeOverrides: vi.fn(),
        setRenderCodeInReader: vi.fn(),
        setShowOutlineInReader: vi.fn(),
        setContentMaxWidthPx: vi.fn(),
        setReaderSettings: vi.fn(),
        setReaderSettingsController: vi.fn(),
        setPromptManagerController: vi.fn(),
        setCommentExportSettings: vi.fn(),
    };
});
const sendControllerCtor = vi.fn(function () {
    return { setTheme: vi.fn(), setThemeOverrides: vi.fn(), setPromptAutocompleteController: vi.fn() };
});
const settingsInit = vi.fn();
const settingsSubscribe = vi.fn();
const settingsGetCached = vi.fn(() => null);
const settingsSetCategory = vi.fn(async () => {});
let settingsSubscriber: ((snap: any) => void) | null = null;
const settingsClientCtor = vi.fn(function () {
    return {
        init: settingsInit,
        subscribe: (fn: (snap: any) => void) => {
            settingsSubscriber = fn;
            return settingsSubscribe(fn);
        },
        getCached: settingsGetCached,
        setCategory: settingsSetCategory,
    };
});
const bookmarksControllerRefreshAll = vi.fn(async () => {});
const bookmarksControllerRefreshPositions = vi.fn(async () => {});
const bookmarksControllerRefreshPageBookmarkStatus = vi.fn(async () => false);
const bookmarksControllerTogglePageBookmarkForCurrentPage = vi.fn(async () => ({ ok: true, data: { saved: true } }));
const bookmarksControllerIsCurrentPageBookmarked = vi.fn(() => false);
const bookmarksControllerGetDefaultFolderPath = vi.fn(() => 'Import');
const bookmarksControllerSetPanelStatus = vi.fn();
const bookmarksControllerSetTheme = vi.fn();
const bookmarksControllerCtor = vi.fn(function () {
    return {
        refreshAll: bookmarksControllerRefreshAll,
        refreshPositionsForUrl: bookmarksControllerRefreshPositions,
        refreshPageBookmarkStatus: bookmarksControllerRefreshPageBookmarkStatus,
        togglePageBookmarkForCurrentPage: bookmarksControllerTogglePageBookmarkForCurrentPage,
        isCurrentPageBookmarked: bookmarksControllerIsCurrentPageBookmarked,
        getDefaultFolderPath: bookmarksControllerGetDefaultFolderPath,
        setPanelStatus: bookmarksControllerSetPanelStatus,
        setTheme: bookmarksControllerSetTheme,
        setThemeOverrides: vi.fn(),
    };
});
const bookmarksToggle = vi.fn(async () => {});
const bookmarksHide = vi.fn();
const bookmarksPanelCtor = vi.fn(function () {
    return { toggle: bookmarksToggle, hide: bookmarksHide };
});
const bookmarkSaveDialogOpen = vi.fn(async () => ({ ok: true, title: 'Saved page title', folderPath: 'Saved/Pages' }));
const bookmarkSaveDialogSetTheme = vi.fn();
const bookmarkSaveDialogSetThemeOverrides = vi.fn();
const messageToolbarsInit = vi.fn();
const messageToolbarsSetTheme = vi.fn();
const messageToolbarsSetBehaviorFlags = vi.fn();
const messageToolbarsSetExportSettings = vi.fn();
const messageToolbarsDispose = vi.fn();
const messageToolbarCtor = vi.fn(function () {
    return {
        init: messageToolbarsInit,
        setTheme: messageToolbarsSetTheme,
        setThemeOverrides: vi.fn(),
        setBehaviorFlags: messageToolbarsSetBehaviorFlags,
        setExportSettings: messageToolbarsSetExportSettings,
        dispose: messageToolbarsDispose,
    };
});
const headerIconInit = vi.fn();
const headerIconDispose = vi.fn();
const headerIconCtor = vi.fn(function () {
    return { init: headerIconInit, dispose: headerIconDispose };
});
const directoryInit = vi.fn();
const directorySetEnabled = vi.fn();
const directorySetDisplayMode = vi.fn();
const directorySetPromptLabelMode = vi.fn();
const directorySetRightInsetPx = vi.fn();
const directorySetTheme = vi.fn();
const directoryDispose = vi.fn();
const directoryCtor = vi.fn(function () {
    return {
        init: directoryInit,
        setEnabled: directorySetEnabled,
        setDisplayMode: directorySetDisplayMode,
        setPromptLabelMode: directorySetPromptLabelMode,
        setRightInsetPx: directorySetRightInsetPx,
        setTheme: directorySetTheme,
        setThemeOverrides: vi.fn(),
        dispose: directoryDispose,
    };
});
const officialNavigationSetEnabled = vi.fn();
const officialNavigationDispose = vi.fn();
const officialNavigationCtor = vi.fn(function () {
    return {
        setEnabled: officialNavigationSetEnabled,
        dispose: officialNavigationDispose,
    };
});
const viewportResizeSuspendInit = vi.fn();
const viewportResizeSuspendDispose = vi.fn();
const viewportResizeSuspendCtor = vi.fn(function () {
    return {
        init: viewportResizeSuspendInit,
        dispose: viewportResizeSuspendDispose,
    };
});
const sendPositionRestoreInit = vi.fn();
const sendPositionRestoreDispose = vi.fn();
const sendPositionRestoreSetEnabled = vi.fn();
const sendPositionRestoreSetEnterKeyNewlineEnabled = vi.fn();
const sendPositionRestoreCtor = vi.fn(function () {
    return {
        init: sendPositionRestoreInit,
        dispose: sendPositionRestoreDispose,
        setEnabled: sendPositionRestoreSetEnabled,
        setEnterKeyNewlineEnabled: sendPositionRestoreSetEnterKeyNewlineEnabled,
    };
});
const composerEnterInit = vi.fn();
const composerEnterDispose = vi.fn();
const composerEnterSetEnabled = vi.fn();
const composerEnterCtor = vi.fn(function () {
    return {
        init: composerEnterInit,
        dispose: composerEnterDispose,
        setEnabled: composerEnterSetEnabled,
    };
});
const messageStepperInit = vi.fn();
const messageStepperDispose = vi.fn();
const messageStepperSetKeyboardEnabled = vi.fn();
const messageStepperSetVisible = vi.fn();
const messageStepperSetPageBookmarkControlVisible = vi.fn();
const messageStepperSetDetachedReaderControlVisible = vi.fn();
const messageStepperSetPromptControlVisible = vi.fn();
const messageStepperSetPageBookmarked = vi.fn();
const messageStepperSetThemeOverrides = vi.fn();
const messageStepperCtor = vi.fn(function () {
    return {
        init: messageStepperInit,
        dispose: messageStepperDispose,
        setKeyboardEnabled: messageStepperSetKeyboardEnabled,
        setVisible: messageStepperSetVisible,
        setPageBookmarkControlVisible: messageStepperSetPageBookmarkControlVisible,
        setDetachedReaderControlVisible: messageStepperSetDetachedReaderControlVisible,
        setPromptControlVisible: messageStepperSetPromptControlVisible,
        setPageBookmarked: messageStepperSetPageBookmarked,
        setThemeOverrides: messageStepperSetThemeOverrides,
    };
});
const promptLibraryClient = {
    listPrompts: vi.fn(async () => []),
    savePrompt: vi.fn(),
    deletePrompt: vi.fn(),
    restoreDefaults: vi.fn(),
    recordUse: vi.fn(),
};
const createPromptLibraryClient = vi.fn(() => promptLibraryClient);
const promptAutocompleteInit = vi.fn();
const promptAutocompleteDispose = vi.fn();
const promptAutocompleteOpenManager = vi.fn(async () => undefined);
const promptAutocompleteSetThemeOverrides = vi.fn();
const promptAutocompleteCtor = vi.fn(function () {
    return {
        init: promptAutocompleteInit,
        dispose: promptAutocompleteDispose,
        openManager: promptAutocompleteOpenManager,
        setThemeOverrides: promptAutocompleteSetThemeOverrides,
    };
});
const pageWidthInit = vi.fn();
const pageWidthDispose = vi.fn();
const pageWidthSetScale = vi.fn();
const pageWidthCtor = vi.fn(function () {
    return {
        init: pageWidthInit,
        dispose: pageWidthDispose,
        setScale: pageWidthSetScale,
    };
});
const engineInit = vi.fn();
const engineSubscribe = vi.fn();
const engineGetSnapshot = vi.fn(async () => null);
const engineCtor = vi.fn(function () {
    return {
        init: engineInit,
        subscribe: engineSubscribe,
        getSnapshot: engineGetSnapshot,
    };
});
const setLocale = vi.fn(async () => {});
const t = vi.fn((key: string) => key);
const scrollToBookmarkTargetWithRetry = vi.fn(async () => ({ ok: true }));
const consumePendingNavigation = vi.fn(() => null);
const navigateChatGPTDirectoryTarget = vi.fn(async () => ({ ok: true }));
const readComposer = vi.fn(() => ({ ok: true as const, kind: 'contenteditable' as const, text: 'source draft' }));
const writeComposer = vi.fn(async () => ({ ok: true as const, kind: 'contenteditable' as const }));
const sendText = vi.fn(async () => ({ ok: true as const }));
const armChatGPTSendPositionRestore = vi.fn();
const collectFreshReaderContent = vi.fn(async () => ({
    items: [{ id: 'reader-item-1', userPrompt: 'Prompt', content: 'Answer' }],
    startIndex: 0,
}));
const buildReaderSessionSnapshot = vi.fn(async (input: any) => ({
    items: input.items,
    startIndex: input.startIndex,
    sourceUrl: input.sourceUrl,
    theme: input.theme,
    createdAt: 1,
    updatedAt: 1,
}));
let modalConfirmResult = true;
const modalConfirm = vi.fn(async () => modalConfirmResult);
const overlayUnmount = vi.fn();
const overlaySessionCtor = vi.fn(function () {
    return {
        modalHost: { confirm: modalConfirm },
        unmount: overlayUnmount,
    };
});
const addListener = vi.fn();
const runtimeSendMessage = vi.fn(async () => ({ ok: true }));
let runtimeMessageListener: ((msg: unknown) => void) | null = null;
const startFormulaOnlyRuntime = vi.fn();
let formulaOnlyProfile: any = null;

let adapterPlatformId = 'chatgpt';

vi.mock('@/drivers/content/adapters/registry', () => ({
    getAdapter: () => adapterPlatformId === 'unknown'
        ? null
        : ({
            getPlatformId: () => adapterPlatformId,
            getMessageSelector: () => '[data-testid="message"]',
            getObserverContainer: () => document.body,
        }),
}));

vi.mock('@/runtimes/content/formulaOnlyRuntime', () => ({
    getFormulaOnlyPlatformProfile: () => formulaOnlyProfile,
    startFormulaOnlyRuntime,
}));

vi.mock('@/drivers/content/theme/theme-manager', () => ({
    ThemeManager: themeManagerCtor,
}));

vi.mock('@/ui/content/controllers/FormulaAssetHoverController', () => ({
    FormulaAssetHoverController: mathClickCtor,
}));

vi.mock('@/drivers/content/bookmarks/navigation', () => ({
    consumePendingNavigation,
    scrollToBookmarkTargetWithRetry,
}));

vi.mock('@/ui/content/chatgptDirectory/navigation', () => ({
    navigateChatGPTDirectoryTarget,
}));

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        runtime: {
            onMessage: {
                addListener: (listener: (msg: unknown) => void) => {
                    runtimeMessageListener = listener;
                    addListener(listener);
                },
            },
            sendMessage: runtimeSendMessage,
        },
    },
}));

vi.mock('@/style/pageTokens', () => ({
    ensurePageTokens,
}));

vi.mock('@/ui/content/reader/ReaderPanel', () => ({
    ReaderPanel: readerPanelCtor,
}));

vi.mock('@/ui/content/controllers/MessageToolbarOrchestrator', () => ({
    MessageToolbarOrchestrator: messageToolbarCtor,
}));

vi.mock('@/ui/content/controllers/HeaderIconOrchestrator', () => ({
    HeaderIconOrchestrator: headerIconCtor,
}));

vi.mock('@/ui/content/bookmarks/BookmarksPanel', () => ({
    BookmarksPanel: bookmarksPanelCtor,
}));

vi.mock('@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton', () => ({
    bookmarkSaveDialog: {
        open: bookmarkSaveDialogOpen,
        setTheme: bookmarkSaveDialogSetTheme,
        setThemeOverrides: bookmarkSaveDialogSetThemeOverrides,
    },
}));

vi.mock('@/ui/content/bookmarks/BookmarksPanelController', () => ({
    BookmarksPanelController: bookmarksControllerCtor,
}));

vi.mock('@/drivers/content/settings/settingsClient', () => ({
    SettingsClient: settingsClientCtor,
}));

vi.mock('@/ui/content/components/i18n', () => ({
    setLocale,
    t,
}));

vi.mock('@/ui/content/overlay/OverlaySession', () => ({
    OverlaySession: overlaySessionCtor,
}));

vi.mock('@/services/reader/readerContentSource', () => ({
    collectFreshReaderContent,
}));

vi.mock('@/services/reader/readerSessionSnapshot', () => ({
    buildReaderSessionSnapshot,
}));

vi.mock('@/ui/content/controllers/ChatGPTDirectoryController', () => ({
    ChatGPTDirectoryController: directoryCtor,
}));

vi.mock('@/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController', () => ({
    ChatGPTOfficialNavigationVisibilityController: officialNavigationCtor,
}));

vi.mock('@/ui/content/controllers/ViewportResizeSuspendController', () => ({
    ViewportResizeSuspendController: viewportResizeSuspendCtor,
}));

vi.mock('@/ui/content/controllers/ChatGPTSendPositionRestoreController', () => ({
    ChatGPTSendPositionRestoreController: sendPositionRestoreCtor,
}));

vi.mock('@/ui/content/controllers/ChatGPTComposerEnterController', () => ({
    ChatGPTComposerEnterController: composerEnterCtor,
}));

vi.mock('@/ui/content/controllers/ChatGPTMessageStepperController', () => ({
    ChatGPTMessageStepperController: messageStepperCtor,
}));

vi.mock('@/drivers/content/prompts/promptLibraryClient', () => ({
    createPromptLibraryClient,
}));

vi.mock('@/ui/content/controllers/ChatGPTPromptAutocompleteController', () => ({
    ChatGPTPromptAutocompleteController: promptAutocompleteCtor,
}));

vi.mock('@/ui/content/controllers/ChatGPTPageWidthController', () => ({
    ChatGPTPageWidthController: pageWidthCtor,
}));

vi.mock('@/drivers/content/chatgpt/ChatGPTConversationEngine', () => ({
    ChatGPTConversationEngine: engineCtor,
}));

vi.mock('@/ui/content/sending/SendController', () => ({
    SendController: sendControllerCtor,
}));

vi.mock('@/drivers/content/sending/composerPort', async () => {
    const actual = await vi.importActual<typeof import('@/drivers/content/sending/composerPort')>('@/drivers/content/sending/composerPort');
    return {
        ...actual,
        readComposer,
        writeComposer,
    };
});

vi.mock('@/services/sending/sendService', () => ({
    sendText,
}));

vi.mock('@/drivers/content/chatgpt/sendPositionRestoreEvents', () => ({
    armChatGPTSendPositionRestore,
}));

vi.mock('@/contracts/protocol', async () => {
    const actual = await vi.importActual<typeof import('@/contracts/protocol')>('@/contracts/protocol');
    return actual;
});

afterEach(() => {
    vi.clearAllMocks();
    runtimeSendMessage.mockImplementation(async () => ({ ok: true }));
    promptLibraryClient.listPrompts.mockImplementation(async () => []);
    bookmarksControllerRefreshPageBookmarkStatus.mockImplementation(async () => false);
    bookmarksControllerTogglePageBookmarkForCurrentPage.mockImplementation(async () => ({ ok: true, data: { saved: true } }));
    bookmarksControllerIsCurrentPageBookmarked.mockReturnValue(false);
    bookmarksControllerGetDefaultFolderPath.mockReturnValue('Import');
    bookmarkSaveDialogOpen.mockImplementation(async () => ({ ok: true, title: 'Saved page title', folderPath: 'Saved/Pages' }));
    collectFreshReaderContent.mockImplementation(async () => ({
        items: [{ id: 'reader-item-1', userPrompt: 'Prompt', content: 'Answer' }],
        startIndex: 0,
    }));
    buildReaderSessionSnapshot.mockImplementation(async (input: any) => ({
        items: input.items,
        startIndex: input.startIndex,
        sourceUrl: input.sourceUrl,
        theme: input.theme,
        createdAt: 1,
        updatedAt: 1,
    }));
    readComposer.mockReturnValue({ ok: true, kind: 'contenteditable', text: 'source draft' });
    settingsGetCached.mockReturnValue(null);
    adapterPlatformId = 'chatgpt';
    formulaOnlyProfile = null;
    settingsSubscriber = null;
    runtimeMessageListener = null;
    modalConfirmResult = true;
    document.documentElement.removeAttribute('data-aimd-theme');
    document.body.innerHTML = '';
});

describe('content runtime entry', () => {
    it('does not construct runtime surfaces for unsupported hosts', async () => {
        adapterPlatformId = 'unknown';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(ensurePageTokens).toHaveBeenCalled();
        expect(messageToolbarCtor).not.toHaveBeenCalled();
        expect(messageToolbarsInit).not.toHaveBeenCalled();
        expect(headerIconCtor).not.toHaveBeenCalled();
        expect(headerIconInit).not.toHaveBeenCalled();
        expect(bookmarksControllerCtor).not.toHaveBeenCalled();
        expect(bookmarksPanelCtor).not.toHaveBeenCalled();
        expect(addListener).not.toHaveBeenCalled();
        expect(engineCtor).not.toHaveBeenCalled();
        expect(directoryCtor).not.toHaveBeenCalled();
        expect(runtimeSendMessage).not.toHaveBeenCalled();
    });

    it('routes formula-only hosts without constructing the full ChatGPT runtime', async () => {
        formulaOnlyProfile = {
            id: 'gemini',
            hostnames: ['gemini.google.com'],
            observerRootSelectors: ['main'],
            contentRootSelectors: ['model-response'],
            formulaSelectors: ['.math-inline'],
        };
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(ensurePageTokens).toHaveBeenCalled();
        expect(startFormulaOnlyRuntime).toHaveBeenCalledWith(formulaOnlyProfile);
        expect(readerPanelCtor).not.toHaveBeenCalled();
        expect(sendControllerCtor).not.toHaveBeenCalled();
        expect(bookmarksControllerCtor).not.toHaveBeenCalled();
        expect(bookmarksPanelCtor).not.toHaveBeenCalled();
        expect(messageToolbarCtor).not.toHaveBeenCalled();
        expect(headerIconCtor).not.toHaveBeenCalled();
        expect(engineCtor).not.toHaveBeenCalled();
        expect(addListener).not.toHaveBeenCalled();
        expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            v: 1,
            type: 'content:ready',
            payload: { platform: 'gemini', url: 'http://localhost:3000/' },
        }));
    });

    it('announces a ChatGPT content ready handshake once after runtime setup', async () => {
        adapterPlatformId = 'chatgpt';
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/c/mock'),
            configurable: true,
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();

        expect(runtimeSendMessage).toHaveBeenCalledTimes(1);
        expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            v: 1,
            type: 'content:ready',
            payload: { platform: 'chatgpt', url: 'https://chatgpt.com/c/mock' },
        }));
    });

    it('maps cached appearance accent color into runtime theme overrides', async () => {
        adapterPlatformId = 'chatgpt';
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true },
            behavior: {
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
            },
            formula: {
                clickCopyMarkdown: true,
                assetActions: { copyPng: true, copySvg: true, savePng: true, saveSvg: true },
            },
            reader: {
                renderCodeInReader: true,
                showOutlineInReader: true,
                contentMaxWidthPx: 1000,
                commentExport: {
                    prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                    template: [],
                    promptPosition: 'top',
                },
            },
            export: { pngWidthPreset: 'desktop', pngCustomWidth: 920, pngPixelRatio: 1 },
            chatgptDirectory: { enabled: true, mode: 'preview', promptLabelMode: 'head', hideOfficialNavigation: true },
            appearance: { fontSizePx: 18, accentColor: '#7c3aed' },
            bookmarks: { sortMode: 'alpha-asc' },
            chatgptBehavior: { restorePositionAfterSend: false, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true, pageWidthScale: 125 },
        });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(ensurePageTokens).toHaveBeenLastCalledWith(expect.objectContaining({
            accentColor: '#7c3aed',
            baseFontScale: 18 / 16,
        }));
        expect(messageToolbarCtor.mock.results[0]?.value.setThemeOverrides).toHaveBeenCalledWith(expect.objectContaining({
            accentColor: '#7c3aed',
        }));
    });

    it('creates the ChatGPT conversation engine and hides official navigation only with the optional directory rail', async () => {
        adapterPlatformId = 'chatgpt';
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true },
            behavior: {
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: false,
            },
            formula: {
                clickCopyMarkdown: true,
                assetActions: { copyPng: true, copySvg: true, savePng: true, saveSvg: true },
            },
            reader: {
                renderCodeInReader: true,
                showOutlineInReader: true,
                contentMaxWidthPx: 1000,
                commentExport: {
                    prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                    template: [],
                },
            },
            export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
            chatgptDirectory: { enabled: false, mode: 'expanded', promptLabelMode: 'headTail', hideOfficialNavigation: true },
            chatgptBehavior: { restorePositionAfterSend: true, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: false, pageWidthScale: 130 },
            bookmarks: { sortMode: 'alpha-asc' },
            appearance: { fontSizePx: 16, accentColor: null },
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(engineCtor).toHaveBeenCalledTimes(1);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(engineInit).toHaveBeenCalledTimes(1);
        expect(directoryInit).toHaveBeenCalledTimes(1);
        expect(viewportResizeSuspendCtor).toHaveBeenCalledTimes(1);
        expect(viewportResizeSuspendInit).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreCtor).toHaveBeenCalledTimes(1);
        expect(composerEnterCtor).toHaveBeenCalledTimes(1);
        expect(composerEnterInit).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreInit).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreSetEnabled).toHaveBeenCalledWith(true);
        expect(messageStepperCtor).toHaveBeenCalledTimes(1);
        expect(messageStepperInit).toHaveBeenCalledTimes(1);
        expect(messageStepperSetVisible).toHaveBeenCalledWith(true);
        expect(messageStepperSetPageBookmarkControlVisible).toHaveBeenCalledWith(true);
        expect(messageStepperSetDetachedReaderControlVisible).toHaveBeenCalledWith(true);
        expect(messageStepperSetPromptControlVisible).toHaveBeenCalledWith(true);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenCalledWith(false);
        expect(pageWidthCtor).toHaveBeenCalledTimes(1);
        expect(pageWidthInit).toHaveBeenCalledTimes(1);
        expect(pageWidthSetScale).toHaveBeenCalledWith(130);
        expect(directorySetEnabled).toHaveBeenCalledWith(false);
        expect(directorySetDisplayMode).toHaveBeenCalledWith('expanded');
        expect(directorySetPromptLabelMode).toHaveBeenCalledWith('headTail');
        expect(officialNavigationCtor).toHaveBeenCalledTimes(1);
        expect(officialNavigationSetEnabled).toHaveBeenCalledWith(false);
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.chatGptConversationEngine).toBeTruthy();
    });

    it('initializes prompt autocomplete and wires the lower-right prompt button to the manager', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(createPromptLibraryClient).toHaveBeenCalledTimes(1);
        expect(promptAutocompleteCtor).toHaveBeenCalledWith(
            expect.objectContaining({ getPlatformId: expect.any(Function) }),
            expect.objectContaining({
                listPrompts: promptLibraryClient.listPrompts,
                recordUse: promptLibraryClient.recordUse,
                savePrompt: expect.any(Function),
                deletePrompt: expect.any(Function),
                restoreDefaults: expect.any(Function),
            }),
        );
        expect(promptAutocompleteInit).toHaveBeenCalledTimes(1);
        expect(sendControllerCtor.mock.results[0]?.value.setPromptAutocompleteController).toHaveBeenCalledWith(
            promptAutocompleteCtor.mock.results[0]?.value,
        );

        const anchor = document.createElement('button');
        const onOpenPrompts = messageStepperCtor.mock.calls[0]?.[1]?.onOpenPrompts;
        await onOpenPrompts?.(anchor);

        expect(promptAutocompleteOpenManager).toHaveBeenCalledWith(anchor);

        const settingsAnchor = document.createElement('button');
        const onOpenPromptManager = bookmarksPanelCtor.mock.calls[0]?.[2]?.onOpenPromptManager;
        await onOpenPromptManager?.(settingsAnchor);

        expect(promptAutocompleteOpenManager.mock.calls).toContainEqual([settingsAnchor]);
    });

    it('shares the prompt manager with Reader settings and provides Reader prompts from the unified prompt library on demand', async () => {
        adapterPlatformId = 'chatgpt';
        const cachedCommentExport = {
            prompts: [{ id: 'legacy-reader', title: 'Legacy Reader', content: 'Legacy body.' }],
            template: [{ type: 'text', value: 'Template' }],
            promptPosition: 'bottom',
        };
        const cachedSettings = {
            language: 'auto',
            platforms: { chatgpt: true },
            behavior: {
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
            },
            formula: {
                clickCopyMarkdown: false,
                assetActions: { copyPng: true, copySvg: false, savePng: true, saveSvg: false },
            },
            reader: {
                renderCodeInReader: true,
                showOutlineInReader: true,
                contentMaxWidthPx: 1000,
                commentExport: cachedCommentExport,
            },
            export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
            chatgptDirectory: { enabled: false, mode: 'preview', promptLabelMode: 'head', hideOfficialNavigation: true },
            chatgptBehavior: { restorePositionAfterSend: false, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
            bookmarks: { sortMode: 'alpha-asc' },
            appearance: { fontSizePx: 16, accentColor: null },
        };
        settingsGetCached.mockReturnValue(cachedSettings);
        promptLibraryClient.listPrompts.mockImplementation(async () => [{
            id: 'shared-reader',
            title: 'Shared Reader',
            content: 'Shared body.',
            triggerText: '',
            contexts: ['composer', 'readerComment'],
            favorite: false,
            enabled: true,
            createdAt: 1,
            updatedAt: 2,
            lastUsedAt: null,
        }]);
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();
        await Promise.resolve();

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(reader?.setPromptManagerController).toHaveBeenCalledWith(expect.objectContaining({
            onOpenManager: expect.any(Function),
        }));
        const anchor = document.createElement('button');
        await reader?.setPromptManagerController.mock.calls[0]?.[0]?.onOpenManager(anchor);
        expect(promptAutocompleteOpenManager).toHaveBeenCalledWith(anchor);

        const prompts = await reader?.setPromptManagerController.mock.calls[0]?.[0]?.listReaderPrompts();
        expect(promptLibraryClient.listPrompts).toHaveBeenCalledWith({ context: 'readerComment' });
        expect(prompts).toEqual([{ id: 'shared-reader', title: 'Shared Reader', content: 'Shared body.' }]);
        expect(reader?.setCommentExportSettings).not.toHaveBeenCalled();

        promptLibraryClient.listPrompts.mockResolvedValueOnce([]);
        settingsSubscriber!({ settings: cachedSettings });
        await Promise.resolve();
        await Promise.resolve();

        expect(reader?.setCommentExportSettings).not.toHaveBeenCalled();
    });

    it('routes ChatGPT pending bookmark navigation through the directory helper', async () => {
        adapterPlatformId = 'chatgpt';
        consumePendingNavigation.mockReturnValueOnce({
            url: 'https://chatgpt.com/c/abc',
            position: 50,
            messageId: 'payload-a50',
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(navigateChatGPTDirectoryTarget).toHaveBeenCalledWith(
            expect.objectContaining({ getPlatformId: expect.any(Function) }),
            { url: 'https://chatgpt.com/c/abc', position: 50, messageId: 'payload-a50' },
            { timeoutMs: 8000, intervalMs: 200 },
        );
        expect(scrollToBookmarkTargetWithRetry).not.toHaveBeenCalled();
    });

    it('syncs optional ChatGPT directory settings and disposes the surface with the runtime', async () => {
        adapterPlatformId = 'chatgpt';
        document.body.innerHTML = '<div data-testid="message"></div><div data-testid="message"></div>';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(settingsSubscriber).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: false },
                behavior: {
                    showSaveMessages: true,
                    showWordCount: false,
                    enableClickToCopy: false,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                formula: {
                    clickCopyMarkdown: false,
                    assetActions: { copyPng: false, copySvg: true, savePng: false, saveSvg: true },
                },
                reader: {
                    renderCodeInReader: false,
                    showOutlineInReader: true,
                    contentMaxWidthPx: 1000,
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: false, mode: 'expanded', promptLabelMode: 'headTail', hideOfficialNavigation: true },
                chatgptBehavior: { restorePositionAfterSend: true, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: false, pageWidthScale: 145 },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(messageToolbarsDispose).toHaveBeenCalledTimes(1);
        expect(headerIconDispose).toHaveBeenCalledTimes(1);
        expect(viewportResizeSuspendDispose).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreDispose).toHaveBeenCalledTimes(1);
        expect(composerEnterDispose).toHaveBeenCalledTimes(1);
        expect(messageStepperDispose).toHaveBeenCalledTimes(1);
        expect(pageWidthDispose).toHaveBeenCalledTimes(1);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directoryDispose).toHaveBeenCalledTimes(1);
        expect(officialNavigationDispose).toHaveBeenCalledTimes(1);
        expect(mathClickDisable).toHaveBeenCalledTimes(1);
        expect(mathClickSetFormulaSettings).toHaveBeenLastCalledWith({
            clickCopyMarkdown: false,
            copyMarkdownDelimiters: true,
            assetFontSizePx: 36,
            assetActions: { copyPng: false, copySvg: true, copyMathml: false, savePng: false, saveSvg: true },
        });
        expect(reader?.setReaderSettings).toHaveBeenCalledWith(expect.objectContaining({
            renderCodeInReader: false,
            commentExport: expect.objectContaining({
                prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
            }),
        }));

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: true },
                behavior: {
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                formula: {
                    clickCopyMarkdown: true,
                    assetActions: { copyPng: true, copySvg: true, savePng: true, saveSvg: true },
                },
                reader: {
                    renderCodeInReader: true,
                    showOutlineInReader: true,
                    contentMaxWidthPx: 1000,
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: true, mode: 'preview', promptLabelMode: 'head', hideOfficialNavigation: true },
                chatgptBehavior: { restorePositionAfterSend: false, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true, pageWidthScale: 100 },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        expect(headerIconInit).toHaveBeenCalledTimes(2);
        expect(messageToolbarsInit).toHaveBeenCalledTimes(2);
        expect(viewportResizeSuspendInit).toHaveBeenCalledTimes(2);
        expect(sendPositionRestoreInit).toHaveBeenCalledTimes(2);
        expect(sendPositionRestoreSetEnabled).toHaveBeenLastCalledWith(false);
        expect(composerEnterInit).toHaveBeenCalledTimes(2);
        expect(composerEnterSetEnabled).toHaveBeenLastCalledWith(false);
        expect(messageStepperInit).toHaveBeenCalledTimes(2);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenLastCalledWith(true);
        expect(pageWidthInit).toHaveBeenCalledTimes(2);
        expect(pageWidthSetScale).toHaveBeenLastCalledWith(100);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directoryInit).toHaveBeenCalledTimes(2);
        expect(directorySetEnabled).toHaveBeenLastCalledWith(true);
        expect(directorySetDisplayMode).toHaveBeenLastCalledWith('preview');
        expect(directorySetPromptLabelMode).toHaveBeenLastCalledWith('head');
        expect(officialNavigationSetEnabled).toHaveBeenLastCalledWith(true);
        expect(mathClickEnable).toHaveBeenCalledTimes(2);
        expect(reader?.setReaderSettings).toHaveBeenLastCalledWith(expect.objectContaining({
            renderCodeInReader: true,
        }));
        expect(messageToolbarsSetBehaviorFlags).toHaveBeenLastCalledWith({
            showMessageToolbar: true,
            showSaveMessages: true,
            showWordCount: true,
        });
    });

    it('keeps the extension-action bookmark panel entry working even when the current platform runtime is disabled', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(settingsSubscriber).toBeTypeOf('function');
        expect(runtimeMessageListener).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: false },
            behavior: {
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: false,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
            },
            formula: {
                clickCopyMarkdown: false,
                assetActions: { copyPng: true, copySvg: false, savePng: true, saveSvg: false },
            },
                reader: {
                    renderCodeInReader: true,
                    showOutlineInReader: true,
                    contentMaxWidthPx: 1000,
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: false, mode: 'preview', promptLabelMode: 'head', hideOfficialNavigation: true },
                chatgptBehavior: { restorePositionAfterSend: false, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        runtimeMessageListener!({ v: 1, id: 'toggle_1', type: 'ui:toggle_toolbar' });

        expect(messageToolbarsDispose).toHaveBeenCalledTimes(1);
        expect(headerIconDispose).toHaveBeenCalledTimes(1);
        expect(bookmarksToggle).toHaveBeenCalledTimes(1);
        expect(bookmarksHide).not.toHaveBeenCalled();
    });

    it('applies cached reader comment export settings before the first subscription snapshot', async () => {
        const cachedCommentExport = {
            prompts: [{ id: 'cached', title: 'Cached', content: 'Cached prompt.' }],
            template: [{ type: 'text', value: 'Cached template' }],
        };
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true },
            behavior: {
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
            },
            formula: {
                clickCopyMarkdown: false,
                assetActions: { copyPng: true, copySvg: false, savePng: true, saveSvg: false },
            },
            reader: {
                renderCodeInReader: false,
                showOutlineInReader: true,
                contentMaxWidthPx: 1000,
                commentExport: cachedCommentExport,
            },
            export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
            chatgptDirectory: { enabled: false, mode: 'preview', promptLabelMode: 'head', hideOfficialNavigation: true },
            chatgptBehavior: { restorePositionAfterSend: false, enterKeyNewline: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
            bookmarks: { sortMode: 'alpha-asc' },
            appearance: { fontSizePx: 16, accentColor: null },
        });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(reader?.setReaderSettings).toHaveBeenCalledWith(expect.objectContaining({
            renderCodeInReader: false,
            commentExport: cachedCommentExport,
        }));
        expect(mathClickSetFormulaSettings).toHaveBeenCalledWith({
            clickCopyMarkdown: false,
            copyMarkdownDelimiters: true,
            assetFontSizePx: 36,
            assetActions: { copyPng: true, copySvg: false, copyMathml: false, savePng: true, saveSvg: false },
        });
    });

    it('syncs ChatGPT arrow-key message navigation alongside the optional directory surface', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(messageStepperCtor).toHaveBeenCalledTimes(1);
        expect(composerEnterCtor).toHaveBeenCalledTimes(1);
        expect(messageStepperInit).toHaveBeenCalledTimes(1);
        expect(composerEnterInit).toHaveBeenCalledTimes(1);
        expect(settingsSubscriber).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'auto',
                platforms: { chatgpt: true },
                behavior: {
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                formula: {
                    clickCopyMarkdown: true,
                    assetActions: { copyPng: false, copySvg: false, savePng: false, saveSvg: false },
                },
                reader: {
                    renderCodeInReader: true,
                    showOutlineInReader: true,
                    contentMaxWidthPx: 1000,
                    commentExport: { prompts: [], template: [] },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: true, mode: 'expanded', promptLabelMode: 'headTail', hideOfficialNavigation: false, rightInsetPx: 40 },
                chatgptBehavior: {
                    restorePositionAfterSend: false,
                    enterKeyNewline: true,
                    showMessageStepper: false,
                    showPageBookmarkControl: false,
                    showDetachedReaderControl: false,
                    showPromptControl: false,
                    enableArrowKeyMessageNavigation: false,
                },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        expect(messageStepperSetVisible).toHaveBeenLastCalledWith(false);
        expect(messageStepperSetPageBookmarkControlVisible).toHaveBeenLastCalledWith(false);
        expect(messageStepperSetDetachedReaderControlVisible).toHaveBeenLastCalledWith(false);
        expect(messageStepperSetPromptControlVisible).toHaveBeenLastCalledWith(false);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenLastCalledWith(false);
        expect(sendPositionRestoreSetEnterKeyNewlineEnabled).toHaveBeenLastCalledWith(true);
        expect(composerEnterSetEnabled).toHaveBeenLastCalledWith(true);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directorySetEnabled).toHaveBeenLastCalledWith(true);
        expect(directorySetDisplayMode).toHaveBeenLastCalledWith('expanded');
        expect(directorySetPromptLabelMode).toHaveBeenLastCalledWith('headTail');
        expect(directorySetRightInsetPx).toHaveBeenLastCalledWith(40);
        expect(officialNavigationSetEnabled).toHaveBeenLastCalledWith(true);
    });

    it('does not create a detached reader session when the experimental notice is cancelled', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        modalConfirmResult = false;
        settingsGetCached.mockReturnValue({
            ...DEFAULT_SETTINGS,
            reader: {
                ...DEFAULT_SETTINGS.reader,
                detachedNoticeConfirmed: false,
            },
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        const onOpenDetachedReader = messageStepperCtor.mock.calls[0]?.[1]?.onOpenDetachedReader;
        await onOpenDetachedReader?.();

        expect(modalConfirm).toHaveBeenCalledTimes(1);
        expect(collectFreshReaderContent).not.toHaveBeenCalled();
        expect(runtimeSendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:create',
        }));
        expect(settingsSetCategory).not.toHaveBeenCalledWith('reader', expect.objectContaining({
            detachedNoticeConfirmed: true,
        }));
    });

    it('opens the shared save dialog before creating a current-page bookmark', async () => {
        adapterPlatformId = 'chatgpt';
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc'),
            configurable: true,
        });
        document.title = 'Research Notes - ChatGPT';
        bookmarksControllerIsCurrentPageBookmarked.mockReturnValue(false);
        bookmarkSaveDialogOpen.mockResolvedValueOnce({ ok: true, title: 'Saved page title', folderPath: 'Saved/Pages' });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        const onTogglePageBookmark = messageStepperCtor.mock.calls[0]?.[1]?.onTogglePageBookmark;
        const result = await onTogglePageBookmark?.();

        expect(bookmarkSaveDialogSetTheme).toHaveBeenCalledWith('light');
        expect(bookmarkSaveDialogSetThemeOverrides).toHaveBeenCalled();
        expect(bookmarkSaveDialogOpen).toHaveBeenCalledWith(expect.objectContaining({
            theme: 'light',
            userPrompt: 'Research Notes',
            existingTitle: 'Research Notes',
            currentFolderPath: 'Import',
            mode: 'create',
        }));
        expect(bookmarksControllerTogglePageBookmarkForCurrentPage).toHaveBeenCalledWith({
            url: 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
            title: 'Saved page title',
            platform: 'ChatGPT',
            folderPath: 'Saved/Pages',
        });
        expect(result).toEqual({ saved: true });
    });

    it('does not reopen the save dialog when removing an existing current-page bookmark', async () => {
        adapterPlatformId = 'chatgpt';
        Object.defineProperty(window, 'location', {
            value: new URL('https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc'),
            configurable: true,
        });
        document.title = 'Research Notes - ChatGPT';
        bookmarksControllerIsCurrentPageBookmarked.mockReturnValue(true);
        bookmarksControllerTogglePageBookmarkForCurrentPage.mockResolvedValueOnce({ ok: true, data: { saved: false } });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        const onTogglePageBookmark = messageStepperCtor.mock.calls[0]?.[1]?.onTogglePageBookmark;
        const result = await onTogglePageBookmark?.();

        expect(bookmarkSaveDialogOpen).not.toHaveBeenCalled();
        expect(bookmarksControllerTogglePageBookmarkForCurrentPage).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
            title: 'Research Notes',
            platform: 'ChatGPT',
        }));
        expect(result).toEqual({ saved: false });
    });

    it('does not persist the detached reader notice when session creation fails', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        settingsGetCached.mockReturnValue({
            ...DEFAULT_SETTINGS,
            reader: {
                ...DEFAULT_SETTINGS.reader,
                detachedNoticeConfirmed: false,
            },
        });
        runtimeSendMessage.mockImplementation(async (message: any) => {
            if (message?.type === 'readerSession:create') {
                return { ok: false, error: { code: 'SOURCE_UNAVAILABLE', message: 'source unavailable' } };
            }
            return { ok: true };
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        const onOpenDetachedReader = messageStepperCtor.mock.calls[0]?.[1]?.onOpenDetachedReader;
        await onOpenDetachedReader?.();

        expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:create',
        }));
        expect(settingsSetCategory).not.toHaveBeenCalledWith('reader', expect.objectContaining({
            detachedNoticeConfirmed: true,
        }));
    });

    it('persists the detached reader notice only after session creation succeeds', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        settingsGetCached.mockReturnValue({
            ...DEFAULT_SETTINGS,
            reader: {
                ...DEFAULT_SETTINGS.reader,
                detachedNoticeConfirmed: false,
            },
        });
        runtimeSendMessage.mockImplementation(async (message: any) => {
            if (message?.type === 'readerSession:create') {
                return { ok: true, data: { sessionId: 'session-1' } };
            }
            return { ok: true };
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        const onOpenDetachedReader = messageStepperCtor.mock.calls[0]?.[1]?.onOpenDetachedReader;
        await onOpenDetachedReader?.();

        expect(runtimeSendMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:create',
        }));
        expect(settingsSetCategory).toHaveBeenCalledWith('reader', expect.objectContaining({
            detachedNoticeConfirmed: true,
        }));
    });

    it('returns the source composer draft for detached reader draft requests', async () => {
        adapterPlatformId = 'chatgpt';
        readComposer.mockReturnValueOnce({ ok: true, kind: 'contenteditable', text: 'existing official composer text' });
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();

        const sendResponse = vi.fn();
        (runtimeMessageListener as any)!(
            { v: 1, id: 'draft_1', type: 'readerSession:draft', payload: { sessionId: 'session-1' } },
            undefined,
            sendResponse,
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(readComposer).toHaveBeenCalledWith(expect.objectContaining({
            getPlatformId: expect.any(Function),
        }));
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            type: 'readerSession:draft',
            data: { text: 'existing official composer text' },
        }));
    });

    it('writes detached reader draft updates back to the source composer', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();

        const sendResponse = vi.fn();
        (runtimeMessageListener as any)!(
            { v: 1, id: 'draft_write_1', type: 'readerSession:draft', payload: { sessionId: 'session-1', text: 'edited detached draft' } },
            undefined,
            sendResponse,
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(writeComposer).toHaveBeenCalledWith(expect.objectContaining({
            getPlatformId: expect.any(Function),
        }), 'edited detached draft', { focus: false, strategy: 'auto' });
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            type: 'readerSession:draft',
            data: { written: true },
        }));
    });

    it('arms ChatGPT position restore from detached reader before-send requests', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();

        const sendResponse = vi.fn();
        (runtimeMessageListener as any)!(
            { v: 1, id: 'before_send_1', type: 'readerSession:beforeSend', payload: { sessionId: 'session-1' } },
            undefined,
            sendResponse,
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(armChatGPTSendPositionRestore).toHaveBeenCalledTimes(1);
        expect(sendText).not.toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            type: 'readerSession:beforeSend',
            data: { ready: true },
        }));
    });

    it('sends detached reader text through the source composer', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');
        await Promise.resolve();

        const sendResponse = vi.fn();
        (runtimeMessageListener as any)!(
            { v: 1, id: 'send_1', type: 'readerSession:send', payload: { sessionId: 'session-1', text: 'send from detached' } },
            undefined,
            sendResponse,
        );
        await Promise.resolve();
        await Promise.resolve();

        expect(armChatGPTSendPositionRestore).not.toHaveBeenCalled();
        expect(sendText).toHaveBeenCalledWith(expect.objectContaining({
            getPlatformId: expect.any(Function),
        }), 'send from detached', { focusComposer: true, timeoutMs: 3000 });
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
            ok: true,
            type: 'readerSession:send',
            data: { sent: true },
        }));
    });
});
