import { createIcon } from '../../components/Icon';
import { createIconButton } from '../../components/IconButton';

export type BookmarksPanelTabSpec = {
    id: string;
    label: string;
    icon: string;
    content: HTMLElement;
    panelClassName?: string;
};

export type BookmarksPanelTabs = {
    getElement(): HTMLElement;
    getActive(): string;
    setActive(id: string): void;
};

export type BookmarksPanelShellRefs = {
    overlay: HTMLElement;
    panel: HTMLElement;
    headerMeta: HTMLElement;
    headerActions: HTMLElement;
    title: HTMLElement;
    closeBtn: HTMLButtonElement;
    tabs: BookmarksPanelTabs;
};

export function createBookmarksPanelShell(params: {
    titleText: string;
    closeIcon: string;
    closeLabel: string;
    tabs: BookmarksPanelTabSpec[];
    defaultTabId: string;
}): BookmarksPanelShellRefs {
    const overlay = document.createElement('div');
    overlay.className = 'panel-stage__overlay aimd-panel-overlay';

    const panel = document.createElement('div');
    panel.className = 'panel-window panel-window--bookmarks aimd-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', params.titleText);

    const header = document.createElement('div');
    header.className = 'aimd-panel-header panel-header';

    const headerMeta = document.createElement('div');
    headerMeta.className = 'panel-header__meta';

    const title = document.createElement('h2');
    title.className = 'aimd-panel-title';
    title.textContent = params.titleText;
    headerMeta.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'panel-header__actions';

    const closeBtn = createIconButton({
        icon: params.closeIcon,
        label: params.closeLabel,
        kind: 'default',
        onClick: () => {},
    });
    closeBtn.classList.add('icon-btn');
    closeBtn.dataset.action = 'close';
    headerActions.appendChild(closeBtn);

    header.append(headerMeta, headerActions);

    const shell = document.createElement('div');
    shell.className = 'bookmarks-shell';

    const sidebar = document.createElement('nav');
    sidebar.className = 'bookmarks-sidebar';
    sidebar.setAttribute('aria-label', params.titleText);

    const body = document.createElement('div');
    body.className = 'bookmarks-body';

    const buttons = new Map<string, HTMLButtonElement>();
    const panels = new Map<string, HTMLElement>();
    let active = params.defaultTabId;

    for (const tab of params.tabs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab-btn';
        btn.dataset.action = 'set-bookmarks-tab';
        btn.dataset.tabId = tab.id;
        btn.dataset.tab = tab.id;
        btn.setAttribute('aria-label', tab.label);
        btn.append(createIcon(tab.icon), document.createElement('span'));
        btn.lastElementChild!.textContent = tab.label;
        btn.addEventListener('click', () => {
            setActive(tab.id);
            btn.focus({ preventScroll: true } as FocusOptions);
        });
        sidebar.appendChild(btn);
        buttons.set(tab.id, btn);

        tab.content.classList.add('tab-panel');
        tab.content.dataset.tabId = tab.id;
        if (tab.panelClassName) {
            tab.content.classList.add(tab.panelClassName);
        }
        body.appendChild(tab.content);
        panels.set(tab.id, tab.content);
    }

    const setActive = (id: string): void => {
        active = id;
        buttons.forEach((btn, tabId) => {
            const isActive = tabId === id;
            btn.dataset.active = isActive ? '1' : '0';
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        panels.forEach((tabPanel, tabId) => {
            tabPanel.dataset.active = tabId === id ? '1' : '0';
        });
        shell.dispatchEvent(new CustomEvent('aimd:tabs-change', { detail: { id } }));
    };

    shell.append(sidebar, body);
    panel.append(header, shell);
    setActive(params.defaultTabId);

    return {
        overlay,
        panel,
        headerMeta,
        headerActions,
        title,
        closeBtn,
        tabs: {
            getElement: () => shell,
            getActive: () => active,
            setActive,
        },
    };
}
