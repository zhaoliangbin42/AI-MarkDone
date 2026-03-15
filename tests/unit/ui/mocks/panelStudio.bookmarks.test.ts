import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const studioSource = fs.readFileSync(path.resolve(process.cwd(), 'mocks/components/panel-studio/main.ts'), 'utf8');

async function mountStudio(): Promise<ShadowRoot> {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
    await import('../../../../mocks/components/panel-studio/main.ts');

    const host = document.querySelector<HTMLElement>('.aimd-panel-studio-host');
    expect(host?.shadowRoot).toBeTruthy();
    return host!.shadowRoot!;
}

describe('panel studio bookmarks mock', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('uses folder name clicks to toggle expansion instead of entering a folder filter', async () => {
        const shadow = await mountStudio();

        const productChildren = shadow.querySelector<HTMLElement>('.tree-item--folder .tree-main--folder[data-path="Product"]')
            ?.closest('.tree-node')
            ?.querySelector<HTMLElement>('.tree-children');
        expect(productChildren?.dataset.expanded).toBe('1');

        const folderMain = shadow.querySelector<HTMLButtonElement>('.tree-main--folder[data-path="Product"]');
        expect(folderMain).toBeTruthy();
        folderMain!.click();

        const refreshedChildren = shadow.querySelector<HTMLElement>('.tree-item--folder .tree-main--folder[data-path="Product"]')
            ?.closest('.tree-node')
            ?.querySelector<HTMLElement>('.tree-children');
        expect(refreshedChildren?.dataset.expanded).toBe('0');
        expect(shadow.querySelector('.folder-filter')).toBeNull();
    });

    it('lets blank space on a bookmarks folder row toggle expansion just like the folder label', async () => {
        const shadow = await mountStudio();

        const folderRow = shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Product"]');
        expect(folderRow).toBeTruthy();
        folderRow!.click();

        const refreshedChildren = shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Product"]')
            ?.closest('.tree-node')
            ?.querySelector<HTMLElement>('.tree-children');
        expect(refreshedChildren?.dataset.expanded).toBe('0');
    });

    it('replaces the native platform select and only renders the batch action bar when items are selected', async () => {
        const shadow = await mountStudio();

        expect(shadow.querySelector('[data-role="bookmark-platform"]')).toBeNull();
        const platformTrigger = shadow.querySelector<HTMLButtonElement>('[data-action="toggle-platform-menu"]');
        expect(platformTrigger).toBeTruthy();
        platformTrigger!.click();
        const platformOptions = shadow.querySelectorAll('.platform-dropdown__option');
        expect(platformOptions.length).toBeGreaterThan(1);
        expect(Array.from(platformOptions).every((node) => node.querySelector('svg'))).toBe(true);

        const idleBatchBar = shadow.querySelector<HTMLElement>('.batch-bar');
        expect(idleBatchBar?.dataset.active).toBe('0');
        expect(shadow.textContent).not.toContain('No selection');

        const firstBookmarkCheck = shadow.querySelector<HTMLButtonElement>('.tree-item--bookmark .tree-check[data-id]');
        expect(firstBookmarkCheck).toBeTruthy();
        firstBookmarkCheck!.click();

        const batchBar = shadow.querySelector<HTMLElement>('.batch-bar');
        expect(batchBar).toBeTruthy();
        expect(batchBar?.dataset.active).toBe('1');
        expect(batchBar?.textContent).toContain('1 selected');
    });

    it('uses native checkbox inputs for tree selection to match the shipped bookmarks panel contract', async () => {
        const shadow = await mountStudio();

        const bookmarkCheck = shadow.querySelector<HTMLInputElement>('.tree-item--bookmark input.tree-check[type="checkbox"]');
        const folderCheck = shadow.querySelector<HTMLInputElement>('.tree-item--folder input.tree-check[type="checkbox"]');

        expect(bookmarkCheck).toBeTruthy();
        expect(folderCheck).toBeTruthy();
        expect(bookmarkCheck?.checked).toBe(false);

        bookmarkCheck!.click();

        const refreshedFolderCheck = shadow.querySelector<HTMLInputElement>('.tree-item--folder input.tree-check[type="checkbox"]');
        expect(refreshedFolderCheck?.indeterminate || refreshedFolderCheck?.dataset.indeterminate === '1').toBeTruthy();
    });

    it('drops the bookmarks kicker and footer chrome from the bookmarks tab surface', async () => {
        const shadow = await mountStudio();

        const headerMeta = shadow.querySelector('.panel-window--bookmarks .panel-header__meta');
        expect(headerMeta?.textContent).not.toContain('Bookmarks panel');
        expect(shadow.querySelector('.panel-window--bookmarks .tab-panel[data-active="1"] .panel-footer')).toBeNull();
    });

    it('reuses the shared icon asset module instead of redefining bookmark panel icons inline', () => {
        expect(studioSource).toContain("from '../../../src/assets/icons'");
        expect(studioSource).toContain('bookmarkIcon as sharedBookmarkIcon');
        expect(studioSource).toContain('Icons.gemini');
        expect(studioSource).toContain('icon(sharedBookmarkIcon)');
    });

    it('keeps the bookmarks tab rail on the left and preserves a large desktop shell', async () => {
        const shadow = await mountStudio();
        const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.bookmarks-shell {\n  display: grid;\n  grid-template-columns: 220px minmax(0, 1fr);');
        expect(styleText).not.toContain('@media (max-width: 980px) {\n  .workspace-grid,\n  .bookmarks-shell {\n    grid-template-columns: 1fr;');
        expect(styleText).toContain('.panel-window--bookmarks {\n  width: min(1180px, calc(100vw - 56px));');
        expect(styleText).toContain('height: min(820px, calc(100vh - 56px));');
    });

    it('uses a native compact checkbox, larger non-bold titles, hover feedback, and fixed tree slots for alignment', async () => {
        const shadow = await mountStudio();
        const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.tree-item {\n  position: relative;\n  display: grid;\n  grid-template-columns: 20px 18px 20px minmax(0, 1fr) auto;');
        expect(styleText).toContain('.tree-check {\n  appearance: none;');
        expect(styleText).toContain('appearance: none;');
        expect(styleText).toContain('width: 18px;');
        expect(styleText).toContain('height: 18px;');
        expect(styleText).toContain('.tree-item:hover {\n  background:');
        expect(styleText).toContain('.tree-label {\n  overflow: hidden;');
        expect(styleText).toContain('font-size: 18px;');
        expect(styleText).toContain('font-weight: 400;');
        expect(styleText).toContain('width: 100%;');
        expect(styleText).toContain('.tree-caret-slot {');
        expect(styleText).toContain('.tree-icon-slot {');
        expect(styleText).toContain('.tree-actions {\n  position: absolute;');

        const bookmarkTitle = shadow.querySelector<HTMLElement>('.tree-item--bookmark .tree-label');
        const folderTitle = shadow.querySelector<HTMLElement>('.tree-item--folder .tree-label');
        expect(bookmarkTitle).toBeTruthy();
        expect(folderTitle?.textContent).toBe('Product');
        const styles = getComputedStyle(bookmarkTitle!);
        expect(styles.fontSize).toBe('18px');
        expect(styles.fontWeight).toBe('400');
    });

    it('keeps the bookmarks filters and actions on a single row with a bordered platform trigger and no default export-selected button', async () => {
        const shadow = await mountStudio();
        const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.toolbar-row--bookmarks {');
        expect(styleText).toContain('display: flex;');
        expect(styleText).toContain('align-items: center;');
        expect(styleText).toContain('.search-field {');
        expect(styleText).toContain('flex: 1 1 auto;');
        expect(styleText).toContain('.platform-dropdown__trigger {');
        expect(styleText).toContain('border: 1px solid');

        const toolbar = shadow.querySelector<HTMLElement>('.toolbar-row--bookmarks');
        const search = shadow.querySelector<HTMLElement>('.toolbar-row--bookmarks .search-field');
        const platformTrigger = shadow.querySelector<HTMLElement>('.toolbar-row--bookmarks .platform-dropdown__trigger');
        const topActions = shadow.querySelector<HTMLElement>('.toolbar-row--bookmarks .toolbar-actions');

        expect(toolbar).toBeTruthy();
        expect(search).toBeTruthy();
        expect(platformTrigger).toBeTruthy();
        expect(topActions).toBeTruthy();
        expect(topActions?.querySelector('[data-op="export-selected"]')).toBeNull();

        const toolbarStyle = getComputedStyle(toolbar!);
        const searchStyle = getComputedStyle(search!);
        const triggerStyle = getComputedStyle(platformTrigger!);

        expect(toolbarStyle.display).toBe('flex');
        expect(toolbarStyle.flexWrap).toBe('nowrap');
        expect(searchStyle.flexGrow).toBe('1');
        expect(triggerStyle.borderTopWidth).not.toBe('0px');
    });

    it('hides the folder count when row actions are revealed so the actions do not overlap it', async () => {
        const shadow = await mountStudio();
        const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.tree-item:hover .tree-count,');
        expect(styleText).toContain('.tree-item:focus-within .tree-count,');
        expect(styleText).toContain('.tree-item[data-selected="1"] .tree-count {');
        expect(styleText).toContain('opacity: 0;');
        expect(styleText).toContain('pointer-events: none;');
    });

    it('restyles the settings tab with non-bold row labels, shared dropdown triggers, and a stepped number input', async () => {
        const shadow = await mountStudio();
        const settingsTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]');
        expect(settingsTabButton).toBeTruthy();
        settingsTabButton!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.settings-label strong {');
        expect(styleText).toContain('font-weight: 400;');
        expect(styleText).toContain('.settings-select-trigger {');
        expect(styleText).toContain('border: 1px solid');
        expect(styleText).toContain('.settings-number-field {');
        expect(styleText).toContain('.settings-number-stepper {');

        const selects = refreshedShadow.querySelectorAll('.settings-select-trigger');
        expect(selects.length).toBeGreaterThanOrEqual(2);

        const rowLabel = refreshedShadow.querySelector<HTMLElement>('.settings-row .settings-label strong');
        expect(rowLabel).toBeTruthy();
        expect(getComputedStyle(rowLabel!).fontWeight).toBe('400');

        const numberField = refreshedShadow.querySelector<HTMLElement>('.settings-number-field');
        expect(numberField).toBeTruthy();
        expect(numberField?.querySelector('[data-action="settings-step-count"][data-direction="up"]')).toBeTruthy();
        expect(numberField?.querySelector('[data-action="settings-step-count"][data-direction="down"]')).toBeTruthy();
    });

    it('preserves settings scroll position, removes the first settings divider, and uses the official ChatGPT icon', async () => {
        const shadow = await mountStudio();
        const settingsTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]');
        expect(settingsTabButton).toBeTruthy();
        settingsTabButton!.click();

        const settingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        expect(settingsPanel).toBeTruthy();
        settingsPanel!.scrollTop = 180;

        const foldingModeTrigger = shadow.querySelector<HTMLElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]');
        expect(foldingModeTrigger).toBeTruthy();
        foldingModeTrigger!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const refreshedPanel = refreshedShadow.querySelector<HTMLElement>('.settings-panel');
        expect(refreshedPanel?.scrollTop).toBe(180);

        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        expect(styleText).toContain('.settings-card > .card-title + .settings-row {');

        const foldingModeRow = refreshedShadow.querySelector<HTMLElement>('.settings-card:nth-of-type(2) .settings-row');
        expect(foldingModeRow).toBeTruthy();

        const chatgptCardTitle = refreshedShadow.querySelector<HTMLElement>('.settings-card:nth-of-type(2) .card-title');
        expect(chatgptCardTitle).toBeTruthy();
        expect(studioSource).toContain('chatgptIcon as sharedChatgptIcon');
        expect(chatgptCardTitle?.textContent).toContain('ChatGPT');
    });

    it('rebuilds the sponsor tab as a narrower centered support layout with panel-wide click bursts', async () => {
        const shadow = await mountStudio();
        const sponsorTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="sponsor"]');
        expect(sponsorTabButton).toBeTruthy();
        sponsorTabButton!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.sponsor-shell {');
        expect(styleText).toContain('width: min(620px, calc(100% - 40px));');
        expect(styleText).toContain('.sponsor-celebration {');
        expect(styleText).toContain('.sponsor-qr-image {');
        expect(styleText).toContain('.sponsor-title-row {');
        expect(styleText).toContain('z-index: 4;');

        const sponsorShell = refreshedShadow.querySelector<HTMLElement>('.sponsor-shell');
        const sponsorPanel = refreshedShadow.querySelector<HTMLElement>('.sponsor-panel');
        const sponsorBrand = refreshedShadow.querySelector<HTMLImageElement>('.sponsor-brand-mark');
        const qrImages = refreshedShadow.querySelectorAll<HTMLImageElement>('.sponsor-qr-image');
        const githubButton = refreshedShadow.querySelector<HTMLElement>('[data-action="sponsor-github"]');

        expect(sponsorShell).toBeTruthy();
        expect(refreshedShadow.querySelector('.sponsor-hero')).toBeNull();
        expect(sponsorBrand?.getAttribute('src')).toBe('/icons/icon128.png');
        expect(refreshedShadow.querySelector('.sponsor-title')).toBeNull();
        expect(qrImages.length).toBe(2);
        expect(Array.from(qrImages).map((img) => img.getAttribute('src'))).toEqual(['/icons/bmc_qr.png', '/icons/wechat_qr.png']);
        expect(githubButton?.textContent).toContain('Star on GitHub');
        expect(refreshedShadow.querySelector('.sponsor-celebration')).toBeTruthy();

        sponsorPanel!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 280, clientY: 320 }));
        expect(refreshedShadow.querySelectorAll('.sponsor-burst-piece').length).toBeGreaterThan(0);
    });

    it('retunes the reader panel header and footer controls without showing the bookmark title in the header', async () => {
        const shadow = await mountStudio();
        const readerLauncher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="reader"]');
        expect(readerLauncher).toBeTruthy();
        readerLauncher!.click();
        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.reader-footer {');
        expect(styleText).toContain('.reader-dots {');
        expect(styleText).toContain('overflow-x: auto;');
        expect(styleText).toContain('.reader-content {\n  max-width: min(1000px, 100%);');
        expect(styleText).toContain('.reader-thread {');
        expect(styleText).toContain('.reader-message {');
        expect(styleText).toContain('.reader-markdown {');
        expect(styleText).toContain('.panel-header__meta--reader {\n  display: flex;\n  align-items: center;');
        expect(styleText).toContain('.reader-header-page {\n  display: inline-flex;\n  align-items: center;');
        expect(styleText).toContain('.reader-markdown :where(.katex-display) {');
        expect(styleText).toContain('margin: 1em 0;');
        expect(styleText).toContain('padding: 0;');
        expect(studioSource).toContain("import { getMarkdownThemeCss } from '../../../src/ui/content/components/markdownTheme';");
        expect(studioSource).toContain("import { renderMarkdownToSanitizedHtml } from '../../../src/services/renderer/renderMarkdown';");
        expect(studioSource).toContain("import katexCssUrl from 'katex/dist/katex.min.css?url';");
        expect(studioSource).toContain('?raw');
        expect(studioSource).toContain('fileCodeIcon as sharedFileCodeIcon');
        expect(studioSource).toContain('maximizeIcon as sharedMaximizeIcon');
        expect(studioSource).toContain('minimizeIcon as sharedMinimizeIcon');
        expect(studioSource).not.toContain("import { marked } from 'marked';");
        expect(studioSource).not.toContain("import createDOMPurify from 'dompurify';");
        expect(studioSource).not.toContain('function ensureMathJaxReady(): Promise<any> {');
        expect(studioSource).not.toContain("script.src = '/vendor/mathjax/loader.js';");
        expect(studioSource).toContain('data-action="reader-open-conversation" aria-label="Open conversation">${icon(sharedExternalLinkIcon)}');
        expect(studioSource).toContain('data-action="reader-copy" aria-label="Copy markdown">${icon(sharedCopyIcon)}');
        expect(studioSource).toContain('data-action="reader-source" aria-label="View source">${icon(sharedFileCodeIcon)}');
        expect(studioSource).toContain("data-action=\"reader-fullscreen\" aria-label=\"Toggle fullscreen\">${icon(appState.readerFullscreen ? sharedMinimizeIcon : sharedMaximizeIcon)}");
        expect(studioSource).toContain('data-action="close-panel" aria-label="Close panel">${icon(sharedXIcon)}');

        const headerTitle = refreshedShadow.querySelector<HTMLElement>('.panel-window--reader .panel-header__meta h2');
        const headerMeta = refreshedShadow.querySelector<HTMLElement>('.panel-window--reader .panel-header__meta--reader');
        const pageCounter = refreshedShadow.querySelector<HTMLElement>('.panel-window--reader .reader-header-page');
        const userSection = refreshedShadow.querySelector<HTMLElement>('.reader-message--user');
        const assistantSection = refreshedShadow.querySelector<HTMLElement>('.reader-message--assistant');
        const markdownRoot = refreshedShadow.querySelector<HTMLElement>('.reader-markdown');
        expect(headerTitle?.textContent).toBe('Reader panel');
        expect(refreshedShadow.querySelector('[data-action="reader-toggle-bookmark"]')).toBeNull();
        expect(refreshedShadow.querySelector('[data-action="reader-open-conversation"]')).toBeTruthy();
        expect(pageCounter?.textContent).toMatch(/^1\/\d+$/);
        expect(userSection?.textContent).toContain('User message');
        expect(assistantSection?.textContent).toContain('AI response');
        expect(markdownRoot?.querySelector('h1')?.textContent).toBeTruthy();
        expect(markdownRoot?.querySelector('table')).toBeTruthy();
        expect(markdownRoot?.querySelector('blockquote')).toBeTruthy();
        expect(markdownRoot?.querySelector('.katex')).toBeTruthy();
        expect(markdownRoot?.querySelector('.katex-display')).toBeTruthy();
        expect(markdownRoot?.querySelector('pre[data-code-language="ts"] code')?.className).toContain('hljs');

        const sendButton = refreshedShadow.querySelector<HTMLElement>('[data-action="reader-send-toggle"]');
        const locateButton = refreshedShadow.querySelector<HTMLElement>('[data-action="reader-locate"]');
        const prevButton = refreshedShadow.querySelector<HTMLElement>('[data-action="reader-prev"]');
        const nextButton = refreshedShadow.querySelector<HTMLElement>('[data-action="reader-next"]');
        const footerHint = refreshedShadow.querySelector<HTMLElement>('.reader-footer__meta .hint');
        const footer = refreshedShadow.querySelector<HTMLElement>('.reader-footer');
        const dots = refreshedShadow.querySelector<HTMLElement>('.reader-dots');

        expect(sendButton).toBeTruthy();
        expect(locateButton).toBeTruthy();
        expect(prevButton).toBeTruthy();
        expect(nextButton).toBeTruthy();
        expect(footerHint?.textContent).toContain('<- / ->');
        expect(getComputedStyle(sendButton!).width).toBe('44px');
        expect(getComputedStyle(locateButton!).width).toBe('44px');
        expect(getComputedStyle(prevButton!).width).toBe('44px');
        expect(getComputedStyle(nextButton!).width).toBe('44px');
        expect(getComputedStyle(footer!).paddingTop).toBe('12px');
        expect(getComputedStyle(dots!).overflowX).toBe('auto');
        expect(getComputedStyle(headerMeta!).alignItems).toBe('center');
        expect(getComputedStyle(pageCounter!).display).toBe('inline-flex');
        expect(getComputedStyle(pageCounter!).alignItems).toBe('center');
    });

    it('injects KaTeX runtime CSS into the reader shadow root so math uses the proper visual layer instead of rendering raw fallback content', async () => {
        const shadow = await mountStudio();
        const readerLauncher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="reader"]');
        expect(readerLauncher).toBeTruthy();
        readerLauncher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const katexLink = refreshedShadow.querySelector<HTMLLinkElement>('link[data-aimd-style-link="aimd-panel-studio-katex"]');

        expect(katexLink).toBeTruthy();
        expect(katexLink?.rel).toBe('stylesheet');
        expect(studioSource).toContain("import katexCssUrl from 'katex/dist/katex.min.css?url';");
        expect(studioSource).toContain('ensureShadowStylesheetLink(shadow, katexCssUrl, \'aimd-panel-studio-katex\');');
        expect(studioSource).toContain('link.rel = \'stylesheet\';');
        expect(studioSource).not.toContain('@import url(');
    });

    it('reuses the reader-style header for the source panel and removes the footer chrome', async () => {
        const shadow = await mountStudio();
        const sourceLauncher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="source"]');
        expect(sourceLauncher).toBeTruthy();
        sourceLauncher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        const sourcePanel = refreshedShadow.querySelector<HTMLElement>('.panel-window--source');
        const headerMeta = refreshedShadow.querySelector<HTMLElement>('.panel-window--source .panel-header__meta');
        const title = refreshedShadow.querySelector<HTMLElement>('.panel-window--source .panel-header__meta h2');
        const copyButton = refreshedShadow.querySelector<HTMLElement>('[data-action="source-copy"]');
        const closeButton = refreshedShadow.querySelector<HTMLElement>('.panel-window--source [data-action="close-panel"]');
        const sourcePre = refreshedShadow.querySelector<HTMLElement>('.panel-window--source .source-pre');

        expect(sourcePanel).toBeTruthy();
        expect(headerMeta?.className).toContain('panel-header__meta--reader');
        expect(title?.textContent).toBe('Source');
        expect(copyButton).toBeTruthy();
        expect(closeButton).toBeTruthy();
        expect(refreshedShadow.querySelector('.panel-window--source .panel-footer')).toBeNull();
        expect(styleText).toContain('.source-body {');
        expect(styleText).toContain('flex: 1;');
        expect(styleText).toContain('padding: 22px;');
        expect(styleText).toContain('.source-pre {');
        expect(styleText).toContain('font-size: 14px;');
        expect(styleText).toContain('line-height: 1.7;');
        expect(sourcePre?.textContent).toContain('# Overlay host rollout');
    });

    it('aligns the save messages header with the bookmarks panel and removes the extra status footer', async () => {
        const shadow = await mountStudio();
        const saveLauncher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="saveMessages"]');
        expect(saveLauncher).toBeTruthy();
        saveLauncher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const savePanel = refreshedShadow.querySelector<HTMLElement>('.panel-window--save');
        const title = refreshedShadow.querySelector<HTMLElement>('.panel-window--save .panel-header__meta h2');
        const kicker = refreshedShadow.querySelector<HTMLElement>('.panel-window--save .panel-kicker');
        const footers = refreshedShadow.querySelectorAll('.panel-window--save .panel-footer');
        const closeButton = refreshedShadow.querySelector<HTMLElement>('.panel-window--save [data-action="close-panel"]');

        expect(savePanel).toBeTruthy();
        expect(title?.textContent).toBe('Save Messages');
        expect(kicker).toBeNull();
        expect(footers.length).toBe(1);
        expect(closeButton).toBeTruthy();
        expect(savePanel?.textContent).not.toContain('Choose numbered turns, switch Markdown/PDF, then save.');
    });

    it('reuses the reader-style header for bookmark save, keeps the title editable, and lets blank folder rows toggle expansion', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="bookmarkSave"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        let refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const headerMeta = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .panel-header__meta');
        const title = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .panel-header__meta h2');
        const titleInput = refreshedShadow.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]');
        const helpText = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .help-text');
        const folderRow = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .picker-row[data-path="Product"]');
        const footerStatus = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .status-line');
        const footer = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .panel-footer');
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(headerMeta?.className).toContain('panel-header__meta--reader');
        expect(title?.textContent).toBe('Save Bookmark');
        expect(titleInput).toBeTruthy();
        expect(titleInput?.value).toBeTruthy();
        expect(helpText).toBeNull();
        expect(footerStatus).toBeNull();
        expect(footer?.className).toContain('panel-footer--bookmark-save');
        expect(styleText).toContain('.text-input--bookmark-save-title {');
        expect(styleText).toContain('border: 1px solid');
        expect(styleText).toContain('.panel-footer--bookmark-save {');

        titleInput!.value = 'Renamed bookmark';
        titleInput!.dispatchEvent(new Event('input', { bubbles: true }));
        expect(titleInput!.value).toBe('Renamed bookmark');

        const initialChildren = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .picker-row[data-path="Product"]')
            ?.closest('.picker-node')
            ?.querySelector<HTMLElement>('.tree-children');
        expect(initialChildren?.dataset.expanded).toBe('1');

        expect(folderRow).toBeTruthy();
        folderRow!.click();

        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const collapsedChildren = refreshedShadow.querySelector<HTMLElement>('.panel-window--bookmark-save .picker-row[data-path="Product"]')
            ?.closest('.picker-node')
            ?.querySelector<HTMLElement>('.tree-children');
        expect(collapsedChildren?.dataset.expanded).toBe('0');
    });

    it('keeps send popover actions on the right and lets the top-right handle resize the whole popover upward and to the right', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="sendPopover"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        const textarea = refreshedShadow.querySelector<HTMLTextAreaElement>('.send-popover__input');
        const buttonRow = refreshedShadow.querySelector<HTMLElement>('.send-popover__foot .button-row');
        const popover = refreshedShadow.querySelector<HTMLElement>('.send-popover');
        const resizeHandle = refreshedShadow.querySelector<HTMLElement>('[data-action="send-popover-resize"]');
        const panelWindow = refreshedShadow.querySelector<HTMLElement>('.panel-window--popover-demo');
        const dialogBody = refreshedShadow.querySelector<HTMLElement>('.panel-window--popover-demo .dialog-body');

        expect(textarea).toBeTruthy();
        expect(buttonRow).toBeTruthy();
        expect(popover).toBeTruthy();
        expect(resizeHandle).toBeTruthy();
        expect(panelWindow).toBeTruthy();
        expect(dialogBody).toBeTruthy();
        expect(styleText).toContain('.send-popover__input {');
        expect(styleText).toContain('resize: none;');
        expect(styleText).toContain('min-height: 0;');
        expect(styleText).toContain('.send-popover__foot {');
        expect(styleText).toContain('flex-wrap: wrap;');
        expect(styleText).toContain('.send-popover__foot .status-line {');
        expect(styleText).toContain('flex: 1 1 100%;');
        expect(styleText).toContain('.send-popover__foot .button-row {');
        expect(styleText).toContain('margin-inline-start: auto;');
        expect(styleText).toContain('.send-popover__resize-handle {');
        expect(styleText).toContain('.send-popover__head-actions {');
        expect(styleText).toContain('margin-left: auto;');
        expect(styleText).toContain('.send-popover__resize-grip {');
        expect(styleText).toContain('.send-popover__resize-grip::before,');
        expect(styleText).toContain('top: 6px;');
        expect(styleText).toContain('right: 6px;');
        expect(styleText).toContain('border-radius: 0;');

        panelWindow!.style.width = '760px';
        panelWindow!.style.height = '520px';
        dialogBody!.style.width = '700px';
        dialogBody!.style.height = '440px';
        window.dispatchEvent(new Event('resize'));

        const textareaStyle = getComputedStyle(textarea!);
        const startWidth = popover!.style.width;
        const startHeight = popover!.style.height;

        resizeHandle!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 240 }));
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 360, clientY: 180 }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 360, clientY: 180 }));

        expect(textareaStyle.resize).toBe('none');
        expect(textareaStyle.borderTopWidth).not.toBe('0px');
        expect(getComputedStyle(buttonRow!.parentElement!).display).toBe('flex');
        expect(Number.parseFloat(popover!.style.width)).toBeGreaterThanOrEqual(320);
        expect(Number.parseFloat(popover!.style.width)).toBeLessThanOrEqual(656);
        expect(Number.parseFloat(popover!.style.height)).toBeGreaterThanOrEqual(220);
        expect(Number.parseFloat(popover!.style.height)).toBeLessThanOrEqual(396);
    });

    it('uses a larger dedicated host shell for the send popover demo so the anchored composer stays fully visible', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="sendPopover"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styleText).toContain('.panel-window--popover-demo {');
        expect(styleText).toContain('width: min(820px, calc(100vw - 56px));');
        expect(styleText).toContain('.panel-window--popover-demo .dialog-body {');
        expect(styleText).toContain('min-height: 420px;');
        expect(styleText).toContain('.popover-demo-anchor {');
        expect(styleText).toContain('min-height: 190px;');
        expect(styleText).toContain('overflow: hidden;');
        expect(styleText).toContain('.send-popover--standalone {');
        expect(styleText).toContain('left: 30px;');
        expect(styleText).toContain('top: 30px;');
        expect(styleText).toContain('.send-popover {');
        expect(styleText).toContain('overflow: hidden;');
        expect(styleText).toContain('.popover-demo-toolbar {');
        expect(styleText).toContain('bottom: 30px;');
        expect(refreshedShadow.textContent).not.toContain('What changed in the mocks');
        expect(refreshedShadow.textContent).not.toContain('Mock test checklist');
    });

    it('clamps send popover size back inside the host panel when the host becomes smaller', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="sendPopover"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const resizeHandle = refreshedShadow.querySelector<HTMLElement>('[data-action="send-popover-resize"]');
        const popover = refreshedShadow.querySelector<HTMLElement>('.send-popover');
        const panelWindow = refreshedShadow.querySelector<HTMLElement>('.panel-window--popover-demo');
        const dialogBody = refreshedShadow.querySelector<HTMLElement>('.panel-window--popover-demo .dialog-body');

        expect(resizeHandle).toBeTruthy();
        expect(popover).toBeTruthy();
        expect(panelWindow).toBeTruthy();
        expect(dialogBody).toBeTruthy();

        panelWindow!.style.width = '760px';
        panelWindow!.style.height = '520px';
        dialogBody!.style.width = '700px';
        dialogBody!.style.height = '440px';
        window.dispatchEvent(new Event('resize'));

        resizeHandle!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 240 }));
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 520, clientY: 120 }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 520, clientY: 120 }));

        const expandedWidth = Number.parseFloat(popover!.style.width);
        const expandedHeight = Number.parseFloat(popover!.style.height);
        expect(expandedWidth).toBeGreaterThanOrEqual(320);
        expect(expandedWidth).toBeLessThanOrEqual(656);
        expect(expandedHeight).toBeGreaterThanOrEqual(220);
        expect(expandedHeight).toBeLessThanOrEqual(396);

        panelWindow!.style.width = '460px';
        panelWindow!.style.height = '360px';
        dialogBody!.style.width = '360px';
        dialogBody!.style.height = '300px';
        window.dispatchEvent(new Event('resize'));

        const clampedWidth = Number.parseFloat(popover!.style.width);
        const clampedHeight = Number.parseFloat(popover!.style.height);

        expect(clampedWidth).toBeLessThanOrEqual(expandedWidth);
        expect(clampedHeight).toBeLessThanOrEqual(expandedHeight);
        expect(clampedWidth).toBeLessThanOrEqual(416);
        expect(clampedHeight).toBeLessThanOrEqual(316);
    });

    it('adds a dedicated dialogs mock panel that summarizes the real info, warning, error, and import-merge use cases', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="dialogs"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        const refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const panel = refreshedShadow.querySelector<HTMLElement>('.panel-window--dialogs');
        const title = refreshedShadow.querySelector<HTMLElement>('.panel-window--dialogs .panel-header__meta h2');
        const cards = refreshedShadow.querySelectorAll('.dialog-demo-card');

        expect(panel).toBeTruthy();
        expect(title?.textContent).toBe('System Dialogs');
        expect(cards.length).toBeGreaterThanOrEqual(4);
        expect(panel?.textContent).toContain('Create folder');
        expect(panel?.textContent).toContain('Delete folder');
        expect(panel?.textContent).toContain('Import failed');
        expect(panel?.textContent).toContain('Import merge review');
        expect(panel?.textContent).toContain('Skipped duplicates');
        expect(panel?.textContent).toContain('Renamed titles');
    });

    it('renders one shared modal shell for info, warning, error, and import-merge details', async () => {
        const shadow = await mountStudio();
        const launcher = shadow.querySelector<HTMLElement>('[data-action="open-panel"][data-panel="dialogs"]');
        expect(launcher).toBeTruthy();
        launcher!.click();

        let refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        const infoTrigger = refreshedShadow.querySelector<HTMLElement>('[data-action="open-dialog-preview"][data-dialog="info"]');
        expect(infoTrigger).toBeTruthy();
        infoTrigger!.click();

        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        let modal = refreshedShadow.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
        expect(modal).toBeTruthy();
        expect(modal?.textContent).toContain('Create folder');
        expect(modal?.querySelector('.mock-modal__badge')).toBeNull();
        expect(modal?.querySelector('[data-role="modal-input"]')).toBeTruthy();
        refreshedShadow.querySelector<HTMLElement>('[data-action="modal-cancel"]')!.click();

        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        refreshedShadow.querySelector<HTMLElement>('[data-action="open-dialog-preview"][data-dialog="warning"]')!.click();
        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        modal = refreshedShadow.querySelector<HTMLElement>('.mock-modal[data-kind="warning"]');
        expect(modal).toBeTruthy();
        expect(modal?.textContent).toContain('Delete folder');
        expect(modal?.querySelector('.mock-modal__badge')).toBeNull();
        expect(modal?.querySelector('.studio-btn--danger')).toBeTruthy();
        refreshedShadow.querySelector<HTMLElement>('[data-action="modal-cancel"]')!.click();

        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        refreshedShadow.querySelector<HTMLElement>('[data-action="open-dialog-preview"][data-dialog="error"]')!.click();
        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        modal = refreshedShadow.querySelector<HTMLElement>('.mock-modal[data-kind="error"]');
        expect(modal).toBeTruthy();
        expect(modal?.textContent).toContain('Import failed');
        expect(modal?.querySelector('.mock-modal__badge')).toBeNull();
        expect(modal?.querySelectorAll('.studio-btn').length).toBe(1);
        refreshedShadow.querySelector<HTMLElement>('[data-action="modal-cancel"]')!.click();

        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        refreshedShadow.querySelector<HTMLElement>('[data-action="open-dialog-preview"][data-dialog="import-merge"]')!.click();
        refreshedShadow = document.querySelector<HTMLElement>('.aimd-panel-studio-host')!.shadowRoot!;
        modal = refreshedShadow.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
        const mergeSummary = refreshedShadow.querySelectorAll('.merge-summary-item');
        const mergeRows = refreshedShadow.querySelectorAll('.merge-entry');

        expect(modal).toBeTruthy();
        expect(modal?.textContent).toContain('Import merge review');
        expect(modal?.textContent).toContain('Save context only');
        expect(mergeSummary.length).toBeGreaterThanOrEqual(4);
        expect(mergeRows.length).toBeGreaterThanOrEqual(4);
        expect(modal?.textContent).toContain('Duplicate');
        expect(modal?.textContent).toContain('Rename');
        expect(modal?.textContent).toContain('Research/Archive');

        const styleText = Array.from(refreshedShadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        expect(styleText).toContain('.mock-modal[data-kind="info"] {');
        expect(styleText).toContain('.mock-modal[data-kind="warning"] {');
        expect(styleText).toContain('.mock-modal[data-kind="error"] {');
        expect(styleText).toContain('max-height: min(680px, calc(100% - 40px));');
        expect(styleText).toContain('.dialog-demo-grid {');
        expect(styleText).toContain('.merge-entry-status[data-status="duplicate"] {');
        expect(styleText).not.toContain('.mock-modal__badge {');
    });
});
