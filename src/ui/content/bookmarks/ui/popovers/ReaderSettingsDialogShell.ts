import { xIcon } from '../../../../../assets/icons';
import { createIcon } from '../../../components/Icon';
import { markTransientRoot } from '../../../components/transientUi';

type ReaderSettingsDialogShellParams = {
    parent: HTMLElement;
    title: string;
    closeLabel: string;
    panelClassNames: string[];
};

export type ReaderSettingsDialogShellRefs = {
    layer: HTMLElement;
    panel: HTMLElement;
    header: HTMLElement;
    headerMeta: HTMLElement;
    headerActions: HTMLElement;
    title: HTMLHeadingElement;
    body: HTMLElement;
    footer: HTMLElement;
    closeButton: HTMLButtonElement;
};

export function createReaderSettingsDialogLayer(params: {
    parent: HTMLElement;
    panelClassNames: string[];
}): { layer: HTMLElement; panel: HTMLElement } {
    const layer = markTransientRoot(document.createElement('div'));
    layer.className = 'reader-settings-popover-layer';

    const panel = document.createElement('div');
    panel.className = ['panel-window', 'panel-window--dialog', 'panel-window--reader-settings', ...params.panelClassNames].join(' ');

    layer.appendChild(panel);
    params.parent.appendChild(layer);

    return { layer, panel };
}

export function createReaderSettingsDialogShell(params: ReaderSettingsDialogShellParams): ReaderSettingsDialogShellRefs {
    const { layer, panel } = createReaderSettingsDialogLayer(params);

    const header = document.createElement('div');
    header.className = 'panel-header';

    const headerMeta = document.createElement('div');
    headerMeta.className = 'panel-header__meta';

    const title = document.createElement('h2');
    title.className = 'reader-settings-dialog__title';
    title.textContent = params.title;
    headerMeta.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'panel-header__actions';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'icon-btn reader-settings-dialog__close';
    closeButton.dataset.action = 'close';
    closeButton.setAttribute('aria-label', params.closeLabel);
    closeButton.appendChild(createIcon(xIcon));
    headerActions.appendChild(closeButton);

    header.append(headerMeta, headerActions);

    const body = document.createElement('div');
    body.className = 'dialog-body dialog-body--reader-settings';

    const footer = document.createElement('div');
    footer.className = 'panel-footer panel-footer--reader-settings';

    panel.append(header, body, footer);
    layer.appendChild(panel);
    params.parent.appendChild(layer);

    return {
        layer,
        panel,
        header,
        headerMeta,
        headerActions,
        title,
        body,
        footer,
        closeButton,
    };
}
