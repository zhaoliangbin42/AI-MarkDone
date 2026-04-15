import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import { copyIcon, messageSquareTextIcon } from '../../../assets/icons';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { formatReaderUserPromptDisplay, type ReaderUserPromptDisplay } from '../../../services/reader/userPromptDisplay';
import type { AppSettings } from '../../../core/settings/types';
import { renderMarkdownForReader, type ReaderAtomicUnit } from '../../../services/renderer/renderMarkdown';
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
    resolveReaderCommentExportPrompts,
    type ReaderCommentExportSettings,
} from '../../../services/reader/commentExport';
import { listReaderComments, saveReaderComment, type ReaderCommentRecord } from '../../../services/reader/commentSession';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { createIcon } from '../components/Icon';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { subscribeLocaleChange, t } from '../components/i18n';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { ensureBackdropElement, ensureStableElementFromHtml } from '../components/stableSurface';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { TooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import { OverlaySession } from '../overlay/OverlaySession';
import { ReaderCommentPopover } from './ReaderCommentPopover';
import { ReaderCommentExportPopover } from './ReaderCommentExportPopover';
import { ensureShadowStylesheetLink, getReaderPanelCss, getReaderPanelHtml } from './readerPanelTemplate';
import { decorateReaderCodeBlocksHtml } from './readerCodeBlockEnhancer';
import { CommentPromptPickerPopover } from '../components/CommentPromptPickerPopover';

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
    selectedAtomicUnitIds: string[];
    selectionSourceText: string;
    selectionExport: string;
    userPromptDisplay: ReaderUserPromptDisplay;
    statusText: string;
    options: {
        profile: ReaderPanelProfile;
        showNav: boolean;
        showCopy: boolean;
        showSource: boolean;
        showOpenConversation: boolean;
        dotStyle: 'meta' | 'plain';
        initialView: 'render' | 'source';
        actions: ReaderPanelAction[];
        onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    };
};

type ReaderCommentSelectionSnapshot = {
    range: Range;
    selectedUnits: SelectedAtomicUnit[];
    selectedText: string;
    sourceMarkdown: string;
};

const READER_COMMENT_SCOPE_ID = 'reader-panel-comments-v1';

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
    private closing = false;
    private motionNeedsOpen = false;
    private onSelectionChange: (() => void) | null = null;
    private onPointerUp: (() => void) | null = null;
    private onShadowCopy: EventListener | null = null;
    private renderedAtomicElements: SelectedAtomicUnit[] = [];
    private commentSelectionSnapshot: ReaderCommentSelectionSnapshot | null = null;
    private activeCommentId: string | null = null;
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
        selectedAtomicUnitIds: [],
        selectionSourceText: '',
        selectionExport: '',
        userPromptDisplay: formatReaderUserPromptDisplay(''),
        statusText: '',
        options: {
            profile: 'conversation-reader',
            showNav: true,
            showCopy: true,
            showSource: true,
            showOpenConversation: false,
            dotStyle: 'meta',
            initialView: 'render',
            actions: [],
        },
    };

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.overlaySession?.setTheme(theme);
        this.render();
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
        this.commentExportSettings = settings;
    }

    getCommentExportContext(): { comments: ReaderCommentRecord[]; prompts: ReaderCommentExportSettings['prompts']; template: ReaderCommentExportSettings['template'] } | null {
        const comments = this.getCurrentComments();
        if (comments.length < 1) return null;
        return {
            comments: comments.map((record) => ({ ...record })),
            prompts: this.commentExportSettings.prompts.map((prompt) => ({ ...prompt })),
            template: this.commentExportSettings.template.map((segment) => ({ ...segment })),
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

        if (this.state.options.initialView === 'source') {
            void this.openSourcePanel();
        }

        await this.renderCurrentContent();
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
            surfaceCss: getReaderPanelCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-reader-panel-structure',
            overlayStyleId: 'aimd-reader-panel-tailwind',
        });

        this.overlaySession = session;
        this.tooltipDelegate = new TooltipDelegate(session.shadow, { upgradeTitles: false });

        session.syncBackdropDismiss(() => this.hide());
        session.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));

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
        if (this.onSelectionChange) document.removeEventListener('selectionchange', this.onSelectionChange);
        if (this.onPointerUp) document.removeEventListener('pointerup', this.onPointerUp);
        if (this.overlaySession?.shadow && this.onShadowCopy) {
            this.overlaySession.shadow.removeEventListener('copy', this.onShadowCopy, true);
        }
        this.onSelectionChange = null;
        this.onPointerUp = null;
        this.onShadowCopy = null;
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
            case 'reader-copy':
                await this.copyCurrent();
                return;
            case 'reader-copy-comments':
                this.openCommentExportPopover();
                return;
            case 'reader-copy-code':
                await this.copyCodeBlock(actionEl);
                return;
            case 'reader-source':
                await this.openSourcePanel();
                return;
            case 'reader-fullscreen':
                this.toggleFullscreen();
                return;
            case 'reader-open-conversation':
                this.openConversation();
                return;
            default:
                return;
        }
    }

    private async go(delta: number): Promise<void> {
        const next = this.state.index + delta;
        if (next < 0 || next >= this.state.items.length) return;
        this.state.index = next;
        this.state.renderedHtml = '';
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
        this.state.renderedHtml = decorateReaderCodeBlocksHtml(rendered.html, {
            copyLabel: this.getLabel('btnCopyText', 'Copy code'),
        });
        this.render(false);
        this.syncAtomicSelection();
        this.syncCommentUi();

        const body = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        if (body) body.scrollTop = 0;
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

    private async openSourcePanel(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) return;
        const markdown = await resolveContent(item.content);
        sourcePanel.show({ theme: this.state.theme, title: t('modalSourceTitle'), content: markdown });
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
                renderedHtml: this.state.renderedHtml,
                userPromptDisplay: this.state.userPromptDisplay,
                statusText: this.state.statusText,
                showCopy: this.state.options.showCopy,
                showSource: this.state.options.showSource,
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
                    '[data-action="reader-source"]',
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
        this.applyAtomicSelectionState();
        this.syncCommentUi();
        this.syncCommentControls();

        const nextBody = panel.querySelector<HTMLElement>('.reader-body');
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

        const renderAllThreshold = 60;
        if (total <= renderAllThreshold) {
            for (let index = 0; index < total; index += 1) {
                dots.appendChild(this.createDot(index, index === activeIndex));
            }
            this.scrollActiveDotIntoView();
            return;
        }

        const maxDots = 11;
        const windowSize = Math.min(maxDots, total);
        const half = Math.floor(windowSize / 2);
        let start = Math.max(0, activeIndex - half);
        let end = Math.min(total - 1, start + windowSize - 1);
        start = Math.max(0, end - windowSize + 1);

        if (start > 0) {
            dots.appendChild(this.createDot(0, activeIndex === 0));
            if (start > 1) dots.appendChild(this.createEllipsis());
        }

        const loopStart = start > 0 ? start : 0;
        const loopEnd = end < total - 1 ? end : total - 1;

        for (let index = loopStart; index <= loopEnd; index += 1) {
            dots.appendChild(this.createDot(index, index === activeIndex));
        }

        if (end < total - 1) {
            if (end < total - 2) dots.appendChild(this.createEllipsis());
            dots.appendChild(this.createDot(total - 1, activeIndex === total - 1));
        }

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
                showSource: true,
                showOpenConversation: true,
                dotStyle: 'plain',
                initialView: 'render',
                actions: [],
            };
        }

        return {
            profile: 'conversation-reader',
            showNav: true,
            showCopy: true,
            showSource: true,
            showOpenConversation: false,
            dotStyle: 'meta',
            initialView: 'render',
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
        const actionWidth = (buttonSize * 2) + gap;
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
                placeholder: this.getLabel('readerCommentPlaceholder', 'Write your comment...'),
                cancel: this.getLabel('btnCancel', 'Cancel'),
                save: this.getLabel('readerCommentSave', 'Save comment'),
            },
            onSave: (value) => {
                params.onSave(value);
                this.notify(this.getLabel('readerCommentSaved', 'Comment saved'));
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
            this.notify(this.getLabel('readerCommentCopyEmpty', 'No comments to copy yet.'));
            return;
        }

        const container = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.panel-window--reader');
        const anchorButton = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('[data-action="reader-copy-comments"]');
        const shadow = this.overlaySession.shadow;
        if (!container || !anchorButton) return;
        this.commentPromptPicker.open({
            shadow,
            container,
            anchorEl: anchorButton,
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
                        title: this.getLabel('readerCommentCopyComments', 'Copy comments'),
                        close: this.getLabel('btnClose', 'Close'),
                        copy: this.getLabel('readerCommentCopyComments', 'Copy comments'),
                        copied: this.getLabel('btnCopied', 'Copied!'),
                        empty: this.getLabel('readerCommentCopyEmpty', 'No comments to copy yet.'),
                    },
                    onCopy: async () => {
                        if (!compiledExport.trim()) {
                            this.notify(this.getLabel('readerCommentCopyEmpty', 'No comments to copy yet.'));
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
