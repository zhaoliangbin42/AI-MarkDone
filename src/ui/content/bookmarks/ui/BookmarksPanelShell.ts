import { createIcon } from '../../components/Icon';
import { createIconButton } from '../../components/IconButton';
import { finishSurfaceMotionOpening } from '../../components/motionLifecycle';
import { t } from '../../components/i18n';
import { createBrandIcon, maximizeIcon, minimizeIcon } from '../../../../assets/icons';
import { bookMarkedIcon, settingsIcon, chevronDownIcon } from '../../../../assets/workspaceIcons';

export type BookmarksPanelTabSpec = {
    id: string;
    label: string;
    icon: string;
    content: HTMLElement;
    panelClassName?: string;
    navigation?: HTMLElement;
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
    fullscreenBtn: HTMLButtonElement;
    setFullscreen(fullscreen: boolean): void;
    tabs: BookmarksPanelTabs;
};

export function createBookmarksPanelShell(params: {
    titleText: string;
    closeIcon: string;
    closeLabel: string;
    tabs: BookmarksPanelTabSpec[];
    defaultTabId: string;
    fullscreen?: boolean;
    onFullscreenChange?: (fullscreen: boolean) => void;
}): BookmarksPanelShellRefs {
    const overlay = document.createElement('div');
    overlay.className = 'panel-stage__overlay aimd-panel-overlay';

    const panel = document.createElement('div');
    panel.className = 'panel-window panel-window--bookmarks aimd-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', params.titleText);

    const header = document.createElement('div');
    header.className = 'workspace-title-metadata';
    header.hidden = true;

    const headerMeta = document.createElement('div');
    headerMeta.className = 'panel-header__meta';

    const title = document.createElement('h2');
    title.className = 'aimd-panel-title';
    title.textContent = params.titleText;
    headerMeta.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'workspace-corner-actions';

    const closeBtn = createIconButton({
        icon: params.closeIcon,
        label: params.closeLabel,
        kind: 'default',
        onClick: () => {},
    });
    closeBtn.classList.add('icon-btn');
    closeBtn.dataset.action = 'close';
    header.append(headerMeta);
    let fullscreen = Boolean(params.fullscreen);
    const fullscreenBtn = createIconButton({
        icon: fullscreen ? minimizeIcon : maximizeIcon,
        label: t(fullscreen ? 'exitFullscreen' : 'toggleFullscreen'),
        onClick: () => {
            if (panel.dataset.motionState === 'closing') return;
            setFullscreen(!fullscreen);
            params.onFullscreenChange?.(fullscreen);
        },
    });
    fullscreenBtn.classList.add('icon-btn');
    fullscreenBtn.dataset.action = 'workspace-fullscreen';
    const setFullscreen = (nextFullscreen: boolean): void => {
        if (panel.isConnected) finishSurfaceMotionOpening(panel);
        fullscreen = nextFullscreen;
        panel.dataset.fullscreen = fullscreen ? '1' : '0';
        const label = t(fullscreen ? 'exitFullscreen' : 'toggleFullscreen');
        fullscreenBtn.replaceChildren(createIcon(fullscreen ? minimizeIcon : maximizeIcon));
        fullscreenBtn.setAttribute('aria-label', label);
        fullscreenBtn.title = label;
        fullscreenBtn.setAttribute('aria-pressed', String(fullscreen));
    };
    setFullscreen(fullscreen);
    headerActions.append(fullscreenBtn, closeBtn);

    const shell = document.createElement('div');
    shell.className = 'bookmarks-shell';

    const sidebar = document.createElement('nav');
    sidebar.className = 'bookmarks-sidebar';
    sidebar.setAttribute('aria-label', params.titleText);
    const brand = document.createElement('div'); brand.className = 'workspace-brand';
    const brandLogo = createBrandIcon();
    brandLogo.className = 'workspace-brand__logo';
    brandLogo.alt = '';
    brandLogo.setAttribute('aria-hidden', 'true');
    const brandName = document.createElement('span');
    brandName.className = 'workspace-brand__name';
    brandName.textContent = 'AI-MarkDone';
    brand.append(brandLogo, brandName);
    sidebar.append(brand);
    const modules = document.createElement('div');
    modules.className = 'library-sidebar-modules';
    const libraryNav = document.createElement('div');
    libraryNav.className = 'library-module-content';
    libraryNav.id = 'aimd-library-navigation';
    const settingsNav = document.createElement('div');
    settingsNav.className = 'library-module-content';
    settingsNav.id = 'aimd-settings-navigation';
    const settingsScroll = document.createElement('div');
    settingsScroll.className = 'settings-navigation-scroll';
    const infoNav = document.createElement('div');
    infoNav.className = 'library-info-links';
    settingsScroll.append(infoNav);
    settingsNav.append(settingsScroll);
    const featuredNav = document.createElement('div');
    featuredNav.className = 'library-info-featured-links';

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
        btn.setAttribute('aria-label', tab.id === 'bookmarks' ? t('libraryTitle') : tab.label);
        const isModule = tab.id === 'bookmarks' || tab.id === 'settings';
        btn.append(createIcon(tab.id === 'bookmarks' ? bookMarkedIcon : tab.id === 'settings' ? settingsIcon : tab.icon), document.createElement('span'));
        btn.lastElementChild!.textContent = tab.id === 'bookmarks' ? t('libraryTitle') : tab.label;
        if (!isModule && tab.id !== 'mappamory' && tab.id !== 'sponsor') btn.lastElementChild!.classList.add('workspace-navigation-label');
        if (isModule) {
            btn.classList.add('library-module-button');
            btn.append(createIcon(chevronDownIcon));
            btn.setAttribute('aria-controls', tab.id === 'bookmarks' ? libraryNav.id : settingsNav.id);
        }
        btn.addEventListener('click', () => {
            setActive(tab.id);
            btn.focus({ preventScroll: true } as FocusOptions);
        });
        if (tab.id === 'bookmarks') {
            modules.append(btn, libraryNav);
            if (tab.navigation) libraryNav.append(tab.navigation);
        } else if (tab.id === 'settings') {
            modules.append(btn, settingsNav);
            if (tab.navigation) settingsScroll.prepend(tab.navigation);
        } else {
            if (tab.id === 'mappamory' || tab.id === 'sponsor') btn.classList.add('library-info-featured');
            if (btn.classList.contains('library-info-featured')) featuredNav.append(btn);
            else infoNav.append(btn);
        }
        buttons.set(tab.id, btn);

        const panelWrap = document.createElement('section');
        panelWrap.className = 'tab-panel';
        panelWrap.dataset.tabId = tab.id;
        if (tab.panelClassName) {
            panelWrap.classList.add(tab.panelClassName);
        }
        panelWrap.appendChild(tab.content);
        body.appendChild(panelWrap);
        panels.set(tab.id, panelWrap);
    }

    const setActive = (id: string): void => {
        if (id !== active) {
            shell.dispatchEvent(new CustomEvent('aimd:tabs-before-change', { detail: { previousId: active, nextId: id } }));
        }
        active = id;
        const label = id === 'bookmarks' ? t('libraryTitle') : params.tabs.find(tab => tab.id === id)?.label ?? params.titleText;
        panel.setAttribute('aria-label', label); sidebar.setAttribute('aria-label', label);
        settingsNav.querySelectorAll<HTMLElement>('[data-category]').forEach(button => {
            if (id !== 'settings') { button.dataset.active = 'false'; button.setAttribute('aria-pressed', 'false'); }
        });
        if(id === 'settings') settingsNav.querySelector('.settings-category-navigation')?.dispatchEvent(new Event('aimd:settings-active'));
        const settingsActive = id !== 'bookmarks';
        modules.dataset.active = settingsActive ? 'settings' : 'bookmarks';
        libraryNav.toggleAttribute('inert', settingsActive);
        libraryNav.setAttribute('aria-hidden', String(settingsActive));
        settingsNav.toggleAttribute('inert', !settingsActive);
        settingsNav.setAttribute('aria-hidden', String(!settingsActive));
        buttons.forEach((btn, tabId) => {
            const isActive = tabId === 'settings' ? id !== 'bookmarks' : tabId === id;
            if (tabId === 'bookmarks' || tabId === 'settings') btn.setAttribute('aria-expanded', String(isActive));
            btn.dataset.active = isActive ? '1' : '0';
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        panels.forEach((tabPanel, tabId) => {
            const isActive = tabId === id;
            tabPanel.dataset.active = isActive ? '1' : '0';
            tabPanel.hidden = !isActive;
            tabPanel.toggleAttribute('inert', !isActive);
            const content = tabPanel.firstElementChild as HTMLElement | null;
            if (content) {
                content.dataset.active = isActive ? '1' : '0';
            }
        });
        shell.dispatchEvent(new CustomEvent('aimd:tabs-change', { detail: { id } }));
    };

    settingsNav.addEventListener('aimd:settings-request', () => setActive('settings'));
    sidebar.append(modules, featuredNav);
    shell.append(sidebar, body);
    body.prepend(header);
    panel.append(shell, headerActions);
    setActive(params.defaultTabId);

    return {
        overlay,
        panel,
        headerMeta,
        headerActions,
        title,
        closeBtn,
        fullscreenBtn,
        setFullscreen,
        tabs: {
            getElement: () => shell,
            getActive: () => active,
            setActive,
        },
    };
}
