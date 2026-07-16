import type { CloudBackupProviderId } from '../../../../contracts/protocol';
import type { CloudBackupSnapshotSummary } from '../../../../core/cloudBackup/types';
import {
    CLOUD_BACKUP_RPC_TIMEOUT_MS,
    cloudBackupClient,
} from '../../../../drivers/shared/clients/cloudBackupClient';
import type { ModalHost } from '../../components/ModalHost';
import { t } from '../../components/i18n';
import type { CloudBackupSettingsPanelActions } from '../ui/cloudBackup/CloudBackupSettingsPanel';
import { buildImportMergeReviewModalBody } from '../ui/importMergeReview';

type CloudBackupClient = typeof cloudBackupClient;

type CloudBackupProgressController = {
    update(message: string): void;
    close(): void;
};

type CloudBackupProgressOptions = {
    timeoutBudgetMs?: number;
};

function tr(key: string, fallback: string, substitutions?: string[]): string {
    const translated = substitutions ? t(key, substitutions) : t(key);
    if (!translated || translated === key) return fallback;
    return translated;
}

function formatSnapshotCreatedAt(value: string): string {
    if (Number.isNaN(Date.parse(value))) return value || 'Unknown time';
    return new Date(value).toLocaleString();
}

function formatSnapshotSize(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return tr('cloudBackupSnapshotSizeUnknown', 'Unknown size');
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    const digits = unitIndex === 0 || size >= 10 ? 0 : 1;
    return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function formatProgressRemaining(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export class BookmarksCloudBackupWorkflow {
    private readonly client: CloudBackupClient;

    constructor(private readonly options: {
        getModalHost: () => ModalHost | null;
        client?: CloudBackupClient;
    }) {
        this.client = options.client ?? cloudBackupClient;
    }

    createSettingsActions(): CloudBackupSettingsPanelActions {
        return {
            status: async (provider) => {
                const result = await this.client.status(provider);
                if (!result.ok) return { connected: false, lastError: result.message };
                return result.data ?? { connected: false };
            },
            connect: async (provider) => {
                const confirmed = await this.modalHost?.confirm({
                    kind: 'info',
                    title: tr('cloudBackupConnectConfirmTitle', 'Connect Google Drive?'),
                    message: tr(
                        'cloudBackupConnectConfirmDesc',
                        'AI-MarkDone will open Google authorization so you can choose your own Drive. This feature is experimental; before backing up to Google Drive, we recommend exporting a local copy first. AI-MarkDone does not collect your Google account, token, password, or bookmarks.',
                    ),
                    confirmText: tr('cloudBackupConnectConfirmAction', 'Continue'),
                    cancelText: tr('btnCancel', 'Cancel'),
                });
                if (!confirmed) return { connected: false };
                const result = await this.client.connect(provider);
                if (!result.ok) {
                    await this.showError(result.message);
                    return { connected: false };
                }
                return { connected: true };
            },
            disconnect: async (provider) => {
                const result = await this.client.disconnect(provider);
                if (!result.ok) {
                    await this.showError(result.message);
                    return { connected: true };
                }
                return { connected: false };
            },
            openSettings: async () => this.showGoogleDriveBackupSettings(),
            backupNow: async (provider) => this.backupToCloud(provider),
            restore: async (provider) => this.previewCloudRestore(provider),
        };
    }

    private get modalHost(): ModalHost | null {
        return this.options.getModalHost();
    }

    private async showError(message: string): Promise<void> {
        await this.modalHost?.alert({
            kind: 'error',
            title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'),
            message,
            confirmText: tr('btnOk', 'OK'),
        });
    }

    private async backupToCloud(provider: CloudBackupProviderId): Promise<void> {
        const progress = this.showCloudBackupProgress(
            tr('cloudBackupBackupNow', 'Back up now'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressPreparingBookmarks', 'Preparing local bookmarks...'),
                tr('cloudBackupProgressCreatingSnapshot', 'Creating a verified snapshot...'),
                tr('cloudBackupProgressUploadingDrive', 'Uploading to Google Drive...'),
                tr('cloudBackupProgressVerifyingUpload', 'Reading the file back for verification...'),
                tr('cloudBackupProgressComplete', 'Finishing up...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.backupNow },
        );
        progress?.update(tr('cloudBackupProgressUploadingDrive', 'Uploading to Google Drive...'));
        let result: Awaited<ReturnType<CloudBackupClient['backupNow']>>;
        try {
            result = await this.client.backupNow(provider);
        } finally {
            progress?.close();
        }
        await this.modalHost?.alert({
            kind: result.ok ? 'info' : 'error',
            title: result.ok ? tr('cloudBackupCompleteTitle', 'Backup complete') : tr('cloudBackupErrorTitle', 'Google Drive backup failed'),
            message: result.ok
                ? tr('cloudBackupCompleteDesc', 'A verified bookmark snapshot was saved to your Google Drive.')
                : result.message,
            confirmText: tr('btnOk', 'OK'),
        });
    }

    private async previewCloudRestore(provider: CloudBackupProviderId): Promise<void> {
        const listProgress = this.showCloudBackupProgress(
            tr('cloudBackupRestore', 'Preview restore'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressReadingList', 'Reading Google Drive backups...'),
                tr('cloudBackupProgressDownloadingSnapshot', 'Downloading the selected backup...'),
                tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'),
                tr('cloudBackupProgressWaitingConfirmation', 'Waiting for confirmation...'),
                tr('cloudBackupProgressApplyingMerge', 'Applying safe merge...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.listSnapshots },
        );
        let list: Awaited<ReturnType<CloudBackupClient['listSnapshots']>>;
        try {
            list = await this.client.listSnapshots(provider);
        } finally {
            listProgress?.close();
        }
        if (!list.ok) {
            await this.showError(list.message);
            return;
        }
        const snapshots = list.data.snapshots ?? [];
        if (snapshots.length === 0) {
            await this.modalHost?.alert({
                kind: 'info',
                title: tr('cloudBackupNoSnapshotsTitle', 'No Google Drive backups found'),
                message: tr('cloudBackupNoSnapshotsDesc', 'Google Drive does not have any AI-MarkDone bookmark backups yet.'),
                confirmText: tr('btnOk', 'OK'),
            });
            return;
        }
        const selected = await this.chooseCloudSnapshot(snapshots);
        if (!selected) return;
        const previewProgress = this.showCloudBackupProgress(
            tr('cloudBackupRestore', 'Preview restore'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressDownloadingSnapshot', 'Downloading the selected backup...'),
                tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.previewRestore },
        );
        previewProgress?.update(tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'));
        let preview: Awaited<ReturnType<CloudBackupClient['previewRestore']>>;
        try {
            preview = await this.client.previewRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge' });
        } finally {
            previewProgress?.close();
        }
        if (!preview.ok) {
            await this.showError(preview.message);
            return;
        }
        if (!await this.confirmCloudBackupRestorePreview(preview.data)) return;

        const applyProgress = this.showCloudBackupProgress(
            tr('cloudBackupApplyRestore', 'Apply safe merge'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressApplyingMerge', 'Applying safe merge...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.applyRestore },
        );
        let applied: Awaited<ReturnType<CloudBackupClient['applyRestore']>>;
        try {
            applied = await this.client.applyRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge' });
        } finally {
            applyProgress?.close();
        }
        if (!applied.ok) {
            await this.showError(applied.message);
            return;
        }
        const result = applied.data ?? {};
        await this.modalHost?.alert({
            kind: 'info',
            title: tr('cloudBackupRestoreCompleteTitle', 'Restore complete'),
            message: tr('cloudBackupRestoreCompleteDesc', 'Added $1 bookmark(s). Kept $2 local-only item(s), skipped $3 duplicate(s), and left $4 conflict(s) unchanged.', [
                String(result.restored ?? 0),
                String(result.localOnly ?? 0),
                String(result.skippedDuplicates ?? 0),
                String(result.conflicts ?? 0),
            ]),
            confirmText: tr('btnOk', 'OK'),
        });
    }

    private async confirmCloudBackupRestorePreview(previewData: any): Promise<boolean> {
        const modal = this.modalHost;
        if (!modal) return false;
        const plan = previewData?.plan ?? {};
        const warnings: string[] = [];
        const localOnly = Number(plan.localOnlyCount ?? 0);
        const conflicts = Number(plan.conflictCount ?? 0);
        if (localOnly > 0) {
            warnings.push(tr('cloudBackupRestoreLocalOnlyWarning', '$1 local-only bookmark(s) will stay untouched.', [String(localOnly)]));
        }
        if (conflicts > 0) {
            warnings.push(tr('cloudBackupRestoreConflictWarning', '$1 conflict(s) will keep the local copy.', [String(conflicts)]));
        }
        const review = buildImportMergeReviewModalBody({
            imported: Array.isArray(plan.bookmarksToUpsert) ? plan.bookmarksToUpsert.length : 0,
            skippedDuplicates: Number(plan.duplicateCount ?? 0),
            renamed: 0,
            folderCreateFailures: 0,
            warnings,
        });

        return new Promise((resolve) => {
            void modal.showCustom({
                kind: warnings.length > 0 ? 'warning' : review.kind,
                title: tr('cloudBackupRestorePreviewKind', 'Safe merge preview'),
                body: review.body,
                footer: (footer, close) => {
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.className = 'mock-modal__button mock-modal__button--secondary';
                    cancel.textContent = tr('btnCancel', 'Cancel');
                    cancel.dataset.action = 'modal-cancel';
                    cancel.addEventListener('click', () => {
                        close();
                        resolve(false);
                    });

                    const apply = document.createElement('button');
                    apply.type = 'button';
                    apply.className = 'mock-modal__button mock-modal__button--primary';
                    apply.textContent = tr('cloudBackupApplyRestore', 'Apply safe merge');
                    apply.dataset.action = 'modal-confirm';
                    apply.addEventListener('click', () => {
                        close();
                        resolve(true);
                    });

                    footer.append(cancel, apply);
                    window.setTimeout(() => apply.focus(), 0);
                },
                onDismiss: () => resolve(false),
            });
        });
    }

    private showCloudBackupProgress(
        title: string,
        initialMessage: string,
        steps: string[] = [],
        options: CloudBackupProgressOptions = {},
    ): CloudBackupProgressController | null {
        const modal = this.modalHost;
        if (!modal) return null;

        const body = document.createElement('div');
        body.className = 'cloud-backup-progress';
        const status = document.createElement('p');
        status.className = 'cloud-backup-progress__status';
        status.dataset.role = 'cloud-backup-progress-status';
        status.textContent = initialMessage;
        const budget = document.createElement('p');
        budget.className = 'cloud-backup-progress__budget';
        budget.dataset.role = 'cloud-backup-progress-budget';
        const list = document.createElement('ol');
        list.className = 'cloud-backup-progress__steps';
        const renderedSteps = steps.length > 0 ? steps : [initialMessage];
        renderedSteps.forEach((step, index) => {
            const item = document.createElement('li');
            item.textContent = step;
            item.dataset.active = index === 0 ? '1' : '0';
            list.appendChild(item);
        });

        const timeoutBudgetMs = options.timeoutBudgetMs;
        const startedAt = Date.now();
        const updateBudget = () => {
            if (!timeoutBudgetMs) return;
            const remaining = timeoutBudgetMs - (Date.now() - startedAt);
            budget.textContent = tr('cloudBackupProgressTimeBudget', 'Timeout budget: $1 remaining', [formatProgressRemaining(remaining)]);
        };
        updateBudget();
        if (timeoutBudgetMs) body.append(status, budget, list);
        else body.append(status, list);

        let closeModal: (() => void) | null = null;
        const budgetTimer = timeoutBudgetMs ? window.setInterval(updateBudget, 1000) : null;
        void modal.showCustom({
            kind: 'info',
            title,
            body,
            footer: (footer, close) => {
                closeModal = close;
                const working = document.createElement('button');
                working.type = 'button';
                working.className = 'mock-modal__button mock-modal__button--secondary';
                working.textContent = tr('cloudBackupProgressWorking', 'Working...');
                working.disabled = true;
                footer.appendChild(working);
            },
            onDismiss: () => {
                if (budgetTimer !== null) window.clearInterval(budgetTimer);
                closeModal = null;
            },
        });

        return {
            update: (message: string) => {
                status.textContent = message;
                Array.from(list.children).forEach((child) => {
                    const item = child as HTMLElement;
                    item.dataset.active = item.textContent === message ? '1' : '0';
                });
            },
            close: () => {
                const close = closeModal;
                closeModal = null;
                if (budgetTimer !== null) window.clearInterval(budgetTimer);
                window.setTimeout(() => close?.(), 0);
            },
        };
    }

    private async chooseCloudSnapshot(snapshots: CloudBackupSnapshotSummary[]): Promise<CloudBackupSnapshotSummary | null> {
        const modal = this.modalHost;
        if (!modal) return snapshots[0] ?? null;
        return new Promise((resolve) => {
            const body = document.createElement('div');
            body.className = 'cloud-backup-settings-modal';
            const description = document.createElement('p');
            description.textContent = tr(
                'cloudBackupChooseSnapshotDesc',
                'Choose the Google Drive backup to inspect. This step only previews a safe merge and does not change local bookmarks.',
            );
            let selectedId = snapshots[0]?.snapshotId ?? null;
            const list = document.createElement('div');
            list.className = 'cloud-backup-snapshot-list';
            list.dataset.role = 'cloud-backup-snapshot-list';
            const updateSelected = () => {
                Array.from(list.querySelectorAll<HTMLElement>('.cloud-backup-snapshot-option')).forEach((option) => {
                    const selected = option.dataset.snapshotId === selectedId;
                    option.dataset.selected = selected ? '1' : '0';
                    option.setAttribute('aria-checked', selected ? 'true' : 'false');
                });
            };
            snapshots.forEach((snapshot, index) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'cloud-backup-snapshot-option';
                option.dataset.snapshotId = snapshot.snapshotId;
                option.dataset.selected = index === 0 ? '1' : '0';
                option.setAttribute('role', 'radio');
                option.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
                const radio = document.createElement('span');
                radio.className = 'cloud-backup-snapshot-radio';
                radio.setAttribute('aria-hidden', 'true');
                const content = document.createElement('span');
                content.className = 'cloud-backup-snapshot-content';
                const createdAt = document.createElement('strong');
                createdAt.className = 'cloud-backup-snapshot-time';
                createdAt.textContent = formatSnapshotCreatedAt(snapshot.createdAt);
                const name = document.createElement('span');
                name.className = 'cloud-backup-snapshot-name';
                name.textContent = snapshot.name;
                name.title = snapshot.name;
                const size = document.createElement('span');
                size.className = 'cloud-backup-snapshot-size';
                size.textContent = formatSnapshotSize(snapshot.size);
                content.append(createdAt, name, size);
                option.append(radio, content);
                option.addEventListener('click', () => {
                    selectedId = snapshot.snapshotId;
                    updateSelected();
                });
                list.appendChild(option);
            });
            body.append(description, list);
            void modal.showCustom({
                kind: 'info',
                title: tr('cloudBackupChooseSnapshotTitle', 'Choose Google Drive backup'),
                body,
                footer: (footer, close) => {
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.className = 'mock-modal__button mock-modal__button--secondary';
                    cancel.textContent = tr('btnCancel', 'Cancel');
                    cancel.dataset.action = 'modal-cancel';
                    cancel.addEventListener('click', () => {
                        close();
                        resolve(null);
                    });
                    const confirm = document.createElement('button');
                    confirm.type = 'button';
                    confirm.className = 'mock-modal__button mock-modal__button--primary';
                    confirm.textContent = tr('cloudBackupRestore', 'Preview restore');
                    confirm.dataset.action = 'modal-confirm';
                    confirm.addEventListener('click', () => {
                        const selected = snapshots.find((snapshot) => snapshot.snapshotId === selectedId) ?? snapshots[0] ?? null;
                        close();
                        resolve(selected);
                    });
                    footer.append(cancel, confirm);
                    window.setTimeout(() => list.querySelector<HTMLElement>('.cloud-backup-snapshot-option')?.focus(), 0);
                },
                onDismiss: () => resolve(null),
            });
        });
    }

    private async showGoogleDriveBackupSettings(): Promise<void> {
        const modal = this.modalHost;
        if (!modal) return;
        const body = document.createElement('div');
        body.className = 'cloud-backup-settings-modal';
        const summary = document.createElement('div');
        summary.className = 'settings-label settings-item-info';
        const title = document.createElement('strong');
        title.textContent = 'Google Drive';
        const privacy = document.createElement('p');
        privacy.className = 'cloud-backup-settings-modal__privacy';
        privacy.textContent = tr('cloudBackupPrivacyNote', 'AI-MarkDone does not collect your Google account, token, password, or bookmarks.');
        summary.append(title, privacy);
        body.appendChild(summary);
        const statusRow = document.createElement('div');
        statusRow.className = 'settings-row settings-item cloud-backup-settings-modal__status-card';
        const statusInfo = document.createElement('div');
        statusInfo.className = 'settings-label settings-item-info';
        const statusTitle = document.createElement('strong');
        statusTitle.textContent = tr('cloudBackupStatusLabel', 'Status');
        const status = document.createElement('p');
        status.textContent = tr('cloudBackupStatusChecking', 'Checking Google Drive status...');
        const account = document.createElement('p');
        account.className = 'cloud-backup-settings-modal__account';
        account.hidden = true;
        statusInfo.append(statusTitle, status, account);
        statusRow.appendChild(statusInfo);
        body.appendChild(statusRow);
        const actions = document.createElement('div');
        actions.className = 'cloud-backup-settings-modal__actions';
        body.appendChild(actions);

        const formatAccount = (data: any): string => {
            const accountData = data?.connectedAccount && typeof data.connectedAccount === 'object' ? data.connectedAccount : data;
            const displayName = typeof accountData?.accountDisplayName === 'string' ? accountData.accountDisplayName.trim() : '';
            const email = typeof accountData?.accountEmail === 'string' ? accountData.accountEmail.trim() : '';
            return displayName && email ? `${displayName} · ${email}` : displayName || email;
        };
        const setStatus = async () => {
            const result = await this.client.status('googleDrive');
            if (!result.ok) {
                status.textContent = result.message;
                account.hidden = true;
                return;
            }
            const accountText = formatAccount(result.data);
            if (result.data?.connected) {
                status.textContent = accountText
                    ? (() => {
                        const translated = tr('cloudBackupConnectedAs', 'Connected as $1', [accountText]);
                        return translated && translated !== 'cloudBackupConnectedAs' ? translated : `Connected as ${accountText}`;
                    })()
                    : tr('cloudBackupConnectedStatus', 'Connected');
            } else {
                status.textContent = tr('cloudBackupDisconnected', 'Not connected');
            }
            account.hidden = !accountText;
            account.textContent = accountText;
            account.title = accountText;
        };
        const list = document.createElement('button');
        list.type = 'button';
        list.className = 'secondary-btn';
        list.textContent = tr('cloudBackupTestConnection', 'Test connection');
        list.addEventListener('click', () => void (async () => {
            list.disabled = true;
            status.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
            try {
                const result = await this.client.listSnapshots('googleDrive');
                status.textContent = result.ok
                    ? tr('cloudBackupSnapshotCount', '$1 Google Drive backup(s) found.', [String(result.data.snapshots?.length ?? 0)])
                    : result.message;
            } finally {
                list.disabled = false;
            }
        })());
        const manage = document.createElement('button');
        manage.type = 'button';
        manage.className = 'secondary-btn';
        manage.textContent = tr('cloudBackupManageBackups', 'Manage cloud backups');
        manage.addEventListener('click', () => void this.showCloudBackupManager());
        actions.append(list, manage);
        await setStatus();
        await modal.showCustom({
            kind: 'info',
            title: tr('cloudBackupGoogleDriveSettingsTitle', 'Google Drive backup settings'),
            body,
        });
    }

    private async showCloudBackupManager(): Promise<void> {
        const modal = this.modalHost;
        if (!modal) return;
        const body = document.createElement('div');
        body.className = 'cloud-backup-settings-modal';
        const description = document.createElement('p');
        description.textContent = tr(
            'cloudBackupManageBackupsDesc',
            'These are backup files AI-MarkDone created in your Google Drive. Moving one to trash never changes local bookmarks.',
        );
        const listRoot = document.createElement('div');
        listRoot.className = 'cloud-backup-manager-list';
        listRoot.dataset.role = 'cloud-backup-manager-list';
        body.append(description, listRoot);
        const loadSnapshots = async () => {
            listRoot.dataset.state = 'loading';
            listRoot.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
            const result = await this.client.listSnapshots('googleDrive');
            if (!result.ok) {
                listRoot.dataset.state = 'error';
                listRoot.textContent = result.message;
                return;
            }
            const snapshots = result.data.snapshots ?? [];
            if (snapshots.length === 0) {
                listRoot.dataset.state = 'empty';
                listRoot.textContent = tr('cloudBackupManageEmpty', 'No Google Drive backups yet.');
                return;
            }
            listRoot.dataset.state = 'ready';
            listRoot.replaceChildren(...snapshots.map((snapshot: CloudBackupSnapshotSummary) => {
                const row = document.createElement('article');
                row.className = 'cloud-backup-manager-item';
                const info = document.createElement('div');
                info.className = 'cloud-backup-manager-info';
                const createdAt = document.createElement('strong');
                createdAt.textContent = formatSnapshotCreatedAt(snapshot.createdAt);
                const fileName = document.createElement('span');
                fileName.className = 'cloud-backup-manager-name';
                fileName.textContent = snapshot.name;
                fileName.title = snapshot.name;
                const size = document.createElement('span');
                size.className = 'cloud-backup-manager-size';
                size.textContent = formatSnapshotSize(snapshot.size);
                info.append(createdAt, fileName, size);
                const trash = document.createElement('button');
                trash.type = 'button';
                trash.className = 'secondary-btn secondary-btn--danger cloud-backup-manager-trash';
                trash.textContent = tr('cloudBackupMoveToTrash', 'Move to trash');
                trash.addEventListener('click', () => void (async () => {
                    const confirmed = await modal.confirm({
                        kind: 'warning',
                        title: tr('cloudBackupMoveToTrashConfirmTitle', 'Move backup to trash?'),
                        message: tr('cloudBackupMoveToTrashConfirmDesc', 'This moves "$1" to Google Drive trash. Local bookmarks will not be changed.', [snapshot.name]),
                        confirmText: tr('cloudBackupMoveToTrash', 'Move to trash'),
                        cancelText: tr('btnCancel', 'Cancel'),
                        danger: true,
                    });
                    if (!confirmed) return;
                    trash.disabled = true;
                    trash.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
                    const deleted = await this.client.deleteSnapshot({ provider: 'googleDrive', snapshotId: snapshot.snapshotId });
                    trash.disabled = false;
                    trash.textContent = tr('cloudBackupMoveToTrash', 'Move to trash');
                    if (!deleted.ok) {
                        await this.showError(deleted.message);
                        return;
                    }
                    await loadSnapshots();
                })());
                row.append(info, trash);
                return row;
            }));
        };
        await loadSnapshots();
        await modal.showCustom({
            kind: 'info',
            title: tr('cloudBackupManageBackups', 'Manage cloud backups'),
            body,
        });
    }
}
