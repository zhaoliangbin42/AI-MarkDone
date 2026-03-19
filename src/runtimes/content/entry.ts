import { getAdapter } from '../../drivers/content/adapters/registry';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { MathClickHandler } from '../../drivers/content/math/math-click';
import { consumePendingNavigation, scrollToAssistantPositionWithRetry } from '../../drivers/content/bookmarks/navigation';
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
import { ChatGPTFoldingController } from '../../ui/content/controllers/ChatGPTFoldingController';
import { HeaderIconOrchestrator } from '../../ui/content/controllers/HeaderIconOrchestrator';
import { SendController } from '../../ui/content/sending/SendController';
import { discoverMessageElements } from '../../drivers/content/injection/messageDiscovery';

ensurePageTokens();

const adapter = getAdapter();
if (adapter) {
    const themeManager = new ThemeManager();
    const mathClick = new MathClickHandler();
    const readerPanel = new ReaderPanel();
    const sendController = new SendController();
    const settingsClient = new SettingsClient();
    const bookmarksController = new BookmarksPanelController(adapter);
    const bookmarksPanel = new BookmarksPanel(bookmarksController, readerPanel);
    const folding = adapter.getPlatformId() === 'chatgpt' ? new ChatGPTFoldingController() : null;
    const headerIcon = new HeaderIconOrchestrator(adapter, {
        onToggle: () => bookmarksPanel.toggle(),
    });
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        sendController,
        bookmarksController,
        onMessageInjected: (messageElement) => {
            const behavior = settingsClient.getCached()?.behavior ?? DEFAULT_SETTINGS.behavior;
            if (behavior.enableClickToCopy) {
                mathClick.enable(messageElement);
            }
            folding?.registerMessage(messageElement);
        },
    });

    settingsClient.init();
    let lastLocale = settingsClient.getCached()?.language ?? DEFAULT_SETTINGS.language;
    const platformKey = adapter.getPlatformId().toLowerCase() as keyof typeof DEFAULT_SETTINGS.platforms;
    let runtimeEnabled = settingsClient.getCached()?.platforms?.[platformKey] ?? true;

    const syncClickToCopy = (enabled: boolean) => {
        mathClick.disable();
        if (!enabled) return;
        for (const messageElement of discoverMessageElements(document, adapter.getMessageSelector())) {
            mathClick.enable(messageElement);
        }
    };

    const initFoldingIfNeeded = () => {
        if (!folding) return;
        const initialTheme = document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light';
        folding.init(adapter, initialTheme);
    };

    const enableRuntime = () => {
        if (runtimeEnabled) return;
        runtimeEnabled = true;
        messageToolbars.init();
        headerIcon.init();
        initFoldingIfNeeded();
    };

    const disableRuntime = () => {
        if (!runtimeEnabled) return;
        runtimeEnabled = false;
        messageToolbars.dispose();
        headerIcon.dispose();
        folding?.dispose();
    };

    // Apply initial UI locale immediately (otherwise switching to a non-auto locale won't take effect until a change event).
    void setLocale(lastLocale);
    settingsClient.subscribe((snap) => {
        if (snap.settings.language !== lastLocale) {
            lastLocale = snap.settings.language;
            void setLocale(lastLocale);
        }
        const nextRuntimeEnabled = snap.settings.platforms?.[platformKey] ?? true;
        if (nextRuntimeEnabled) enableRuntime();
        else disableRuntime();
        syncClickToCopy(Boolean(snap.settings.behavior.enableClickToCopy));
        readerPanel.setRenderCodeInReader(Boolean(snap.settings.reader.renderCodeInReader));
        folding?.setPolicy(snap.settings.chatgpt);
        messageToolbars.setBehaviorFlags({
            showViewSource: snap.settings.behavior.showViewSource,
            showSaveMessages: snap.settings.behavior.showSaveMessages,
            showWordCount: snap.settings.behavior.showWordCount,
        });
    });

    themeManager.init(adapter);
    themeManager.subscribe((theme) => {
        messageToolbars.setTheme(theme);
        readerPanel.setTheme(theme);
        sendController.setTheme(theme);
        bookmarksController.setTheme(theme);
        folding?.setTheme(theme);
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
        initFoldingIfNeeded();
    }

    // Best-effort navigation: handle "Go To" from bookmarks panel across SPA transitions.
    const pending = consumePendingNavigation();
    if (pending) {
        void scrollToAssistantPositionWithRetry(adapter, pending.position, { timeoutMs: 2500, intervalMs: 200 });
    }
}
