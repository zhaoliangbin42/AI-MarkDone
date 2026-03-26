import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { renderMarkdownToSanitizedHtml } from '../../../services/renderer/renderMarkdown';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { createIcon } from '../components/Icon';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { subscribeLocaleChange, t } from '../components/i18n';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { ensureBackdropElement, ensureStableElementFromHtml } from '../components/stableSurface';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { TooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import { OverlaySession } from '../overlay/OverlaySession';
import { ensureShadowStylesheetLink, getReaderPanelCss, getReaderPanelHtml } from './readerPanelTemplate';

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

export class ReaderPanel {
    private overlaySession: OverlaySession | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private contentRenderToken = 0;
    private statusTimer: number | null = null;
    private renderCodeInReader = true;
    private closing = false;
    private motionNeedsOpen = false;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        fullscreen: false,
        renderedHtml: '',
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

    async show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void> {
        this.focusLifecycle.capture();
        const resolvedProfile = this.resolveProfileState(options?.profile);
        this.state.items = items;
        this.state.index = Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1)));
        this.state.theme = theme;
        this.state.visible = true;
        this.state.fullscreen = false;
        this.state.renderedHtml = '';
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

        session.backdropRoot.addEventListener('click', () => this.hide());
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
            this.render(false);
            return;
        }

        const token = ++this.contentRenderToken;
        const markdown = await resolveContent(item.content);
        if (token !== this.contentRenderToken) return;

        this.state.renderedHtml = renderMarkdownToSanitizedHtml(markdown, {
            highlightCode: this.renderCodeInReader,
        });
        this.render(false);

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
}
