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
        setRenderCodeInReader: vi.fn(),
        setContentMaxWidthPx: vi.fn(),
        setCommentExportSettings: vi.fn(),
    };
});
const sendControllerCtor = vi.fn(function () {
    return { setTheme: vi.fn() };
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
const directorySetTheme = vi.fn();
const directoryDispose = vi.fn();
const directoryCtor = vi.fn(function () {
    return {
        init: directoryInit,
        setEnabled: directorySetEnabled,
        setDisplayMode: directorySetDisplayMode,
        setTheme: directorySetTheme,
        dispose: directoryDispose,
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
let runtimeMessageListener: ((msg: unknown) => void) | null = null;

let adapterPlatformId = 'gemini';

vi.mock('@/drivers/content/adapters/registry', () => ({
    getAdapter: () => ({
        getPlatformId: () => adapterPlatformId,
        getMessageSelector: () => '[data-testid="message"]',
        getObserverContainer: () => document.body,
    }),
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
    adapterPlatformId = 'gemini';
    settingsSubscriber = null;
    runtimeMessageListener = null;
    document.documentElement.removeAttribute('data-aimd-theme');
    document.body.innerHTML = '';
});

describe('content runtime entry', () => {
    it('initializes generic content UI for non-ChatGPT adapters', async () => {
        adapterPlatformId = 'gemini';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(ensurePageTokens).toHaveBeenCalled();
        expect(messageToolbarCtor).toHaveBeenCalledTimes(1);
        expect(messageToolbarsInit).toHaveBeenCalledTimes(1);
        expect(headerIconCtor).toHaveBeenCalledTimes(1);
        expect(headerIconInit).toHaveBeenCalledTimes(1);
        expect(bookmarksControllerCtor).toHaveBeenCalledTimes(1);
        expect(bookmarksPanelCtor).toHaveBeenCalledTimes(1);
        expect(addListener).toHaveBeenCalledTimes(1);
        expect(engineCtor).not.toHaveBeenCalled();
        expect(directoryCtor).not.toHaveBeenCalled();
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.chatGptConversationEngine).toBeUndefined();
    });

    it('creates ChatGPT-only conversation engine and directory controller', async () => {
        adapterPlatformId = 'chatgpt';
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
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
                commentExport: {
                    prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                    template: [],
                },
            },
            export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
            chatgptDirectory: { enabled: false, mode: 'expanded' },
            bookmarks: { sortMode: 'alpha-asc' },
        });
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(engineCtor).toHaveBeenCalledTimes(1);
        expect(directoryCtor).toHaveBeenCalledTimes(1);
        expect(engineInit).toHaveBeenCalledTimes(1);
        expect(directoryInit).toHaveBeenCalledTimes(1);
        expect(directorySetEnabled).toHaveBeenCalledWith(false);
        expect(directorySetDisplayMode).toHaveBeenCalledWith('expanded');
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

    it('keeps the ChatGPT directory tied to scoped directory settings and platform runtime state', async () => {
        adapterPlatformId = 'chatgpt';
        document.body.innerHTML = '<div data-testid="message"></div><div data-testid="message"></div>';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(settingsSubscriber).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: false, gemini: true, claude: true, deepseek: true },
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
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: false, mode: 'expanded' },
                bookmarks: { sortMode: 'alpha-asc' },
            },
        });

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(messageToolbarsDispose).toHaveBeenCalledTimes(1);
        expect(headerIconDispose).toHaveBeenCalledTimes(1);
        expect(directorySetEnabled).toHaveBeenCalledWith(false);
        expect(directorySetDisplayMode).toHaveBeenCalledWith('expanded');
        expect(mathClickDisable).toHaveBeenCalledTimes(1);
        expect(mathClickSetFormulaSettings).toHaveBeenLastCalledWith({
            clickCopyMarkdown: false,
            assetActions: { copyPng: false, copySvg: true, savePng: false, saveSvg: true },
        });
        expect(reader?.setRenderCodeInReader).toHaveBeenCalledWith(false);

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
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
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
                export: { pngWidthPreset: 'desktop', pngCustomWidth: 920 },
                chatgptDirectory: { enabled: true, mode: 'preview' },
                bookmarks: { sortMode: 'alpha-asc' },
            },
        });

        expect(headerIconInit).toHaveBeenCalledTimes(2);
        expect(messageToolbarsInit).toHaveBeenCalledTimes(2);
        expect(directorySetEnabled).toHaveBeenLastCalledWith(true);
        expect(directorySetDisplayMode).toHaveBeenLastCalledWith('preview');
        expect(mathClickEnable).toHaveBeenCalledTimes(2);
        expect(reader?.setRenderCodeInReader).toHaveBeenLastCalledWith(true);
        expect(messageToolbarsSetBehaviorFlags).toHaveBeenLastCalledWith({
            showSaveMessages: true,
            showWordCount: true,
        });
    });

    it('keeps the extension-action bookmark panel entry working even when the current platform runtime is disabled', async () => {
        adapterPlatformId = 'gemini';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(settingsSubscriber).toBeTypeOf('function');
        expect(runtimeMessageListener).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: true, gemini: false, claude: true, deepseek: true },
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
                    commentExport: {
                        prompts: [{ id: 'prompt-1', title: 'Prompt 1', content: 'Please review.' }],
                        template: [],
                    },
                },
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
            platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
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
                commentExport: cachedCommentExport,
            },
        });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(reader?.setRenderCodeInReader).toHaveBeenCalledWith(false);
        expect(reader?.setCommentExportSettings).toHaveBeenCalledWith(cachedCommentExport);
        expect(mathClickSetFormulaSettings).toHaveBeenCalledWith({
            clickCopyMarkdown: false,
            assetActions: { copyPng: true, copySvg: false, savePng: true, saveSvg: false },
        });
    });
});
