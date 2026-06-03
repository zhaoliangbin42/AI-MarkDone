import type { CloudBackupProviderId } from '../../../../../contracts/protocol';
import type { ModalHost } from '../../../components/ModalHost';
import { t } from '../../../components/i18n';
import { Icons } from '../../../../../assets/icons';

export type CloudBackupSettingsPanelActions = {
    status?: (provider: CloudBackupProviderId) => Promise<{ configured?: boolean; connected?: boolean; lastBackupAt?: string | null; lastError?: string | null } | null> | { configured?: boolean; connected?: boolean; lastBackupAt?: string | null; lastError?: string | null } | null;
    connect?: (provider: CloudBackupProviderId) => Promise<void | { connected?: boolean }> | void | { connected?: boolean };
    disconnect?: (provider: CloudBackupProviderId) => Promise<void | { connected?: boolean }> | void | { connected?: boolean };
    openSettings?: () => Promise<void> | void;
    backupNow?: (provider: CloudBackupProviderId) => Promise<void> | void;
    restore?: (provider: CloudBackupProviderId) => Promise<void> | void;
};

export class CloudBackupSettingsPanel {
    private readonly root = document.createElement('div');
    private readonly actions: CloudBackupSettingsPanelActions;
    private statusEl: HTMLElement | null = null;
    private actionsEl: HTMLElement | null = null;
    private currentStatus: { configured?: boolean; connected?: boolean; lastError?: string | null } | null = null;

    constructor(_params: { modal: ModalHost; actions?: CloudBackupSettingsPanelActions }) {
        this.actions = _params.actions ?? {};
        this.root.className = 'settings-row settings-item cloud-backup-row';
        this.root.dataset.role = 'cloud-backup-google-drive-row';
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info cloud-backup-row__info';
        const label = document.createElement('strong');
        label.textContent = `Google Drive (${t('cloudBackupExperimentalLabel')})`;
        const desc = document.createElement('p');
        desc.textContent = t('cloudBackupGoogleDriveDesc');
        const status = document.createElement('p');
        status.className = 'cloud-backup-row__status';
        status.dataset.role = 'cloud-backup-google-drive-status';
        status.textContent = t('cloudBackupStatusChecking');
        this.statusEl = status;
        info.append(label, desc, status);

        const actions = document.createElement('div');
        actions.className = 'cloud-backup-row__actions';
        this.actionsEl = actions;

        this.root.replaceChildren(info, actions);
        this.renderActions();
        void this.refreshStatus();
    }

    private async refreshStatus(): Promise<void> {
        if (!this.statusEl) return;
        this.statusEl.classList.remove('cloud-backup-row__status--error');
        this.statusEl.classList.remove('cloud-backup-row__status--connected');
        if (!this.actions.status) {
            this.statusEl.textContent = t('cloudBackupDisconnected');
            return;
        }
        try {
            const status = await this.actions.status('googleDrive');
            this.currentStatus = status ?? { connected: false };
            if (status?.configured === false) {
                this.statusEl.classList.add('cloud-backup-row__status--error');
                this.statusEl.textContent = t('cloudBackupConfigMissingStatus');
                this.statusEl.title = status.lastError ?? '';
                this.renderActions();
                return;
            }
            if (status?.lastError) {
                this.statusEl.classList.add('cloud-backup-row__status--error');
                this.statusEl.textContent = status.lastError;
                this.statusEl.title = status.lastError;
                this.renderActions();
                return;
            }
            this.statusEl.textContent = t(status?.connected ? 'cloudBackupConnectedStatus' : 'cloudBackupDisconnected');
            if (status?.connected) {
                this.statusEl.classList.add('cloud-backup-row__status--connected');
            }
            this.statusEl.title = '';
            this.renderActions();
        } catch {
            this.currentStatus = { connected: false };
            this.statusEl.textContent = t('cloudBackupDisconnected');
            this.statusEl.title = '';
            this.renderActions();
        }
    }

    private renderActions(): void {
        if (!this.actionsEl) return;
        const configured = this.currentStatus?.configured !== false;
        const connected = Boolean(this.currentStatus?.connected);
        const controls: HTMLElement[] = [];

        if (!configured) {
            controls.push(this.createIconButton(Icons.settings, t('cloudBackupSettings'), 'cloud-backup-google-drive-settings', () => this.actions.openSettings?.()));
            this.actionsEl.replaceChildren(...controls);
            return;
        }

        if (connected) {
            controls.push(
                this.createTextButton(Icons.upload, t('cloudBackupBackupNow'), 'cloud-backup-google-drive-backup-now', 'primary', () => this.actions.backupNow?.('googleDrive')),
                this.createTextButton(Icons.download, t('cloudBackupRestore'), 'cloud-backup-google-drive-restore', 'secondary', () => this.actions.restore?.('googleDrive')),
                this.createTextButton('', t('cloudBackupLogoutGoogleDrive'), 'cloud-backup-google-drive-disconnect', 'secondary', () => this.runAndRefresh(() => this.actions.disconnect?.('googleDrive'))),
                this.createIconButton(Icons.settings, t('cloudBackupSettings'), 'cloud-backup-google-drive-settings', () => this.actions.openSettings?.()),
            );
        } else {
            controls.push(
                this.createTextButton('', t('cloudBackupLoginGoogleDrive'), 'cloud-backup-google-drive-connect', 'primary', () => this.runAndRefresh(() => this.actions.connect?.('googleDrive'))),
                this.createIconButton(Icons.settings, t('cloudBackupSettings'), 'cloud-backup-google-drive-settings', () => this.actions.openSettings?.()),
            );
        }

        this.actionsEl.replaceChildren(...controls);
    }

    private async runAndRefresh(action: () => Promise<void | { connected?: boolean }> | void | { connected?: boolean } | undefined): Promise<void> {
        await action();
        await this.refreshStatus();
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

    private createTextButton(icon: string, label: string, role: string, tone: 'primary' | 'secondary', action: () => Promise<void> | void | undefined): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = tone === 'primary' ? 'secondary-btn secondary-btn--primary' : 'secondary-btn';
        button.dataset.role = role;
        button.innerHTML = `${icon}<span>${label}</span>`;
        button.addEventListener('click', () => void action());
        return button;
    }
}
