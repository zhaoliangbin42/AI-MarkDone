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
    const settingsClient = new SettingsClient();
    const bookmarksController = new BookmarksPanelController(adapter);
    const bookmarksPanel = new BookmarksPanel(bookmarksController, readerPanel);
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        bookmarksController,
        onMessageInjected: (messageElement) => {
            const behavior = settingsClient.getCached()?.behavior ?? DEFAULT_SETTINGS.behavior;
            if (behavior.enableClickToCopy) {
                mathClick.enable(messageElement);
            }
        },
    });

    settingsClient.init();
    settingsClient.subscribe((snap) => {
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
        bookmarksController.setTheme(theme);
    });

    browser.runtime.onMessage.addListener((msg: unknown) => {
        if (!isExtRequest(msg)) return;
        if (msg.type === 'ui:toggle_toolbar') {
            void bookmarksPanel.toggle();
        }
    });

    messageToolbars.init();

    // Best-effort navigation: handle "Go To" from bookmarks panel across SPA transitions.
    const pending = consumePendingNavigation();
    if (pending) {
        void scrollToAssistantPositionWithRetry(adapter, pending.position, { timeoutMs: 2500, intervalMs: 200 });
    }
}
