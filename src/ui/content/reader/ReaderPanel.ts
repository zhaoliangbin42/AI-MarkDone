import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import { getTokenCss } from '../../../style/tokens';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { renderMarkdownToSanitizedHtml } from '../../../services/renderer/renderMarkdown';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import {
    chevronRightIcon,
    copyIcon,
    externalLinkIcon,
    fileCodeIcon,
    maximizeIcon,
    minimizeIcon,
    xIcon,
} from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { subscribeLocaleChange, t } from '../components/i18n';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { TooltipDelegate, upgradeTitleTooltips } from '../../../utils/tooltip';
import { getMarkdownThemeCss } from '../components/markdownTheme';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from '../overlay/OverlaySurfaceHost';
import overlayCssText from '../../../style/tailwind-overlay.css?inline';

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

export type ReaderPanelShowOptions = {
    showNav?: boolean;
    showCopy?: boolean;
    showSource?: boolean;
    showOpenConversation?: boolean;
    dotStyle?: 'meta' | 'plain';
    onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    actions?: ReaderPanelAction[];
    initialView?: 'render' | 'source';
};

type ReaderPanelState = {
    theme: Theme;
    items: ReaderItem[];
    index: number;
    visible: boolean;
    fullscreen: boolean;
    renderedHtml: string;
    statusText: string;
    options: Required<Pick<ReaderPanelShowOptions, 'showNav' | 'showCopy' | 'showSource' | 'showOpenConversation' | 'dotStyle' | 'initialView'>> & {
        actions: ReaderPanelAction[];
        onOpenConversation?: (ctx: ReaderPanelActionContext) => void | Promise<void>;
    };
};

export class ReaderPanel {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: OverlaySurfaceHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private contentRenderToken = 0;
    private statusTimer: number | null = null;
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        fullscreen: false,
        renderedHtml: '',
        statusText: '',
        options: {
            showNav: true,
            showCopy: true,
            showSource: true,
            showOpenConversation: true,
            dotStyle: 'meta',
            initialView: 'render',
            actions: [],
        },
    };

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.hostHandle?.setThemeCss(getTokenCss(theme));
        this.render();
    }

    async show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void> {
        this.state.items = items;
        this.state.index = Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1)));
        this.state.theme = theme;
        this.state.visible = true;
        this.state.fullscreen = false;
        this.state.renderedHtml = '';
        this.state.statusText = '';
        this.state.options = {
            showNav: options?.showNav ?? true,
            showCopy: options?.showCopy ?? true,
            showSource: options?.showSource ?? true,
            showOpenConversation: options?.showOpenConversation ?? true,
            dotStyle: options?.dotStyle ?? 'meta',
            initialView: options?.initialView ?? 'render',
            onOpenConversation: options?.onOpenConversation,
            actions: options?.actions ?? [],
        };

        this.mount();
        this.render(false);
        this.keyboardHandle?.detach();
        this.keyboardHandle = attachDialogKeyboardScope({
            root: this.hostHandle?.host ?? document.body,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: this.hostHandle?.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? this.hostHandle?.host ?? undefined,
        });

        if (this.state.options.initialView === 'source') {
            void this.openSourcePanel();
        }

        await this.renderCurrentContent();
    }

    hide(): void {
        this.state.visible = false;
        this.unmount();
    }

    notify(text: string, timeoutMs: number = 1400): void {
        this.setStatus(text);
        if (this.statusTimer) window.clearTimeout(this.statusTimer);
        this.statusTimer = window.setTimeout(() => this.setStatus(''), timeoutMs);
    }

    private mount(): void {
        if (this.hostHandle) return;

        const handle = mountOverlaySurfaceHost({
            id: 'aimd-reader-panel-host',
            themeCss: getTokenCss(this.state.theme),
            surfaceCss: this.getCss(),
            overlayCss: overlayCssText,
            lockScroll: true,
            surfaceStyleId: 'aimd-reader-panel-structure',
            overlayStyleId: 'aimd-reader-panel-tailwind',
        });

        this.host = handle.host;
        this.shadow = handle.shadow;
        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(handle.shadow);

        handle.backdropRoot.addEventListener('click', () => this.hide());
        handle.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));

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
        handle.host.addEventListener('keydown', this.onKeyDown);

        const katexUrl = this.getKatexUrl();
        if (katexUrl) ensureShadowStylesheetLink(handle.shadow, katexUrl, 'aimd-reader-panel-katex');

        if (!this.unsubscribeLocale) {
            this.unsubscribeLocale = subscribeLocaleChange(() => this.render());
        }
    }

    private unmount(): void {
        if (this.host && this.onKeyDown) {
            this.host.removeEventListener('keydown', this.onKeyDown);
        }
        this.onKeyDown = null;

        if (this.statusTimer) {
            window.clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }

        this.contentRenderToken += 1;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.hostHandle?.unmount();
        this.hostHandle = null;
        this.host = null;
        this.shadow = null;
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

        this.state.renderedHtml = renderMarkdownToSanitizedHtml(markdown);
        this.render(false);

        const body = this.hostHandle?.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        if (body) body.scrollTop = 0;
    }

    private async copyCurrent(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) return;

        const button = this.hostHandle?.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="reader-copy"]');
        if (!button) return;

        try {
            button.disabled = true;
            const markdown = await resolveContent(item.content);
            const ok = await copyTextToClipboard(markdown);
            this.notify(ok ? t('btnCopied') : t('copyFailed'));
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
        const status = this.hostHandle?.surfaceRoot.querySelector<HTMLElement>('[data-field="status"]');
        if (status) status.textContent = text;
    }

    private render(preserveScrollTop: boolean = true): void {
        if (!this.hostHandle) return;

        const currentBody = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        const scrollTop = preserveScrollTop ? currentBody?.scrollTop ?? 0 : 0;

        this.hostHandle.setSurfaceCss(this.getCss());
        this.hostHandle.backdropRoot.innerHTML = '<div class="panel-stage__overlay"></div>';
        this.hostHandle.surfaceRoot.innerHTML = this.getHtml();

        this.renderActions();
        this.renderDots();
        upgradeTitleTooltips(this.hostHandle.surfaceRoot);
        this.tooltipDelegate?.refresh(this.shadow ?? undefined);

        const nextBody = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.reader-body');
        if (nextBody && preserveScrollTop) {
            nextBody.scrollTop = scrollTop;
        }
    }

    private renderActions(): void {
        if (!this.hostHandle) return;

        const headerSlot = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('[data-role="header-custom-actions"]');
        const footerSlot = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('[data-role="footer-left-actions"]');
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
                    await action.onClick({ ...nextCtx, anchorEl: button, shadow: this.shadow || undefined });
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
        if (!this.hostHandle) return;

        const dots = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.reader-dots');
        if (!dots) return;

        const total = this.state.items.length;
        const activeIndex = this.state.index;
        dots.replaceChildren();

        if (!this.state.options.showNav || total <= 0) {
            const footerCenter = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.reader-footer__center');
            if (footerCenter) footerCenter.style.display = 'none';
            return;
        }

        const footerCenter = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.reader-footer__center');
        if (footerCenter) footerCenter.style.display = '';

        const sizing = this.calculateDotSizing(total);
        dots.style.setProperty('--aimd-dot-size', `${sizing.size}px`);
        dots.style.setProperty('--aimd-dot-gap', `${sizing.gap}px`);

        const renderAllThreshold = 60;
        if (total <= renderAllThreshold) {
            for (let index = 0; index < total; index += 1) {
                dots.appendChild(this.createDot(index, index === activeIndex));
            }
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
        span.textContent = '…';
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    private toggleFullscreen(): void {
        this.state.fullscreen = !this.state.fullscreen;
        this.render();
    }

    private calculateDotSizing(total: number): { size: number; gap: number } {
        if (total <= 10) return { size: 10, gap: 10 };
        if (total <= 20) return { size: 9, gap: 8 };
        if (total <= 35) return { size: 8, gap: 6 };
        if (total <= 50) return { size: 7, gap: 5 };
        return { size: 6, gap: 4 };
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

    private getHtml(): string {
        const item = this.state.items[this.state.index];
        const total = this.state.items.length;
        const title = this.getLabel('btnReader', 'Reader panel');
        const openConversationLabel = this.getLabel('openConversationLabel', 'Open conversation');
        const copyLabel = this.getLabel('btnCopyText', 'Copy markdown');
        const sourceLabel = this.getLabel('btnViewSource', 'View source');
        const fullscreenLabel = this.state.fullscreen
            ? this.getLabel('exitFullscreen', 'Exit fullscreen')
            : this.getLabel('toggleFullscreen', 'Toggle fullscreen');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        const previousLabel = this.getLabel('previousMessage', 'Previous message');
        const nextLabel = this.getLabel('nextMessage', 'Next message');
        const pagerHint = '';

        return `
<div class="panel-window panel-window--reader" data-fullscreen="${this.state.fullscreen ? '1' : '0'}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
      <div class="reader-header-page">${total > 0 ? `${this.state.index + 1}/${total}` : '0/0'}</div>
    </div>
    <div class="panel-header__actions">
      <div class="panel-header__actions-group" data-role="header-custom-actions"></div>
      ${this.state.options.showOpenConversation ? `<button class="icon-btn" data-action="reader-open-conversation" aria-label="${escapeHtml(openConversationLabel)}" data-tooltip="${escapeHtml(openConversationLabel)}">${iconMarkup(externalLinkIcon)}</button>` : ''}
      ${this.state.options.showCopy ? `<button class="icon-btn" data-action="reader-copy" aria-label="${escapeHtml(copyLabel)}" data-tooltip="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>` : ''}
      ${this.state.options.showSource ? `<button class="icon-btn" data-action="reader-source" aria-label="${escapeHtml(sourceLabel)}" data-tooltip="${escapeHtml(sourceLabel)}">${iconMarkup(fileCodeIcon)}</button>` : ''}
      <button class="icon-btn" data-action="reader-fullscreen" aria-label="${escapeHtml(fullscreenLabel)}" data-tooltip="${escapeHtml(fullscreenLabel)}">${iconMarkup(this.state.fullscreen ? minimizeIcon : maximizeIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="reader-body">
    <article class="reader-content">
      <div class="reader-thread">
        <section class="reader-message reader-message--user">
          <div class="reader-message__label">User message</div>
          <div class="reader-message__body reader-message__body--prompt">${escapeHtml(item?.userPrompt || '')}</div>
        </section>
        <section class="reader-message reader-message--assistant">
          <div class="reader-message__label">AI response</div>
          <div class="reader-markdown markdown-body">${this.state.renderedHtml}</div>
        </section>
      </div>
    </article>
  </div>
  <div class="reader-footer">
    <div class="reader-footer__left">
      <div class="reader-footer__actions" data-role="footer-left-actions"></div>
    </div>
    <div class="reader-footer__center">
      <button class="nav-btn nav-btn--reader" data-action="reader-prev" aria-label="${escapeHtml(previousLabel)}" data-tooltip="${escapeHtml(previousLabel)}" ${this.state.index <= 0 ? 'disabled' : ''}>${iconMarkup(chevronRightIcon)}</button>
      <div class="reader-dots" aria-label="${escapeHtml(this.getLabel('paginationLabel', 'Pagination'))}"></div>
      <button class="nav-btn nav-btn--next nav-btn--reader" data-action="reader-next" aria-label="${escapeHtml(nextLabel)}" data-tooltip="${escapeHtml(nextLabel)}" ${this.state.index >= total - 1 ? 'disabled' : ''}>${iconMarkup(chevronRightIcon)}</button>
    </div>
    <div class="reader-footer__meta">
      <div class="hint">${escapeHtml(pagerHint)}</div>
      <div class="status-line" data-field="status">${escapeHtml(this.state.statusText)}</div>
    </div>
  </div>
</div>
`;
    }

    private getCss(): string {
        return `
:host { font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }

.panel-stage__overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 28%, transparent);
}

.panel-window {
  position: fixed;
  top: var(--aimd-panel-top);
  left: 50%;
  transform: translateX(-50%);
  width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-6)));
  height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-6)));
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-window--reader {
  min-height: 720px;
}

.panel-window--reader[data-fullscreen="1"] {
  top: 0;
  left: 0;
  transform: none;
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: 72px;
  padding: var(--aimd-space-4) var(--aimd-space-5);
  border-bottom: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-primary);
}

.panel-header__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.panel-header__meta--reader {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-header__meta--reader h2 {
  margin: 0;
  font-size: var(--aimd-text-xl);
  line-height: 1.2;
  font-weight: var(--aimd-font-semibold);
}

.reader-header-page {
  display: inline-flex;
  align-items: center;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.panel-header__actions,
.panel-header__actions-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-btn,
.nav-btn,
.secondary-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
}

.icon-btn,
.nav-btn {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-primary);
  background: transparent;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.icon-btn:hover,
.nav-btn:hover {
  background: var(--aimd-interactive-hover);
}

.icon-btn:active,
.nav-btn:active {
  background: var(--aimd-interactive-active);
}

.icon-btn:disabled,
.nav-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-btn:focus-visible,
.nav-btn:focus-visible,
.secondary-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.icon-btn .aimd-icon,
.icon-btn .aimd-icon svg,
.nav-btn .aimd-icon,
.nav-btn .aimd-icon svg {
  width: 18px;
  height: 18px;
}

.icon-btn--active {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.icon-btn--danger {
  color: var(--aimd-interactive-danger);
}

.secondary-btn {
  min-height: 40px;
  padding: 0 var(--aimd-space-4);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-text-sm);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
}

.secondary-btn:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, var(--aimd-interactive-hover));
}

.secondary-btn--compact {
  min-height: 36px;
  padding: 0 var(--aimd-space-3);
}

.secondary-btn--primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}

.secondary-btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.secondary-btn--danger {
  color: var(--aimd-interactive-danger);
}

.reader-body {
  flex: 1;
  overflow: auto;
  padding: 26px 28px 20px;
}

.reader-content {
  max-width: min(1000px, 100%);
  margin: 0 auto;
}

.reader-thread {
  display: grid;
  gap: 18px;
}

.reader-message {
  display: grid;
  gap: 14px;
  padding: 24px 28px;
  border-radius: var(--aimd-radius-2xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent);
}

.reader-message--assistant {
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
}

.reader-message__label {
  font-size: var(--aimd-text-xs);
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.reader-message__body--prompt {
  font-size: 17px;
  line-height: 1.8;
  color: var(--aimd-text-primary);
}

.reader-markdown {
  min-width: 0;
}

${getMarkdownThemeCss('.reader-markdown')}

.reader-markdown :where(.katex-display) {
  margin: 1em 0;
  padding: 0;
}

.reader-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  position: relative;
}

.reader-footer__left,
.reader-footer__center {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reader-footer__left {
  position: relative;
}

.reader-footer__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reader-footer__center {
  justify-content: center;
  min-width: 0;
}

.reader-footer__meta {
  justify-self: end;
  text-align: right;
  max-width: 220px;
}

.reader-footer__meta .hint {
  font-size: 13px;
  line-height: 1.45;
  color: var(--aimd-text-secondary);
}

.status-line {
  min-height: 18px;
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.status-line:empty {
  display: none;
}

.reader-dots {
  display: flex;
  gap: 8px;
  max-width: min(280px, 34vw);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 2px 0;
}

.reader-dots::-webkit-scrollbar {
  display: none;
}

.reader-dot {
  all: unset;
  box-sizing: border-box;
  display: block;
  cursor: pointer;
  border: 0;
  box-shadow: none;
  flex: none;
  width: var(--aimd-dot-size, 10px);
  height: var(--aimd-dot-size, 10px);
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 90%, transparent);
}

.reader-dot--active {
  width: calc(var(--aimd-dot-size, 10px) * 2.2);
  background: var(--aimd-interactive-primary);
}

.reader-dot--bookmarked {
  border-radius: var(--aimd-radius-xs);
}

.reader-dot--bookmarked.reader-dot--active {
  border-radius: var(--aimd-radius-sm);
}

.reader-ellipsis {
  color: var(--aimd-text-secondary);
  line-height: 1;
}

.nav-btn--reader {
  width: 44px;
  height: 44px;
}

.nav-btn--reader:first-child .aimd-icon svg {
  transform: rotate(180deg);
}

@media (max-width: 900px) {
  .panel-window {
    width: min(var(--aimd-panel-max-width), calc(100vw - var(--aimd-space-4)));
    height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-4)));
  }

  .panel-header {
    padding: var(--aimd-space-4);
    min-height: 64px;
  }

  .reader-body {
    padding: 20px 18px 16px;
  }

  .reader-message {
    padding: 20px;
  }

  .reader-footer {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .reader-footer__left,
  .reader-footer__center {
    justify-content: center;
  }

  .reader-footer__meta {
    justify-self: center;
    text-align: center;
  }
}
`;
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

function iconMarkup(svg: string): string {
    return `<span class="aimd-icon">${svg}</span>`;
}

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}

function ensureShadowStylesheetLink(shadow: ShadowRoot, href: string, styleId: string): HTMLLinkElement {
    const existing = shadow.querySelector<HTMLLinkElement>(`link[data-aimd-style-link="${styleId}"]`);
    if (existing) {
        if (existing.href !== href) existing.href = href;
        return existing;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-aimd-style-link', styleId);
    shadow.appendChild(link);
    return link;
}
