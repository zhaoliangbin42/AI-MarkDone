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
import { SendController } from '../../ui/content/sending/SendController';

ensurePageTokens();

const adapter = getAdapter();
if (!adapter || adapter.getPlatformId() !== 'chatgpt') {
    // ChatGPT-only validation stage.
    // Other platforms remain out of scope until this loop is fully stable and audited.
    // Why: reduce variables and enforce a single acceptance target.
    // Note: no global UI is injected in this stage.
    // (Adapters may still exist for future parity work.)
} else {
    const themeManager = new ThemeManager();
    const mathClick = new MathClickHandler();
    const readerPanel = new ReaderPanel();
    const sendController = new SendController();
    const settingsClient = new SettingsClient();
    const bookmarksController = new BookmarksPanelController(adapter);
    const bookmarksPanel = new BookmarksPanel(bookmarksController, readerPanel);
    const folding = new ChatGPTFoldingController();
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        sendController,
        bookmarksController,
        onMessageInjected: (messageElement) => {
            const behavior = settingsClient.getCached()?.behavior ?? DEFAULT_SETTINGS.behavior;
            if (behavior.enableClickToCopy) {
                mathClick.enable(messageElement);
            }
            folding.registerMessage(messageElement);
        },
    });

    settingsClient.init();
    let lastLocale = settingsClient.getCached()?.language ?? DEFAULT_SETTINGS.language;
    // Apply initial UI locale immediately (otherwise switching to a non-auto locale won't take effect until a change event).
    void setLocale(lastLocale);
    settingsClient.subscribe((snap) => {
        if (snap.settings.language !== lastLocale) {
            lastLocale = snap.settings.language;
            void setLocale(lastLocale);
        }
        folding.setPolicy(snap.settings.chatgpt);
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
        folding.setTheme(theme);
    });

    browser.runtime.onMessage.addListener((msg: unknown) => {
        if (!isExtRequest(msg)) return;
        if (msg.type === 'ui:toggle_toolbar') {
            void bookmarksPanel.toggle();
        }
    });

    messageToolbars.init();
    folding.init(adapter, 'light');

    // Best-effort navigation: handle "Go To" from bookmarks panel across SPA transitions.
    const pending = consumePendingNavigation();
    if (pending) {
        void scrollToAssistantPositionWithRetry(adapter, pending.position, { timeoutMs: 2500, intervalMs: 200 });
    }
}
