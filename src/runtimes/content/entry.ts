import { getAdapter } from '../../drivers/content/adapters/registry';
import type { Theme } from '../../core/types/theme';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { FormulaAssetHoverController } from '../../ui/content/controllers/FormulaAssetHoverController';
import { consumePendingNavigation, scrollToBookmarkTargetWithRetry } from '../../drivers/content/bookmarks/navigation';
import { browser } from '../../drivers/shared/browser';
import { isExtRequest } from '../../contracts/protocol';
import { ensurePageTokens } from '../../style/pageTokens';
import { ReaderPanel } from '../../ui/content/reader/ReaderPanel';
import { MessageToolbarOrchestrator } from '../../ui/content/controllers/MessageToolbarOrchestrator';
import { BookmarksPanel } from '../../ui/content/bookmarks/BookmarksPanel';
import { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import { SettingsClient } from '../../drivers/content/settings/settingsClient';
import { DEFAULT_SETTINGS } from '../../core/settings/types';
import { setLocale } from '../../ui/content/components/i18n';
import { HeaderIconOrchestrator } from '../../ui/content/controllers/HeaderIconOrchestrator';
import { SendController } from '../../ui/content/sending/SendController';
import { saveMessagesDialog } from '../../ui/content/export/SaveMessagesDialog';
import { discoverMessageElements } from '../../drivers/content/injection/messageDiscovery';
import { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { ChatGPTDirectoryController } from '../../ui/content/controllers/ChatGPTDirectoryController';
import { navigateChatGPTDirectoryTarget } from '../../ui/content/chatgptDirectory/navigation';

ensurePageTokens();

const isDebugEnabled = () => {
    try {
        return window.localStorage.getItem('aimd:debug') === '1';
    } catch {
        return false;
    }
};

const writeDebugState = (patch: Record<string, string | boolean | number | null | undefined>) => {
    if (!isDebugEnabled()) return;
    for (const [key, value] of Object.entries(patch)) {
        document.documentElement.dataset[`aimdDebug${key}`] = value == null ? '' : String(value);
    }
};

const adapter = getAdapter();
if (adapter) {
    const themeManager = new ThemeManager();
    const mathClick = new FormulaAssetHoverController();
    const readerPanel = new ReaderPanel();
    const sendController = new SendController();
    const settingsClient = new SettingsClient();
    const bookmarksController = new BookmarksPanelController(adapter);
    const bookmarksPanel = new BookmarksPanel(bookmarksController, readerPanel);
    const chatGptConversationEngine = adapter.getPlatformId() === 'chatgpt' ? new ChatGPTConversationEngine(adapter) : null;
    const chatGptDirectory = adapter.getPlatformId() === 'chatgpt' && chatGptConversationEngine
        ? new ChatGPTDirectoryController(adapter, chatGptConversationEngine)
        : null;
    const headerIcon = new HeaderIconOrchestrator(adapter, {
        onToggle: () => bookmarksPanel.toggle(),
    });
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        sendController,
        bookmarksController,
        chatGptConversationEngine: chatGptConversationEngine ?? undefined,
        onMessageInjected: (messageElement) => {
            const formula = resolveFormulaSettings(settingsClient.getCached()?.formula);
            if (shouldEnableFormulaInteractions(formula)) {
                mathClick.enable(messageElement);
            }
        },
    });

    settingsClient.init();
    const cachedSettings = settingsClient.getCached();
    let lastLocale = cachedSettings?.language ?? DEFAULT_SETTINGS.language;
    const platformKey = adapter.getPlatformId().toLowerCase() as keyof typeof DEFAULT_SETTINGS.platforms;
    let runtimeEnabled = cachedSettings?.platforms?.[platformKey] ?? true;
    let currentTheme: Theme = document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light';
    writeDebugState({
        Content: 'loaded',
        Platform: adapter.getPlatformId(),
        RuntimeEnabled: runtimeEnabled,
        DirectoryAvailable: Boolean(chatGptDirectory),
    });

    const syncClickToCopy = (enabled: boolean) => {
        mathClick.disable();
        if (!enabled) return;
        for (const messageElement of discoverMessageElements(document, adapter.getMessageSelector())) {
            mathClick.enable(messageElement);
        }
    };

    const syncFormulaSettings = (settings: typeof DEFAULT_SETTINGS.formula | undefined) => {
        const next = resolveFormulaSettings(settings);
        mathClick.setFormulaSettings(next);
        if (!runtimeEnabled) {
            mathClick.disable();
            return;
        }
        syncClickToCopy(shouldEnableFormulaInteractions(next));
    };

    const initChatGptIfNeeded = () => {
        if (!chatGptConversationEngine || !chatGptDirectory) return;
        writeDebugState({ ChatGptInit: 'start' });
        chatGptConversationEngine.init();
        chatGptDirectory.init(currentTheme);
        syncChatGptDirectorySettings(settingsClient.getCached()?.chatgptDirectory);
        writeDebugState({ ChatGptInit: 'done' });
    };

    const syncChatGptDirectorySettings = (settings: typeof DEFAULT_SETTINGS.chatgptDirectory | undefined) => {
        if (!chatGptDirectory) return;
        const next = {
            ...DEFAULT_SETTINGS.chatgptDirectory,
            ...settings,
        };
        chatGptDirectory.setDisplayMode(next.mode === 'expanded' ? 'expanded' : 'preview');
        chatGptDirectory.setEnabled(Boolean(next.enabled));
    };

    const enableRuntime = () => {
        if (runtimeEnabled) return;
        runtimeEnabled = true;
        writeDebugState({ RuntimeEnabled: runtimeEnabled });
        initChatGptIfNeeded();
        messageToolbars.init();
        headerIcon.init();
    };

    const disableRuntime = () => {
        if (!runtimeEnabled) return;
        runtimeEnabled = false;
        writeDebugState({ RuntimeEnabled: runtimeEnabled });
        messageToolbars.dispose();
        headerIcon.dispose();
        chatGptDirectory?.dispose();
        chatGptConversationEngine?.dispose?.();
    };

    // Apply initial UI locale immediately (otherwise switching to a non-auto locale won't take effect until a change event).
    void setLocale(lastLocale);
    if (cachedSettings?.reader) {
        readerPanel.setRenderCodeInReader(Boolean(cachedSettings.reader.renderCodeInReader));
        readerPanel.setContentMaxWidthPx(cachedSettings.reader.contentMaxWidthPx ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx);
        readerPanel.setCommentExportSettings(cachedSettings.reader.commentExport);
    }
    mathClick.setFormulaSettings(resolveFormulaSettings(cachedSettings?.formula));
    saveMessagesDialog.setExportSettings(cachedSettings?.export ?? DEFAULT_SETTINGS.export);
    messageToolbars.setExportSettings(cachedSettings?.export ?? DEFAULT_SETTINGS.export);
    settingsClient.subscribe((snap) => {
        if (snap.settings.language !== lastLocale) {
            lastLocale = snap.settings.language;
            void setLocale(lastLocale);
        }
        const nextRuntimeEnabled = snap.settings.platforms?.[platformKey] ?? true;
        syncChatGptDirectorySettings(snap.settings.chatgptDirectory);
        if (nextRuntimeEnabled) enableRuntime();
        else disableRuntime();
        syncFormulaSettings(snap.settings.formula);
        readerPanel.setRenderCodeInReader(Boolean(snap.settings.reader.renderCodeInReader));
        readerPanel.setContentMaxWidthPx(snap.settings.reader.contentMaxWidthPx ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx);
        readerPanel.setCommentExportSettings(snap.settings.reader.commentExport);
        saveMessagesDialog.setExportSettings(snap.settings.export ?? DEFAULT_SETTINGS.export);
        messageToolbars.setExportSettings(snap.settings.export ?? DEFAULT_SETTINGS.export);
        messageToolbars.setBehaviorFlags({
            showSaveMessages: snap.settings.behavior.showSaveMessages,
            showWordCount: snap.settings.behavior.showWordCount,
        });
    });

    themeManager.init(adapter);
    themeManager.subscribe((theme) => {
        currentTheme = theme;
        messageToolbars.setTheme(theme);
        readerPanel.setTheme(theme);
        sendController.setTheme(theme);
        bookmarksController.setTheme(theme);
        chatGptDirectory?.setTheme(theme);
    });

    browser.runtime.onMessage.addListener((msg: unknown) => {
        if (!isExtRequest(msg)) return;
        if (msg.type === 'ui:toggle_toolbar') {
            void bookmarksPanel.toggle();
        }
    });

    if (runtimeEnabled) {
        messageToolbars.init();
        headerIcon.init();
        initChatGptIfNeeded();
    }

    // Best-effort navigation: handle "Go To" from bookmarks panel across SPA transitions.
    const pending = consumePendingNavigation();
    if (pending) {
        const pendingNavigation = adapter.getPlatformId() === 'chatgpt'
            ? navigateChatGPTDirectoryTarget(adapter, pending, { timeoutMs: 8000, intervalMs: 200 })
            : scrollToBookmarkTargetWithRetry(adapter, pending, { timeoutMs: 8000, intervalMs: 200 });
        void pendingNavigation;
    }
}

function resolveFormulaSettings(settings: typeof DEFAULT_SETTINGS.formula | undefined): typeof DEFAULT_SETTINGS.formula {
    return {
        ...DEFAULT_SETTINGS.formula,
        ...settings,
        assetActions: {
            ...DEFAULT_SETTINGS.formula.assetActions,
            ...settings?.assetActions,
        },
    };
}

function shouldEnableFormulaInteractions(settings: typeof DEFAULT_SETTINGS.formula): boolean {
    return Boolean(
        settings.clickCopyMarkdown
        || settings.assetActions.copyPng
        || settings.assetActions.copySvg
        || settings.assetActions.savePng
        || settings.assetActions.saveSvg
    );
}
