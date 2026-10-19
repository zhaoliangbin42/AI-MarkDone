import { xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';
import { getSurfaceMaterialCss } from '../components/styles/surfaceMaterialCss';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import dialogCss from './readerSettingsDialog.css?inline';

function getDialogCss(): string {
    return dialogCss + getSurfaceMaterialCss() + getFlatWorkflowCss();
}

let dialogTitleSequence = 0;

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
    if (params.panelClassNames.includes('reader-settings-popover--template')) layer.classList.add('reader-settings-popover-layer--template');
    const root = params.parent.getRootNode();
    if (root instanceof ShadowRoot) ensureStyle(root, getDialogCss(), { id: 'aimd-reader-settings-material', cache: 'shared' });

    const panel = document.createElement('div');
    panel.className = ['panel-window', 'panel-window--dialog', 'panel-window--reader-settings', 'aimd-material-surface', 'flat-workflow', ...params.panelClassNames].join(' ');

    layer.appendChild(panel);
    params.parent.appendChild(layer);

    return { layer, panel };
}

export function createReaderSettingsDialogShell(params: ReaderSettingsDialogShellParams): ReaderSettingsDialogShellRefs {
    const { layer, panel } = createReaderSettingsDialogLayer(params);
    const titleId = `aimd-reader-settings-dialog-title-${++dialogTitleSequence}`;
    panel.dataset.aimdSurfaceProfile = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);

    const header = document.createElement('div');
    header.className = 'panel-header aimd-material-chrome';

    const headerMeta = document.createElement('div');
    headerMeta.className = 'panel-header__meta';

    const title = document.createElement('h2');
    title.className = 'reader-settings-dialog__title';
    title.id = titleId;
    title.textContent = params.title;
    headerMeta.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'panel-header__actions';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'icon-btn reader-settings-dialog__close aimd-material-button aimd-material-button--quiet';
    closeButton.dataset.action = 'close';
    closeButton.setAttribute('aria-label', params.closeLabel);
    closeButton.appendChild(createIcon(xIcon));
    headerActions.appendChild(closeButton);

    header.append(headerMeta, headerActions);

    const body = document.createElement('div');
    body.className = 'dialog-body dialog-body--reader-settings';

    const footer = document.createElement('div');
    footer.className = 'panel-footer panel-footer--reader-settings aimd-material-chrome';

    panel.append(header, body, footer);

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
