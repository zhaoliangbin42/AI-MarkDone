import { detectPlatformId } from '../../contracts/platform';
import { isExtRequest, PROTOCOL_VERSION } from '../../contracts/protocol';
import { browser } from '../../drivers/shared/browser';
import { getAdapter } from '../../drivers/content/adapters/registry';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';
import { MathClickHandler } from '../../drivers/content/math/math-click';
import { MessageToolbarController } from '../../drivers/content/toolbars/message-toolbar-controller';
import { copyMarkdownFromPage } from '../../services/copy/copy-markdown';
import { ensurePageTokens } from '../../style/pageTokens';
import { RewriteToolbar } from '../../ui/content/RewriteToolbar';
import { ReaderPanel } from '../../ui/content/reader/ReaderPanel';

ensurePageTokens();

const platform = detectPlatformId(window.location.hostname);
const adapter = getAdapter();

const themeManager = new ThemeManager();
const mathClick = new MathClickHandler();
let latexClickEnabled = true;
const readerPanel = new ReaderPanel();
const messageToolbars = adapter
    ? new MessageToolbarController(adapter, {
          onMessageInjected: (messageElement) => {
              if (!latexClickEnabled) return;
              mathClick.enable(messageElement);
          },
          readerPanel,
      })
    : null;

const toolbar = new RewriteToolbar(
    { platform, theme: 'light' },
    {
        onCopyMarkdown: async () => {
            if (!adapter) return { ok: false, message: 'Unsupported site.' };
            const res = copyMarkdownFromPage(adapter);
            if (!res.ok) return { ok: false, message: res.error.message };
            const ok = await copyTextToClipboard(res.markdown);
            return ok ? { ok: true } : { ok: false, message: 'Clipboard write failed.' };
        },
        onToggleLatexClickMode: async (nextEnabled) => {
            latexClickEnabled = nextEnabled;
            toolbar.setLatexClickMode(nextEnabled);
            if (nextEnabled) {
                messageToolbars?.getMessageElements().forEach((el) => mathClick.enable(el));
            } else {
                mathClick.disable();
            }
            return { ok: true, enabled: latexClickEnabled };
        },
    }
);

themeManager.init(adapter);
themeManager.subscribe((theme) => {
    toolbar.setTheme(theme);
    messageToolbars?.setTheme(theme);
    readerPanel.setTheme(theme);
});

toolbar.mount();
toolbar.setLatexClickMode(latexClickEnabled);
messageToolbars?.init();

browser.runtime.onMessage.addListener((msg: unknown) => {
    if (!isExtRequest(msg)) return;
    if (msg.v !== PROTOCOL_VERSION) return;
    if (msg.type === 'ui:toggle_toolbar') {
        toolbar.toggle();
    }
});
