import { afterEach, describe, expect, it, vi } from 'vitest';

const ensurePageTokens = vi.fn();
const mathClickEnable = vi.fn();
const mathClickDisable = vi.fn();
const mathClickCtor = vi.fn(function () {
    return { enable: mathClickEnable, disable: mathClickDisable };
});
const themeInit = vi.fn();
const themeSubscribe = vi.fn();
const themeManagerCtor = vi.fn(function () {
    return { init: themeInit, subscribe: themeSubscribe };
});
const readerPanelCtor = vi.fn(function () {
    return { setTheme: vi.fn(), setRenderCodeInReader: vi.fn(), setCommentExportSettings: vi.fn() };
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
const messageToolbarsSetConversationContentPreparer = vi.fn();
const messageToolbarsSetVirtualizationController = vi.fn();
const messageToolbarsDispose = vi.fn();
const messageToolbarCtor = vi.fn(function () {
    return {
        init: messageToolbarsInit,
        setTheme: messageToolbarsSetTheme,
        setBehaviorFlags: messageToolbarsSetBehaviorFlags,
        setConversationContentPreparer: messageToolbarsSetConversationContentPreparer,
        setVirtualizationController: messageToolbarsSetVirtualizationController,
        dispose: messageToolbarsDispose,
    };
});
const headerIconInit = vi.fn();
const headerIconDispose = vi.fn();
const headerIconCtor = vi.fn(function () {
    return { init: headerIconInit, dispose: headerIconDispose };
});
const foldingInit = vi.fn();
const foldingRegisterMessage = vi.fn();
const foldingSetPolicy = vi.fn();
const foldingSetTheme = vi.fn();
const foldingCtor = vi.fn(function () {
    return {
        init: foldingInit,
        registerMessage: foldingRegisterMessage,
        setPolicy: foldingSetPolicy,
        setTheme: foldingSetTheme,
        dispose: vi.fn(),
    };
});
const setLocale = vi.fn(async () => {});
const scrollToAssistantPositionWithRetry = vi.fn(async () => ({ ok: true }));
const consumePendingNavigation = vi.fn(() => null);
const addListener = vi.fn();
let runtimeMessageListener: ((msg: unknown) => void) | null = null;

let adapterPlatformId = 'gemini';

vi.mock('@/drivers/content/adapters/registry', () => ({
    getAdapter: () => ({
        getPlatformId: () => adapterPlatformId,
        getMessageSelector: () => '[data-testid="message"]',
    }),
}));

vi.mock('@/drivers/content/theme/theme-manager', () => ({
    ThemeManager: themeManagerCtor,
}));

vi.mock('@/drivers/content/math/math-click', () => ({
    MathClickHandler: mathClickCtor,
}));

vi.mock('@/drivers/content/bookmarks/navigation', () => ({
    consumePendingNavigation,
    scrollToAssistantPositionWithRetry,
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

vi.mock('@/ui/content/controllers/ChatGPTFoldingController', () => ({
    ChatGPTFoldingController: foldingCtor,
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
        expect(foldingInit).not.toHaveBeenCalled();
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.foldingController).toBeUndefined();
    });

    it('keeps ChatGPT folding ChatGPT-only', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(messageToolbarsInit).toHaveBeenCalledTimes(1);
        expect(headerIconInit).toHaveBeenCalledTimes(1);
        expect(foldingCtor).toHaveBeenCalledTimes(1);
        expect(foldingInit).toHaveBeenCalledTimes(1);
        expect(messageToolbarsSetConversationContentPreparer).not.toHaveBeenCalled();
        expect(messageToolbarsSetVirtualizationController).not.toHaveBeenCalled();
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.foldingController).toBeTruthy();
    });

    it('applies settings updates to runtime wiring and existing messages', async () => {
        adapterPlatformId = 'chatgpt';
        document.body.innerHTML = '<div data-testid="message"></div><div data-testid="message"></div>';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(settingsSubscriber).toBeTypeOf('function');

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: false, gemini: true, claude: true, deepseek: true },
                chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
                behavior: {
                    showViewSource: true,
                    showSaveMessages: true,
                    showWordCount: false,
                    enableClickToCopy: false,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                reader: {
                    renderCodeInReader: false,
                    commentExport: {
                        activePromptId: 'default',
                        prompts: [{ id: 'default', title: 'Default', content: 'Please review.', builtIn: true }],
                        template: [],
                    },
                },
            },
        });

        const reader = readerPanelCtor.mock.results[0]?.value;
        expect(messageToolbarsDispose).toHaveBeenCalledTimes(1);
        expect(headerIconDispose).toHaveBeenCalledTimes(1);
        expect(bookmarksHide).not.toHaveBeenCalled();
        expect(mathClickDisable).toHaveBeenCalledTimes(1);
        expect(reader?.setRenderCodeInReader).toHaveBeenCalledWith(false);
        expect(messageToolbarsSetConversationContentPreparer).not.toHaveBeenCalled();

        settingsSubscriber!({
            settings: {
                language: 'en',
                platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                chatgpt: { foldingMode: 'all', defaultExpandedCount: 8, showFoldDock: true },
                behavior: {
                    showViewSource: true,
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                reader: {
                    renderCodeInReader: true,
                    commentExport: {
                        activePromptId: 'default',
                        prompts: [{ id: 'default', title: 'Default', content: 'Please review.', builtIn: true }],
                        template: [],
                    },
                },
            },
        });

        expect(headerIconInit).toHaveBeenCalledTimes(2);
        expect(messageToolbarsInit).toHaveBeenCalledTimes(2);
        expect(mathClickEnable).toHaveBeenCalledTimes(2);
        expect(reader?.setRenderCodeInReader).toHaveBeenLastCalledWith(true);
        expect(messageToolbarsSetVirtualizationController).not.toHaveBeenCalled();
        expect(messageToolbarsSetBehaviorFlags).toHaveBeenLastCalledWith({
            showViewSource: true,
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
                chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
                behavior: {
                    showViewSource: true,
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: false,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                reader: {
                    renderCodeInReader: true,
                    commentExport: {
                        activePromptId: 'default',
                        prompts: [{ id: 'default', title: 'Default', content: 'Please review.', builtIn: true }],
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

    it('does not instantiate ChatGPT strong-mode controllers', async () => {
        adapterPlatformId = 'chatgpt';
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
            chatgpt: { foldingMode: 'all', defaultExpandedCount: 8, showFoldDock: true },
            behavior: {
                showViewSource: true,
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
            },
            reader: {
                renderCodeInReader: true,
                commentExport: {
                    activePromptId: 'default',
                    prompts: [{ id: 'default', title: 'Default', content: 'Please review.', builtIn: true }],
                    template: [],
                },
            },
        });

        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(messageToolbarsSetConversationContentPreparer).not.toHaveBeenCalled();
        expect(messageToolbarsSetVirtualizationController).not.toHaveBeenCalled();
        expect(messageToolbarCtor.mock.calls[0]?.[1]?.virtualizationController).toBeUndefined();
    });

    it('applies cached reader comment export settings before the first subscription snapshot', async () => {
        const cachedCommentExport = {
            activePromptId: 'cached',
            prompts: [{ id: 'cached', title: 'Cached', content: 'Cached prompt.' }],
            template: [{ type: 'text', value: 'Cached template' }],
        };
        settingsGetCached.mockReturnValue({
            language: 'auto',
            platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
            chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
            behavior: {
                showViewSource: true,
                showSaveMessages: true,
                showWordCount: true,
                enableClickToCopy: true,
                saveContextOnly: false,
                _contextOnlyConfirmed: true,
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
    });
});
