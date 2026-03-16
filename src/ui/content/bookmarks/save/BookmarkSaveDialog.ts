import type { Theme } from '../../../../core/types/theme';
import { PathUtils } from '../../../../core/bookmarks/path';
import type { ProtocolErrorCode } from '../../../../contracts/protocol';
import { bookmarksClient } from '../../../../drivers/shared/clients/bookmarksClient';
import { getTokenCss } from '../../../../style/tokens';
import overlayCssText from '../../../../style/tailwind-overlay.css?inline';
import {
    checkIcon,
    chevronDownIcon,
    chevronRightIcon,
    folderIcon,
    folderOpenIcon,
    folderPlusIcon,
    xIcon,
} from '../../../../assets/icons';
import {
    createInitialDraftState,
    deriveDefaultTitle,
    deriveInitialSelection,
    reduceDraft,
    validateDraft,
} from '../../../../services/bookmarks/saveDialog/draftModel';
import { buildFolderPickerVm } from '../../../../services/bookmarks/saveDialog/folderPickerModel';
import type { BookmarkSaveDraftState, SaveDialogMode } from '../../../../services/bookmarks/saveDialog/types';
import { t } from '../../components/i18n';
import { createIcon } from '../../components/Icon';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../../components/dialogKeyboardScope';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from '../../overlay/OverlaySurfaceHost';
import { TooltipDelegate } from '../../../../utils/tooltip';
import { folderCreateBackendErrorMessage, titleValidationMessage, validateFolderSegmentName } from '../helpers/nameValidation';
import { getBookmarkSaveDialogCss } from './bookmarkSaveDialogCss';

type FolderLite = { path: string; name: string; depth: number };

export type BookmarkSaveDialogResult =
    | { ok: true; title: string; folderPath: string }
    | { ok: false; reason: 'cancel' };

type OpenParams = {
    theme: Theme;
    userPrompt: string;
    existingTitle?: string | null;
    currentFolderPath?: string | null;
    mode?: SaveDialogMode;
};

type RootFolderModalState = { value: string; error: string; note: string };
type InlineSubfolderState = { parentPath: string; value: string; error: string; note: string };

export class BookmarkSaveDialog {
    private hostHandle: OverlaySurfaceHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private theme: Theme = 'light';
    private resolve: ((res: BookmarkSaveDialogResult) => void) | null = null;

    private folders: FolderLite[] = [];
    private state: BookmarkSaveDraftState | null = null;
    private status = '';
    private pending = false;
    private rootFolderModal: RootFolderModalState | null = null;
    private subfolderInline: InlineSubfolderState | null = null;
    private lastSelectedFolderPathCache: string | null = null;

    isOpen(): boolean {
        return Boolean(this.hostHandle);
    }

    async open(params: OpenParams): Promise<BookmarkSaveDialogResult> {
        if (this.hostHandle) this.close({ ok: false, reason: 'cancel' });
        this.theme = params.theme;
        this.status = '';
        this.pending = false;
        this.rootFolderModal = null;
        this.subfolderInline = null;

        const mode: SaveDialogMode = params.mode ?? 'create';
        const title = deriveDefaultTitle({ userPrompt: params.userPrompt, existingTitle: params.existingTitle ?? null });

        this.mount();
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
            this.state = createInitialDraftState({ mode, title, selectedFolderPath: null });
            this.render();
        }

        void this.refreshFoldersAndUiState({
            mode,
            currentFolderPath: params.currentFolderPath ?? null,
        });

        window.setTimeout(() => this.hostHandle?.surfaceRoot.querySelector<HTMLInputElement>('[data-role="bookmark-save-title"]')?.focus(), 0);

        return await new Promise<BookmarkSaveDialogResult>((resolve) => {
            this.resolve = resolve;
        });
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.hostHandle?.setThemeCss(getTokenCss(theme));
        this.hostHandle?.setSurfaceCss(this.getCss());
    }

    private close(result: BookmarkSaveDialogResult): void {
        const resolve = this.resolve;
        this.resolve = null;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
        this.hostHandle?.unmount();
        this.hostHandle = null;
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

        if (!this.hostHandle) return;

        if (foldersRes.ok) {
            this.folders = foldersRes.data.folders.map((f) => ({ path: f.path, name: f.name, depth: f.depth }));
        }

        if (uiStateRes.ok) this.lastSelectedFolderPathCache = uiStateRes.data.value;

        if (!this.state) return;
        const selected = this.state.selectedFolderPath;
        const exists = selected ? this.folders.some((f) => f.path === selected) : false;
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
        if (this.hostHandle) return;
        const handle = mountOverlaySurfaceHost({
            id: 'aimd-bookmark-save-dialog-host',
            themeCss: getTokenCss(this.theme),
            surfaceCss: this.getCss(),
            overlayCss: overlayCssText,
            lockScroll: true,
            surfaceStyleId: 'aimd-bookmark-save-dialog-structure',
            overlayStyleId: 'aimd-bookmark-save-dialog-tailwind',
        });

        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(handle.shadow);

        handle.backdropRoot.addEventListener('click', () => this.close({ ok: false, reason: 'cancel' }));
        handle.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));
        handle.surfaceRoot.addEventListener('input', (event) => this.handleSurfaceInput(event));
        handle.surfaceRoot.addEventListener('keydown', (event) => void this.handleSurfaceKeyDown(event));

        this.keyboardHandle = attachDialogKeyboardScope({
            root: handle.host,
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
            trapTabWithin: handle.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? handle.host,
        });
    }

    private render(): void {
        if (!this.hostHandle || !this.state) return;
        this.hostHandle.setSurfaceCss(this.getCss());
        this.hostHandle.backdropRoot.innerHTML = '<div class="panel-stage__overlay"></div>';
        this.hostHandle.surfaceRoot.innerHTML = this.getHtml();
        this.renderModalLayer();
        this.tooltipDelegate?.refresh(this.hostHandle.shadow);
    }

    private handleSurfaceInput(event: Event): void {
        const target = event.target as HTMLElement | null;
        if (!this.state || !target) return;

        if (target.matches('[data-role="bookmark-save-title"]')) {
            const input = target as HTMLInputElement;
            this.state = reduceDraft(this.state, { type: 'setTitle', title: input.value });
            this.render();
            return;
        }

        if (target.matches('[data-role="bookmark-save-inline-draft"]') && this.subfolderInline) {
            const input = target as HTMLInputElement;
            this.subfolderInline.value = input.value;
            this.subfolderInline.error = '';
            this.subfolderInline.note = '';
            this.renderModalLayer();
        }
    }

    private async handleSurfaceClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        switch (actionEl.dataset.action) {
            case 'close-panel':
                this.close({ ok: false, reason: 'cancel' });
                return;
            case 'bookmark-save-submit':
                await this.submit();
                return;
            case 'bookmark-save-select-folder':
                if (actionEl.dataset.path) this.selectFolder(actionEl.dataset.path);
                return;
            case 'bookmark-save-toggle-folder':
                if (!this.state || !actionEl.dataset.path) return;
                this.state = reduceDraft(this.state, { type: 'toggleExpanded', path: actionEl.dataset.path });
                this.render();
                return;
            case 'bookmark-save-new-root-folder':
                this.openRootFolderModal();
                return;
            case 'bookmark-save-inline-folder':
                if (actionEl.dataset.path) await this.openInlineSubfolderEditor(actionEl.dataset.path);
                return;
            case 'bookmark-save-inline-confirm':
                if (actionEl.dataset.path) await this.confirmInlineSubfolder(actionEl.dataset.path);
                return;
            case 'bookmark-save-inline-cancel':
                this.subfolderInline = null;
                this.render();
                return;
            default:
                return;
        }
    }

    private async handleSurfaceKeyDown(event: KeyboardEvent): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.matches('[data-role="bookmark-save-inline-draft"]')) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const path = (target as HTMLElement).dataset.parent;
                if (path) await this.confirmInlineSubfolder(path);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.subfolderInline = null;
                this.render();
            }
            event.stopPropagation();
        }
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
    }

    private async openInlineSubfolderEditor(parentPath: string): Promise<void> {
        if (!this.state || this.pending) return;
        this.subfolderInline = { parentPath, value: '', error: '', note: '' };
        this.state = reduceDraft(this.state, { type: 'expandToPath', path: parentPath });
        this.render();
        window.setTimeout(() => {
            this.hostHandle?.surfaceRoot.querySelector<HTMLInputElement>(`[data-role="bookmark-save-inline-draft"][data-parent="${CSS.escape(parentPath)}"]`)?.focus();
        }, 0);
    }

    private async confirmInlineSubfolder(parentPath: string): Promise<void> {
        if (!this.subfolderInline || this.pending) return;
        const result = await this.createFolderOnBackend({ parentPath, rawName: this.subfolderInline.value });
        if (!result.ok) {
            this.subfolderInline.error = result.message;
            this.subfolderInline.note = '';
            this.render();
            return;
        }

        this.subfolderInline = null;
        if (this.state) this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path: result.path });
        this.render();
    }

    private async createFolderOnBackend(params: { parentPath: string | null; rawName: string }): Promise<{ ok: true; path: string; note: string } | { ok: false; message: string }> {
        const segmentValidation = validateFolderSegmentName(params.rawName);
        if (!segmentValidation.ok) return { ok: false, message: segmentValidation.message };

        const note = segmentValidation.note;
        const nameNormalized = segmentValidation.normalized;
        const path = params.parentPath ? `${params.parentPath}${PathUtils.SEPARATOR}${nameNormalized}` : nameNormalized;

        this.pending = true;
        this.status = this.getLabel('saving', 'Saving');
        this.render();

        const res = await bookmarksClient.foldersCreate({ path });
        this.pending = false;

        if (!res.ok) {
            this.status = '';
            this.render();
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
        this.render();
        return { ok: true, path, note };
    }

    private renderModalLayer(): void {
        if (!this.hostHandle) return;
        const layer = this.hostHandle.modalRoot;
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
        panel.setAttribute('aria-label', this.getLabel('newFolder', 'New Folder'));

        const head = document.createElement('div');
        head.className = 'modal-head';
        const title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = this.getLabel('newFolder', 'New Folder');
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'icon-btn';
        close.setAttribute('aria-label', this.getLabel('btnClose', 'Close'));
        close.appendChild(createIcon(xIcon));
        close.addEventListener('click', () => {
            this.rootFolderModal = null;
            this.renderModalLayer();
        });
        head.append(title, close);

        const body = document.createElement('div');
        body.className = 'modal-body';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input';
        input.value = this.rootFolderModal.value;
        input.placeholder = this.getLabel('enterFolderName', 'New folder');
        input.setAttribute('data-role', 'root_folder_input');
        input.addEventListener('input', () => {
            if (!this.rootFolderModal) return;
            this.rootFolderModal.value = input.value;
            this.rootFolderModal.error = '';
            this.rootFolderModal.note = '';
            this.renderModalLayer();
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

        const error = document.createElement('div');
        error.className = 'error-text';
        error.textContent = this.rootFolderModal.error || '';
        error.style.display = this.rootFolderModal.error ? 'block' : 'none';

        const hint = document.createElement('div');
        hint.className = 'help-text';
        hint.textContent = this.rootFolderModal.note || '';
        hint.style.display = this.rootFolderModal.note ? 'block' : 'none';
        body.append(input, error, hint);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary-btn';
        cancel.textContent = this.getLabel('btnCancel', 'Cancel');
        cancel.addEventListener('click', () => {
            this.rootFolderModal = null;
            this.renderModalLayer();
        });

        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'secondary-btn secondary-btn--primary';
        save.textContent = this.getLabel('btnSave', 'Save');

        const confirm = async () => {
            if (!this.rootFolderModal || this.pending) return;
            const res = await this.createFolderOnBackend({ parentPath: null, rawName: this.rootFolderModal.value });
            if (!res.ok) {
                this.rootFolderModal.error = res.message;
                this.rootFolderModal.note = '';
                this.renderModalLayer();
                return;
            }

            if (this.state) this.state = reduceDraft(this.state, { type: 'setSelectedFolderPath', path: res.path });
            this.rootFolderModal = null;
            this.render();
        };

        save.addEventListener('click', () => void confirm());
        actions.append(cancel, save);

        panel.append(head, body, actions);
        overlay.appendChild(panel);
        layer.appendChild(overlay);
        window.setTimeout(() => input.focus(), 0);
    }

    private async submit(): Promise<void> {
        if (!this.state || this.pending) return;
        const validation = validateDraft(this.state);
        if (!validation.canSubmit) {
            this.render();
            return;
        }

        const folderPath = this.state.selectedFolderPath!;
        const title = this.state.title.trim();
        void bookmarksClient.uiStateSetLastSelectedFolderPath(folderPath);
        this.close({ ok: true, title, folderPath });
    }

    private renderNode(node: any): string {
        const expanded = node.isExpanded ? '1' : '0';
        const selected = node.isSelected ? '1' : '0';
        const hasChildren = Boolean(node.children?.length);
        const inlineState = this.subfolderInline?.parentPath === node.path ? this.subfolderInline : null;
        const inlineEditor = inlineState
            ? `
          <div class="inline-editor" style="padding-left:calc(10px + ${Math.max(0, node.depth)} * 22px);">
                <input class="text-input text-input--inline" type="text" data-role="bookmark-save-inline-draft" data-parent="${escapeHtml(node.path)}" value="${escapeHtml(inlineState.value)}" placeholder="${escapeHtml(this.getLabel('enterFolderName', 'New subfolder'))}" />
                <button class="icon-btn" data-action="bookmark-save-inline-confirm" data-path="${escapeHtml(node.path)}" aria-label="${escapeHtml(this.getLabel('btnSave', 'Save'))}">${iconMarkup(checkIcon)}</button>
                <button class="icon-btn" data-action="bookmark-save-inline-cancel" aria-label="${escapeHtml(this.getLabel('btnCancel', 'Cancel'))}">${iconMarkup(xIcon)}</button>
              </div>
              ${inlineState.error ? `<div class="error-text error-text--inline">${escapeHtml(inlineState.error)}</div>` : inlineState.note ? `<div class="help-text help-text--inline">${escapeHtml(inlineState.note)}</div>` : ''}
            `
            : '';

        return `
<div class="picker-node">
  <div class="picker-row" data-path="${escapeHtml(node.path)}" data-selected="${selected}" style="padding-left:calc(10px + ${Math.max(0, node.depth - 1)} * 22px);">
    <button class="tree-caret" data-action="bookmark-save-toggle-folder" data-path="${escapeHtml(node.path)}" ${hasChildren ? '' : 'disabled'}>
      ${hasChildren ? iconMarkup(node.isExpanded ? chevronDownIcon : chevronRightIcon) : ''}
    </button>
    <button class="picker-main" data-action="bookmark-save-select-folder" data-path="${escapeHtml(node.path)}">
      <span class="tree-folder-icon">${iconMarkup(node.isExpanded ? folderOpenIcon : folderIcon)}</span>
      <span class="tree-label">${escapeHtml(node.name)}</span>
    </button>
    <button class="icon-btn" data-action="bookmark-save-inline-folder" data-path="${escapeHtml(node.path)}" aria-label="${escapeHtml(this.getLabel('createSubfolder', 'Create subfolder'))}">${iconMarkup(folderPlusIcon)}</button>
    <span class="picker-check">${node.isSelected ? iconMarkup(checkIcon) : ''}</span>
  </div>
  ${inlineEditor}
  <div class="tree-children" data-expanded="${expanded}">
    ${(node.children || []).map((child: any) => this.renderNode(child)).join('')}
  </div>
</div>`;
    }

    private getHtml(): string {
        const isFolderSelect = this.state?.mode === 'folder-select';
        const title = isFolderSelect ? this.getLabel('labelFolder', 'Select Folder') : this.getLabel('saveBookmarkTitle', 'Save Bookmark');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        const titleLabel = this.getLabel('labelTitle', 'Title');
        const folderLabel = this.getLabel('labelFolder', 'Folder');
        const cancelLabel = this.getLabel('btnCancel', 'Cancel');
        const saveLabel = isFolderSelect ? this.getLabel('btnConfirm', 'Confirm') : this.getLabel('btnSave', 'Save');
        const createFolderLabel = this.getLabel('newFolder', 'Create root folder');
        const titlePlaceholder = this.getLabel('enterBookmarkTitle', 'Enter bookmark title');

        const validation = this.state ? validateDraft(this.state) : { canSubmit: false, titleError: null };
        const vm = this.state
            ? buildFolderPickerVm({
                  folders: this.folders as any,
                  expandedPaths: this.state.expandedPaths,
                  selectedPath: this.state.selectedFolderPath,
              })
            : { nodes: [] };

        return `
<div class="panel-window panel-window--dialog panel-window--bookmark-save" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="dialog-body dialog-body--bookmark-save">
    ${isFolderSelect ? '' : `<div class="field-block">
      <label class="field-label">${escapeHtml(titleLabel)}</label>
      <input class="text-input text-input--bookmark-save-title" type="text" data-role="bookmark-save-title" value="${escapeHtml(this.state?.title ?? '')}" placeholder="${escapeHtml(titlePlaceholder)}" aria-invalid="${validation.titleError ? 'true' : 'false'}" />
      ${validation.titleError ? `<div class="error-text">${escapeHtml(titleValidationMessage(validation.titleError as any))}</div>` : ''}
    </div>`}
    <div class="field-block">
      <div class="field-head">
        <label class="field-label">${escapeHtml(folderLabel)}</label>
        <button class="icon-btn" data-action="bookmark-save-new-root-folder" aria-label="${escapeHtml(createFolderLabel)}">${iconMarkup(folderPlusIcon)}</button>
      </div>
      <div class="picker-tree">
        ${vm.nodes.length === 0 ? `<div class="help-text">${escapeHtml(this.status || this.getLabel('noFoldersYet', 'No folders yet'))}</div>` : vm.nodes.map((node: any) => this.renderNode(node)).join('')}
      </div>
    </div>
  </div>
  <div class="panel-footer panel-footer--bookmark-save">
    <div class="button-row">
      <button class="secondary-btn" data-action="close-panel">${escapeHtml(cancelLabel)}</button>
      <button class="secondary-btn secondary-btn--primary" data-action="bookmark-save-submit" ${this.pending || !validation.canSubmit ? 'disabled' : ''}>${escapeHtml(saveLabel)}</button>
    </div>
  </div>
</div>`;
    }

    private getCss(): string {
        return `${getTokenCss(this.theme)}\n${getBookmarkSaveDialogCss(this.theme)}`;
    }

    private getLabel(key: string, fallback: string): string {
        const translated = t(key);
        if (!translated || translated === key) return fallback;
        return translated;
    }
}

function iconMarkup(svg: string): string {
    return createIcon(svg).outerHTML;
}

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}
