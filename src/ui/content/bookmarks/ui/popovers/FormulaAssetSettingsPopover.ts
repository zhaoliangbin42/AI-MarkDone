import { imageIcon } from '../../../../../assets/icons';
import type { FormulaSettings } from '../../../../../core/settings/formula';
import { createIcon } from '../../../components/Icon';
import { createReaderSettingsDialogShell } from './ReaderSettingsDialogShell';

type OpenParams = {
    parent: HTMLElement;
    settings: FormulaSettings;
    labels: {
        title: string;
        close: string;
        copyPng: string;
        copySvg: string;
        savePng: string;
        saveSvg: string;
    };
    onChange: (assetActions: FormulaSettings['assetActions']) => void;
    onClose?: () => void;
};

export class FormulaAssetSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private onWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        if (!this.rootEl) return;
        if (this.onWindowKeyDown) {
            window.removeEventListener('keydown', this.onWindowKeyDown, { capture: true } as any);
            this.onWindowKeyDown = null;
        }
        this.rootEl.remove();
        this.rootEl = null;
    }

    open(params: OpenParams): void {
        this.close();
        const shell = createReaderSettingsDialogShell({
            parent: params.parent,
            title: params.labels.title,
            closeLabel: params.labels.close,
            panelClassNames: ['formula-asset-settings'],
        });
        this.rootEl = shell.layer;
        const title = shell.title;
        title.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'reader-settings-dialog__title-icon';
        icon.appendChild(createIcon(imageIcon));
        const text = document.createElement('span');
        text.textContent = params.labels.title;
        title.append(icon, text);

        const state = { ...params.settings.assetActions };
        const rows = [
            ['copyPng', params.labels.copyPng, 'settings-formula-asset-action-copy-png'],
            ['copySvg', params.labels.copySvg, 'settings-formula-asset-action-copy-svg'],
            ['savePng', params.labels.savePng, 'settings-formula-asset-action-save-png'],
            ['saveSvg', params.labels.saveSvg, 'settings-formula-asset-action-save-svg'],
        ] as const;

        const list = document.createElement('div');
        list.className = 'formula-asset-settings__list';
        for (const [key, labelText, role] of rows) {
            const row = document.createElement('div');
            row.className = 'formula-asset-settings__row';
            const label = document.createElement('strong');
            label.className = 'formula-asset-settings__label';
            label.textContent = labelText;
            const toggle = document.createElement('label');
            toggle.className = 'toggle-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.dataset.role = role;
            input.checked = Boolean(state[key]);
            toggle.dataset.checked = input.checked ? '1' : '0';
            const knob = document.createElement('span');
            knob.className = 'toggle-knob';
            input.addEventListener('change', () => {
                state[key] = input.checked;
                toggle.dataset.checked = input.checked ? '1' : '0';
                params.onChange({ ...state });
            });
            toggle.append(input, knob);
            row.append(label, toggle);
            list.appendChild(row);
        }

        shell.body.appendChild(list);
        shell.footer.remove();

        const close = () => {
            this.close();
            params.onClose?.();
        };
        shell.closeButton.addEventListener('click', close);
        shell.panel.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        }, { capture: true });
        shell.panel.addEventListener('keydown', (event) => event.stopPropagation());
        this.onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        window.addEventListener('keydown', this.onWindowKeyDown, { capture: true });
    }
}

