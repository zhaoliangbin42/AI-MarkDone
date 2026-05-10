import type { CloudBackupProviderId } from '../../../../../contracts/protocol';
import type { ModalHost } from '../../../components/ModalHost';
import { t } from '../../../components/i18n';
import { Icons } from '../../../../../assets/icons';

export type CloudBackupSettingsPanelActions = {
    status?: (provider: CloudBackupProviderId) => Promise<{ configured?: boolean; connected?: boolean; lastBackupAt?: string | null; lastError?: string | null } | null> | { configured?: boolean; connected?: boolean; lastBackupAt?: string | null; lastError?: string | null } | null;
    openSettings?: () => Promise<void> | void;
    backupNow?: (provider: CloudBackupProviderId) => Promise<void> | void;
    restore?: (provider: CloudBackupProviderId) => Promise<void> | void;
};

export class CloudBackupSettingsPanel {
    private readonly root = document.createElement('div');
    private readonly actions: CloudBackupSettingsPanelActions;
    private statusEl: HTMLElement | null = null;

    constructor(_params: { modal: ModalHost; actions?: CloudBackupSettingsPanelActions }) {
        this.actions = _params.actions ?? {};
        this.root.className = 'cloud-backup-row';
        this.root.dataset.role = 'cloud-backup-google-drive-row';
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const info = document.createElement('div');
        info.className = 'settings-item-info cloud-backup-row__info';
        const label = document.createElement('span');
        label.className = 'settings-item-label';
        label.textContent = 'Google Drive';
        const desc = document.createElement('span');
        desc.className = 'settings-item-warning-text';
        desc.textContent = t('cloudBackupGoogleDriveDesc');
        const status = document.createElement('span');
        status.className = 'cloud-backup-row__status';
        status.dataset.role = 'cloud-backup-google-drive-status';
        status.textContent = t('cloudBackupStatusChecking');
        this.statusEl = status;
        info.append(label, desc, status);

        const actions = document.createElement('div');
        actions.className = 'cloud-backup-row__actions';
        actions.append(
            this.createIconButton(Icons.settings, t('cloudBackupSettings'), 'cloud-backup-google-drive-settings', () => this.actions.openSettings?.()),
            this.createIconButton(Icons.upload, t('cloudBackupBackupNow'), 'cloud-backup-google-drive-backup-now', () => this.actions.backupNow?.('googleDrive')),
            this.createIconButton(Icons.download, t('cloudBackupRestore'), 'cloud-backup-google-drive-restore', () => this.actions.restore?.('googleDrive')),
        );

        this.root.replaceChildren(info, actions);
        void this.refreshStatus();
    }

    private async refreshStatus(): Promise<void> {
        if (!this.statusEl) return;
        this.statusEl.classList.remove('cloud-backup-row__status--error');
        if (!this.actions.status) {
            this.statusEl.textContent = t('cloudBackupDisconnected');
            return;
        }
        try {
            const status = await this.actions.status('googleDrive');
            if (status?.configured === false) {
                this.statusEl.classList.add('cloud-backup-row__status--error');
                this.statusEl.textContent = t('cloudBackupConfigMissingStatus');
                this.statusEl.title = status.lastError ?? '';
                return;
            }
            if (status?.lastError) {
                this.statusEl.classList.add('cloud-backup-row__status--error');
                this.statusEl.textContent = status.lastError;
                this.statusEl.title = status.lastError;
                return;
            }
            this.statusEl.textContent = t(status?.connected ? 'cloudBackupConnectedStatus' : 'cloudBackupDisconnected');
            this.statusEl.title = '';
        } catch {
            this.statusEl.textContent = t('cloudBackupDisconnected');
            this.statusEl.title = '';
        }
    }

    private createIconButton(icon: string, label: string, role: string, action: () => Promise<void> | void | undefined): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-btn cloud-backup-row__button';
        button.dataset.role = role;
        button.innerHTML = icon;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.addEventListener('click', () => void action());
        return button;
    }
}
