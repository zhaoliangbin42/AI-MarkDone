import '../bookmarks-workspace/main';

let activeHost: HTMLElement | null = null;
function activateKeyboardSettings(): void {
    const host = document.getElementById('aimd-bookmarks-panel-host');
    if (!host || host === activeHost) return;
    const root = host.shadowRoot;
    const category = root?.querySelector<HTMLButtonElement>('[data-category="controls"]');
    const keyboard = root?.querySelector<HTMLButtonElement>('[data-controls-tab="keyboard"]');
    if (!category || !keyboard) return;
    activeHost = host;
    category.click(); keyboard.click();
}
new MutationObserver(activateKeyboardSettings).observe(document.documentElement, { childList: true, subtree: true });
activateKeyboardSettings();
