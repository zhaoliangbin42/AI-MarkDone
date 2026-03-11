import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import { getTokenCss } from '../../../style/tokens';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { renderMarkdownToSanitizedHtml } from '../../../services/renderer/renderMarkdown';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { chevronRightIcon, copyIcon, fileCodeIcon, maximizeIcon, minimizeIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { subscribeLocaleChange, t } from '../components/i18n';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';

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
    actions?: ReaderPanelAction[];
    initialView?: 'render' | 'source';
};

type ReaderPanelState = {
    theme: Theme;
    items: ReaderItem[];
    index: number;
    visible: boolean;
    fullscreen: boolean;
    options: Required<Pick<ReaderPanelShowOptions, 'showNav' | 'showCopy' | 'showSource' | 'initialView'>> & { actions: ReaderPanelAction[] };
};

export class ReaderPanel {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private dotTooltipTimer: number | null = null;
    private dotTooltipTarget: HTMLElement | null = null;
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        fullscreen: false,
        options: { showNav: true, showCopy: true, showSource: true, initialView: 'render', actions: [] },
    };

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.hostHandle?.setCss(this.getCss());
        this.render();
    }

    async show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void> {
        this.state.items = items;
        this.state.index = Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1)));
        this.state.theme = theme;
        this.state.visible = true;
        this.state.fullscreen = false;
        this.state.options = {
            showNav: options?.showNav ?? true,
            showCopy: options?.showCopy ?? true,
            showSource: options?.showSource ?? true,
            initialView: options?.initialView ?? 'render',
            actions: options?.actions ?? [],
        };

        this.mount();
        if (this.state.options.initialView === 'source') {
            void this.openSourcePanel();
        }
        await this.renderBody();
        this.render();
    }

    hide(): void {
        this.state.visible = false;
        this.unmount();
    }

    notify(text: string, timeoutMs: number = 1400): void {
        this.setStatus(text);
        window.setTimeout(() => this.setStatus(''), timeoutMs);
    }

    private mount(): void {
        if (this.host) return;
        const handle = mountShadowDialogHost({
            id: 'aimd-reader-panel-host',
            html: this.getHtml(),
            cssText: this.getCss(),
            lockScroll: true,
        });
        const host = handle.host;
        const shadow = handle.shadow;

        const overlay = shadow.querySelector<HTMLElement>('[data-role="overlay"]');
        overlay?.addEventListener('click', () => this.hide());

        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.hide());
        shadow.querySelector<HTMLButtonElement>('[data-action="prev"]')?.addEventListener('click', () => void this.go(-1));
        shadow.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener('click', () => void this.go(1));
        shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => void this.copyCurrent());
        shadow.querySelector<HTMLButtonElement>('[data-action="source"]')?.addEventListener('click', () => void this.openSourcePanel());
        shadow.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')?.addEventListener('click', () => this.toggleFullscreen());

        this.onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                void this.go(-1);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                void this.go(1);
            }
        };
        host.addEventListener('keydown', this.onKeyDown);

        this.host = host;
        this.shadow = shadow;
        this.hostHandle = handle;

        this.keyboardHandle = attachDialogKeyboardScope({
            root: host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: shadow.querySelector<HTMLElement>('.panel') ?? undefined,
        });

        if (!this.unsubscribeLocale) {
            this.unsubscribeLocale = subscribeLocaleChange(() => {
                this.applyI18nStaticStrings();
                this.render();
            });
        }

        this.applyI18nStaticStrings();
    }

    private unmount(): void {
        this.clearDotTooltip();
        if (this.host && this.onKeyDown) {
            this.host.removeEventListener('keydown', this.onKeyDown);
        }
        this.onKeyDown = null;

        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
        this.shadow = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
    }

    private async go(delta: number): Promise<void> {
        const next = this.state.index + delta;
        if (next < 0 || next >= this.state.items.length) return;
        this.state.index = next;
        await this.renderBody();
        this.render();
    }

    private jumpTo(index: number): void {
        const next = Math.max(0, Math.min(index, this.state.items.length - 1));
        if (next === this.state.index) return;
        void this.go(next - this.state.index);
    }

    private async renderBody(): Promise<void> {
        if (!this.shadow) return;
        const item = this.state.items[this.state.index];
        const container = this.shadow.querySelector<HTMLElement>('[data-role="content"]');
        if (!container || !item) return;

        const markdown = await resolveContent(item.content);

        const html = renderMarkdownToSanitizedHtml(markdown);
        this.applyHtml(container, html);
        container.scrollTop = 0;
    }

    private async copyCurrent(): Promise<void> {
        if (!this.shadow) return;
        const item = this.state.items[this.state.index];
        if (!item) return;

        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (!btn) return;

        try {
            btn.disabled = true;
            const markdown = await resolveContent(item.content);
            const ok = await copyTextToClipboard(markdown);
            this.setStatus(ok ? t('btnCopied') : t('copyFailed'));
        } finally {
            window.setTimeout(() => this.setStatus(''), 1200);
            btn.disabled = false;
        }
    }

    private async openSourcePanel(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) return;
        const markdown = await resolveContent(item.content);
        sourcePanel.show({ theme: this.state.theme, title: t('modalSourceTitle'), content: markdown });
    }

    private setStatus(text: string): void {
        if (!this.shadow) return;
        const el = this.shadow.querySelector<HTMLElement>('[data-field="status"]');
        if (el) el.textContent = text;
    }

    private render(): void {
        if (!this.shadow) return;

        const total = this.state.items.length;
        const idx = this.state.index;
        const item = this.state.items[idx];

        const titleEl = this.shadow.querySelector<HTMLElement>('[data-field="title"]');
        if (titleEl) {
            const fullTitle = item ? item.userPrompt : t('btnReader');
            titleEl.textContent = this.truncateTitle(fullTitle);
            titleEl.title = fullTitle;
        }
        this.shadow.querySelectorAll<HTMLElement>('[data-field="counter"]').forEach((el) => {
            el.textContent = total > 0 ? `${idx + 1}/${total}` : '';
        });
        const hintEl = this.shadow.querySelector<HTMLElement>('[data-field="pager_hint"]');
        if (hintEl) hintEl.textContent = total > 1 ? t('readerPagerHint') : '';
        const panelEl = this.shadow.querySelector<HTMLElement>('.panel');
        if (panelEl) panelEl.dataset.fullscreen = this.state.fullscreen ? '1' : '0';
        this.renderFullscreenButton();

        this.renderActions();
        this.renderDots();

        const prevBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="prev"]');
        const nextBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="next"]');
        if (prevBtn) prevBtn.disabled = idx <= 0;
        if (nextBtn) nextBtn.disabled = idx >= total - 1;
    }

    private renderActions(): void {
        if (!this.shadow) return;

        const total = this.state.items.length;
        const opts = this.state.options;

        const pagerCore = this.shadow.querySelector<HTMLElement>('[data-role="pager_core"]');
        if (pagerCore) pagerCore.style.display = opts.showNav && total > 0 ? 'flex' : 'none';

        const copyBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (copyBtn) copyBtn.style.display = opts.showCopy ? 'grid' : 'none';

        const sourceBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="source"]');
        if (sourceBtn) sourceBtn.style.display = opts.showSource ? 'grid' : 'none';

        const custom = this.shadow.querySelector<HTMLElement>('[data-role="custom_actions"]');
        if (!custom) return;
        const footerLeft = this.shadow.querySelector<HTMLElement>('[data-role="footer_left_actions"]');
        custom.replaceChildren();
        footerLeft?.replaceChildren();
        const actionCtx = this.getActionContext();
        for (const action of opts.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = actionCtx ? Boolean(action.isActive?.(actionCtx)) : false;
            if (action.icon) {
                const tone = isActive && action.toggle
                    ? 'icon--primary'
                    : action.kind === 'primary'
                        ? 'icon--primary'
                        : action.kind === 'danger'
                            ? 'icon--danger'
                            : '';
                btn.className = `icon ${tone}`.trim();
                btn.title = action.tooltip || action.label;
                btn.setAttribute('aria-label', action.label);
                btn.appendChild(createIcon(action.icon));
            } else {
                btn.className = `chip ${action.kind === 'primary' ? 'chip--primary' : action.kind === 'danger' ? 'chip--danger' : ''}`.trim();
                btn.textContent = action.label;
                btn.setAttribute('aria-label', action.label);
            }
            btn.dataset.active = isActive ? '1' : '0';
            btn.addEventListener('click', async () => {
                const ctx = this.getActionContext();
                if (!ctx) return;
                try {
                    btn.disabled = true;
                    await action.onClick({ ...ctx, anchorEl: btn, shadow: this.shadow || undefined });
                } finally {
                    btn.disabled = false;
                    if (action.rerenderOnClick !== false) {
                        this.render();
                    }
                }
            });
            const placement = action.placement || 'header';
            if (placement === 'footer_left' && footerLeft) footerLeft.appendChild(btn);
            else custom.appendChild(btn);
        }
    }

    private renderDots(): void {
        if (!this.shadow) return;
        const dots = this.shadow.querySelector<HTMLElement>('[data-role="dots"]');
        if (!dots) return;
        const total = this.state.items.length;
        const idx = this.state.index;
        this.clearDotTooltip();
        dots.replaceChildren();
        if (total <= 0) return;

        const sizing = this.calculateDotSizing(total);
        dots.style.setProperty('--aimd-dot-size', `${sizing.size}px`);
        dots.style.setProperty('--aimd-dot-gap', `${sizing.gap}px`);

        // When the total is reasonable, render all dots (legacy-inspired, very scan-friendly).
        // For very large conversations, fall back to a windowed control to avoid hundreds of nodes.
        const renderAllThreshold = 60;
        if (total <= renderAllThreshold) {
            for (let i = 0; i < total; i += 1) {
                dots.appendChild(this.createDot(i, i === idx));
            }
            return;
        }

        const maxDots = 11;
        const windowSize = Math.min(maxDots, total);
        const half = Math.floor(windowSize / 2);
        let start = Math.max(0, idx - half);
        let end = Math.min(total - 1, start + windowSize - 1);
        start = Math.max(0, end - windowSize + 1);

        const pushEllipsis = () => {
            const el = document.createElement('span');
            el.className = 'ellipsis';
            el.textContent = '…';
            el.setAttribute('aria-hidden', 'true');
            dots.appendChild(el);
        };

        if (start > 0) {
            dots.appendChild(this.createDot(0, idx === 0));
            if (start > 1) pushEllipsis();
        }

        const loopStart = start > 0 ? start : 0;
        const loopEnd = end < total - 1 ? end : total - 1;

        for (let i = loopStart; i <= loopEnd; i++) {
            dots.appendChild(this.createDot(i, i === idx));
        }

        if (end < total - 1) {
            if (end < total - 2) pushEllipsis();
            dots.appendChild(this.createDot(total - 1, idx === total - 1));
        }
    }

    private createDot(index: number, active: boolean): HTMLButtonElement {
        const btn = document.createElement('button');
        const item = this.state.items[index];
        const bookmarked = Boolean(item?.meta?.bookmarked);
        btn.type = 'button';
        btn.className = `dot ${active ? 'dot--active' : ''} ${bookmarked ? 'dot--bookmarked' : ''}`.trim();
        btn.setAttribute('aria-label', t('goToPage', String(index + 1)));
        btn.title = `${index + 1}`;
        btn.addEventListener('click', () => this.jumpTo(index));
        btn.addEventListener('mouseenter', () => this.scheduleDotTooltip(btn, index));
        btn.addEventListener('mouseleave', () => this.clearDotTooltip(btn));
        return btn;
    }

    private scheduleDotTooltip(target: HTMLElement, index: number): void {
        this.clearDotTooltip();
        this.dotTooltipTarget = target;
        this.dotTooltipTimer = window.setTimeout(() => {
            if (this.dotTooltipTarget !== target) return;
            const item = this.state.items[index];
            if (!item) return;

            const tooltip = document.createElement('div');
            tooltip.className = 'dot-tooltip';

            const indexEl = document.createElement('span');
            indexEl.className = 'dot-tooltip__index';
            indexEl.textContent = String(index + 1);

            const textEl = document.createElement('span');
            textEl.className = 'dot-tooltip__text';
            textEl.textContent = this.truncatePrompt(item.userPrompt, 50);

            tooltip.append(indexEl, textEl);
            target.appendChild(tooltip);
        }, 150);
    }

    private clearDotTooltip(target?: HTMLElement | null): void {
        if (this.dotTooltipTimer !== null) {
            clearTimeout(this.dotTooltipTimer);
            this.dotTooltipTimer = null;
        }
        const owner = target ?? this.dotTooltipTarget;
        owner?.querySelector('.dot-tooltip')?.remove();
        this.dotTooltipTarget = null;
    }

    private toggleFullscreen(): void {
        this.state.fullscreen = !this.state.fullscreen;
        this.render();
    }

    private renderFullscreenButton(): void {
        if (!this.shadow) return;
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="fullscreen"]');
        if (!btn) return;
        const isFullscreen = this.state.fullscreen;
        const label = isFullscreen ? t('exitFullscreen') : t('toggleFullscreen');
        btn.setAttribute('aria-label', label);
        btn.title = label;
        btn.replaceChildren(createIcon(isFullscreen ? minimizeIcon : maximizeIcon));
    }

    private applyI18nStaticStrings(): void {
        if (!this.shadow) return;
        const panel = this.shadow.querySelector<HTMLElement>('.panel');
        if (panel) panel.setAttribute('aria-label', t('btnReader'));

        const copyBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (copyBtn) {
            copyBtn.setAttribute('aria-label', t('btnCopyText'));
            copyBtn.title = t('btnCopyText');
        }
        const sourceBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="source"]');
        if (sourceBtn) {
            sourceBtn.setAttribute('aria-label', t('btnViewSource'));
            sourceBtn.title = t('btnViewSource');
        }
        this.renderFullscreenButton();
        const closeBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="close"]');
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', t('btnClose'));
            closeBtn.title = t('btnClose');
        }

        const prevBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="prev"]');
        if (prevBtn) prevBtn.setAttribute('aria-label', t('previousMessage'));
        const nextBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="next"]');
        if (nextBtn) nextBtn.setAttribute('aria-label', t('nextMessage'));

        const dots = this.shadow.querySelector<HTMLElement>('[data-role="dots"]');
        if (dots) dots.setAttribute('aria-label', t('paginationLabel'));
    }

    private calculateDotSizing(total: number): { size: number; gap: number } {
        // Legacy-inspired tiers (also keeps "Apple page control" density reasonable).
        if (total <= 10) return { size: 10, gap: 10 };
        if (total <= 20) return { size: 9, gap: 8 };
        if (total <= 35) return { size: 8, gap: 6 };
        if (total <= 50) return { size: 7, gap: 5 };
        return { size: 6, gap: 4 };
    }

    private truncateTitle(text: string): string {
        const chars = Array.from(text || '');
        if (chars.length <= 40) return text;
        return `${chars.slice(0, 40).join('')}…`;
    }

    private truncatePrompt(text: string, maxLength: number): string {
        const chars = Array.from(text || '');
        if (chars.length <= maxLength) return text;
        return `${chars.slice(0, maxLength).join('')}…`;
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
        return `
<div class="overlay" data-role="overlay"></div>
<div class="panel" role="dialog" aria-modal="true" aria-label="${t('btnReader')}">
  <div class="header">
    <div class="title" data-field="title"></div>
    <div class="header-right">
      <div class="custom-actions" data-role="custom_actions"></div>
      <button class="icon" data-action="copy" aria-label="${t('btnCopyText')}" title="${t('btnCopyText')}">${copyIcon}</button>
      <button class="icon" data-action="source" aria-label="${t('btnViewSource')}" title="${t('btnViewSource')}">${fileCodeIcon}</button>
      <button class="icon" data-action="fullscreen" aria-label="${t('toggleFullscreen')}" title="${t('toggleFullscreen')}">${maximizeIcon}</button>
      <button class="icon" data-action="close" aria-label="${t('btnClose')}" title="${t('btnClose')}">${xIcon}</button>
    </div>
  </div>
  <div class="body">
    <div class="markdown-body" data-role="content"></div>
  </div>
  <div class="footer">
    <div class="footer-left" data-role="footer_left_actions"></div>
    <div class="pager-core" data-role="pager_core">
      <button class="nav-btn nav-btn--prev" data-action="prev" aria-label="${t('previousMessage')}">${chevronRightIcon}</button>
      <div class="dots" data-role="dots" aria-label="${t('paginationLabel')}"></div>
      <button class="nav-btn nav-btn--next" data-action="next" aria-label="${t('nextMessage')}">${chevronRightIcon}</button>
    </div>
    <div class="footer-meta" data-role="footer_meta">
      <div class="counter counter--footer" data-field="counter"></div>
      <div class="hint" data-field="pager_hint"></div>
      <div class="status" data-field="status"></div>
    </div>
  </div>
</div>
`;
    }

    private getCss(): string {
        const katexUrl = (() => {
            try {
                return browser.runtime.getURL('vendor/katex/katex.min.css');
            } catch {
                return '';
            }
        })();

        return `
${getTokenCss(this.state.theme)}
${katexUrl ? `@import url("${katexUrl}");` : ''}

/* Reset (shadow-scoped) */
:host { font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }

.overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-overlay-bg);
}

.panel {
  position: fixed;
  top: var(--aimd-panel-top);
  left: 50%;
  transform: translateX(-50%);
  width: var(--aimd-panel-width);
  max-width: var(--aimd-panel-max-width);
  height: var(--aimd-panel-height);
  /* Gmail/Material-like solid surface (no blur/sheens). */
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 16px;
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: top var(--aimd-duration-base) var(--aimd-ease-in-out),
              left var(--aimd-duration-base) var(--aimd-ease-in-out),
              width var(--aimd-duration-base) var(--aimd-ease-in-out),
              max-width var(--aimd-duration-base) var(--aimd-ease-in-out),
              height var(--aimd-duration-base) var(--aimd-ease-in-out),
              border-radius var(--aimd-duration-base) var(--aimd-ease-in-out),
              transform var(--aimd-duration-base) var(--aimd-ease-in-out);
}

.panel[data-fullscreen="1"] {
  top: 0;
  left: 0;
  transform: none;
  width: 100vw;
  max-width: none;
  height: 100vh;
  border-radius: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 12px 14px;
  background: var(--aimd-bg-primary);
  border-bottom: 1px solid var(--aimd-border-default);
}

.title {
  font-size: var(--aimd-font-size-sm);
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.header-right { display: flex; align-items: center; gap: 8px; }
.counter { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }

.icon {
  all: unset;
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: color-mix(in srgb, var(--aimd-text-primary) 82%, transparent);
  border: 1px solid transparent;
  background: transparent;
  transition: background 150ms ease, transform 120ms ease;
}
.icon svg { width: 18px; height: 18px; display: block; }
.icon:hover {
  background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent);
}
.icon:active { transform: none; background: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent); }
.icon:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
  box-shadow: none;
}
.icon--primary:hover { background: var(--aimd-interactive-primary-hover); }
.icon--danger {
  background: color-mix(in srgb, var(--aimd-state-error-border) 16%, transparent);
  border-color: transparent;
  color: var(--aimd-text-primary);
  box-shadow: none;
}
.icon--danger:hover { background: color-mix(in srgb, var(--aimd-state-error-border) 24%, transparent); }

.body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px 10px;
}

.footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px 14px 12px;
  background: var(--aimd-bg-primary);
  border-top: 1px solid var(--aimd-border-default);
}

.footer-left {
  position: relative;
  justify-self: start;
  display: flex;
  align-items: center;
  min-height: 36px;
  min-width: 0;
}

.custom-actions { display: flex; gap: 8px; align-items: center; }
.pager-core {
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 45%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 55%, transparent);
}
.dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-dot-gap, 8px);
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
}
.counter--footer {
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ellipsis { color: var(--aimd-text-secondary); font-size: 12px; padding: 0 2px; }
.dot {
  all: unset;
  cursor: pointer;
  width: var(--aimd-dot-size, 8px);
  height: var(--aimd-dot-size, 8px);
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-text-secondary) 38%, transparent);
  position: relative;
  transition: transform 160ms ease, background 160ms ease, width 160ms ease, border-radius 160ms ease, box-shadow 160ms ease;
}
.dot:hover { background: color-mix(in srgb, var(--aimd-text-secondary) 68%, transparent); transform: scale(1.18); }
.dot--active {
  width: calc(var(--aimd-dot-size, 8px) * 1.7);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 18%, transparent);
}
.dot--bookmarked {
  border-radius: 3px;
  background: color-mix(in srgb, var(--aimd-interactive-primary) 72%, transparent);
}
.dot--bookmarked.dot--active {
  width: calc(var(--aimd-dot-size, 8px) * 1.5);
  border-radius: 4px;
  background: var(--aimd-interactive-primary);
}
.nav-btn {
  all: unset;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  color: var(--aimd-text-primary);
}
.nav-btn:hover { background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent); }
.nav-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.nav-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.nav-btn svg { width: 14px; height: 14px; display: block; }
.nav-btn--prev svg { transform: rotate(180deg); }

.chip {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 28%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 55%, transparent);
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-primary);
}
.chip:hover { background: color-mix(in srgb, var(--aimd-bg-primary) 42%, transparent); }
.chip:disabled { opacity: 0.55; cursor: not-allowed; }
.chip--primary { background: color-mix(in srgb, var(--aimd-interactive-primary) 92%, transparent); color: var(--aimd-text-on-primary); border-color: transparent; }
.chip--primary:hover { background: color-mix(in srgb, var(--aimd-interactive-primary-hover) 92%, transparent); }
.chip--danger { border-color: var(--aimd-state-error-border); }

.footer-meta {
  justify-self: end;
  display: grid;
  justify-items: end;
  gap: 2px;
  min-height: 36px;
}

.hint {
  font-size: 11px;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--aimd-text-secondary) 88%, transparent);
  white-space: nowrap;
}

.status {
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
  white-space: nowrap;
  min-width: 0;
}

.dot-tooltip {
  position: absolute;
  bottom: calc(100% + var(--aimd-space-2));
  left: 50%;
  transform: translate(-50%, 4px);
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 132px;
  max-width: 260px;
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-sys-color-surface-frosted);
  color: var(--aimd-text-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  box-shadow: var(--aimd-shadow-lg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
  opacity: 1;
  z-index: var(--aimd-z-tooltip);
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.dot-tooltip::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  background: inherit;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
}

.dot-tooltip__index {
  font-size: 18px;
  line-height: 1;
  color: var(--aimd-interactive-primary);
  font-weight: 700;
}

.dot-tooltip__text {
  font-size: var(--aimd-text-lg);
  line-height: 1.4;
  color: color-mix(in srgb, var(--aimd-text-primary) 88%, transparent);
  white-space: normal;
  word-break: break-word;
}

/* Send popover (Reader footer-left) */
.aimd-send-popover {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: min(520px, calc(100vw - 48px));
  max-width: 520px;
  font-family: var(--aimd-font-family-sans);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 12px;
  box-shadow: var(--aimd-shadow-panel);
  padding: 10px;
  display: grid;
  gap: 10px;
}
.aimd-send-popover::after {
  content: "";
  position: absolute;
  left: 18px;
  bottom: -7px;
  width: 12px;
  height: 12px;
  background: var(--aimd-bg-primary);
  border-right: 1px solid var(--aimd-border-default);
  border-bottom: 1px solid var(--aimd-border-default);
  transform: rotate(45deg);
}
.aimd-send-popover .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aimd-send-popover .title {
  font-size: 14px;
  font-weight: 650;
}
.aimd-send-popover .icon {
  width: 34px;
  height: 34px;
  border-radius: 999px;
}
.aimd-send-popover .input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-size: 13px;
  line-height: 1.45;
  outline: none;
}
.aimd-send-popover .input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  outline-offset: 2px;
}
.aimd-send-popover .foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aimd-send-popover .status {
  min-height: 18px;
  color: var(--aimd-text-secondary);
}
.aimd-send-popover .actions { display: flex; gap: 8px; align-items: center; }
.aimd-send-popover .btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: transparent;
  color: var(--aimd-text-primary);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.aimd-send-popover .btn:hover { background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent); }
.aimd-send-popover .btn:active { background: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent); }
.aimd-send-popover .btn:disabled { opacity: 0.55; cursor: not-allowed; }
.aimd-send-popover .btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}
.aimd-send-popover .btn--primary:hover { background: var(--aimd-interactive-primary-hover); }
.aimd-send-popover .btn--primary .aimd-icon svg { width: 16px; height: 16px; }

/* Markdown styling (shadow-isolated, legacy-inspired) */
.markdown-body {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 1000px;
  margin-inline: auto;
  font-family: var(--aimd-font-family-sans);
  color: var(--aimd-text-primary);
  font-size: 15px;
  line-height: 1.65;
  word-wrap: break-word;
}
.markdown-body h1, .markdown-body h2 {
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  padding-bottom: 0.3em;
}
.markdown-body code {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 84%, var(--aimd-text-primary) 16%);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  padding: 0.16em 0.4em;
  border-radius: 6px;
  font-family: var(--aimd-font-family-mono);
  font-size: 0.9em;
}
.markdown-body pre {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 75%, transparent);
  padding: 14px;
  border-radius: 12px;
  overflow: auto;
  margin: 1em 0;
}
.markdown-body pre code { background: transparent; border: none; padding: 0; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body th, .markdown-body td { border: 1px solid color-mix(in srgb, var(--aimd-border-default) 75%, transparent); padding: 6px 10px; }
.markdown-body blockquote {
  border-left: 4px solid color-mix(in srgb, var(--aimd-border-default) 85%, transparent);
  padding-left: 14px;
  color: var(--aimd-text-secondary);
}
`;
    }

    private applyHtml(container: HTMLElement, html: string): void {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const wrapper = doc.body.firstElementChild as HTMLElement | null;
        if (!wrapper) {
            container.replaceChildren();
            return;
        }
        const fragment = document.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach((node) => fragment.appendChild(node));
        container.replaceChildren(fragment);
    }
}
