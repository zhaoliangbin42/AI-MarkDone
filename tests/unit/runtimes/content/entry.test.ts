import { afterEach, describe, expect, it, vi } from 'vitest';

const ensurePageTokens = vi.fn();
const mathClickEnable = vi.fn();
const mathClickCtor = vi.fn(function () {
    return { enable: mathClickEnable };
});
const themeInit = vi.fn();
const themeSubscribe = vi.fn();
const themeManagerCtor = vi.fn(function () {
    return { init: themeInit, subscribe: themeSubscribe };
});
const readerPanelCtor = vi.fn(function () {
    return { setTheme: vi.fn() };
});
const sendControllerCtor = vi.fn(function () {
    return { setTheme: vi.fn() };
});
const settingsInit = vi.fn();
const settingsSubscribe = vi.fn();
const settingsGetCached = vi.fn(() => null);
const settingsClientCtor = vi.fn(function () {
    return { init: settingsInit, subscribe: settingsSubscribe, getCached: settingsGetCached };
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
const bookmarksPanelCtor = vi.fn(function () {
    return { toggle: bookmarksToggle };
});
const messageToolbarsInit = vi.fn();
const messageToolbarsSetTheme = vi.fn();
const messageToolbarsSetBehaviorFlags = vi.fn();
const messageToolbarCtor = vi.fn(function () {
    return {
        init: messageToolbarsInit,
        setTheme: messageToolbarsSetTheme,
        setBehaviorFlags: messageToolbarsSetBehaviorFlags,
    };
});
const headerIconInit = vi.fn();
const headerIconCtor = vi.fn(function () {
    return { init: headerIconInit };
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
    };
});
const setLocale = vi.fn(async () => {});
const scrollToAssistantPositionWithRetry = vi.fn(async () => ({ ok: true }));
const consumePendingNavigation = vi.fn(() => null);
const addListener = vi.fn();

let adapterPlatformId = 'gemini';

vi.mock('@/drivers/content/adapters/registry', () => ({
    getAdapter: () => ({
        getPlatformId: () => adapterPlatformId,
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
                addListener,
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
    adapterPlatformId = 'gemini';
    document.documentElement.removeAttribute('data-aimd-theme');
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
    });

    it('keeps ChatGPT folding ChatGPT-only', async () => {
        adapterPlatformId = 'chatgpt';
        vi.resetModules();
        await import('@/runtimes/content/entry');

        expect(messageToolbarsInit).toHaveBeenCalledTimes(1);
        expect(headerIconInit).toHaveBeenCalledTimes(1);
        expect(foldingCtor).toHaveBeenCalledTimes(1);
        expect(foldingInit).toHaveBeenCalledTimes(1);
    });
});
