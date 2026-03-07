import type { Theme } from '../../../../core/types/theme';
import { PathUtils } from '../../../../core/bookmarks/path';
import type { ProtocolErrorCode } from '../../../../contracts/protocol';
import { bookmarksClient } from '../../../../drivers/shared/clients/bookmarksClient';
import { getTokenCss } from '../../../../style/tokens';
import {
    checkIcon,
    chevronDownIcon,
    chevronRightIcon,
    folderIcon,
    folderOpenIcon,
    folderPlusIcon,
    xIcon,
} from '../../../../assets/icons';
import { createInitialDraftState, deriveDefaultTitle, deriveInitialSelection, reduceDraft, validateDraft } from '../../../../services/bookmarks/saveDialog/draftModel';
import { buildFolderPickerVm } from '../../../../services/bookmarks/saveDialog/folderPickerModel';
import type { BookmarkSaveDraftState, SaveDialogMode } from '../../../../services/bookmarks/saveDialog/types';
import { t } from '../../components/i18n';
import { createIcon } from '../../components/Icon';
import { folderCreateBackendErrorMessage, titleValidationMessage, validateFolderSegmentName } from '../helpers/nameValidation';
import { getBookmarkSaveDialogCss } from './bookmarkSaveDialogCss';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../../components/dialogKeyboardScope';

type FolderLite = { path: string; name: string; depth: number };

export type BookmarkSaveDialogResult =
    | { ok: true; title: string; folderPath: string }
    | { ok: false; reason: 'cancel' };

type OpenParams = {
    theme: Theme;
    userPrompt: string;
    existingTitle?: string | null;
    currentFolderPath?: string | null;
    mode?: SaveDialogMode; // default 'create'
};

type RootFolderModalState = { value: string; error: string; note: string };
type InlineSubfolderState = { parentPath: string; value: string; error: string; note: string };

export class BookmarkSaveDialog {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private theme: Theme = 'light';
    private resolve: ((res: BookmarkSaveDialogResult) => void) | null = null;

    private folders: FolderLite[] = [];
    private state: BookmarkSaveDraftState | null = null;
    private status: string = '';
    private pending: boolean = false;

    private rootFolderModal: RootFolderModalState | null = null;
    private subfolderInline: InlineSubfolderState | null = null;
    private lastSelectedFolderPathCache: string | null = null;

    isOpen(): boolean {
        return Boolean(this.host);
    }

    async open(params: OpenParams): Promise<BookmarkSaveDialogResult> {
        if (this.host) this.close({ ok: false, reason: 'cancel' });
        this.theme = params.theme;
        this.status = '';
        this.pending = false;
        this.rootFolderModal = null;
        this.subfolderInline = null;

        const mode: SaveDialogMode = params.mode ?? 'create';
        const title = deriveDefaultTitle({ userPrompt: params.userPrompt, existingTitle: params.existingTitle ?? null });

        this.mount();
        // Optimistic render from cache to avoid "seconds-level" perceived delay on repeated opens.
        if (this.folders.length > 0) {
            const selectedFolderPath = deriveInitialSelection({
                folders: this.folders as any,
                lastSelectedFolderPath: this.lastSelectedFolderPathCache,
                currentFolderPath: params.currentFolderPath ?? null,
                mode,
            });
            this.state = createInitialDraftState({ mode, title, selectedFolderPath });
            this.render();
        } else {
            this.renderLoading();
            this.state = createInitialDraftState({ mode, title, selectedFolderPath: null });
            this.renderTitleOnly();
            this.renderFooterOnly();
        }

        // Fetch latest folders + last-selected (best-effort). Do not block the UI on this round trip.
        void this.refreshFoldersAndUiState({
            mode,
            currentFolderPath: params.currentFolderPath ?? null,
        });

        // Focus title by default (but do it after initial render).
        window.setTimeout(() => this.shadow?.querySelector<HTMLInputElement>('[data-role="title"]')?.focus(), 0);

        return await new Promise<BookmarkSaveDialogResult>((resolve) => {
            this.resolve = resolve;
        });
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.hostHandle?.setCss(getTokenCss(theme) + getBookmarkSaveDialogCss(theme));
    }

    private close(result: BookmarkSaveDialogResult): void {
        const resolve = this.resolve;
        this.resolve = null;

        this.shadow = null;

        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
        this.state = null;
        this.status = '';
        this.pending = false;
        this.rootFolderModal = null;
        this.subfolderInline = null;

        resolve?.(result);
    }

    private async refreshFoldersAndUiState(params: { mode: SaveDialogMode; currentFolderPath: string | null }): Promise<void> {
        const [foldersRes, uiStateRes] = await Promise.all([
            bookmarksClient.foldersList(),
            bookmarksClient.uiStateGetLastSelectedFolderPath(),
        ]);

        if (!this.host) return;

        if (foldersRes.ok) {
            this.folders = foldersRes.data.folders.map((f) => ({ path: f.path, name: f.name, depth: f.depth }));
        }

        if (uiStateRes.ok) this.lastSelectedFolderPathCache = uiStateRes.data.value;

        if (!this.state) return;
        const selected = this.state.selectedFolderPath;
        const exists = selected ? this.folders.some((f) => f.path === selected) : false;

        // Only adjust selection if the current selection is missing; never override an explicit user selection.
        if (!exists) {
            const nextSelected = deriveInitialSelection({
                folders: this.folders as any,
                lastSelectedFolderPath: this.lastSelectedFolderPathCache,
                currentFolderPath: params.currentFolderPath,
                mode: params.mode,
            });
            this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path: nextSelected });
        }

        this.status = '';
        this.render();
    }

    private mount(): void {
        if (this.host) return;
        const handle = mountShadowDialogHost({
            id: 'aimd-bookmark-save-dialog-host',
            html: this.getHtml(),
            cssText: getTokenCss(this.theme) + getBookmarkSaveDialogCss(this.theme),
            lockScroll: true,
        });
        const host = handle.host;
        const shadow = handle.shadow;

        shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.close({ ok: false, reason: 'cancel' });
        });
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close({ ok: false, reason: 'cancel' }));
        shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => this.close({ ok: false, reason: 'cancel' }));
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => void this.submit());
        shadow.querySelector<HTMLButtonElement>('[data-action="new_folder"]')?.addEventListener('click', () => this.openRootFolderModal());

        const titleInput = shadow.querySelector<HTMLInputElement>('[data-role="title"]');
        titleInput?.addEventListener('input', () => {
            if (!this.state) return;
            this.state = reduceDraft(this.state, { type: 'setTitle', title: titleInput.value });
            // IME-friendly: do not rebuild the full tree on each keystroke.
            this.renderTitleOnly();
            this.renderFooterOnly();
        });

        this.keyboardHandle = attachDialogKeyboardScope({
            root: host,
            onEscape: () => {
                if (this.rootFolderModal) {
                    this.rootFolderModal = null;
                    this.renderModalLayer();
                    return;
                }
                if (this.subfolderInline) {
                    this.subfolderInline = null;
                    this.render();
                    return;
                }
                this.close({ ok: false, reason: 'cancel' });
            },
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: shadow.querySelector<HTMLElement>('.panel') ?? undefined,
        });

        this.host = host;
        this.shadow = shadow;
        this.hostHandle = handle;
    }

    private renderLoading(): void {
        if (!this.shadow) return;
        const tree = this.shadow.querySelector<HTMLElement>('[data-role="tree"]');
        if (!tree) return;
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = t('loadingFolders');
        tree.replaceChildren(empty);
    }

    private renderTitleOnly(): void {
        if (!this.shadow || !this.state) return;

        const titleInput = this.shadow.querySelector<HTMLInputElement>('[data-role="title"]');
        if (titleInput && titleInput.value !== this.state.title) titleInput.value = this.state.title;

        const validation = validateDraft(this.state);
        if (titleInput) titleInput.setAttribute('aria-invalid', validation.titleError ? 'true' : 'false');

        const titleError = this.shadow.querySelector<HTMLElement>('[data-role="title_error"]');
        if (titleError) {
            const msg = validation.titleError ? titleValidationMessage(validation.titleError as any) : '';
            titleError.textContent = msg;
            titleError.style.display = msg ? 'block' : 'none';
        }
    }

    private renderFooterOnly(): void {
        if (!this.shadow || !this.state) return;

        const status = this.shadow.querySelector<HTMLElement>('[data-role="status"]');
        if (status) status.textContent = this.status || '';

        const validation = validateDraft(this.state);
        const saveBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="save"]');
        if (saveBtn) saveBtn.disabled = this.pending || !validation.canSubmit;
    }

    private render(): void {
        if (!this.shadow || !this.state) return;
        this.renderTitleOnly();
        this.renderFooterOnly();

        const vm = buildFolderPickerVm({
            folders: this.folders as any,
            expandedPaths: this.state.expandedPaths,
            selectedPath: this.state.selectedFolderPath,
        });

        const tree = this.shadow.querySelector<HTMLElement>('[data-role="tree"]');
        if (tree) {
            tree.replaceChildren();
            if (vm.nodes.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = this.status || t('noFoldersYet');
                tree.appendChild(empty);
            } else {
                vm.nodes.forEach((node) => tree.appendChild(this.renderNode(node)));
            }
        }

        this.renderModalLayer();
    }

    private renderNode(node: any): HTMLElement {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.path = node.path;
        row.dataset.selected = node.isSelected ? '1' : '0';
        row.style.paddingLeft = `calc(10px + ${Math.max(0, node.depth - 1)} * 22px)`;

        const caret = document.createElement('span');
        caret.className = 'caret';

        const hasChildren = node.children && node.children.length > 0;
        if (hasChildren) {
            caret.appendChild(createIcon(node.isExpanded ? chevronDownIcon : chevronRightIcon));
            caret.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.state) return;
                this.state = reduceDraft(this.state, { type: 'toggleExpanded', path: node.path });
                this.render();
            });
        } else {
            caret.innerHTML = '';
        }

        const iconWrap = document.createElement('span');
        iconWrap.className = 'folder-icon';
        iconWrap.appendChild(createIcon(node.isExpanded ? folderOpenIcon : folderIcon));

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = node.name;

        const actions = document.createElement('span');
        actions.className = 'row-actions';

        if (node.canCreateSubfolder) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon icon-sm';
            btn.title = t('createSubfolder');
            btn.setAttribute('aria-label', t('createSubfolder'));
            btn.innerHTML = folderPlusIcon;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                void this.openInlineSubfolderEditor(node.path);
            });
            actions.appendChild(btn);
        }

        const check = document.createElement('span');
        check.className = 'check';
        check.innerHTML = node.isSelected ? checkIcon : '';

        row.appendChild(caret);
        row.appendChild(iconWrap);
        row.appendChild(name);
        row.appendChild(actions);
        row.appendChild(check);

        row.addEventListener('click', () => this.selectFolder(node.path));

        const wrap = document.createElement('div');
        wrap.appendChild(row);
        if (this.subfolderInline && this.subfolderInline.parentPath === node.path) {
            wrap.appendChild(this.renderInlineSubfolderRow(node.path, node.depth));
        }
        if (hasChildren && node.isExpanded) {
            for (const ch of node.children) wrap.appendChild(this.renderNode(ch));
        }
        return wrap.childElementCount === 1 ? row : wrap;
    }

    private selectFolder(path: string): void {
        if (!this.state) return;
        this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path });
        this.render();
        this.lastSelectedFolderPathCache = path;
        void bookmarksClient.uiStateSetLastSelectedFolderPath(path);
    }

    private openRootFolderModal(): void {
        if (this.pending) return;
        this.rootFolderModal = { value: '', error: '', note: '' };
        this.renderModalLayer();
        window.setTimeout(() => this.shadow?.querySelector<HTMLInputElement>('[data-role="root_folder_input"]')?.focus(), 0);
    }

    private async openInlineSubfolderEditor(parentPath: string): Promise<void> {
        if (!this.state || this.pending) return;
        this.subfolderInline = { parentPath, value: '', error: '', note: '' };
        this.state = reduceDraft(this.state, { type: 'expandToPath', path: parentPath });
        this.render();

        window.setTimeout(() => {
            const input = this.shadow?.querySelector<HTMLInputElement>(
                `[data-role="subfolder_input"][data-parent="${CSS.escape(parentPath)}"]`
            );
            input?.focus();
        }, 0);
    }

    private async createFolderOnBackend(params: { parentPath: string | null; rawName: string }): Promise<{ ok: true; path: string; note: string } | { ok: false; message: string }> {
        const segmentValidation = validateFolderSegmentName(params.rawName);
        if (!segmentValidation.ok) return { ok: false, message: segmentValidation.message };

        const note = segmentValidation.note;
        const nameNormalized = segmentValidation.normalized;
        const path = params.parentPath ? `${params.parentPath}${PathUtils.SEPARATOR}${nameNormalized}` : nameNormalized;

        this.pending = true;
        this.status = t('saving');
        this.renderFooterOnly();

        const res = await bookmarksClient.foldersCreate({ path });
        this.pending = false;

        if (!res.ok) {
            this.status = '';
            this.renderFooterOnly();
            return {
                ok: false,
                message: folderCreateBackendErrorMessage({
                    errorCode: (res as any).errorCode as ProtocolErrorCode,
                    message: (res as any).message,
                    rawName: params.rawName,
                }),
            };
        }

        const foldersRes = await bookmarksClient.foldersList();
        if (foldersRes.ok) {
            this.folders = foldersRes.data.folders.map((f) => ({ path: f.path, name: f.name, depth: f.depth }));
        }

        this.status = '';
        this.renderFooterOnly();

        return { ok: true, path, note };
    }

    private renderInlineSubfolderRow(parentPath: string, parentDepth: number): HTMLElement {
        const outer = document.createElement('div');
        outer.className = 'inline-wrap';
        outer.style.paddingLeft = `calc(10px + ${Math.max(0, parentDepth)} * 22px)`;

        const row = document.createElement('div');
        row.className = 'inline-editor';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input input-compact';
        input.placeholder = t('enterFolderName');
        input.setAttribute('data-role', 'subfolder_input');
        input.setAttribute('data-parent', parentPath);
        input.value = this.subfolderInline?.value ?? '';

        input.addEventListener('input', () => {
            if (!this.subfolderInline) return;
            this.subfolderInline.value = input.value;
            this.subfolderInline.error = '';
            this.subfolderInline.note = '';
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.subfolderInline = null;
                this.render();
            }
            e.stopPropagation();
        });

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'icon icon-sm';
        okBtn.title = t('btnSave');
        okBtn.setAttribute('aria-label', t('btnSave'));
        okBtn.innerHTML = checkIcon;
        okBtn.addEventListener('click', () => void confirm());

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'icon icon-sm';
        cancelBtn.title = t('btnCancel');
        cancelBtn.setAttribute('aria-label', t('btnCancel'));
        cancelBtn.innerHTML = xIcon;
        cancelBtn.addEventListener('click', () => {
            this.subfolderInline = null;
            this.render();
        });

        row.append(input, okBtn, cancelBtn);

        const message = document.createElement('div');
        message.className = 'inline-message';
        message.setAttribute('data-role', 'inline_message');
        const initialMsg = this.subfolderInline?.error || this.subfolderInline?.note || '';
        message.textContent = initialMsg;
        message.dataset.kind = this.subfolderInline?.error ? 'error' : (this.subfolderInline?.note ? 'note' : '');
        message.style.display = initialMsg ? 'block' : 'none';

        const confirm = async () => {
            if (!this.subfolderInline || this.pending) return;
            const rawName = this.subfolderInline.value;
            const result = await this.createFolderOnBackend({ parentPath, rawName });
            if (!result.ok) {
                this.subfolderInline.error = result.message;
                this.subfolderInline.note = '';
                message.dataset.kind = 'error';
                message.textContent = result.message;
                message.style.display = 'block';
                input.focus();
                return;
            }

            this.subfolderInline = null;
            if (this.state) this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path: result.path });
            this.render();
        };

        outer.append(row, message);
        return outer;
    }

    private renderModalLayer(): void {
        if (!this.shadow) return;
        const layer = this.shadow.querySelector<HTMLElement>('[data-role="modal_layer"]');
        if (!layer) return;

        layer.replaceChildren();
        if (!this.rootFolderModal) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.rootFolderModal = null;
                this.renderModalLayer();
            }
        });

        const panel = document.createElement('div');
        panel.className = 'modal';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', t('newFolder'));

        const head = document.createElement('div');
        head.className = 'modal-head';

        const title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = t('newFolder');

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'icon icon-sm';
        close.title = t('btnClose');
        close.setAttribute('aria-label', t('btnClose'));
        close.innerHTML = xIcon;
        close.addEventListener('click', () => {
            this.rootFolderModal = null;
            this.renderModalLayer();
        });

        head.append(title, close);

        const body = document.createElement('div');
        body.className = 'modal-body';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input';
        input.placeholder = t('enterFolderName');
        input.setAttribute('data-role', 'root_folder_input');
        input.value = this.rootFolderModal.value;

        const err = document.createElement('div');
        err.className = 'error';
        err.setAttribute('data-role', 'root_folder_error');

        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.setAttribute('data-role', 'root_folder_hint');

        const syncErrorHint = () => {
            if (!this.rootFolderModal) return;
            err.textContent = this.rootFolderModal.error || '';
            err.style.display = this.rootFolderModal.error ? 'block' : 'none';
            hint.textContent = this.rootFolderModal.note || '';
        };
        syncErrorHint();

        input.addEventListener('input', () => {
            if (!this.rootFolderModal) return;
            this.rootFolderModal.value = input.value;
            this.rootFolderModal.error = '';
            this.rootFolderModal.note = '';
            syncErrorHint();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.rootFolderModal = null;
                this.renderModalLayer();
            }
            e.stopPropagation();
        });

        body.append(input, err, hint);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn';
        cancel.textContent = t('btnCancel');
        cancel.addEventListener('click', () => {
            this.rootFolderModal = null;
            this.renderModalLayer();
        });

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = t('btnSave');

        const confirm = async () => {
            if (!this.rootFolderModal || this.pending) return;
            const res = await this.createFolderOnBackend({ parentPath: null, rawName: this.rootFolderModal.value });
            if (!res.ok) {
                this.rootFolderModal.error = res.message;
                this.rootFolderModal.note = '';
                syncErrorHint();
                input.focus();
                return;
            }

            this.rootFolderModal.error = '';
            this.rootFolderModal.note = res.note;
            syncErrorHint();

            if (this.state) this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path: res.path });
            this.rootFolderModal = null;
            this.render();
        };

        confirmBtn.addEventListener('click', () => void confirm());
        actions.append(cancel, confirmBtn);

        panel.append(head, body, actions);
        overlay.appendChild(panel);
        layer.appendChild(overlay);

        window.setTimeout(() => input.focus(), 0);
    }

    private async submit(): Promise<void> {
        if (!this.state || this.pending) return;

        const validation = validateDraft(this.state);
        if (!validation.canSubmit) {
            this.status = '';
            this.renderTitleOnly();
            this.renderFooterOnly();
            return;
        }

        const folderPath = this.state.selectedFolderPath!;
        const title = this.state.title.trim();

        void bookmarksClient.uiStateSetLastSelectedFolderPath(folderPath);
        this.close({ ok: true, title, folderPath });
    }

    private getHtml(): string {
        return `
<div class="overlay" data-role="overlay">
  <div class="panel" role="dialog" aria-modal="true" aria-label="${t('saveBookmarkTitle')}">
    <div class="header">
      <div class="title">${t('saveBookmarkTitle')}</div>
      <button class="icon" type="button" data-action="close" aria-label="${t('btnClose')}" title="${t('btnClose')}">${xIcon}</button>
    </div>
    <div class="body">
      <div class="field">
        <div class="label">${t('labelTitle')}</div>
        <input class="input" data-role="title" type="text" placeholder="${t('enterBookmarkTitle')}" />
        <div class="error" data-role="title_error" style="display:none;"></div>
      </div>

      <div class="field">
        <div class="folders-head">
          <div class="label">${t('labelFolder')}</div>
          <div class="folders-actions">
            <button class="icon" type="button" data-action="new_folder" aria-label="${t('newFolder')}" title="${t('newFolder')}">${folderPlusIcon}</button>
          </div>
        </div>
        <div class="tree" data-role="tree"></div>
      </div>
    </div>
    <div class="footer">
      <div class="status" data-role="status"></div>
      <div class="footer-actions">
        <button class="btn" type="button" data-action="cancel">${t('btnCancel')}</button>
        <button class="btn btn-primary" type="button" data-action="save">${t('btnSave')}</button>
      </div>
    </div>
  </div>
</div>
<div data-role="modal_layer"></div>
`;
    }
}
