import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { bookmarkCheckIcon, bookmarkIcon, chevronRightIcon, messageSquareTextIcon, splitViewIcon } from '../../../assets/icons';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import type { Theme } from '../../../core/types/theme';
import {
    collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';

const HOST_ID = 'aimd-chatgpt-message-stepper';
const STYLE_ID = 'aimd-chatgpt-message-stepper-style';
const NAVIGATION_SETTLE_MS = 1200;

function getPortalTokenCss(selector: string, overrides: UserThemeOverrides = {}): string {
    const light = getTokenCss('light', overrides).replace(/:host/g, `${selector}[data-aimd-theme="light"]`);
    const dark = getTokenCss('dark', overrides).replace(/:host/g, `${selector}[data-aimd-theme="dark"]`);
    return `${light}\n${dark}`;
}

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function isEditableElement(node: EventTarget | null): boolean {
    if (!(node instanceof HTMLElement)) return false;
    const tag = node.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (node.isContentEditable) return true;
    if (node.getAttribute('contenteditable') === 'true') return true;
    if (node.getAttribute('role') === 'textbox') return true;
    return false;
}

function isExtensionSurfaceElement(node: EventTarget | null): boolean {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest([
        '[data-aimd-role]',
        '#aimd-bookmarks-panel-host',
        '#aimd-reader-panel-host',
        '#aimd-send-modal-host',
        '#aimd-bookmark-save-dialog-host',
        '#aimd-changelog-notice-host',
        '.aimd-message-toolbar-host',
        '.send-popover',
        '.aimd-field-control',
    ].join(',')));
}

function getRoundRange(round: ChatGPTRoundPosition): { top: number; bottom: number } | null {
    const nodes = round.groupEls.length ? round.groupEls : [round.jumpAnchor];
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
        if (!node.isConnected) continue;
        const rect = node.getBoundingClientRect();
        if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) continue;
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
    }
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
    return { top, bottom };
}

function getRangeDistanceFromReference(range: { top: number; bottom: number }, referenceY: number): number {
    if (referenceY < range.top) return range.top - referenceY;
    if (referenceY > range.bottom) return referenceY - range.bottom;
    return 0;
}

export class ChatGPTMessageStepperController {
    private initialized = false;
    private keyboardEnabled = true;
    private navigationVisibleEnabled = true;
    private pageBookmarkVisibleEnabled = true;
    private detachedReaderVisibleEnabled = true;
    private promptVisibleEnabled = true;
    private pageBookmarked = false;
    private pageBookmarkStatusUrl: string | null = null;
    private host: HTMLDivElement | null = null;
    private pageBookmarkButton: HTMLButtonElement | null = null;
    private detachedReaderButton: HTMLButtonElement | null = null;
    private promptsButton: HTMLButtonElement | null = null;
    private previousButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private rounds: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private mutationObserver: MutationObserver | null = null;
    private refreshAnimationFrame: number | null = null;
    private navigationLockUntil = 0;
    private navigationRequestId = 0;
    private themeOverrides: UserThemeOverrides = {};
    private theme: Theme = this.resolveInitialTheme();

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly options: {
            onOpenDetachedReader?: () => Promise<void> | void;
            onOpenPrompts?: (anchor: HTMLElement) => Promise<void> | void;
            onTogglePageBookmark?: () => Promise<{ saved: boolean }> | { saved: boolean } | void;
            onRefreshPageBookmarkState?: (url: string) => Promise<boolean> | boolean;
        } = {},
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureHost();
        this.refreshState();
        document.addEventListener('keydown', this.onKeyDownCapture, { capture: true });
        window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
        document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
        this.bindMutationObserver();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('keydown', this.onKeyDownCapture, { capture: true } as any);
        window.removeEventListener('scroll', this.onScroll, { capture: true } as any);
        document.removeEventListener('scroll', this.onScroll, { capture: true } as any);
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        if (this.refreshAnimationFrame !== null) {
            window.cancelAnimationFrame(this.refreshAnimationFrame);
            this.refreshAnimationFrame = null;
        }
        this.host?.remove();
        this.host = null;
        this.pageBookmarkButton = null;
        this.detachedReaderButton = null;
        this.promptsButton = null;
        this.previousButton = null;
        this.nextButton = null;
        this.rounds = [];
        this.activePosition = 0;
        this.navigationLockUntil = 0;
        this.navigationRequestId += 1;
        this.pageBookmarkStatusUrl = null;
    }

    setKeyboardEnabled(enabled: boolean): void {
        this.keyboardEnabled = enabled;
    }

    setVisible(enabled: boolean): void {
        this.navigationVisibleEnabled = enabled;
        if (!this.initialized) return;
        this.ensureHost();
        this.syncNavigationVisibility();
        this.refreshState();
    }

    setPageBookmarkControlVisible(enabled: boolean): void {
        this.pageBookmarkVisibleEnabled = enabled;
        if (!this.initialized) return;
        this.ensureHost();
        this.syncPageBookmarkButton();
        this.refreshState();
    }

    setDetachedReaderControlVisible(enabled: boolean): void {
        this.detachedReaderVisibleEnabled = enabled;
        if (!this.initialized) return;
        this.ensureHost();
        this.syncAuxiliaryButtonVisibility();
        this.refreshState();
    }

    setPromptControlVisible(enabled: boolean): void {
        this.promptVisibleEnabled = enabled;
        if (!this.initialized) return;
        this.ensureHost();
        this.syncAuxiliaryButtonVisibility();
        this.refreshState();
    }

    setPageBookmarked(saved: boolean): void {
        this.pageBookmarked = saved;
        this.syncPageBookmarkButton();
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.ensureStyle({ force: true });
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        if (this.host) this.host.setAttribute('data-aimd-theme', theme);
        this.ensureStyle({ force: true });
    }

    private ensureHost(): void {
        if (this.host?.isConnected) return;
        const existing = document.getElementById(HOST_ID);
        if (existing instanceof HTMLDivElement) existing.remove();
        this.ensureStyle();
        const host = document.createElement('div');
        host.id = HOST_ID;
        host.className = 'aimd-chatgpt-message-stepper';
        host.dataset.aimdRole = 'chatgpt-message-stepper';
        host.dataset.visible = '0';
        host.setAttribute('data-aimd-theme', this.theme);

        const pageBookmark = this.createButton('toggle-page-bookmark', 'Bookmark current page', () => {
            void this.handlePageBookmarkClick();
        }, bookmarkIcon);
        const previous = this.createButton('previous-message', 'Previous message', () => this.step(-1));
        const next = this.createButton('next-message', 'Next message', () => this.step(1));
        const detachedReader = this.createButton('open-detached-reader', 'Open Reader in split view', () => {
            void this.options.onOpenDetachedReader?.();
        }, splitViewIcon);
        const prompts = this.createButton('open-prompts', 'Prompts', () => {
            if (prompts.hidden || prompts.disabled) return;
            void this.options.onOpenPrompts?.(prompts);
        }, messageSquareTextIcon);
        previous.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon')!.dataset.direction = 'left';
        next.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon')!.dataset.direction = 'right';
        host.append(pageBookmark, detachedReader, prompts, previous, next);
        document.body.appendChild(host);
        this.host = host;
        this.pageBookmarkButton = pageBookmark;
        this.detachedReaderButton = detachedReader;
        this.promptsButton = prompts;
        this.previousButton = previous;
        this.nextButton = next;
        this.syncNavigationVisibility();
        this.syncPageBookmarkButton();
        this.syncAuxiliaryButtonVisibility();
    }

    private createButton(action: string, label: string, onClick: () => void, icon: string = chevronRightIcon): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aimd-chatgpt-message-stepper__button';
        button.dataset.action = action;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.innerHTML = `<span class="aimd-chatgpt-message-stepper__icon">${icon}</span>`;
        button.addEventListener('click', () => {
            if (button.disabled || button.hidden) return;
            onClick();
        });
        return button;
    }

    private ensureStyle(options: { force?: boolean } = {}): void {
        let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        if (!options.force && style.textContent) return;
        style.textContent = this.getCss();
    }

    private getCss(): string {
        return `${getPortalTokenCss('.aimd-chatgpt-message-stepper', this.themeOverrides)}
.aimd-chatgpt-message-stepper {
  position: fixed;
  right: var(--aimd-space-4);
  bottom: 0;
  z-index: var(--aimd-z-panel);
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  pointer-events: auto;
  font-family: var(--aimd-font-family-sans);
}
.aimd-chatgpt-message-stepper[data-visible="0"] {
  display: none;
}
.aimd-chatgpt-message-stepper__button {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-secondary);
  background: transparent;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-chatgpt-message-stepper__button:hover:not(:disabled),
.aimd-chatgpt-message-stepper__button:focus-visible:not(:disabled) {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-button-icon-hover);
}
.aimd-chatgpt-message-stepper__button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}
.aimd-chatgpt-message-stepper__button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.aimd-chatgpt-message-stepper__button[data-active="1"] {
  color: var(--aimd-interactive-primary);
}
.aimd-chatgpt-message-stepper__button[hidden] {
  display: none;
}
.aimd-chatgpt-message-stepper__icon,
.aimd-chatgpt-message-stepper__icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.aimd-chatgpt-message-stepper__icon[data-direction="left"] {
  transform: scaleX(-1);
}
`;
    }

    private bindMutationObserver(): void {
        this.mutationObserver?.disconnect();
        this.mutationObserver = new MutationObserver((mutations) => {
            if (!this.shouldRefreshForMutations(mutations)) return;
            this.scheduleRefreshState();
        });
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    private shouldRefreshForMutations(mutations: MutationRecord[]): boolean {
        for (const mutation of mutations) {
            if (isExtensionSurfaceElement(mutation.target)) continue;
            for (const node of Array.from(mutation.addedNodes || [])) {
                if (isExtensionSurfaceElement(node)) continue;
                if (node instanceof Element && this.nodeMayContainConversationTurn(node)) return true;
            }
            for (const node of Array.from(mutation.removedNodes || [])) {
                if (isExtensionSurfaceElement(node)) continue;
                if (node instanceof Element && this.nodeMayContainConversationTurn(node)) return true;
            }
        }
        return false;
    }

    private nodeMayContainConversationTurn(node: Element): boolean {
        const selector = '[data-turn-id-container], [data-turn="user"], [data-turn="assistant"], [data-message-author-role="user"], [data-message-author-role="assistant"], [data-testid^="conversation-turn-"]';
        try {
            return node.matches(selector) || node.querySelector(selector) instanceof HTMLElement;
        } catch {
            return false;
        }
    }

    private onScroll = (): void => {
        this.scheduleRefreshState();
    };

    private scheduleRefreshState(): void {
        if (!this.initialized || this.refreshAnimationFrame !== null) return;
        this.refreshAnimationFrame = window.requestAnimationFrame(() => {
            this.refreshAnimationFrame = null;
            this.refreshState();
        });
    }

    private onKeyDownCapture = (event: KeyboardEvent): void => {
        if (!this.keyboardEnabled) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (event.defaultPrevented || event.isComposing) return;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (this.shouldIgnoreKeyboardEvent(event)) return;
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        if (!this.step(delta)) return;
        event.preventDefault();
    };

    private shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (isEditableElement(node) || isExtensionSurfaceElement(node)) return true;
        }
        const active = document.activeElement;
        return isEditableElement(active) || isExtensionSurfaceElement(active);
    }

    private step(delta: -1 | 1): boolean {
        this.refreshState({ preserveLogicalPosition: true });
        const activeIndex = this.getActiveIndex();
        if (activeIndex < 0) return false;
        const target = this.rounds[activeIndex + delta];
        if (!target) return false;
        const requestId = this.navigationRequestId + 1;
        this.navigationRequestId = requestId;
        this.activePosition = target.position;
        this.navigationLockUntil = Date.now() + NAVIGATION_SETTLE_MS;
        this.syncButtons();
        void navigateChatGPTDirectoryTarget(this.adapter, {
            position: target.position,
            messageId: target.messageId,
        }).then((result) => {
            if (requestId !== this.navigationRequestId) return;
            if (!result.ok) {
                this.navigationLockUntil = 0;
                this.refreshState();
                return;
            }
            this.activePosition = target.position;
            this.navigationLockUntil = Date.now() + NAVIGATION_SETTLE_MS;
            this.syncButtons();
        });
        return true;
    }

    private getActiveIndex(): number {
        return this.rounds.findIndex((round) => round.position === this.activePosition);
    }

    private refreshState(options: { preserveLogicalPosition?: boolean } = {}): void {
        if (!this.initialized) return;
        this.ensureHost();
        this.rounds = collectChatGPTRoundPositions(this.adapter);
        const visible = this.adapter.getPlatformId() === 'chatgpt'
            && this.rounds.length > 0
            && (isChatGPTConversationPage(window.location.href) || this.rounds.length > 0);
        if (this.host) {
            this.host.dataset.visible = visible ? '1' : '0';
            this.host.setAttribute('data-aimd-theme', this.theme);
        }
        this.refreshPageBookmarkStatusIfNeeded();
        if (!visible) {
            this.activePosition = 0;
            this.syncButtons();
            return;
        }
        const canPreserveLogicalPosition = (
            (options.preserveLogicalPosition || Date.now() < this.navigationLockUntil)
            && this.rounds.some((round) => round.position === this.activePosition)
        );
        if (canPreserveLogicalPosition) {
            this.syncButtons();
            return;
        }
        this.activePosition = this.resolveActivePosition();
        this.syncButtons();
    }

    private resolveActivePosition(): number {
        if (this.rounds.length === 0) return 0;
        const referenceY = Math.round(window.innerHeight * 0.35);
        const ranges = this.rounds
            .map((round) => {
                const range = getRoundRange(round);
                return range ? { position: round.position, ...range } : null;
            })
            .filter((range): range is { position: number; top: number; bottom: number } => range !== null);
        const visible = ranges.find((range) => range.top <= referenceY && range.bottom >= referenceY);
        if (visible) return visible.position;
        if (ranges.length > 0) {
            let nearest = ranges[0]!;
            let nearestDistance = getRangeDistanceFromReference(nearest, referenceY);
            for (const range of ranges.slice(1)) {
                const distance = getRangeDistanceFromReference(range, referenceY);
                if (distance < nearestDistance) {
                    nearest = range;
                    nearestDistance = distance;
                }
            }
            return nearest.position;
        }
        return this.rounds[0]?.position ?? 0;
    }

    private syncButtons(): void {
        this.syncNavigationVisibility();
        const activeIndex = this.getActiveIndex();
        const canGoPrevious = activeIndex > 0;
        const canGoNext = activeIndex >= 0 && activeIndex < this.rounds.length - 1;
        if (this.previousButton) {
            this.previousButton.disabled = !canGoPrevious;
            this.previousButton.dataset.disabled = this.previousButton.disabled ? '1' : '0';
        }
        if (this.nextButton) {
            this.nextButton.disabled = !canGoNext;
            this.nextButton.dataset.disabled = this.nextButton.disabled ? '1' : '0';
        }
    }

    private syncNavigationVisibility(): void {
        for (const button of [this.previousButton, this.nextButton]) {
            if (!button) continue;
            button.hidden = !this.navigationVisibleEnabled;
        }
    }

    private syncAuxiliaryButtonVisibility(): void {
        if (this.detachedReaderButton) this.detachedReaderButton.hidden = !this.detachedReaderVisibleEnabled;
        if (this.promptsButton) this.promptsButton.hidden = !this.promptVisibleEnabled;
    }

    private syncPageBookmarkButton(): void {
        if (!this.pageBookmarkButton) return;
        const visible = this.pageBookmarkVisibleEnabled && isChatGPTConversationPage(window.location.href);
        this.pageBookmarkButton.hidden = !visible;
        this.pageBookmarkButton.dataset.active = this.pageBookmarked ? '1' : '0';
        this.pageBookmarkButton.setAttribute('aria-label', this.pageBookmarked ? 'Remove page bookmark' : 'Bookmark current page');
        this.pageBookmarkButton.setAttribute('title', this.pageBookmarked ? 'Remove page bookmark' : 'Bookmark current page');
        const iconEl = this.pageBookmarkButton.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon');
        if (iconEl) iconEl.innerHTML = this.pageBookmarked ? bookmarkCheckIcon : bookmarkIcon;
    }

    private refreshPageBookmarkStatusIfNeeded(): void {
        const url = window.location.href.split('#')[0] || window.location.href;
        if (!this.pageBookmarkVisibleEnabled || !isChatGPTConversationPage(url)) {
            this.pageBookmarkStatusUrl = null;
            this.pageBookmarked = false;
            this.syncPageBookmarkButton();
            return;
        }
        if (this.pageBookmarkStatusUrl === url) {
            this.syncPageBookmarkButton();
            return;
        }
        this.pageBookmarkStatusUrl = url;
        void Promise.resolve(this.options.onRefreshPageBookmarkState?.(url) ?? false).then((saved) => {
            if (this.pageBookmarkStatusUrl !== url) return;
            this.setPageBookmarked(Boolean(saved));
        }).catch(() => {
            if (this.pageBookmarkStatusUrl === url) this.setPageBookmarked(false);
        });
    }

    private async handlePageBookmarkClick(): Promise<void> {
        if (!this.pageBookmarkButton || this.pageBookmarkButton.hidden || this.pageBookmarkButton.disabled) return;
        const result = await this.options.onTogglePageBookmark?.();
        if (result && typeof result.saved === 'boolean') {
            this.setPageBookmarked(result.saved);
        }
    }

    private resolveInitialTheme(): Theme {
        return document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light';
    }
}
