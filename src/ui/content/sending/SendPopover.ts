import type { Theme } from '../../../core/types/theme';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import type {
    CommentTemplateSegment,
    ReaderCommentPrompt,
    ReaderCommentPromptPosition,
    ReaderCommentSortMode,
} from '../../../core/settings/readerCommentExport';
import { DEFAULT_READER_COMMENT_SORT_MODE } from '../../../core/settings/readerCommentExport';
import { createIcon } from '../components/Icon';
import { messageSquarePlusIcon, sendIcon, xIcon } from '../../../assets/icons';
import { subscribeLocaleChange, t, type UiLocale } from '../components/i18n';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { getSendPopoverCss } from './ui/styles/sendPopoverCss';
import { buildCommentsExport, resolveReaderCommentExportPrompts } from '../../../services/reader/commentExport';
import { CommentPromptPickerPopover } from '../components/CommentPromptPickerPopover';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import {
    getDefaultSurfaceMotionProfile,
    SurfaceSession,
    type ResponsiveProfile,
} from '../components/SurfaceRuntime';

type State = {
    sendPort: SendPort | null;
    open: boolean;
    anchor: HTMLElement | null;
    width: number;
    height: number;
};

type CommentInsertContext = {
    listReaderPrompts: () => Promise<ReaderCommentPrompt[]> | ReaderCommentPrompt[];
    template: CommentTemplateSegment[];
    promptPosition: ReaderCommentPromptPosition;
    sortMode?: ReaderCommentSortMode;
    comments: ReaderCommentRecord[];
};

type ResizeState = {
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    shadow: ShadowRoot;
};

export type SendPortResult = { ok: true; message?: string } | { ok: false; message?: string };

export type SendPort = {
    readDraft?: () => string | Promise<string>;
    writeDraft?: (text: string) => void | Promise<void>;
    beforeSubmit?: () => void;
    submit: (text: string) => Promise<SendPortResult>;
};

export type SendPopoverPromptAutocompleteController = {
    attachExternalComposer: (input: HTMLTextAreaElement) => () => void;
};

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 260;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;
const MAX_WIDTH = 680;
const MAX_HEIGHT = 520;
const SEND_POPOVER_RESPONSIVE_PROFILE: ResponsiveProfile = {
    viewportGutterPx: 16,
    maxWidthCss: 'min(680px, calc(100vw - var(--aimd-space-4)))',
    maxHeightCss: 'calc(100vh - var(--aimd-space-4) * 2)',
    collision: 'flip-clamp',
    scrollOwner: 'content',
    narrowFallback: 'compact',
};
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class SendPopover {
    private state: State = {
        sendPort: null,
        open: false,
        anchor: null,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
    };
    private popoverEl: HTMLElement | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private surfaceSession: SurfaceSession<AppearanceSnapshot, UiLocale | null> | null = null;
    private pending = false;
    private resizeState: ResizeState | null = null;
    private onWindowMouseMove: ((event: MouseEvent) => void) | null = null;
    private onWindowMouseUp: ((event: MouseEvent) => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private readonly promptPicker = new CommentPromptPickerPopover();
    private promptAutocompleteController: SendPopoverPromptAutocompleteController | null = null;
    private detachPromptAutocomplete: (() => void) | null = null;

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        if (!this.surfaceSession?.setAppearance(snapshot)) {
            this.applyTheme();
        }
    }

    setPromptAutocompleteController(controller: SendPopoverPromptAutocompleteController | null): void {
        this.promptAutocompleteController = controller;
        if (!this.state.open || !this.popoverEl) return;
        this.attachPromptAutocomplete(this.popoverEl.querySelector<HTMLTextAreaElement>('[data-role="text"]'));
    }

    isOpen(): boolean {
        return this.state.open;
    }

    toggle(params: {
        shadow: ShadowRoot;
        anchor: HTMLElement;
        sendPort: SendPort;
        theme: Theme;
        initialText?: string;
        commentInsert?: CommentInsertContext | null;
    }): void {
        if (this.state.open) {
            this.close(params.shadow, { syncBack: true });
            return;
        }
        this.open(params);
    }

    open(params: { shadow: ShadowRoot; anchor: HTMLElement; sendPort: SendPort; theme: Theme; initialText?: string; commentInsert?: CommentInsertContext | null }): void {
        this.ensureStyles(params.shadow);

        this.state.sendPort = params.sendPort;
        this.setAppearance(createAppearanceSnapshot(params.theme, this.appearance.overrides));
        this.state.open = true;
        this.state.anchor = params.anchor;

        this.surfaceSession?.destroy();
        const session = new SurfaceSession<AppearanceSnapshot, UiLocale | null>({
            profile: 'anchored',
            responsiveProfile: SEND_POPOVER_RESPONSIVE_PROFILE,
            motionProfile: getDefaultSurfaceMotionProfile('anchored'),
            appearance: {
                currentValue: this.appearance,
                equals: areAppearanceSnapshotsEqual,
                apply: (snapshot) => {
                    this.appearance = snapshot;
                    this.applyTheme();
                },
            },
            locale: {
                currentValue: null,
                apply: () => this.refreshLocalizedCopy(),
            },
        });
        this.surfaceSession = session;
        session.captureFocus();
        const resetAnchorPosition = this.ensureAnchorPositioning(params.anchor);
        session.syncPositioner({
            update: () => undefined,
            destroy: () => resetAnchorPosition?.(),
        });

        const pop = document.createElement('div');
        pop.className = 'send-popover';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'false');
        pop.setAttribute('aria-label', t('send'));
        pop.setAttribute('aria-busy', 'false');
        pop.dataset.surfaceProfile = session.profile;
        this.applySize(pop, this.getClampedSize(params.shadow, this.state.width, this.state.height));
        pop.innerHTML = `
  <div class="send-popover__head">
    <strong>${escapeHtml(t('send'))}</strong>
    <div class="send-popover__head-actions">
      ${params.commentInsert !== undefined
        ? `<button class="icon-btn" type="button" data-action="insert-comments" aria-label="${escapeHtml(t('readerCommentInsertIntoSend'))}" ${this.canInsertPromptContent(params.commentInsert) ? '' : 'disabled'}>${createIcon(messageSquarePlusIcon).outerHTML}</button>`
        : ''}
      <button class="icon-btn" type="button" data-action="close" aria-label="${escapeHtml(t('btnClose'))}">${createIcon(xIcon).outerHTML}</button>
    </div>
  </div>
  <button class="send-popover__resize-handle" type="button" data-action="resize" aria-label="${escapeHtml(t('resizeSendPopover'))}">
    <span class="send-popover__resize-grip" aria-hidden="true"></span>
  </button>
  <textarea class="send-popover__input aimd-field-control aimd-field-control--standalone" data-role="text" rows="5" placeholder="${escapeHtml(t('typeYourMessage'))}"></textarea>
  <div class="send-popover__foot">
    <div class="status-line" data-role="status" data-tone="muted" role="status" aria-live="polite"></div>
    <div class="button-row">
      <button class="studio-btn studio-btn--ghost" type="button" data-action="cancel" aria-label="${escapeHtml(t('btnCancel'))}">${escapeHtml(t('btnCancel'))}</button>
      <button class="studio-btn studio-btn--primary" type="button" data-action="send" aria-label="${escapeHtml(t('send'))}">${createIcon(sendIcon).outerHTML}<span>${escapeHtml(t('send'))}</span></button>
    </div>
  </div>
`;

        params.anchor.appendChild(pop);
        this.popoverEl = pop;
        session.open({ surface: pop });

        const textarea = pop.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (textarea) {
            this.hydrateDraftText(pop, textarea, params.initialText);
            this.installDraftEventBoundary(textarea);
            this.attachPromptAutocomplete(textarea);
        }
        session.scheduleInitialFocus({
            surface: pop,
            selectors: ['[data-role="text"]', '[data-action="send"]', '[data-action="close"]'],
        });

        const resizeHandle = pop.querySelector<HTMLButtonElement>('[data-action="resize"]');
        if (resizeHandle) resizeHandle.dataset.ready = '1';

        pop.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close(params.shadow, { syncBack: true }));
        pop.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => this.close(params.shadow, { syncBack: true }));
        pop.querySelector<HTMLButtonElement>('[data-action="send"]')?.addEventListener('click', () => void this.submit(params.shadow));
        pop.querySelector<HTMLButtonElement>('[data-action="resize"]')?.addEventListener('mousedown', (event) => this.startResize(event, params.shadow));
        pop.querySelector<HTMLButtonElement>('[data-action="insert-comments"]')?.addEventListener('click', () => {
            const context = params.commentInsert;
            if (!this.canInsertPromptContent(context)) return;
            const button = pop.querySelector<HTMLElement>('[data-action="insert-comments"]');
            const textarea = pop.querySelector<HTMLTextAreaElement>('[data-role="text"]');
            if (!button || !textarea) return;
            void this.listReaderPrompts(context).then((prompts) => {
                if (!this.state.open || this.popoverEl !== pop) return;
                this.promptPicker.open({
                    shadow: params.shadow,
                    container: this.getPopoverSurface(params.shadow, params.anchor),
                    anchorEl: button,
                    theme: this.appearance.theme,
                    prompts,
                    labels: {
                        title: t('readerCommentPromptPickerTitle'),
                        close: t('btnClose'),
                        empty: t('readerCommentPromptPickerEmpty'),
                    },
                    onSelect: (promptId) => {
                        const compiled = this.buildInsertablePromptContent(context, prompts, promptId);
                        if (!compiled.trim()) return;
                        this.insertIntoTextarea(textarea, compiled);
                    },
                });
            });
        });

        pop.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close(params.shadow, { syncBack: true });
                return;
            }
            event.stopPropagation();
        });

        session.syncOutsideDismiss({
            eventTarget: document,
            roots: () => [this.popoverEl, this.state.anchor],
            onDismiss: () => this.close(params.shadow, { syncBack: true }),
        });

        if (!this.unsubscribeLocale) {
            this.unsubscribeLocale = subscribeLocaleChange((locale) => {
                if (!this.state.open || !this.popoverEl) return;
                this.surfaceSession?.setLocale(locale);
            });
        }

        this.applyTheme();
    }

    private hydrateDraftText(popover: HTMLElement, textarea: HTMLTextAreaElement, initialText?: string): void {
        if (initialText !== undefined) {
            textarea.value = initialText;
            return;
        }

        const draft = this.state.sendPort?.readDraft?.() ?? '';
        if (typeof (draft as Promise<string>).then !== 'function') {
            textarea.value = String(draft);
            return;
        }

        void (draft as Promise<string>).then((text) => {
            if (!this.state.open || this.popoverEl !== popover) return;
            if (textarea.value.length > 0) return;
            textarea.value = text;
        }).catch(() => {
            // Draft hydration is best-effort; submit still uses the textarea value.
        });
    }

    close(shadow: ShadowRoot, opts?: { syncBack?: boolean }): void {
        const sendPort = this.state.sendPort;
        const text = this.popoverEl?.querySelector<HTMLTextAreaElement>('[data-role="text"]')?.value ?? '';

        if (opts?.syncBack && sendPort?.writeDraft) {
            void sendPort.writeDraft(text);
        }

        this.stopResize();
        this.popoverEl?.remove();
        this.popoverEl = null;
        this.pending = false;
        this.state.open = false;
        this.state.anchor = null;
        this.state.sendPort = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.promptPicker.close(shadow);
        this.detachPromptAutocomplete?.();
        this.detachPromptAutocomplete = null;
        this.surfaceSession?.restoreFocus(shadow);
        this.surfaceSession?.destroy();
        this.surfaceSession = null;
    }

    private ensureStyles(shadow: ShadowRoot): void {
        if (shadow.querySelector('style[data-aimd-send-popover-style]')) return;
        const style = document.createElement('style');
        style.dataset.aimdSendPopoverStyle = '1';
        style.textContent = getSendPopoverCss();
        shadow.appendChild(style);
    }

    private ensureAnchorPositioning(anchor: HTMLElement): (() => void) | null {
        const currentPosition = window.getComputedStyle(anchor).position;
        if (currentPosition !== 'static') return null;
        const previousInline = anchor.style.position;
        anchor.style.position = 'relative';
        return () => {
            anchor.style.position = previousInline;
        };
    }

    private applyTheme(): void {
        if (!this.popoverEl) return;
        this.popoverEl.setAttribute('data-aimd-theme', this.appearance.theme);
    }

    private installDraftEventBoundary(textarea: HTMLTextAreaElement): void {
        installInputEventBoundary(textarea);
    }

    private attachPromptAutocomplete(textarea: HTMLTextAreaElement | null): void {
        this.detachPromptAutocomplete?.();
        this.detachPromptAutocomplete = null;
        if (!textarea || !this.promptAutocompleteController) return;
        this.detachPromptAutocomplete = this.promptAutocompleteController.attachExternalComposer(textarea);
    }

    private setStatus(text: string, tone: 'muted' | 'error' = 'muted'): void {
        const el = this.popoverEl?.querySelector<HTMLElement>('[data-role="status"]');
        if (!el) return;
        el.textContent = text;
        el.dataset.tone = tone;
    }

    private setPending(pending: boolean): void {
        this.pending = pending;
        this.popoverEl?.setAttribute('aria-busy', pending ? 'true' : 'false');
        const btn = this.popoverEl?.querySelector<HTMLButtonElement>('[data-action="send"]');
        if (btn) btn.disabled = pending;
    }

    private refreshLocalizedCopy(): void {
        if (!this.popoverEl) return;
        this.popoverEl.setAttribute('aria-label', t('send'));
        const title = this.popoverEl.querySelector<HTMLElement>('.send-popover__head strong');
        if (title) title.textContent = t('send');
        const close = this.popoverEl.querySelector<HTMLButtonElement>('[data-action="close"]');
        if (close) close.setAttribute('aria-label', t('btnClose'));
        const insertComments = this.popoverEl.querySelector<HTMLButtonElement>('[data-action="insert-comments"]');
        if (insertComments) insertComments.setAttribute('aria-label', t('readerCommentInsertIntoSend'));
        const resize = this.popoverEl.querySelector<HTMLButtonElement>('[data-action="resize"]');
        if (resize) resize.setAttribute('aria-label', t('resizeSendPopover'));
        const textarea = this.popoverEl.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (textarea) textarea.setAttribute('placeholder', t('typeYourMessage'));
        const cancel = this.popoverEl.querySelector<HTMLButtonElement>('[data-action="cancel"]');
        if (cancel) {
            cancel.setAttribute('aria-label', t('btnCancel'));
            cancel.textContent = t('btnCancel');
        }
        const send = this.popoverEl.querySelector<HTMLButtonElement>('[data-action="send"]');
        if (send) {
            send.setAttribute('aria-label', t('send'));
            const text = send.querySelector('span');
            if (text) text.textContent = t('send');
        }
    }

    private canInsertPromptContent(context: CommentInsertContext | null | undefined): context is CommentInsertContext {
        return Boolean(context);
    }

    private async listReaderPrompts(context: CommentInsertContext): Promise<ReaderCommentPrompt[]> {
        try {
            const prompts = await context.listReaderPrompts();
            return Array.isArray(prompts)
                ? prompts.map((prompt) => ({ ...prompt }))
                : [];
        } catch {
            return [];
        }
    }

    private buildInsertablePromptContent(context: CommentInsertContext, prompts: ReaderCommentPrompt[], promptId?: string | null): string {
        const resolved = resolveReaderCommentExportPrompts({
            prompts,
            template: context.template,
            promptPosition: context.promptPosition,
            sortMode: context.sortMode ?? DEFAULT_READER_COMMENT_SORT_MODE,
        }, promptId);

        if (context.comments.length < 1) {
            return resolved.userPrompt.trim();
        }

        return buildCommentsExport(context.comments, resolved);
    }

    private insertIntoTextarea(textarea: HTMLTextAreaElement, text: string): void {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
        const needsTrailingBreak = after.length > 0 && !after.startsWith('\n');
        const insertion = `${needsLeadingBreak ? '\n' : ''}${text}${needsTrailingBreak ? '\n' : ''}`;
        const nextValue = `${before}${insertion}${after}`;
        const nextCaret = before.length + insertion.length;
        textarea.value = nextValue;
        textarea.setSelectionRange(nextCaret, nextCaret);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    private startResize(event: MouseEvent, shadow: ShadowRoot): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.popoverEl) return;

        this.stopResize();
        const rect = this.popoverEl.getBoundingClientRect();
        const currentWidth = rect.width > 0 ? rect.width : Number.parseFloat(this.popoverEl.style.width) || this.state.width;
        const currentHeight = rect.height > 0 ? rect.height : Number.parseFloat(this.popoverEl.style.height) || this.state.height;

        this.resizeState = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: currentWidth,
            startHeight: currentHeight,
            shadow,
        };

        this.onWindowMouseMove = (moveEvent: MouseEvent) => this.handleResize(moveEvent);
        this.onWindowMouseUp = () => this.stopResize();
        window.addEventListener('mousemove', this.onWindowMouseMove);
        window.addEventListener('mouseup', this.onWindowMouseUp);
    }

    private handleResize(event: MouseEvent): void {
        if (!this.resizeState || !this.popoverEl) return;

        const dx = event.clientX - this.resizeState.startX;
        const dy = event.clientY - this.resizeState.startY;
        const nextWidth = this.resizeState.startWidth + dx;
        const nextHeight = this.resizeState.startHeight - dy;
        this.applySize(this.popoverEl, this.getClampedSize(this.resizeState.shadow, nextWidth, nextHeight));
    }

    private stopResize(): void {
        if (this.onWindowMouseMove) {
            window.removeEventListener('mousemove', this.onWindowMouseMove);
            this.onWindowMouseMove = null;
        }
        if (this.onWindowMouseUp) {
            window.removeEventListener('mouseup', this.onWindowMouseUp);
            this.onWindowMouseUp = null;
        }
        this.resizeState = null;
    }

    private getClampedSize(shadow: ShadowRoot, width: number, height: number): { width: number; height: number } {
        const surface = this.getPopoverSurface(shadow);
        const rect = surface?.getBoundingClientRect();
        const surfaceWidth = rect?.width && rect.width > 0
            ? rect.width
            : Number.parseFloat(surface?.style.width || '') || window.innerWidth;
        const surfaceHeight = rect?.height && rect.height > 0
            ? rect.height
            : Number.parseFloat(surface?.style.height || '') || window.innerHeight;
        const horizontalGutter = SEND_POPOVER_RESPONSIVE_PROFILE.viewportGutterPx * 2;
        const effectiveMinWidth = Math.min(MIN_WIDTH, Math.max(240, surfaceWidth - horizontalGutter));
        const effectiveMinHeight = Math.min(MIN_HEIGHT, Math.max(160, surfaceHeight - horizontalGutter));
        const maxWidth = Math.max(effectiveMinWidth, Math.min(MAX_WIDTH, surfaceWidth - horizontalGutter));
        const maxHeight = Math.max(effectiveMinHeight, Math.min(MAX_HEIGHT, surfaceHeight - horizontalGutter));

        return {
            width: Math.max(effectiveMinWidth, Math.min(maxWidth, Math.round(width))),
            height: Math.max(effectiveMinHeight, Math.min(maxHeight, Math.round(height))),
        };
    }

    private getPopoverSurface(shadow: ShadowRoot, fallback?: HTMLElement | null): HTMLElement {
        return shadow.querySelector<HTMLElement>('.panel-window--reader, .panel-window')
            ?? fallback
            ?? shadow.host as HTMLElement;
    }

    private applySize(popover: HTMLElement, next: { width: number; height: number }): void {
        this.state.width = next.width;
        this.state.height = next.height;
        popover.style.width = `${next.width}px`;
        popover.style.height = `${next.height}px`;
    }

    private async submit(shadow: ShadowRoot): Promise<void> {
        if (this.pending) return;
        const sendPort = this.state.sendPort;
        if (!sendPort) return;
        const textarea = this.popoverEl?.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (!textarea) return;

        const text = textarea.value;
        if (text.length === 0) {
            this.setStatus(t('sendEmpty'));
            window.setTimeout(() => this.setStatus(''), 1200);
            return;
        }

        this.setPending(true);
        this.setStatus(t('sendingStatus'));
        try {
            sendPort.beforeSubmit?.();
            const res = await sendPort.submit(text);
            if (!res.ok) {
                this.setStatus(res.message || t('sendFailed'), 'error');
                return;
            }
            this.setStatus(t('sentStatus'));
            window.setTimeout(() => this.close(shadow, { syncBack: false }), 120);
        } finally {
            window.setTimeout(() => this.setStatus(''), 1200);
            this.setPending(false);
        }
    }
}
