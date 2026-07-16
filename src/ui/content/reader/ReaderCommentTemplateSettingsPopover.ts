import { fileCodeIcon, messageSquareTextIcon, messageSquareTextIcon as commentTokenIcon } from '../../../assets/icons';
import type { CommentTemplateSegment, CommentTemplateTokenKey } from '../../../core/settings/readerCommentExport';
import { createIcon } from '../components/Icon';
import { getDefaultSurfaceMotionProfile, SurfaceSession } from '../components/SurfaceRuntime';
import { ReaderCommentTemplateEditor } from './ReaderCommentTemplateEditor';
import { createReaderSettingsDialogShell } from './ReaderSettingsDialogShell';

type OpenParams = {
    parent: HTMLElement;
    opener?: HTMLElement;
    template: CommentTemplateSegment[];
    preview: string;
    labels: {
        title: string;
        close: string;
        template: string;
        templateHint: string;
        templatePlaceholder: string;
        insertPlaceholder: string;
        insertSelectedSource: string;
        insertUserComment: string;
        tokenSelectedSource: string;
        tokenUserComment: string;
        preview: string;
        restoreDefault: string;
        save: string;
        cancel: string;
        copied: string;
    };
    onBuildPreview: (template: CommentTemplateSegment[]) => string;
    onSave: (template: CommentTemplateSegment[]) => void;
    onRestoreDefault: () => CommentTemplateSegment[];
    onClose?: () => void;
};

export class ReaderCommentTemplateSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private session: SurfaceSession | null = null;
    private editor: ReaderCommentTemplateEditor | null = null;
    private placeholderMenuOpen = false;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        if (!this.rootEl) return;
        this.rootEl.remove();
        this.rootEl = null;
        this.session?.restoreFocus(document);
        this.session?.destroy();
        this.session = null;
        this.editor = null;
        this.placeholderMenuOpen = false;
    }

    open(params: OpenParams): void {
        this.close();
        const shell = createReaderSettingsDialogShell({
            parent: params.parent,
            title: params.labels.title,
            closeLabel: params.labels.close,
            panelClassNames: ['reader-settings-popover--template'],
        });
        const popover = shell.panel;
        const title = shell.title;
        title.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'reader-settings-dialog__title-icon';
        icon.appendChild(createIcon(messageSquareTextIcon));
        const text = document.createElement('span');
        text.textContent = params.labels.title;
        title.append(icon, text);

        shell.closeButton.addEventListener('click', () => {
            this.close();
            params.onClose?.();
        });
        this.rootEl = shell.layer;

        shell.body.innerHTML = `
          <div class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.template}</span>
            <div class="reader-settings-template__toolbar">
              <div class="reader-settings-template__menu-shell">
                <button class="secondary-btn secondary-btn--compact reader-settings-template__tool" type="button" data-action="toggle-placeholder-menu" aria-haspopup="menu" aria-expanded="false">${params.labels.insertPlaceholder}</button>
                <div class="reader-settings-template__menu" data-role="placeholder-menu" data-open="0" role="menu">
                  <button class="reader-settings-template__menu-item" type="button" data-action="insert-selected-source" role="menuitem">
                    ${createIcon(fileCodeIcon).outerHTML}
                    <span>${params.labels.insertSelectedSource}</span>
                  </button>
                  <button class="reader-settings-template__menu-item" type="button" data-action="insert-user-comment" role="menuitem">
                    ${createIcon(commentTokenIcon).outerHTML}
                    <span>${params.labels.insertUserComment}</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="reader-settings-template__editor" data-role="commentTemplate" tabindex="0"></div>
            <p class="reader-settings-template__hint">${params.labels.templateHint}</p>
          </div>
          <div class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.preview}</span>
            <pre class="reader-settings-template__preview" data-role="preview"></pre>
          </div>
        `;
        shell.footer.innerHTML = `
          <button class="secondary-btn secondary-btn--compact" type="button" data-action="restore-default-template">${params.labels.restoreDefault}</button>
          <button class="secondary-btn" type="button" data-action="cancel">${params.labels.cancel}</button>
          <button class="secondary-btn secondary-btn--primary" type="button" data-action="save">${params.labels.save}</button>
        `;

        const editorRoot = popover.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        const placeholderMenu = popover.querySelector<HTMLElement>('[data-role="placeholder-menu"]')!;
        const placeholderToggle = popover.querySelector<HTMLButtonElement>('[data-action="toggle-placeholder-menu"]')!;
        preview.textContent = params.preview;
        const close = () => {
            this.close();
            params.onClose?.();
        };
        const session = new SurfaceSession({
            profile: 'panel',
            responsiveProfile: {
                viewportGutterPx: 16,
                maxWidthCss: 'min(920px, calc(100% - (var(--aimd-space-4) * 2)))',
                maxHeightCss: 'calc(100% - (var(--aimd-space-4) * 2))',
                collision: 'clamp',
                scrollOwner: 'content',
                narrowFallback: 'fullscreen',
            },
            motionProfile: getDefaultSurfaceMotionProfile('panel'),
        });
        this.session = session;
        session.captureFocus(params.opener);
        session.syncEscapeScope({
            root: popover,
            trapTabWithin: popover,
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            onEscape: close,
        });
        this.editor = new ReaderCommentTemplateEditor({
            root: editorRoot,
            value: params.template,
            labels: {
                selected_source: params.labels.tokenSelectedSource,
                user_comment: params.labels.tokenUserComment,
            },
            placeholder: params.labels.templatePlaceholder,
            onChange: (nextTemplate) => {
                preview.textContent = params.onBuildPreview(nextTemplate);
            },
        });

        const insertToken = (key: CommentTemplateTokenKey) => this.editor?.insertToken(key);
        const setPlaceholderMenuOpen = (open: boolean) => {
            this.placeholderMenuOpen = open;
            placeholderMenu.dataset.open = open ? '1' : '0';
            placeholderToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        const bindInsertButton = (selector: string, key: CommentTemplateTokenKey) => {
            const button = popover.querySelector<HTMLButtonElement>(selector);
            button?.addEventListener('pointerdown', (event) => {
                this.editor?.rememberSelection();
                event.preventDefault();
                event.stopPropagation();
            });
            button?.addEventListener('click', () => {
                insertToken(key);
                setPlaceholderMenuOpen(false);
            });
        };
        placeholderToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.editor?.rememberSelection();
            setPlaceholderMenuOpen(!this.placeholderMenuOpen);
        });
        popover.addEventListener('pointerdown', (event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (placeholderMenu.contains(target) || placeholderToggle.contains(target)) return;
            setPlaceholderMenuOpen(false);
        });
        bindInsertButton('[data-action="insert-selected-source"]', 'selected_source');
        bindInsertButton('[data-action="insert-user-comment"]', 'user_comment');

        popover.querySelector<HTMLButtonElement>('[data-action="restore-default-template"]')?.addEventListener('click', () => {
            const restored = params.onRestoreDefault();
            this.editor?.update(restored);
            preview.textContent = params.onBuildPreview(restored);
            editorRoot.focus({ preventScroll: true } as FocusOptions);
        });
        popover.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', close);
        popover.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => {
            params.onSave(this.editor?.getValue() ?? params.template);
            close();
        });
        session.scheduleInitialFocus({ surface: popover, selectors: ['[data-role="commentTemplate"]'] });
    }
}
