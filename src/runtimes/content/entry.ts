import { getAdapter } from '../../drivers/content/adapters/registry';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { MathClickHandler } from '../../drivers/content/math/math-click';
import { ensurePageTokens } from '../../style/pageTokens';
import { ReaderPanel } from '../../ui/content/reader/ReaderPanel';
import { MessageToolbarOrchestrator } from '../../ui/content/controllers/MessageToolbarOrchestrator';

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
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        onMessageInjected: (messageElement) => {
            // Frozen decision: LaTeX click-to-copy is enabled by default (no UI toggle).
            mathClick.enable(messageElement);
        },
    });

    themeManager.init(adapter);
    themeManager.subscribe((theme) => {
        messageToolbars.setTheme(theme);
        readerPanel.setTheme(theme);
    });

    messageToolbars.init();
}
