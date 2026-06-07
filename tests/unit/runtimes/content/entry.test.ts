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
        setCommentExportSettings: vi.fn(),
    };
});
const sendControllerCtor = vi.fn(function () {
    return { setTheme: vi.fn(), setThemeOverrides: vi.fn() };
});
const settingsInit = vi.fn();
const settingsSubscribe = vi.fn();
const settingsGetCached = vi.fn(() => null);
let settingsSubscriber: ((snap: any) => void) | null = null;
const settingsClientCtor = vi.fn(function () {
    return {
        init: settingsInit,
        subscribe: (fn: (snap: any) => void) => {
            settingsSubscriber = fn;
            return settingsSubscribe(fn);
        },
        getCached: settingsGetCached,
    };
});
const bookmarksControllerRefreshAll = vi.fn(async () => {});
const bookmarksControllerRefreshPositions = vi.fn(async () => {});
const bookmarksControllerSetTheme = vi.fn();
const bookmarksControllerCtor = vi.fn(function () {
    return {
        refreshAll: bookmarksControllerRefreshAll,
        refreshPositionsForUrl: bookmarksControllerRefreshPositions,
        setTheme: bookmarksControllerSetTheme,
        setThemeOverrides: vi.fn(),
    };
});
const bookmarksToggle = vi.fn(async () => {});
const bookmarksHide = vi.fn();
const bookmarksPanelCtor = vi.fn(function () {
    return { toggle: bookmarksToggle, hide: bookmarksHide };
});
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
const directorySetTheme = vi.fn();
const directoryDispose = vi.fn();
const directoryCtor = vi.fn(function () {
    return {
        init: directoryInit,
        setEnabled: directorySetEnabled,
        setDisplayMode: directorySetDisplayMode,
        setPromptLabelMode: directorySetPromptLabelMode,
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
const sendPositionRestoreCtor = vi.fn(function () {
    return {
        init: sendPositionRestoreInit,
        dispose: sendPositionRestoreDispose,
        setEnabled: sendPositionRestoreSetEnabled,
    };
});
const messageStepperInit = vi.fn();
const messageStepperDispose = vi.fn();
const messageStepperSetKeyboardEnabled = vi.fn();
const messageStepperSetVisible = vi.fn();
const messageStepperSetThemeOverrides = vi.fn();
const messageStepperCtor = vi.fn(function () {
    return {
        init: messageStepperInit,
        dispose: messageStepperDispose,
        setKeyboardEnabled: messageStepperSetKeyboardEnabled,
        setVisible: messageStepperSetVisible,
        setThemeOverrides: messageStepperSetThemeOverrides,
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
const scrollToBookmarkTargetWithRetry = vi.fn(async () => ({ ok: true }));
const consumePendingNavigation = vi.fn(() => null);
const navigateChatGPTDirectoryTarget = vi.fn(async () => ({ ok: true }));
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

vi.mock('@/ui/content/bookmarks/BookmarksPanelController', () => ({
    BookmarksPanelController: bookmarksControllerCtor,
}));

vi.mock('@/drivers/content/settings/settingsClient', () => ({
    SettingsClient: settingsClientCtor,
}));

vi.mock('@/ui/content/components/i18n', () => ({
    setLocale,
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

vi.mock('@/ui/content/controllers/ChatGPTMessageStepperController', () => ({
    ChatGPTMessageStepperController: messageStepperCtor,
}));

vi.mock('@/drivers/content/chatgpt/ChatGPTConversationEngine', () => ({
    ChatGPTConversationEngine: engineCtor,
}));

vi.mock('@/ui/content/sending/SendController', () => ({
    SendController: sendControllerCtor,
}));

vi.mock('@/contracts/protocol', async () => {
    const actual = await vi.importActual<typeof import('@/contracts/protocol')>('@/contracts/protocol');
    return actual;
});

afterEach(() => {
    vi.clearAllMocks();
    settingsGetCached.mockReturnValue(null);
    adapterPlatformId = 'chatgpt';
    formulaOnlyProfile = null;
    settingsSubscriber = null;
    runtimeMessageListener = null;
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
            chatgptBehavior: { restorePositionAfterSend: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
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
            chatgptBehavior: { restorePositionAfterSend: true, showMessageStepper: true, enableArrowKeyMessageNavigation: false },
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
        expect(sendPositionRestoreInit).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreSetEnabled).toHaveBeenCalledWith(true);
        expect(messageStepperCtor).toHaveBeenCalledTimes(1);
        expect(messageStepperInit).toHaveBeenCalledTimes(1);
        expect(messageStepperSetVisible).toHaveBeenCalledWith(true);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenCalledWith(false);
        expect(directorySetEnabled).toHaveBeenCalledWith(false);
        expect(directorySetDisplayMode).toHaveBeenCalledWith('expanded');
        expect(directorySetPromptLabelMode).toHaveBeenCalledWith('headTail');
        expect(officialNavigationCtor).toHaveBeenCalledTimes(1);
        expect(officialNavigationSetEnabled).toHaveBeenCalledWith(false);
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.chatGptConversationEngine).toBeTruthy();
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
                chatgptBehavior: { restorePositionAfterSend: true, showMessageStepper: true, enableArrowKeyMessageNavigation: false },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(messageToolbarsDispose).toHaveBeenCalledTimes(1);
        expect(headerIconDispose).toHaveBeenCalledTimes(1);
        expect(viewportResizeSuspendDispose).toHaveBeenCalledTimes(1);
        expect(sendPositionRestoreDispose).toHaveBeenCalledTimes(1);
        expect(messageStepperDispose).toHaveBeenCalledTimes(1);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directoryDispose).toHaveBeenCalledTimes(1);
        expect(officialNavigationDispose).toHaveBeenCalledTimes(1);
        expect(mathClickDisable).toHaveBeenCalledTimes(1);
        expect(mathClickSetFormulaSettings).toHaveBeenLastCalledWith({
            clickCopyMarkdown: false,
            assetActions: { copyPng: false, copySvg: true, copyMathml: false, savePng: false, saveSvg: true },
        });
        expect(reader?.setRenderCodeInReader).toHaveBeenCalledWith(false);

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
                chatgptBehavior: { restorePositionAfterSend: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        expect(headerIconInit).toHaveBeenCalledTimes(2);
        expect(messageToolbarsInit).toHaveBeenCalledTimes(2);
        expect(viewportResizeSuspendInit).toHaveBeenCalledTimes(2);
        expect(sendPositionRestoreInit).toHaveBeenCalledTimes(2);
        expect(sendPositionRestoreSetEnabled).toHaveBeenLastCalledWith(false);
        expect(messageStepperInit).toHaveBeenCalledTimes(2);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenLastCalledWith(true);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directoryInit).toHaveBeenCalledTimes(2);
        expect(directorySetEnabled).toHaveBeenLastCalledWith(true);
        expect(directorySetDisplayMode).toHaveBeenLastCalledWith('preview');
        expect(directorySetPromptLabelMode).toHaveBeenLastCalledWith('head');
        expect(officialNavigationSetEnabled).toHaveBeenLastCalledWith(true);
        expect(mathClickEnable).toHaveBeenCalledTimes(2);
        expect(reader?.setRenderCodeInReader).toHaveBeenLastCalledWith(true);
        expect(messageToolbarsSetBehaviorFlags).toHaveBeenLastCalledWith({
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
                chatgptBehavior: { restorePositionAfterSend: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
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
            chatgptBehavior: { restorePositionAfterSend: false, showMessageStepper: true, enableArrowKeyMessageNavigation: true },
            bookmarks: { sortMode: 'alpha-asc' },
            appearance: { fontSizePx: 16, accentColor: null },
        });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(reader?.setRenderCodeInReader).toHaveBeenCalledWith(false);
        expect(reader?.setCommentExportSettings).toHaveBeenCalledWith(cachedCommentExport);
        expect(mathClickSetFormulaSettings).toHaveBeenCalledWith({
            clickCopyMarkdown: false,
            assetActions: { copyPng: true, copySvg: false, copyMathml: false, savePng: true, saveSvg: false },
        });
    });

    it('syncs ChatGPT arrow-key message navigation alongside the optional directory surface', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(messageStepperCtor).toHaveBeenCalledTimes(1);
        expect(messageStepperInit).toHaveBeenCalledTimes(1);
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
                chatgptDirectory: { enabled: true, mode: 'expanded', promptLabelMode: 'headTail', hideOfficialNavigation: false },
                chatgptBehavior: { restorePositionAfterSend: false, showMessageStepper: false, enableArrowKeyMessageNavigation: false },
                bookmarks: { sortMode: 'alpha-asc' },
                appearance: { fontSizePx: 16, accentColor: null },
            },
        });

        expect(messageStepperSetVisible).toHaveBeenLastCalledWith(false);
        expect(messageStepperSetKeyboardEnabled).toHaveBeenLastCalledWith(false);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(directorySetEnabled).toHaveBeenLastCalledWith(true);
        expect(directorySetDisplayMode).toHaveBeenLastCalledWith('expanded');
        expect(directorySetPromptLabelMode).toHaveBeenLastCalledWith('headTail');
        expect(officialNavigationSetEnabled).toHaveBeenLastCalledWith(true);
    });
});
