import { messageSquareTextIcon, xIcon } from '../../../assets/workspaceIcons';
import { minusIcon, maximizeIcon, minimizeIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';
import type { AppearanceSnapshot } from '../../../style/appearance';
import {
    getDefaultSurfaceMotionProfile,
    SurfaceSession,
} from '../components/SurfaceRuntime';
import { getAnchoredMotionCss } from '../components/styles/anchoredMotionCss';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import { getAnnotationActionButtonCss } from '../pageAnnotations/annotationActionButtonCss';

const editorMessages = {
    minimize: ['readerCommentMinimize', 'Minimize'], expand: ['readerCommentExpand', 'Expand'], restore: ['readerCommentRestore', 'Restore'],
    discardDraft: ['readerCommentDiscardDraft', 'Discard edits'], drag: ['readerCommentDrag', 'Move annotation window'],
    saving: ['readerCommentSaving', 'Saving annotation…'],
    saveFailed: ['readerCommentSaveFailed', 'Annotation not saved. Your text is kept here; try again.'],
    discardConfirm: ['readerCommentDiscardConfirm', 'Discard these unsaved edits?'],
    deleteConfirm: ['readerCommentDeleteConfirm', 'Delete this annotation?'], keepWriting: ['readerCommentKeepWriting', 'Keep writing'],
    more: ['libraryMore', 'More'],
} as const;
export function getAnnotationEditorLabels(getLabel: (key: string, fallback: string) => string): Record<keyof typeof editorMessages, string> {
    return Object.fromEntries(Object.entries(editorMessages).map(([name, [key, fallback]]) => [name, getLabel(key, fallback)])) as Record<keyof typeof editorMessages, string>;
}
type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    appearance: AppearanceSnapshot;
    selectedSource: string;
    anchorRect: {
        left: number;
        top: number;
        width: number;
        height: number;
        right: number;
        bottom: number;
    };
    initialText?: string;
    mode: 'create' | 'edit';
    labels?: Partial<Record<keyof typeof editorMessages, string>> & {
        addTitle?: string;
        editTitle?: string;
        close?: string;
        selectedSource?: string;
        placeholder?: string;
        cancel?: string;
        delete?: string;
        save?: string;
        saveShortcut?: string;
    };
    onSave: (value: string) => void | Promise<void>;
    onCancel?: () => void;
    onDelete?: () => void | Promise<void>;
};

type ActiveCommentSurface = {
    layer: HTMLElement;
    popover: HTMLElement;
    session: SurfaceSession<AppearanceSnapshot>;
    onCancel?: () => void;
    input: HTMLTextAreaElement;
    resumeKeyboard?: () => void;
};

function getCommentPopoverCss(): string {
    return `
${getAnchoredMotionCss()}
${getFlatWorkflowCss()}
.reader-comment-popover-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reader-comment-popover {
  --_reader-comment-arrow-size: var(--aimd-space-3);
  pointer-events: auto;
  position: absolute;
  width: min(420px, calc(100% - (var(--aimd-space-4) * 2)));
  max-height: calc(100% - (var(--aimd-space-4) * 2));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0;
  padding: 0;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid var(--aimd-workspace-border);
  background: var(--aimd-workspace-card);
  box-shadow: var(--aimd-shadow-workspace);
  color: var(--aimd-text-primary);
  z-index: var(--aimd-z-tooltip);
  overflow: hidden;
}

.reader-comment-popover::after {
  display: none;
}

.reader-comment-popover__head,
.reader-comment-popover__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4) var(--aimd-space-5);
}

.reader-comment-popover__head {
  flex-wrap: wrap;
  border-bottom: 1px solid var(--aimd-border-subtle);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.reader-comment-popover__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  margin: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-normal);
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
}

.reader-comment-popover__title .aimd-icon {
  color: var(--aimd-text-secondary);
}

.reader-comment-popover__title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-comment-popover__tools {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-1);
  flex: none;
  order: 2;
}

.reader-comment-popover__options {
  min-width: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  order: 1;
}

.reader-comment-popover__options[open] {
  flex-basis: 100%;
  order: 3;
}

.reader-comment-popover__options > summary {
  cursor: pointer;
  padding: var(--aimd-space-2);
}

.reader-comment-popover__option-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--aimd-space-2);
  padding-top: var(--aimd-space-2);
}

.reader-comment-popover__selection {
  padding: 0;
}

.reader-comment-popover__selection > summary {
  cursor: pointer;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
}

.reader-comment-popover__selection-excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: var(--aimd-space-2);
  font-size: var(--aimd-text-sm);
  overflow-wrap: anywhere;
}

.reader-comment-popover__selection[open] .reader-comment-popover__selection-excerpt {
  display: none;
}

.reader-comment-popover__body {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-5);
  overflow: auto;
  overscroll-behavior: contain;
}

.reader-comment-popover__selection-label {
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-secondary);
}

.reader-comment-popover__selection-value {
  margin: var(--aimd-space-3) 0 0;
  padding: 0 0 0 var(--aimd-space-3);
  border: 0;
  border-left: 2px solid var(--aimd-border-default);
  background: transparent;
  box-shadow: none;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-height: 0;
  max-height: calc(var(--aimd-size-control-action-panel) * 3);
  overflow: auto;
}

.reader-comment-popover__input {
  width: 100%;
  min-height: calc(var(--aimd-size-control-action-panel) * 5);
  resize: none;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-workspace-border);
  background: var(--aimd-bg-primary);
  box-shadow: none;
  color: var(--aimd-text-primary);
  font: inherit;
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.reader-comment-popover__input:focus-visible {
  outline: none;
  border-color: var(--aimd-interactive-primary);
  box-shadow: var(--aimd-shadow-focus);
}

.reader-comment-popover__actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  border-top: 1px solid var(--aimd-border-subtle);
}

.reader-comment-popover__btn {
  min-width: 0;
  padding-inline: var(--aimd-space-4);
}

.reader-comment-popover__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reader-comment-popover__shortcut {
  flex-basis: 100%;
  text-align: right;
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
  white-space: nowrap;
  user-select: none;
}

@media (max-width: 560px) {
  .reader-comment-popover {
    width: calc(100% - (var(--aimd-space-2) * 2));
    max-height: calc(100% - (var(--aimd-space-2) * 2));
    gap: 0;
  }

  .reader-comment-popover__head,
  .reader-comment-popover__body,
  .reader-comment-popover__actions {
    padding: var(--aimd-space-3);
  }

  .reader-comment-popover__btn {
    min-width: 0;
    flex: 1 1 0;
  }
}

@media (max-height: 568px) {
  .reader-comment-popover__selection-value {
    min-height: var(--aimd-size-control-action-panel);
    max-height: calc(var(--aimd-size-control-action-panel) * 2);
  }

  .reader-comment-popover__input {
    min-height: calc(var(--aimd-size-control-action-panel) * 2);
  }
}
${getAnnotationActionButtonCss()}
.reader-comment-popover__status { flex:1 1 100%; margin:0; font-size:var(--aimd-text-xs); line-height:var(--aimd-leading-normal); color:var(--aimd-text-secondary); overflow-wrap:anywhere; }
.reader-comment-popover__status:empty { display:none; }
.reader-comment-popover__btn { min-width:0; }
.reader-comment-popover__confirmation { display:flex; align-items:center; gap:var(--aimd-space-2); flex-wrap:wrap; font-size:var(--aimd-text-sm); }
.reader-comment-popover [hidden] { display:none; }
.reader-comment-popover[data-minimized="true"] .reader-comment-popover__body,
.reader-comment-popover[data-minimized="true"] .reader-comment-popover__actions { display:none; }
.reader-comment-popover[data-minimized="true"] { grid-template-rows:auto; }
.reader-comment-popover[data-minimized="true"] .reader-comment-popover__head { border-bottom:0; }
.reader-comment-popover[data-expanded="true"] .reader-comment-popover__body { grid-template-rows:auto minmax(0,1fr); }
.reader-comment-popover[data-expanded="true"] .reader-comment-popover__input { height:100%; }
`;
}

export class ReaderCommentPopover {
    private active: ActiveCommentSurface | null = null;
    private readonly closing = new Set<ActiveCommentSurface>();
    private composing = false;

    setAppearance(snapshot: AppearanceSnapshot): void {
        this.active?.session.setAppearance(snapshot);
    }

    isOpen(): boolean {
        return Boolean(this.active);
    }

    preserveForRender(): (container: HTMLElement) => void {
        const active = this.active;
        if (!active) return () => undefined;
        const root = active.popover.getRootNode() as ShadowRoot;
        const focused = active.popover.contains(root.activeElement);
        active.layer.remove();
        return container => {
            if (this.active !== active) return;
            container.append(active.layer);
            active.resumeKeyboard?.();
            active.session.position();
            if (focused) active.input.focus({ preventScroll: true });
        };
    }

    open(params: OpenParams): void {
        this.teardownCurrent(false);
        this.teardownClosing();
        this.composing = false;
        const appearance = params.appearance;
        ensureStyle(params.shadow, getCommentPopoverCss(), { id: 'aimd-reader-comment-popover-style', cache: 'shared' });
        const labels = {
            ...getAnnotationEditorLabels((_key, fallback) => fallback),
            ...params.labels,
            addTitle: params.labels?.addTitle ?? 'Add annotation',
            editTitle: params.labels?.editTitle ?? 'Edit annotation',
            close: params.labels?.close ?? 'Close',
            selectedSource: params.labels?.selectedSource ?? 'Selected content',
            placeholder: params.labels?.placeholder ?? 'Write your annotation...',
            cancel: params.labels?.cancel ?? 'Cancel',
            delete: params.labels?.delete ?? 'Delete',
            save: params.labels?.save ?? 'Save annotation',
            saveShortcut: params.labels?.saveShortcut ?? 'Ctrl/Cmd + Enter to save',
        };

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-popover-layer';

        const popover = document.createElement('div');
        popover.className = 'reader-comment-popover flat-workflow';
        popover.dataset.aimdSurfaceProfile = 'anchored';
        popover.dataset.aimdRole = 'reader-comment-popover';
        popover.setAttribute('data-aimd-theme', appearance.theme);
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-modal', 'false');
        popover.setAttribute('aria-label', params.mode === 'edit' ? labels.editTitle : labels.addTitle);
        popover.innerHTML = `
          <div class="reader-comment-popover__head">
            <h3 class="reader-comment-popover__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${params.mode === 'edit' ? labels.editTitle : labels.addTitle}</span></h3>
            <details class="reader-comment-popover__options">
              <summary>${labels.more}</summary>
              <div class="reader-comment-popover__option-actions">
                <button class="secondary-btn reader-comment-popover__btn" type="button" data-action="minimize" aria-label="${labels.minimize}">${createIcon(minusIcon).outerHTML}<span>${labels.minimize}</span></button>
                <button class="secondary-btn reader-comment-popover__btn" type="button" data-action="expand" aria-label="${labels.expand}">${createIcon(maximizeIcon).outerHTML}<span>${labels.expand}</span></button>
                <button class="secondary-btn reader-comment-popover__btn" type="button" data-action="discard">${labels.discardDraft}</button>
                ${params.mode === 'edit' ? `<button class="secondary-btn reader-comment-popover__btn" type="button" data-action="delete">${labels.delete}</button>` : ''}
                <span class="reader-comment-popover__shortcut" aria-hidden="true">${labels.saveShortcut}</span>
              </div>
            </details>
            <div class="reader-comment-popover__tools">
            <button class="icon-btn reader-comment-popover__close annotation-action-button" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
            </div>
          </div>
          <div class="reader-comment-popover__body flat-workflow__body">
            <details class="reader-comment-popover__selection">
              <summary><span class="reader-comment-popover__selection-label">${labels.selectedSource}</span><span class="reader-comment-popover__selection-excerpt" data-role="source-excerpt"></span></summary>
              <pre class="reader-comment-popover__selection-value" data-role="selected-source"></pre>
            </details>
            <div class="reader-comment-popover__editor flat-workflow__field">
              <textarea class="reader-comment-popover__input flat-workflow__input" data-role="input" placeholder="${labels.placeholder}"></textarea>
            </div>
          </div>
          <div class="reader-comment-popover__actions">
            <p class="reader-comment-popover__status" data-role="save-status" role="status" aria-live="polite"></p>
            <div class="reader-comment-popover__confirmation" data-role="confirmation" hidden></div>
            <button class="secondary-btn secondary-btn--primary reader-comment-popover__btn" type="button" data-action="save">${labels.save}</button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        const session = new SurfaceSession<AppearanceSnapshot>({
            profile: 'anchored',
            responsiveProfile: {
                viewportGutterPx: 16,
                maxWidthCss: 'min(380px, calc(100% - (var(--aimd-space-4) * 2)))',
                maxHeightCss: 'calc(100% - (var(--aimd-space-4) * 2))',
                collision: 'flip-clamp',
                scrollOwner: 'content',
                narrowFallback: 'compact',
            },
            motionProfile: getDefaultSurfaceMotionProfile('anchored'),
            appearance: {
                currentValue: appearance,
                apply: (snapshot) => popover.setAttribute('data-aimd-theme', snapshot.theme),
            },
        });
        session.captureFocus();
        let moved: { left: number; top: number } | undefined;
        const reposition = () => this.positionPopover(popover, params.container, params.anchorRect, moved);
        const onViewportChange = () => session.position();
        popover.querySelectorAll('details').forEach((details) => details.addEventListener('toggle', onViewportChange));
        window.addEventListener('resize', onViewportChange);
        window.visualViewport?.addEventListener('resize', onViewportChange);
        window.visualViewport?.addEventListener('scroll', onViewportChange);
        session.syncPositioner({
            update: reposition,
            destroy: () => {
                window.removeEventListener('resize', onViewportChange);
                window.visualViewport?.removeEventListener('resize', onViewportChange);
                window.visualViewport?.removeEventListener('scroll', onViewportChange);
            },
        });

        const textarea = popover.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        if (!textarea) return;
        const selectedSource = popover.querySelector<HTMLElement>('[data-role="selected-source"]');
        if (selectedSource) selectedSource.textContent = params.selectedSource;
        const sourceExcerpt = popover.querySelector<HTMLElement>('[data-role="source-excerpt"]');
        if (sourceExcerpt) {
            const characters = Array.from(params.selectedSource.replace(/\s+/g, ' ').trim());
            sourceExcerpt.textContent = characters.length > 140 ? `${characters.slice(0, 140).join('')}…` : characters.join('');
        }
        if (textarea) {
            textarea.value = params.initialText ?? '';
            textarea.setAttribute('aria-label', labels.placeholder);
            installInputEventBoundary(textarea);
            textarea.addEventListener('compositionstart', () => {
                this.composing = true;
            });
            textarea.addEventListener('compositionend', () => {
                this.composing = false;
            });
        }

        const status = popover.querySelector<HTMLElement>('[data-role="save-status"]')!;
        this.active = { layer, popover, session, onCancel: params.onCancel, input: textarea };
        const cancelAndClose = () => {
            if (saving) return;
            params.onCancel?.();
            this.close(params.shadow, false);
        };
        const resumeKeyboard = () => session.syncEscapeScope({
            root: popover,
            maintainFocus: false,
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            onEscape: () => { void cancelAndClose(); },
        });
        this.active.resumeKeyboard = resumeKeyboard;
        resumeKeyboard();
        session.open({ surface: popover });
        session.scheduleInitialFocus({ surface: popover, selectors: ['[data-role="input"]'] });

        let saving = false;
        const saveCurrentValue = async () => {
            const value = textarea?.value.trim() ?? '';
            if (!value || saving) return;
            saving = true;
            const submitted = textarea.value;
            textarea.disabled = true;
            status.textContent = labels.saving;
            const save = popover.querySelector<HTMLButtonElement>('[data-action="save"]');
            if (save) save.disabled = true;
            try {
                await params.onSave(value);
                if (this.active?.popover === popover && textarea.value === submitted) this.close(params.shadow, false);
            } catch {
                if (save) save.disabled = false;
                status.textContent = labels.saveFailed;
            } finally {
                saving = false;
                textarea.disabled = false;
            }
        };

        const syncSaveState = () => {
            const save = popover.querySelector<HTMLButtonElement>('[data-action="save"]');
            if (save) save.disabled = saving || !(textarea?.value.trim());
        };

        textarea?.addEventListener('input', syncSaveState);
        syncSaveState();

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            void cancelAndClose();
        });
        const confirmAction = (deleting: boolean) => {
            const confirmation = popover.querySelector<HTMLElement>('[data-role="confirmation"]')!;
            confirmation.replaceChildren(); confirmation.hidden = false;
            const prompt = document.createElement('span'); prompt.textContent = deleting ? labels.deleteConfirm : labels.discardConfirm;
            const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'secondary-btn'; accept.textContent = deleting ? labels.delete : labels.discardDraft;
            accept.dataset.action = deleting ? 'confirm-delete' : 'confirm-discard';
            const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'secondary-btn'; keep.textContent = labels.keepWriting;
            confirmation.append(prompt, keep, accept);
            keep.addEventListener('click', () => { confirmation.hidden = true; textarea.focus(); });
            accept.addEventListener('click', async () => {
                if (saving) return;
                saving = true;
                textarea.disabled = true;
                const mutationButtons = popover.querySelectorAll<HTMLButtonElement>('[data-action="save"], [data-action="discard"], [data-action="delete"], [data-action="close"]');
                mutationButtons.forEach(button => { button.disabled = true; });
                accept.disabled = true;
                try {
                    if (deleting) await params.onDelete?.();
                    textarea.value = '';
                    if (!deleting) params.onCancel?.();
                    if (this.active?.popover === popover) this.close(params.shadow, false);
                } catch { /* The owner reports mutation failures; keep the input for retry. */ }
                finally {
                    saving = false; textarea.disabled = false; accept.disabled = false;
                    mutationButtons.forEach(button => { button.disabled = false; }); syncSaveState();
                }
            });
            keep.focus();
        };
        popover.querySelector('[data-action="discard"]')?.addEventListener('click', () => confirmAction(false));
        popover.querySelector('[data-action="delete"]')?.addEventListener('click', () => confirmAction(true));
        popover.querySelector<HTMLButtonElement>('[data-action="minimize"]')?.addEventListener('click', event => {
            const minimized = popover.dataset.minimized !== 'true';
            popover.dataset.minimized = String(minimized);
            const button = event.currentTarget as HTMLButtonElement;
            button.setAttribute('aria-label', minimized ? labels.restore : labels.minimize);
            button.setAttribute('aria-expanded', String(!minimized));
            button.replaceChildren(createIcon(minusIcon), document.createTextNode(minimized ? labels.restore : labels.minimize));
            reposition();
        });
        popover.querySelector<HTMLButtonElement>('[data-action="expand"]')?.addEventListener('click', event => {
            const expanded = popover.dataset.expanded !== 'true'; popover.dataset.expanded = String(expanded); popover.dataset.minimized = 'false';
            const button = event.currentTarget as HTMLButtonElement;
            button.setAttribute('aria-label', expanded ? labels.restore : labels.expand);
            button.replaceChildren(createIcon(expanded ? minimizeIcon : maximizeIcon), document.createTextNode(expanded ? labels.restore : labels.expand));
            reposition();
        });
        const header = popover.querySelector<HTMLElement>('.reader-comment-popover__head')!;
        header.setAttribute('title', labels.drag);
        header.tabIndex = 0;
        header.setAttribute('aria-label', labels.drag);
        header.addEventListener('keydown', event => {
            if (event.target !== header || popover.dataset.expanded === 'true') return;
            const delta = this.readPxVar(popover, '--aimd-space-4', 16);
            const directions: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault(); event.stopPropagation();
            moved = { left: (Number.parseFloat(popover.style.left) || 0) + direction[0], top: (Number.parseFloat(popover.style.top) || 0) + direction[1] };
            reposition();
        });
        header.addEventListener('pointerdown', event => {
            if (event.button !== 0 || (event.target as Element).closest('button, details') || popover.dataset.expanded === 'true') return;
            event.preventDefault();
            const origin = { left: Number.parseFloat(popover.style.left) || 0, top: Number.parseFloat(popover.style.top) || 0, x: event.clientX, y: event.clientY };
            header.setPointerCapture?.(event.pointerId);
            const move = (next: PointerEvent) => { moved = { left: origin.left + next.clientX - origin.x, top: origin.top + next.clientY - origin.y }; reposition(); };
            const stop = () => { header.removeEventListener('pointermove', move); header.removeEventListener('pointerup', stop); header.removeEventListener('pointercancel', stop); };
            header.addEventListener('pointermove', move); header.addEventListener('pointerup', stop); header.addEventListener('pointercancel', stop);
        });

        popover.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => {
            void saveCurrentValue();
        });

        textarea?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                if (event.isComposing || this.composing) return;
                event.preventDefault();
                void cancelAndClose();
                return;
            }
            if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.isComposing &&
                !this.composing
            ) {
                event.preventDefault();
                event.stopPropagation();
                void saveCurrentValue();
            }
        });
    }

    close(shadow: ShadowRoot, callCancel: boolean): void {
        void shadow;
        this.composing = false;
        const active = this.active;
        if (!active) return;
        this.active = null;
        this.closing.add(active);
        if (callCancel) active.onCancel?.();
        active.session.clearEscapeScope();
        active.session.clearOutsideDismiss();
        active.session.clearPositioner();
        const finalize = () => {
            this.closing.delete(active);
            active.layer.remove();
            active.session.restoreFocus(document);
            active.session.destroy();
        };
        if (!active.session.close({ surface: active.popover, onClosed: finalize })) finalize();
    }

    destroy(): void {
        this.composing = false;
        this.teardownCurrent(false);
        this.teardownClosing();
    }

    private teardownCurrent(restoreFocus: boolean): void {
        const active = this.active;
        if (!active) return;
        this.active = null;
        active.session.clearEscapeScope();
        active.session.clearOutsideDismiss();
        active.session.clearPositioner();
        active.layer.remove();
        if (restoreFocus) active.session.restoreFocus(document);
        active.session.destroy();
    }

    private teardownClosing(): void {
        for (const active of this.closing) {
            active.session.cancelClose();
            active.layer.remove();
            active.session.destroy();
        }
        this.closing.clear();
    }

    private positionPopover(
        popover: HTMLElement,
        container: HTMLElement,
        anchorRect: OpenParams['anchorRect'],
        moved?: { left: number; top: number },
    ): void {
        const containerRect = container.getBoundingClientRect();
        const viewport = window.visualViewport;
        const gutter = this.readPxVar(popover, '--aimd-space-4', 16);
        const minLeft = Math.max(gutter, (viewport?.offsetLeft ?? 0) - containerRect.left + gutter);
        const minTop = Math.max(gutter, (viewport?.offsetTop ?? 0) - containerRect.top + gutter);
        const right = Math.min(containerRect.width || window.innerWidth, (viewport?.width ?? window.innerWidth) + (viewport?.offsetLeft ?? 0) - containerRect.left) - gutter;
        const bottom = Math.min(containerRect.height || window.innerHeight, (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0) - containerRect.top) - gutter;
        const expanded = popover.dataset.expanded === 'true';
        popover.style.width = expanded ? `${Math.max(0, right - minLeft)}px` : '';
        popover.style.height = expanded && popover.dataset.minimized !== 'true' ? `${Math.max(0, bottom - minTop)}px` : '';
        popover.style.maxWidth = `${Math.max(0, right - minLeft)}px`;
        popover.style.maxHeight = `${Math.max(0, bottom - minTop)}px`;
        const popoverRect = popover.getBoundingClientRect();
        const width = popoverRect.width > 0 ? popoverRect.width : 380;
        const height = popoverRect.height > 0 ? popoverRect.height : 220;
        const edgeInset = this.readPxVar(popover, '--aimd-space-4', 16);
        const gap = this.readPxVar(popover, '--aimd-space-3', 12);

        const anchorCenter = anchorRect.left - containerRect.left + (anchorRect.width / 2);
        const unclampedLeft = anchorCenter - (width / 2);
        const left = Math.max(minLeft, Math.min(expanded ? minLeft : moved?.left ?? unclampedLeft, Math.max(minLeft, right - width)));

        let side: 'top' | 'bottom' = 'top';
        let top = anchorRect.top - containerRect.top - height - gap;
        if (top < edgeInset) {
            side = 'bottom';
            top = anchorRect.bottom - containerRect.top + gap;
        }
        top = Math.max(minTop, Math.min(expanded ? minTop : moved?.top ?? top, Math.max(minTop, bottom - height)));

        const arrowInset = this.readPxVar(popover, '--aimd-space-4', 16) + this.readPxVar(popover, '--aimd-space-2', 8);
        const arrowLeft = Math.max(arrowInset, Math.min(anchorCenter - left, Math.max(arrowInset, width - arrowInset)));

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.dataset.side = side;
        popover.style.setProperty('--_reader-comment-arrow-left', `${arrowLeft}px`);
    }

    private readPxVar(element: HTMLElement, name: string, fallback: number): number {
        const value = window.getComputedStyle(element).getPropertyValue(name).trim();
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
}
