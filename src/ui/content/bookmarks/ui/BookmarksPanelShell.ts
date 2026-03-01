import type { TabSpec } from '../../components/Tabs';
import { Tabs } from '../../components/Tabs';
import { createIconButton } from '../../components/IconButton';

export type BookmarksPanelShellRefs = {
    overlay: HTMLElement;
    panel: HTMLElement;
    title: HTMLElement;
    closeBtn: HTMLButtonElement;
    tabs: Tabs;
};

export function createBookmarksPanelShell(params: {
    titleText: string;
    closeIcon: string;
    closeLabel: string;
    tabs: Array<Omit<TabSpec, 'content'> & { content: HTMLElement }>;
    defaultTabId: string;
}): BookmarksPanelShellRefs {
    const overlay = document.createElement('div');
    overlay.className = 'aimd-panel-overlay';
    overlay.dataset.role = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'aimd-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', params.titleText);

    const header = document.createElement('div');
    header.className = 'aimd-panel-header';

    const title = document.createElement('div');
    title.className = 'aimd-panel-title';
    title.textContent = params.titleText;

    const closeBtn = createIconButton({
        icon: params.closeIcon,
        label: params.closeLabel,
        kind: 'default',
        onClick: () => {},
    });
    closeBtn.dataset.action = 'close';

    header.append(title, closeBtn);

    const tabs = new Tabs(params.tabs as any, params.defaultTabId);
    const main = tabs.getElement();

    panel.append(header, main);

    return { overlay, panel, title, closeBtn, tabs };
}

