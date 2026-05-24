import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import {
    copyIcon,
    messageSquareTextIcon,
    pinIcon,
} from '../../../assets/icons';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { formatReaderUserPromptDisplay, type ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import type { AppSettings } from '../../../core/settings/types';
import { renderMarkdownForReader, type ReaderAtomicUnit, type ReaderOutlineItem } from '../../../services/renderer/renderMarkdown';
import {
    annotateRenderedAtomicUnits,
    applyRenderedAtomicSelection,
    clearRenderedAtomicSelection,
    resolveReaderSelectionRange,
    resolveSelectedAtomicUnits,
    type SelectedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import { buildAtomicSelectionExport } from '../../../services/reader/atomicExport';
import {
    createReaderCommentRecord,
    resolveReaderCommentAnchor,
    resolveSelectionLayout,
    type ReaderCommentRect,
} from '../../../services/reader/commentAnchoring';
import {
    buildCommentsExport,
    createDefaultReaderCommentExportSettings,
    normalizeReaderCommentExportSettings,
    resolveReaderCommentExportPrompts,
    type ReaderCommentExportSettings,
} from '../../../services/reader/commentExport';
import { listReaderComments, removeReaderComment, saveReaderComment, type ReaderCommentRecord } from '../../../services/reader/commentSession';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { createIcon } from '../components/Icon';
import { subscribeLocaleChange, t } from '../components/i18n';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { ensureBackdropElement, ensureStableElementFromHtml } from '../components/stableSurface';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { TooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import { OverlaySession } from '../overlay/OverlaySession';
import type { UserThemeOverrides } from '../../../style/tokens';
import { ReaderCommentPopover } from './ReaderCommentPopover';
import { ReaderCommentExportPopover } from './ReaderCommentExportPopover';
import { ensureShadowStylesheetLink, getReaderPanelCss, getReaderPanelHtml } from './readerPanelTemplate';
import { decorateReaderCodeBlocksHtml } from './readerCodeBlockEnhancer';
import { CommentPromptPickerPopover } from '../components/CommentPromptPickerPopover';
import { showChangelogNoticeIfNeeded } from '../changelog/ChangelogNoticePresenter';

export type ReaderPanelActionContext = {
    item: ReaderItem;
    index: number;
    items: ReaderItem[];
    anchorEl?: HTMLElement;
    shadow?: ShadowRoot;
    notify: (text: string, timeoutMs?: number) => void;
    rerender: () => void;
};

export type ReaderPanelAction = {
    id: string;
    label: string;
    icon?: string;
    tooltip?: string;
    kind?: 'default' | 'primary' | 'danger';
    placement?: 'header' | 'footer_left';
    toggle?: boolean;
    rerenderOnClick?: boolean;
    isActive?: (ctx: ReaderPanelActionContext) => boolean;
    onClick: (ctx: ReaderPanelActionContext) => void | Promise<void>;
};

export type ReaderPanelProfile = 'conversation-reader' | 'bookmark-preview';

export type ReaderPanelShowOptions = {
    profile?: ReaderPanelProfile;
    onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    actions?: ReaderPanelAction[];
};

type ReaderPanelState = {
    theme: Theme;
    items: ReaderItem[];
    index: number;
    visible: boolean;
    fullscreen: boolean;
    renderedHtml: string;
    renderedMarkdownSource: string;
    renderedAtomicUnits: ReaderAtomicUnit[];
    outlineItems: ReaderOutlineItem[];
    activeOutlineId: string;
    showOutlineInReader: boolean;
    selectedAtomicUnitIds: string[];
    selectionSourceText: string;
    selectionExport: string;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    contentMaxWidthPx: number;
    stickyOpen: boolean;
    stickyWidthPx: number;
    stickyBlocks: ReaderStickyBlock[];
    options: {
        profile: ReaderPanelProfile;
        showNav: boolean;
        showCopy: boolean;
        showOpenConversation: boolean;
        dotStyle: 'meta' | 'plain';
        actions: ReaderPanelAction[];
        onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    };
};

type ReaderStickyBlock = {
    id: string;
    sourceMarkdown: string;
    renderedHtml: string;
    createdAt: number;
};

type ReaderCommentSelectionSnapshot = {
    range: Range;
    selectedUnits: SelectedAtomicUnit[];
    selectedText: string;
    sourceMarkdown: string;
};

const READER_COMMENT_SCOPE_ID = 'reader-panel-comments-v1';
const STICKY_WIDTH_DEFAULT_PX = 320;
const STICKY_WIDTH_MIN_PX = 240;
const STICKY_WIDTH_FALLBACK_MAX_PX = 460;
const STICKY_WIDTH_MAX_RATIO = 2 / 3;

export class ReaderPanel {
    private overlaySession: OverlaySession | null = null;
    private readonly commentPopover = new ReaderCommentPopover();
    private readonly commentExportPopover = new ReaderCommentExportPopover();
    private readonly commentPromptPicker = new CommentPromptPickerPopover();
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private contentRenderToken = 0;
    private statusTimer: number | null = null;
    private renderCodeInReader = true;
    private themeOverrides: UserThemeOverrides = {};
    private closing = false;
    private motionNeedsOpen = false;
    private onSelectionChange: (() => void) | null = null;
    private onPointerUp: (() => void) | null = null;
    private onSurfacePointerDown: ((event: PointerEvent) => void) | null = null;
    private onSurfaceDragStart: ((event: DragEvent) => void) | null = null;
    private onSurfaceDragOver: ((event: DragEvent) => void) | null = null;
    private onSurfaceDrop: ((event: DragEvent) => void) | null = null;
    private onSurfaceDragEnd: ((event: DragEvent) => void) | null = null;
    private onShadowCopy: EventListener | null = null;
    private readerBodyEl: HTMLElement | null = null;
    private onReaderBodyScroll: (() => void) | null = null;
    private outlineScrollFrame: number | null = null;
    private renderedAtomicElements: SelectedAtomicUnit[] = [];
    private commentSelectionSnapshot: ReaderCommentSelectionSnapshot | null = null;
    private activeCommentId: string | null = null;
    private stickyDragBlockId: string | null = null;
    private stickyResizeCleanup: (() => void) | null = null;
    private stickyDragCleanup: (() => void) | null = null;
    private commentExportSettings: ReaderCommentExportSettings = createDefaultReaderCommentExportSettings();
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        fullscreen: false,
        renderedHtml: '',
        renderedMarkdownSource: '',
        renderedAtomicUnits: [],
        outlineItems: [],
        activeOutlineId: '',
        showOutlineInReader: true,
        selectedAtomicUnitIds: [],
        selectionSourceText: '',
        selectionExport: '',
        userPromptDisplay: formatReaderUserPromptDisplay(''),
        statusText: '',
        contentMaxWidthPx: 1000,
        stickyOpen: false,
        stickyWidthPx: STICKY_WIDTH_DEFAULT_PX,
        stickyBlocks: [],
        options: {
            profile: 'conversation-reader',
            showNav: true,
            showCopy: true,
            showOpenConversation: false,
            dotStyle: 'meta',
            actions: [],
        },
    };

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.overlaySession?.setTheme(theme);
        this.render();
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.overlaySession?.setThemeOverrides(this.themeOverrides);
        if (this.state.visible) this.render();
    }

    isVisible(): boolean {
        return this.state.visible;
    }

    isShowingConversationReader(): boolean {
        return this.state.visible && this.state.options.profile === 'conversation-reader';
    }

    getItemsSnapshot(): ReaderItem[] {
        return [...this.state.items];
    }

    setRenderCodeInReader(enabled: boolean): void {
        if (this.renderCodeInReader === enabled) return;
        this.renderCodeInReader = enabled;
        if (this.state.visible) {
            void this.renderCurrentContent();
        }
    }

    setCommentExportSettings(settings: AppSettings['reader']['commentExport']): void {
        this.commentExportSettings = normalizeReaderCommentExportSettings(settings);
    }

    setContentMaxWidthPx(widthPx: number): void {
        const next = Number.isFinite(widthPx) ? Math.max(1, Math.round(widthPx)) : 1000;
        if (this.state.contentMaxWidthPx === next) return;
        this.state.contentMaxWidthPx = next;
        if (this.state.visible) this.render();
    }

    setShowOutlineInReader(enabled: boolean): void {
        const next = Boolean(enabled);
        if (this.state.showOutlineInReader === next) return;
        this.state.showOutlineInReader = next;
        if (this.state.visible) this.render();
    }

    getCommentExportContext(): { comments: ReaderCommentRecord[]; prompts: ReaderCommentExportSettings['prompts']; template: ReaderCommentExportSettings['template']; promptPosition: ReaderCommentExportSettings['promptPosition'] } | null {
        const comments = this.getCurrentComments();
        return {
            comments: comments.map((record) => ({ ...record })),
            prompts: this.commentExportSettings.prompts.map((prompt) => ({ ...prompt })),
            template: this.commentExportSettings.template.map((segment) => ({ ...segment })),
            promptPosition: this.commentExportSettings.promptPosition,
        };
    }

    async show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void> {
        this.focusLifecycle.capture();
        const resolvedProfile = this.resolveProfileState(options?.profile);
        this.state.items = items;
        this.state.index = Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1)));
        this.state.theme = theme;
        this.state.visible = true;
        this.state.fullscreen = false;
        this.state.renderedHtml = '';
        this.state.renderedMarkdownSource = '';
        this.state.renderedAtomicUnits = [];
        this.state.outlineItems = [];
        this.state.activeOutlineId = '';
        this.state.selectedAtomicUnitIds = [];
        this.state.selectionSourceText = '';
        this.state.selectionExport = '';
        this.state.userPromptDisplay = formatReaderUserPromptDisplay(items[this.state.index]?.userPrompt ?? '');
        this.state.statusText = '';
        this.closing = false;
        this.motionNeedsOpen = true;
        this.state.options = {
            ...resolvedProfile,
            onOpenConversation: options?.onOpenConversation,
            actions: options?.actions ?? [],
        };

        this.mount();
        this.render(false);
        this.overlaySession?.syncKeyboardScope({
            root: this.overlaySession?.host ?? document.body,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? this.overlaySession?.host ?? undefined,
        });

        await this.renderCurrentContent();
        if (this.state.options.profile === 'conversation-reader' && this.overlaySession) {
            void showChangelogNoticeIfNeeded({
                modalHost: this.overlaySession.modalHost,
                loggerScope: 'ReaderPanel',
            });
        }
    }

    async appendItem(item: ReaderItem): Promise<void> {
        this.state.items = [...this.state.items, item];
        this.render();
    }

    hide(): void {
        if (this.closing) return;
        this.state.visible = false;
        const panel = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        const backdrop = this.overlaySession?.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay');
        if (this.overlaySession && panel) {
            this.closing = true;
            beginSurfaceMotionClose({
                shell: panel,
                backdrop,
                onClosed: () => this.unmount(),
                fallbackMs: 560,
            });
            return;
        }
        this.unmount();
    }

    notify(text: string, timeoutMs: number = 1400): void {
        this.setStatus(text);
        if (this.statusTimer) window.clearTimeout(this.statusTimer);
        this.statusTimer = window.setTimeout(() => this.setStatus(''), timeoutMs);
    }

    private mount(): void {
        if (this.overlaySession) return;

        const session = new OverlaySession({
            id: 'aimd-reader-panel-host',
            theme: this.state.theme,
            themeOverrides: this.themeOverrides,
            surfaceCss: getReaderPanelCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-reader-panel-structure',
            overlayStyleId: 'aimd-reader-panel-overlay-extra',
        });

        this.overlaySession = session;
        this.tooltipDelegate = new TooltipDelegate(session.shadow, { upgradeTitles: false });

        session.syncBackdropDismiss(() => this.hide());
        session.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));
        this.onSurfacePointerDown = (event: PointerEvent) => this.handleSurfacePointerDown(event);
        this.onSurfaceDragStart = (event: DragEvent) => this.handleSurfaceDragStart(event);
        this.onSurfaceDragOver = (event: DragEvent) => this.handleSurfaceDragOver(event);
        this.onSurfaceDrop = (event: DragEvent) => this.handleSurfaceDrop(event);
        this.onSurfaceDragEnd = () => { this.stickyDragBlockId = null; };
        session.surfaceRoot.addEventListener('pointerdown', this.onSurfacePointerDown);
        session.surfaceRoot.addEventListener('dragstart', this.onSurfaceDragStart);
        session.surfaceRoot.addEventListener('dragover', this.onSurfaceDragOver);
        session.surfaceRoot.addEventListener('drop', this.onSurfaceDrop);
        session.surfaceRoot.addEventListener('dragend', this.onSurfaceDragEnd);

        this.onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                void this.go(-1);
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                void this.go(1);
            }
        };
        session.host.addEventListener('keydown', this.onKeyDown);

        this.onSelectionChange = () => this.syncAtomicSelection();
        this.onPointerUp = () => this.syncAtomicSelection();
        this.onShadowCopy = (event: Event) => this.handleAtomicCopy(event as ClipboardEvent);
        document.addEventListener('selectionchange', this.onSelectionChange);
        document.addEventListener('pointerup', this.onPointerUp);
        session.shadow.addEventListener('copy', this.onShadowCopy, true);

        const katexUrl = this.getKatexUrl();
        if (katexUrl) ensureShadowStylesheetLink(session.shadow, katexUrl, 'aimd-reader-panel-katex');

        if (!this.unsubscribeLocale) {
            this.unsubscribeLocale = subscribeLocaleChange(() => this.render());
        }
    }

    private unmount(): void {
        if (this.overlaySession?.host && this.onKeyDown) {
            this.overlaySession.host.removeEventListener('keydown', this.onKeyDown);
        }
        this.onKeyDown = null;
        if (this.overlaySession?.surfaceRoot && this.onSurfacePointerDown) {
            this.overlaySession.surfaceRoot.removeEventListener('pointerdown', this.onSurfacePointerDown);
        }
        if (this.overlaySession?.surfaceRoot && this.onSurfaceDragStart) {
            this.overlaySession.surfaceRoot.removeEventListener('dragstart', this.onSurfaceDragStart);
        }
        if (this.overlaySession?.surfaceRoot && this.onSurfaceDragOver) {
            this.overlaySession.surfaceRoot.removeEventListener('dragover', this.onSurfaceDragOver);
        }
        if (this.overlaySession?.surfaceRoot && this.onSurfaceDrop) {
            this.overlaySession.surfaceRoot.removeEventListener('drop', this.onSurfaceDrop);
        }
        if (this.overlaySession?.surfaceRoot && this.onSurfaceDragEnd) {
            this.overlaySession.surfaceRoot.removeEventListener('dragend', this.onSurfaceDragEnd);
        }
        this.onSurfacePointerDown = null;
        this.onSurfaceDragStart = null;
        this.onSurfaceDragOver = null;
        this.onSurfaceDrop = null;
        this.onSurfaceDragEnd = null;
        this.stickyResizeCleanup?.();
        this.stickyResizeCleanup = null;
        this.stickyDragCleanup?.();
        this.stickyDragCleanup = null;
        this.stickyDragBlockId = null;
        if (this.onSelectionChange) document.removeEventListener('selectionchange', this.onSelectionChange);
        if (this.onPointerUp) document.removeEventListener('pointerup', this.onPointerUp);
        if (this.overlaySession?.shadow && this.onShadowCopy) {
            this.overlaySession.shadow.removeEventListener('copy', this.onShadowCopy, true);
        }
        this.onSelectionChange = null;
        this.onPointerUp = null;
        this.onShadowCopy = null;
        this.clearReaderBodyScrollListener();
        this.renderedAtomicElements = [];
        this.commentSelectionSnapshot = null;
        this.activeCommentId = null;
        if (this.overlaySession?.shadow) {
            this.commentPopover.close(this.overlaySession.shadow, false);
            this.commentExportPopover.close(this.overlaySession.shadow);
            this.commentPromptPicker.close(this.overlaySession.shadow);
        }

        if (this.statusTimer) {
            window.clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }

        this.contentRenderToken += 1;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.focusLifecycle.restore(document);
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.closing = false;
        this.motionNeedsOpen = false;
    }

    private async handleSurfaceClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        switch (action) {
            case 'close-panel':
                this.hide();
                return;
            case 'reader-prev':
                await this.go(-1);
                return;
            case 'reader-next':
                await this.go(1);
                return;
            case 'reader-jump': {
                const index = Number(actionEl.dataset.index ?? -1);
                if (Number.isFinite(index) && index >= 0) this.jumpTo(index);
                return;
            }
            case 'reader-outline-jump': {
                const outlineId = actionEl.dataset.outlineId ?? '';
                if (outlineId) this.jumpToOutline(outlineId);
                return;
            }
            case 'reader-copy':
                await this.copyCurrent();
                return;
            case 'reader-copy-comments':
                this.openCommentExportPopover();
                return;
            case 'reader-copy-code':
                await this.copyCodeBlock(actionEl);
                return;
            case 'reader-fullscreen':
                this.toggleFullscreen();
                return;
            case 'reader-open-conversation':
                this.openConversation();
                return;
            case 'reader-sticky-toggle':
                this.toggleStickyWorkspace();
                return;
            case 'reader-sticky-delete':
                this.deleteStickyBlock(actionEl.dataset.stickyId ?? '');
                return;
            default:
                return;
        }
    }

    private handleSurfacePointerDown(event: PointerEvent): void {
        const target = event.target as HTMLElement | null;
        const dragHandle = target?.closest<HTMLElement>('[data-action="reader-sticky-drag"]');
        if (dragHandle) {
            this.startStickyPointerDrag(event, dragHandle.dataset.stickyId ?? '');
            return;
        }

        const handle = target?.closest<HTMLElement>('[data-action="reader-sticky-resize"]');
        if (!handle || !this.overlaySession) return;
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = this.state.stickyWidthPx;
        const panel = handle.closest<HTMLElement>('.reader-sticky-panel');

        const onMove = (moveEvent: PointerEvent) => {
            const nextWidth = this.clampStickyWidth(startWidth + moveEvent.clientX - startX);
            this.state.stickyWidthPx = nextWidth;
            panel?.style.setProperty('--_reader-sticky-width', `${nextWidth}px`);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this.stickyResizeCleanup = null;
            this.render();
        };

        this.stickyResizeCleanup?.();
        this.stickyResizeCleanup = onUp;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp, { once: true });
    }

    private startStickyPointerDrag(event: PointerEvent, sourceId: string): void {
        if (!sourceId || !this.overlaySession) return;
        event.preventDefault();
        event.stopPropagation();

        this.stickyDragCleanup?.();
        this.stickyDragBlockId = sourceId;
        this.setStickyDragState(sourceId, true);

        const onMove = (moveEvent: PointerEvent) => {
            if (!this.stickyDragBlockId) return;
            moveEvent.preventDefault();
            const target = this.findStickyBlockAtPointer(moveEvent.clientY);
            const targetId = target?.dataset.stickyId ?? '';
            if (!targetId || targetId === this.stickyDragBlockId) return;
            this.reorderStickyBlock(this.stickyDragBlockId, targetId);
            this.setStickyDragState(this.stickyDragBlockId, true);
        };
        const onEnd = () => {
            const draggedId = this.stickyDragBlockId;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);
            this.stickyDragCleanup = null;
            this.stickyDragBlockId = null;
            if (draggedId) this.setStickyDragState(draggedId, false);
        };

        this.stickyDragCleanup = onEnd;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd, { once: true });
        document.addEventListener('pointercancel', onEnd, { once: true });
    }

    private findStickyBlockAtPointer(clientY: number): HTMLElement | null {
        const blocks = Array.from(this.overlaySession?.surfaceRoot.querySelectorAll<HTMLElement>('[data-role="reader-sticky-block"]') ?? []);
        return blocks.find((block) => {
            const rect = block.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        }) ?? null;
    }

    private setStickyDragState(id: string, dragging: boolean): void {
        const block = Array.from(this.overlaySession?.surfaceRoot.querySelectorAll<HTMLElement>('[data-role="reader-sticky-block"]') ?? [])
            .find((candidate) => candidate.dataset.stickyId === id);
        if (!block) return;
        if (dragging) {
            block.dataset.dragging = '1';
            return;
        }
        delete block.dataset.dragging;
    }

    private handleSurfaceDragStart(event: DragEvent): void {
        const target = event.target as HTMLElement | null;
        const handle = target?.closest<HTMLElement>('[data-action="reader-sticky-drag"]');
        if (!handle) return;
        const id = handle.dataset.stickyId ?? '';
        if (!id) return;
        this.stickyDragBlockId = id;
        event.dataTransfer?.setData('text/plain', id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }

    private handleSurfaceDragOver(event: DragEvent): void {
        if (!this.stickyDragBlockId) return;
        const target = event.target as HTMLElement | null;
        if (!target?.closest('[data-role="reader-sticky-block"]')) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    private handleSurfaceDrop(event: DragEvent): void {
        if (!this.stickyDragBlockId) return;
        const target = event.target as HTMLElement | null;
        const block = target?.closest<HTMLElement>('[data-role="reader-sticky-block"]');
        const targetId = block?.dataset.stickyId ?? '';
        const sourceId = event.dataTransfer?.getData('text/plain') || this.stickyDragBlockId;
        this.stickyDragBlockId = null;
        if (!sourceId || !targetId || sourceId === targetId) return;
        event.preventDefault();
        this.reorderStickyBlock(sourceId, targetId);
    }

    private async go(delta: number): Promise<void> {
        const next = this.state.index + delta;
        if (next < 0 || next >= this.state.items.length) return;
        this.state.index = next;
        this.state.renderedHtml = '';
        this.state.outlineItems = [];
        this.state.activeOutlineId = '';
        this.render(false);
        await this.renderCurrentContent();
    }

    private jumpTo(index: number): void {
        const next = Math.max(0, Math.min(index, this.state.items.length - 1));
        if (next === this.state.index) return;
        void this.go(next - this.state.index);
    }

    private async renderCurrentContent(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) {
            this.state.renderedHtml = '';
            this.state.renderedMarkdownSource = '';
            this.state.renderedAtomicUnits = [];
            this.state.outlineItems = [];
            this.state.activeOutlineId = '';
            this.state.selectedAtomicUnitIds = [];
            this.state.selectionSourceText = '';
            this.state.selectionExport = '';
            this.commentSelectionSnapshot = null;
            this.state.userPromptDisplay = formatReaderUserPromptDisplay('');
            this.render(false);
            return;
        }

        const token = ++this.contentRenderToken;
        this.state.userPromptDisplay = formatReaderUserPromptDisplay(item.userPrompt);
        const markdown = await resolveContent(item.content);
        if (token !== this.contentRenderToken) return;

        const rendered = renderMarkdownForReader(markdown, {
            highlightCode: this.renderCodeInReader,
        });
        this.state.renderedMarkdownSource = rendered.markdownSource;
        this.state.renderedAtomicUnits = rendered.atomicUnits;
        this.state.outlineItems = rendered.outlineItems;
        this.state.activeOutlineId = rendered.outlineItems[0]?.id ?? '';
        this.state.renderedHtml = decorateReaderCodeBlocksHtml(rendered.html, {
            copyLabel: this.getLabel('btnCopyText', 'Copy code'),
        });
        this.render(false);
        this.syncAtomicSelection();
        this.syncCommentUi();

        const body = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        if (body) body.scrollTop = 0;
        this.syncOutlineActiveState();
    }

    private async copyCurrent(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) return;

        const button = this.overlaySession?.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="reader-copy"]');
        if (!button) return;

        try {
            button.disabled = true;
            const markdown = await resolveContent(item.content);
            const ok = await copyTextToClipboard(markdown);
            showEphemeralTooltip({
                root: this.overlaySession?.shadow ?? document,
                anchor: button,
                text: ok ? t('btnCopied') : t('copyFailed'),
            });
        } finally {
            button.disabled = false;
        }
    }

    private async copyCodeBlock(button: HTMLElement): Promise<void> {
        const code = button.closest('.reader-code-block')?.querySelector<HTMLElement>('pre code');
        if (!code) return;

        const copyButton = button as HTMLButtonElement;
        try {
            copyButton.disabled = true;
            const codeText = (code.textContent ?? '').replace(/\s+$/, '');
            const ok = await copyTextToClipboard(codeText);
            showEphemeralTooltip({
                root: this.overlaySession?.shadow ?? document,
                anchor: copyButton,
                text: ok ? t('btnCopied') : t('copyFailed'),
            });
        } finally {
            copyButton.disabled = false;
        }
    }

    private openConversation(): void {
        const ctx = this.getActionContext();
        if (ctx && this.state.options.onOpenConversation) {
            void this.state.options.onOpenConversation(ctx);
            return;
        }

        const item = this.state.items[this.state.index];
        const url = item?.meta?.url?.trim();
        if (!url) {
            this.notify(this.getLabel('openConversationLabel', 'Conversation link unavailable'));
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    private setStatus(text: string): void {
        this.state.statusText = text;
        const status = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('[data-field="status"]');
        if (status) status.textContent = text;
    }

    private render(preserveScrollTop: boolean = true): void {
        if (!this.overlaySession || this.closing) return;

        const currentBody = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        const scrollTop = preserveScrollTop ? currentBody?.scrollTop ?? 0 : 0;
        this.state.stickyWidthPx = this.clampStickyWidth(this.state.stickyWidthPx);

        this.overlaySession.setSurfaceCss(getReaderPanelCss());
        const { element: backdrop, isNew: isNewBackdrop } = ensureBackdropElement(this.overlaySession.backdropRoot, 'panel-stage__overlay');
        const { element: panel, isNew: isNewPanel } = ensureStableElementFromHtml<HTMLElement>(
            this.overlaySession.surfaceRoot,
            '.panel-window--reader',
            getReaderPanelHtml({
            state: {
                items: this.state.items,
                index: this.state.index,
                fullscreen: this.state.fullscreen,
                contentMaxWidthPx: this.state.contentMaxWidthPx,
                stickyEnabled: this.isStickyAvailable(),
                stickyOpen: this.state.stickyOpen,
                stickyWidthPx: this.state.stickyWidthPx,
                stickyBlocks: this.state.stickyBlocks,
                renderedHtml: this.state.renderedHtml,
                outlineItems: this.state.outlineItems,
                activeOutlineId: this.state.activeOutlineId,
                showOutlineRail: this.state.showOutlineInReader,
                userPromptDisplay: this.state.userPromptDisplay,
                statusText: this.state.statusText,
                showCopy: this.state.options.showCopy,
                showOpenConversation: this.state.options.showOpenConversation,
            },
            canOpenConversation: this.canOpenConversation(),
            getLabel: (key, fallback, substitutions) => this.getLabel(key, fallback, substitutions),
        }),
        );
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: panel ?? this.overlaySession.host,
        });
        if (this.motionNeedsOpen && (isNewBackdrop || isNewPanel)) {
            setSurfaceMotionOpening([backdrop, panel]);
            this.focusLifecycle.scheduleInitialFocus({
                surface: panel,
                selectors: [
                    '[data-action="reader-open-conversation"]',
                    '[data-action="reader-copy"]',
                    '[data-action="reader-fullscreen"]',
                    '[data-action="close-panel"]',
                ],
            });
            this.motionNeedsOpen = false;
        }

        this.renderActions();
        this.renderDots();
        this.tooltipDelegate?.refresh(this.overlaySession.shadow);
        this.syncAtomicMarkup();
        this.syncOutlineActiveState();
        this.applyAtomicSelectionState();
        this.syncCommentUi();
        this.syncCommentControls();

        const nextBody = panel.querySelector<HTMLElement>('.reader-body');
        this.syncReaderBodyScrollListener(nextBody);
        if (nextBody && preserveScrollTop) {
            nextBody.scrollTop = scrollTop;
        }
    }

    private renderActions(): void {
        if (!this.overlaySession) return;

        const headerSlot = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('[data-role="header-custom-actions"]');
        const footerSlot = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('[data-role="footer-left-actions"]');
        if (!headerSlot || !footerSlot) return;

        headerSlot.replaceChildren();
        footerSlot.replaceChildren();

        const ctx = this.getActionContext();
        for (const action of this.state.options.actions) {
            const active = ctx ? Boolean(action.isActive?.(ctx)) : false;
            const button = document.createElement('button');
            button.type = 'button';
            if (action.icon) {
                button.className = `icon-btn ${active && action.toggle ? 'icon-btn--active' : ''} ${action.kind === 'danger' ? 'icon-btn--danger' : ''}`.trim();
                button.appendChild(createIcon(action.icon));
            } else {
                button.className = `secondary-btn secondary-btn--compact ${action.kind === 'primary' ? 'secondary-btn--primary' : ''} ${action.kind === 'danger' ? 'secondary-btn--danger' : ''}`.trim();
                button.textContent = action.label;
            }
            button.setAttribute('aria-label', action.label);
            button.dataset.tooltip = action.tooltip || action.label;
            button.dataset.active = active ? '1' : '0';
            button.addEventListener('click', async () => {
                const nextCtx = this.getActionContext();
                if (!nextCtx) return;
                try {
                    button.disabled = true;
                    await action.onClick({ ...nextCtx, anchorEl: button, shadow: this.overlaySession?.shadow || undefined });
                } finally {
                    button.disabled = false;
                    if (action.rerenderOnClick !== false) {
                        this.render();
                    }
                }
            });

            if ((action.placement || 'header') === 'footer_left') {
                footerSlot.appendChild(button);
            } else {
                headerSlot.appendChild(button);
            }
        }
    }

    private renderDots(): void {
        if (!this.overlaySession) return;

        const dots = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.reader-dots');
        if (!dots) return;

        const total = this.state.items.length;
        const activeIndex = this.state.index;
        dots.replaceChildren();

        if (!this.state.options.showNav || total <= 0) {
            const footerCenter = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.reader-footer__center');
            if (footerCenter) footerCenter.style.display = 'none';
            return;
        }

        const footerCenter = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.reader-footer__center');
        if (footerCenter) footerCenter.style.display = '';

        dots.style.setProperty('--aimd-dot-size', '10px');
        dots.style.setProperty('--aimd-dot-gap', '10px');

        const maxPageDots = 10;
        if (total <= maxPageDots) {
            for (let index = 0; index < total; index += 1) {
                dots.appendChild(this.createDot(index, index === activeIndex));
            }
            this.scrollActiveDotIntoView();
            return;
        }

        const edgeDots = 3;
        const middleDots = 4;
        const appendDotRange = (start: number, end: number) => {
            for (let index = start; index <= end; index += 1) {
                dots.appendChild(this.createDot(index, index === activeIndex));
            }
        };
        const appendGap = (leftEnd: number, rightStart: number) => {
            if (leftEnd + 1 < rightStart) dots.appendChild(this.createEllipsis());
        };
        const middleStart = Math.max(0, Math.min(activeIndex - 1, total - middleDots));
        const ranges = [
            [0, edgeDots - 1],
            [middleStart, middleStart + middleDots - 1],
            [total - edgeDots, total - 1],
        ]
            .map(([start, end]) => [Math.max(0, start), Math.min(total - 1, end)] as [number, number])
            .sort(([a], [b]) => a - b)
            .reduce<Array<[number, number]>>((merged, range) => {
                const previous = merged[merged.length - 1];
                if (previous && range[0] <= previous[1] + 1) {
                    previous[1] = Math.max(previous[1], range[1]);
                } else {
                    merged.push([...range]);
                }
                return merged;
            }, []);

        ranges.forEach(([start, end], index) => {
            if (index > 0) appendGap(ranges[index - 1][1], start);
            appendDotRange(start, end);
        });

        this.scrollActiveDotIntoView();
    }

    private createDot(index: number, active: boolean): HTMLButtonElement {
        const button = document.createElement('button');
        const item = this.state.items[index];
        const bookmarked = this.state.options.dotStyle === 'meta' && Boolean(item?.meta?.bookmarked);
        button.type = 'button';
        button.className = `reader-dot ${active ? 'reader-dot--active' : ''} ${bookmarked ? 'reader-dot--bookmarked' : ''}`.trim();
        button.dataset.action = 'reader-jump';
        button.dataset.index = String(index);
        button.dataset.tooltipTitle = String(index + 1);
        button.dataset.tooltip = item?.userPrompt || this.getLabel('goToPage', `Go to page ${index + 1}`, String(index + 1));
        button.dataset.tooltipVariant = 'preview';
        button.setAttribute('aria-label', this.getLabel('goToPage', `Go to page ${index + 1}`, String(index + 1)));
        return button;
    }

    private createEllipsis(): HTMLElement {
        const span = document.createElement('span');
        span.className = 'reader-ellipsis';
        span.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 3; index += 1) {
            const dot = document.createElement('span');
            dot.className = 'reader-ellipsis__dot';
            span.appendChild(dot);
        }
        return span;
    }

    private scrollActiveDotIntoView(): void {
        const activeDot = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.reader-dots .reader-dot--active');
        activeDot?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: 'auto' });
    }

    private toggleFullscreen(): void {
        this.state.fullscreen = !this.state.fullscreen;
        this.render();
    }

    private resolveProfileState(profile: ReaderPanelProfile | undefined): ReaderPanelState['options'] {
        if (profile === 'bookmark-preview') {
            return {
                profile,
                showNav: true,
                showCopy: true,
                showOpenConversation: true,
                dotStyle: 'plain',
                actions: [],
            };
        }

        return {
            profile: 'conversation-reader',
            showNav: true,
            showCopy: true,
            showOpenConversation: false,
            dotStyle: 'meta',
            actions: [],
        };
    }

    private getActionContext(): ReaderPanelActionContext | null {
        const item = this.state.items[this.state.index] ?? null;
        if (!item) return null;
        return {
            item,
            index: this.state.index,
            items: this.state.items,
            notify: (text, timeoutMs) => this.notify(text, timeoutMs),
            rerender: () => this.render(),
        };
    }

    private canOpenConversation(): boolean {
        if (this.state.options.onOpenConversation) return true;
        const item = this.state.items[this.state.index];
        return Boolean(item?.meta?.url?.trim());
    }

    private isStickyAvailable(): boolean {
        return this.state.options.profile === 'conversation-reader';
    }

    private clampStickyWidth(value: number): number {
        return Math.max(STICKY_WIDTH_MIN_PX, Math.min(this.getStickyWidthMaxPx(), Math.round(value)));
    }

    private getStickyWidthMaxPx(): number {
        const root = this.overlaySession?.surfaceRoot;
        const bodyWrap = root?.querySelector<HTMLElement>('.reader-body-wrap');
        const panel = root?.querySelector<HTMLElement>('.panel-window--reader');
        const layoutWidth = bodyWrap?.getBoundingClientRect().width || panel?.getBoundingClientRect().width || 0;
        if (layoutWidth > 0) {
            return Math.max(STICKY_WIDTH_MIN_PX, Math.floor(layoutWidth * STICKY_WIDTH_MAX_RATIO));
        }
        return STICKY_WIDTH_FALLBACK_MAX_PX;
    }

    private toggleStickyWorkspace(): void {
        if (!this.isStickyAvailable()) return;
        this.state.stickyOpen = !this.state.stickyOpen;
        this.render();
    }

    private addStickyBlock(sourceMarkdown: string): void {
        const trimmed = sourceMarkdown.trim();
        if (!this.isStickyAvailable() || !trimmed) return;
        const rendered = renderMarkdownForReader(trimmed, {
            softBreaks: true,
            highlightCode: this.renderCodeInReader,
        });
        this.state.stickyBlocks = [
            ...this.state.stickyBlocks,
            {
                id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                sourceMarkdown: trimmed,
                renderedHtml: rendered.html,
                createdAt: Date.now(),
            },
        ];
        this.state.stickyOpen = true;
        this.clearSelectionSnapshot();
        this.render();
    }

    private deleteStickyBlock(id: string): void {
        if (!id) return;
        this.state.stickyBlocks = this.state.stickyBlocks.filter((block) => block.id !== id);
        this.render();
    }

    private reorderStickyBlock(sourceId: string, targetId: string): void {
        const sourceIndex = this.state.stickyBlocks.findIndex((block) => block.id === sourceId);
        const targetIndex = this.state.stickyBlocks.findIndex((block) => block.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
        const next = [...this.state.stickyBlocks];
        const [block] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, block!);
        this.state.stickyBlocks = next;
        this.render();
    }

    private clearSelectionSnapshot(): void {
        this.state.selectionSourceText = '';
        this.state.selectionExport = '';
        this.state.selectedAtomicUnitIds = [];
        this.commentSelectionSnapshot = null;
        const markdownRoot = this.getMarkdownRoot();
        if (markdownRoot) clearRenderedAtomicSelection(markdownRoot);
        try {
            window.getSelection()?.removeAllRanges();
        } catch {
            // ignore host selection cleanup failures
        }
    }

    private getLabel(key: string, fallback: string, substitutions?: string | string[]): string {
        const translated = t(key, substitutions as any);
        if (!translated || translated === key) return fallback;
        return translated;
    }

    private getKatexUrl(): string {
        try {
            return browser.runtime.getURL('vendor/katex/katex.min.css');
        } catch {
            return '';
        }
    }

    private getMarkdownRoot(): HTMLElement | null {
        return this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.reader-markdown') ?? null;
    }

    private getReaderBody(): HTMLElement | null {
        return this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.reader-body') ?? null;
    }

    private syncReaderBodyScrollListener(nextBody: HTMLElement | null): void {
        if (this.readerBodyEl === nextBody) return;
        this.clearReaderBodyScrollListener();
        if (!nextBody) return;

        this.readerBodyEl = nextBody;
        this.onReaderBodyScroll = () => this.scheduleOutlineActiveSync();
        nextBody.addEventListener('scroll', this.onReaderBodyScroll, { passive: true });
    }

    private clearReaderBodyScrollListener(): void {
        if (this.readerBodyEl && this.onReaderBodyScroll) {
            this.readerBodyEl.removeEventListener('scroll', this.onReaderBodyScroll);
        }
        this.readerBodyEl = null;
        this.onReaderBodyScroll = null;
        if (this.outlineScrollFrame !== null) {
            window.cancelAnimationFrame(this.outlineScrollFrame);
            this.outlineScrollFrame = null;
        }
    }

    private scheduleOutlineActiveSync(): void {
        if (this.outlineScrollFrame !== null) return;
        this.outlineScrollFrame = window.requestAnimationFrame(() => {
            this.outlineScrollFrame = null;
            this.syncActiveOutlineFromScroll();
        });
    }

    private jumpToOutline(outlineId: string): void {
        const body = this.getReaderBody();
        const markdownRoot = this.getMarkdownRoot();
        if (!body || !markdownRoot) return;

        const target = markdownRoot.querySelector<HTMLElement>(`[data-aimd-unit-id="${outlineId}"]`);
        if (!target) return;

        const bodyRect = body.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top = Math.max(0, body.scrollTop + targetRect.top - bodyRect.top - this.getTokenSize('--aimd-space-4', 16));
        this.setActiveOutlineId(outlineId);
        if (typeof body.scrollTo === 'function') {
            body.scrollTo({ top, behavior: 'smooth' });
            return;
        }
        body.scrollTop = top;
    }

    private syncActiveOutlineFromScroll(): void {
        if (this.state.outlineItems.length < 2) return;
        const body = this.getReaderBody();
        const markdownRoot = this.getMarkdownRoot();
        if (!body || !markdownRoot) return;

        const bodyTop = body.getBoundingClientRect().top;
        const threshold = bodyTop + this.getTokenSize('--aimd-space-6', 24);
        let activeId = this.state.outlineItems[0]?.id ?? '';

        for (const item of this.state.outlineItems) {
            const heading = markdownRoot.querySelector<HTMLElement>(`[data-aimd-unit-id="${item.id}"]`);
            if (!heading) continue;
            if (heading.getBoundingClientRect().top <= threshold) {
                activeId = item.id;
                continue;
            }
            break;
        }

        this.setActiveOutlineId(activeId);
    }

    private setActiveOutlineId(outlineId: string): void {
        if (this.state.activeOutlineId === outlineId) {
            this.syncOutlineActiveState();
            return;
        }
        this.state.activeOutlineId = outlineId;
        this.syncOutlineActiveState();
    }

    private syncOutlineActiveState(): void {
        const root = this.overlaySession?.surfaceRoot;
        if (!root) return;
        root.querySelectorAll<HTMLElement>('.reader-outline-rail__item').forEach((item) => {
            item.dataset.active = item.dataset.outlineId === this.state.activeOutlineId ? '1' : '0';
        });
    }

    private getCommentOverlay(): HTMLElement | null {
        return this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('[data-role="comment-overlay"]') ?? null;
    }

    private toViewportRect(rect: ReaderCommentRect): DOMRect | null {
        const overlay = this.getCommentOverlay();
        if (!overlay) return null;
        const overlayRect = overlay.getBoundingClientRect();
        return new DOMRect(
            overlayRect.left + rect.left,
            overlayRect.top + rect.top,
            rect.width,
            rect.height,
        );
    }

    private getCurrentItem(): ReaderItem | null {
        return this.state.items[this.state.index] ?? null;
    }

    private getCurrentComments(): ReaderCommentRecord[] {
        const item = this.getCurrentItem();
        if (!item) return [];
        return listReaderComments(READER_COMMENT_SCOPE_ID, item.id);
    }

    private syncCommentControls(): void {
        const button = this.overlaySession?.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]');
        if (!button) return;
        button.disabled = this.getCurrentComments().length < 1;
    }

    private syncCommentUi(): void {
        const overlayRoot = this.getCommentOverlay();
        const markdownRoot = this.getMarkdownRoot();
        if (!overlayRoot || !markdownRoot) return;
        overlayRoot.replaceChildren();

        const comments = this.getCurrentComments();
        const occupiedAnchorTops: number[] = [];
        for (const record of comments) {
            const resolved = resolveReaderCommentAnchor(markdownRoot, record);
            const active = record.id === this.activeCommentId;
            resolved.rects.forEach((rect) => overlayRoot.appendChild(this.createCommentHighlight(rect, active)));
            if (resolved.unionRect) {
                overlayRoot.appendChild(this.createCommentAnchor(record, resolved.unionRect, resolved.rects, occupiedAnchorTops));
            }
        }

        if (this.commentPopover.isOpen() || this.commentExportPopover.isOpen() || this.commentPromptPicker.isOpen()) return;
        const selection = this.commentSelectionSnapshot;
        if (!selection) return;
        if (!selection.selectedText.trim() && selection.selectedUnits.length < 1) return;

        const resolved = resolveSelectionLayout({
            root: markdownRoot,
            range: selection.range,
            selectedUnits: selection.selectedUnits,
        });
        if (resolved.unionRect) {
            overlayRoot.appendChild(this.createCommentAction(resolved.unionRect, selection));
        }
    }

    private createCommentHighlight(rect: ReaderCommentRect, active: boolean): HTMLElement {
        const element = document.createElement('div');
        element.className = `reader-comment-highlight${active ? ' reader-comment-highlight--active' : ''}`;
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        return element;
    }

    private createCommentAction(unionRect: ReaderCommentRect, selection: ReaderCommentSelectionSnapshot): HTMLElement {
        const group = document.createElement('div');
        group.className = 'reader-comment-action';
        const overlay = this.getCommentOverlay();
        const buttonSize = this.getTokenSize('--aimd-size-control-icon-panel', 32);
        const gap = this.getTokenSize('--aimd-space-2', 8);
        const showStickyAction = this.isStickyAvailable();
        const actionCount = showStickyAction ? 3 : 2;
        const actionWidth = (buttonSize * actionCount) + (gap * (actionCount - 1));
        const clampPadding = this.getTokenSize('--aimd-space-3', 12);
        const verticalGap = this.getTokenSize('--aimd-space-2', 8);
        const left = Math.max(0, Math.min(
            Math.max(0, (overlay?.clientWidth ?? 0) - actionWidth - clampPadding),
            unionRect.left + unionRect.width / 2 - actionWidth / 2,
        ));
        const preferredTop = unionRect.top - buttonSize - verticalGap;
        const fallbackTop = unionRect.top + unionRect.height + verticalGap;
        const top = preferredTop >= -(buttonSize + verticalGap) ? preferredTop : fallbackTop;

        group.style.left = `${left}px`;
        group.style.top = `${top}px`;
        this.installTransientButtonBoundary(group);

        const copyButton = document.createElement('button');
        copyButton.className = 'icon-btn reader-comment-action__button';
        copyButton.type = 'button';
        copyButton.dataset.action = 'reader-selection-copy';
        copyButton.setAttribute('aria-label', this.getLabel('btnCopyText', 'Copy markdown'));
        copyButton.setAttribute('title', this.getLabel('btnCopyText', 'Copy markdown'));
        copyButton.innerHTML = createIcon(copyIcon).outerHTML;
        copyButton.addEventListener('click', async () => {
            if (!selection.sourceMarkdown.trim()) return;
            const ok = await copyTextToClipboard(selection.sourceMarkdown);
            showEphemeralTooltip({
                root: this.overlaySession?.shadow ?? document,
                anchor: copyButton,
                text: this.getLabel(ok ? 'btnCopied' : 'copyFailed', ok ? 'Copied!' : 'Copy failed'),
            });
        });

        const commentButton = document.createElement('button');
        commentButton.className = 'icon-btn reader-comment-action__button';
        commentButton.type = 'button';
        commentButton.dataset.action = 'reader-comment-add';
        commentButton.setAttribute('aria-label', this.getLabel('readerCommentAction', 'Comment'));
        commentButton.setAttribute('title', this.getLabel('readerCommentAction', 'Comment'));
        commentButton.innerHTML = createIcon(messageSquareTextIcon).outerHTML;
        commentButton.addEventListener('click', () => {
            const markdownRoot = this.getMarkdownRoot();
            const shell = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window--reader');
            if (!markdownRoot || !shell || !this.overlaySession) return;
            const frozenSelection: ReaderCommentSelectionSnapshot = {
                range: selection.range.cloneRange(),
                selectedUnits: [...selection.selectedUnits],
                selectedText: selection.selectedText,
                sourceMarkdown: selection.sourceMarkdown,
            };
            this.openCommentPopover({
                mode: 'create',
                anchorRect: commentButton.getBoundingClientRect(),
                initialText: '',
                selectedSource: frozenSelection.sourceMarkdown,
                onSave: (value) => {
                    const item = this.getCurrentItem();
                    if (!item) return;
                    const record = createReaderCommentRecord({
                        id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        itemId: item.id,
                        comment: value,
                        range: frozenSelection.range,
                        root: markdownRoot,
                        selectedUnits: frozenSelection.selectedUnits,
                    });
                    saveReaderComment(READER_COMMENT_SCOPE_ID, record);
                    this.activeCommentId = record.id;
                    this.syncCommentUi();
                    this.syncCommentControls();
                },
                onCancel: () => {
                    this.activeCommentId = null;
                    this.syncCommentUi();
                },
            });
        });
        if (showStickyAction) {
            const stickButton = document.createElement('button');
            stickButton.className = 'icon-btn reader-comment-action__button';
            stickButton.type = 'button';
            stickButton.dataset.action = 'reader-selection-stick';
            stickButton.setAttribute('aria-label', this.getLabel('readerStickyAction', 'Stick'));
            stickButton.setAttribute('title', this.getLabel('readerStickyAction', 'Stick'));
            stickButton.innerHTML = createIcon(pinIcon).outerHTML;
            stickButton.addEventListener('click', () => {
                this.addStickyBlock(selection.sourceMarkdown);
            });
            group.append(copyButton, commentButton, stickButton);
            return group;
        }

        group.append(copyButton, commentButton);
        return group;
    }

    private createCommentAnchor(
        record: ReaderCommentRecord,
        unionRect: ReaderCommentRect,
        _rects: ReaderCommentRect[],
        occupiedAnchorTops: number[],
    ): HTMLElement {
        const button = document.createElement('button');
        button.className = 'icon-btn reader-comment-anchor';
        button.type = 'button';
        button.dataset.action = 'reader-comment-open';
        button.innerHTML = createIcon(messageSquareTextIcon).outerHTML;

        const buttonSize = this.getTokenSize('--aimd-size-control-icon-panel', 32);
        const stackStep = buttonSize - this.getTokenSize('--aimd-space-1', 4);
        let top = unionRect.top + unionRect.height / 2 - buttonSize / 2;
        while (occupiedAnchorTops.some((value) => Math.abs(value - top) < buttonSize + this.getTokenSize('--aimd-space-1', 4))) {
            top += stackStep;
        }
        occupiedAnchorTops.push(top);

        const overlayRect = this.getCommentOverlay()!.getBoundingClientRect();
        const markdownRect = this.getMarkdownRoot()!.getBoundingClientRect();
        const gutterLeft = markdownRect.right - overlayRect.left + this.getTokenSize('--aimd-space-4', 16);
        const anchorLeft = Math.max(
            0,
            Math.min(this.getCommentOverlay()!.clientWidth - buttonSize, gutterLeft),
        );

        button.style.left = `${anchorLeft}px`;
        button.style.top = `${Math.max(0, top)}px`;
        this.installTransientButtonBoundary(button);
        button.addEventListener('click', () => {
            this.activeCommentId = record.id;
            this.syncCommentUi();
            const markdownRoot = this.getMarkdownRoot();
            const resolved = markdownRoot ? resolveReaderCommentAnchor(markdownRoot, record) : null;
            const contentAnchorRect = resolved?.unionRect ? this.toViewportRect(resolved.unionRect) : null;
            this.openCommentPopover({
                mode: 'edit',
                anchorRect: contentAnchorRect ?? button.getBoundingClientRect(),
                initialText: record.comment,
                selectedSource: record.sourceMarkdown,
                onSave: (value) => {
                    saveReaderComment(READER_COMMENT_SCOPE_ID, {
                        ...record,
                        comment: value,
                        updatedAt: Date.now(),
                    });
                    this.activeCommentId = record.id;
                    this.syncCommentUi();
                },
                onDelete: () => {
                    removeReaderComment(READER_COMMENT_SCOPE_ID, record.itemId, record.id);
                    this.activeCommentId = null;
                    this.syncCommentUi();
                    this.syncCommentControls();
                    this.notify(this.getLabel('readerCommentDeleted', 'Annotation deleted'));
                },
                onCancel: () => this.syncCommentUi(),
            });
        });
        return button;
    }

    private openCommentPopover(params: {
        mode: 'create' | 'edit';
        anchorRect: DOMRect;
        initialText: string;
        selectedSource: string;
        onSave: (value: string) => void;
        onDelete?: () => void;
        onCancel?: () => void;
    }): void {
        if (!this.overlaySession) return;
        const container = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.panel-window--reader');
        if (!container) return;
        this.commentPopover.open({
            shadow: this.overlaySession.shadow,
            container,
            theme: this.state.theme,
            selectedSource: params.selectedSource,
            anchorRect: params.anchorRect,
            initialText: params.initialText,
            mode: params.mode,
            labels: {
                addTitle: this.getLabel('readerCommentAddTitle', 'Add comment'),
                editTitle: this.getLabel('readerCommentEditTitle', 'Edit comment'),
                close: this.getLabel('btnClose', 'Close'),
                selectedSource: this.getLabel('readerCommentSelectedSource', 'Selected content'),
                placeholder: this.getLabel('readerCommentPlaceholder', 'Write your annotation...'),
                cancel: this.getLabel('btnCancel', 'Cancel'),
                delete: this.getLabel('btnDelete', 'Delete'),
                save: this.getLabel('readerCommentSave', 'Save annotation'),
            },
            onSave: (value) => {
                params.onSave(value);
                this.notify(this.getLabel('readerCommentSaved', 'Annotation saved'));
            },
            onDelete: () => {
                params.onDelete?.();
            },
            onCancel: () => {
                params.onCancel?.();
                this.syncCommentUi();
            },
        });
    }

    private openCommentExportPopover(): void {
        if (!this.overlaySession) return;
        const comments = this.getCurrentComments();
        if (comments.length < 1) {
            this.notify(this.getLabel('readerCommentCopyEmpty', 'No annotations to copy yet.'));
            return;
        }

        const container = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.panel-window--reader');
        const pickerContainer = this.overlaySession.surfaceRoot;
        const anchorButton = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('[data-action="reader-copy-comments"]');
        const shadow = this.overlaySession.shadow;
        if (!container || !pickerContainer || !anchorButton) return;
        this.commentPromptPicker.open({
            shadow,
            container: pickerContainer,
            anchorEl: anchorButton,
            placement: 'center',
            theme: this.state.theme,
            prompts: this.commentExportSettings.prompts,
            labels: {
                title: this.getLabel('readerCommentPromptPickerTitle', 'Choose prompt'),
                close: this.getLabel('btnClose', 'Close'),
                empty: this.getLabel('readerCommentPromptPickerEmpty', 'No prompts available.'),
            },
            onSelect: (promptId) => {
                const prompts = resolveReaderCommentExportPrompts(this.commentExportSettings, promptId);
                const compiledExport = buildCommentsExport(comments, prompts);
                this.commentExportPopover.open({
                    shadow,
                    container,
                    theme: this.state.theme,
                    preview: compiledExport,
                    canCopy: Boolean(compiledExport.trim()),
                    labels: {
                        title: this.getLabel('readerCommentCopyComments', 'Copy annotations'),
                        close: this.getLabel('btnClose', 'Close'),
                        copy: this.getLabel('readerCommentCopyComments', 'Copy annotations'),
                        copied: this.getLabel('btnCopied', 'Copied!'),
                        empty: this.getLabel('readerCommentCopyEmpty', 'No annotations to copy yet.'),
                    },
                    onCopy: async () => {
                        if (!compiledExport.trim()) {
                            this.notify(this.getLabel('readerCommentCopyEmpty', 'No annotations to copy yet.'));
                            return false;
                        }
                        const ok = await copyTextToClipboard(compiledExport);
                        this.notify(this.getLabel(ok ? 'btnCopied' : 'copyFailed', ok ? 'Copied!' : 'Copy failed'));
                        return ok;
                    },
                    onClose: () => this.syncCommentUi(),
                });
            },
            onClose: () => this.syncCommentUi(),
        });
    }

    private installTransientButtonBoundary(button: HTMLElement): void {
        const swallow = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
        };
        button.addEventListener('pointerdown', swallow);
        button.addEventListener('pointerup', swallow);
        button.addEventListener('mouseup', swallow);
    }

    private getTokenSize(token: string, fallback: number): number {
        const host = this.overlaySession?.host;
        if (!host) return fallback;
        const value = getComputedStyle(host).getPropertyValue(token).trim();
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    private syncAtomicMarkup(): void {
        const markdownRoot = this.getMarkdownRoot();
        if (!markdownRoot) {
            this.renderedAtomicElements = [];
            return;
        }

        if (this.state.renderedAtomicUnits.length < 1) {
            this.renderedAtomicElements = [];
            clearRenderedAtomicSelection(markdownRoot);
            return;
        }

        this.renderedAtomicElements = annotateRenderedAtomicUnits(markdownRoot, this.state.renderedAtomicUnits);
    }

    private applyAtomicSelectionState(): void {
        const markdownRoot = this.getMarkdownRoot();
        if (!markdownRoot) return;
        applyRenderedAtomicSelection(markdownRoot, this.state.selectedAtomicUnitIds);
    }

    private syncAtomicSelection(): void {
        const markdownRoot = this.getMarkdownRoot();
        if (!markdownRoot || !this.overlaySession) return;

        const selection = window.getSelection();
        const range = resolveReaderSelectionRange(selection, this.overlaySession.shadow, markdownRoot);
        if (!range) {
            this.state.selectionSourceText = '';
            this.state.selectionExport = '';
            this.state.selectedAtomicUnitIds = [];
            this.commentSelectionSnapshot = null;
            clearRenderedAtomicSelection(markdownRoot);
            this.syncCommentUi();
            this.syncCommentControls();
            return;
        }

        const selectedText = range.toString().trim();
        const selectedUnits = resolveSelectedAtomicUnits(range, markdownRoot).map((selected) => {
            const rendered = this.renderedAtomicElements.find((unit) => unit.id === selected.id);
            return rendered ?? selected;
        });

        this.state.selectionSourceText = selectedText;
        this.state.selectedAtomicUnitIds = selectedUnits.map((unit) => unit.id);
        this.state.selectionExport = buildAtomicSelectionExport({
            range,
            root: markdownRoot,
            selectedUnits,
        });
        this.commentSelectionSnapshot = {
            range: range.cloneRange(),
            selectedUnits: [...selectedUnits],
            selectedText,
            sourceMarkdown: this.state.selectionExport,
        };
        applyRenderedAtomicSelection(markdownRoot, this.state.selectedAtomicUnitIds);
        this.syncCommentUi();
        this.syncCommentControls();
    }

    private handleAtomicCopy(event: ClipboardEvent): void {
        const markdownRoot = this.getMarkdownRoot();
        if (!markdownRoot || !this.overlaySession) return;

        this.syncAtomicSelection();
        const selection = window.getSelection();
        const range = resolveReaderSelectionRange(selection, this.overlaySession.shadow, markdownRoot);
        if (!range || !this.state.selectionExport) return;

        const hasSelection = Boolean(range.toString().trim()) || this.state.selectedAtomicUnitIds.length > 0;
        if (!hasSelection) return;

        event.preventDefault();
        event.stopPropagation();
        event.clipboardData?.setData('text/plain', this.state.selectionExport);

        const anchor = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('[data-action="reader-copy"]') ?? markdownRoot;
        showEphemeralTooltip({
            root: this.overlaySession.shadow,
            anchor,
            text: t('btnCopied'),
        });
    }
}
