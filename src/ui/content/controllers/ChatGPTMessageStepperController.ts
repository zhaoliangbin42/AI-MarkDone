import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { bookmarkCheckIcon, bookmarkIcon, chevronRightIcon, Icons, messageSquareTextIcon, refreshCwIcon, splitViewIcon } from '../../../assets/icons';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import type { Theme } from '../../../core/types/theme';
import { subscribeLocaleChange, t } from '../components/i18n';
import {
    navigateChatGPTDirectoryTarget,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';
import { ChatGPTActivePositionTracker } from './ChatGPTActivePositionTracker';
import { showEphemeralTooltip } from '../../../utils/tooltip';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import {
    AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE,
    type ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';

const HOST_ID = 'aimd-chatgpt-message-stepper';
const STYLE_ID = 'aimd-chatgpt-message-stepper-style';
const TOKEN_STYLE_ID = 'aimd-chatgpt-message-stepper-tokens';
const NAVIGATION_SETTLE_MS = 1200;

export type PageBookmarkStatusResult =
    | { ok: true; saved: boolean }
    | { ok: false; message: string };

export type PageBookmarkMutationResult =
    | { ok: true; saved: boolean }
    | { ok: false; message: string }
    | { ok: false; cancelled: true };

type PageBookmarkState = 'unknown' | 'saved' | 'unsaved';

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
        '#aimd-bookmark-save-dialog-host',
        '#aimd-changelog-notice-host',
        '.aimd-message-toolbar-host',
        '.send-popover',
        '.aimd-field-control',
    ].join(',')));
}

export class ChatGPTMessageStepperController {
    private initialized = false;
    private keyboardEnabled = true;
    private navigationVisibleEnabled = true;
    private pageBookmarkVisibleEnabled = true;
    private detachedReaderVisibleEnabled = true;
    private promptVisibleEnabled = true;
    private pageBookmarkState: PageBookmarkState = 'unknown';
    private pageBookmarkError: string | null = null;
    private pageBookmarkMutationPending = false;
    private pageBookmarkStatusUrl: string | null = null;
    private pageBookmarkRequestId = 0;
    private host: HTMLDivElement | null = null;
    private appearanceScope: AppearanceScope | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot(this.resolveInitialTheme());
    private bookmarksPanelButton: HTMLButtonElement | null = null;
    private pageBookmarkButton: HTMLButtonElement | null = null;
    private detachedReaderButton: HTMLButtonElement | null = null;
    private promptsButton: HTMLButtonElement | null = null;
    private messageNavigationButton: HTMLButtonElement | null = null;
    private previousButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private rounds: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private unsubscribeSurface: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private readonly activePositionTracker: ChatGPTActivePositionTracker;
    private unsubscribeActivePosition: (() => void) | null = null;
    private refreshAnimationFrame: number | null = null;
    private navigationLockUntil = 0;
    private navigationRequestId = 0;

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly options: {
            onOpenBookmarksPanel?: () => Promise<void> | void;
            onOpenDetachedReader?: () => Promise<void> | void;
            onOpenPrompts?: (anchor: HTMLElement) => Promise<void> | void;
            onRefreshMessageNavigation?: () => Promise<void> | void;
            onTogglePageBookmark?: (url: string) => Promise<PageBookmarkMutationResult> | PageBookmarkMutationResult;
            onRefreshPageBookmarkState?: (url: string) => Promise<PageBookmarkStatusResult> | PageBookmarkStatusResult;
            surface: ConversationSurfacePortV1;
            navigation?: ConversationNavigationPortV1 | null;
            activePositionTracker?: ChatGPTActivePositionTracker;
        },
    ) {
        this.activePositionTracker = options.activePositionTracker
            ?? new ChatGPTActivePositionTracker(options.surface);
    }

    private get surface(): ConversationSurfacePortV1 {
        return this.options.surface;
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureHost();
        this.unsubscribeLocale = subscribeLocaleChange(() => this.syncControlLabels());
        this.unsubscribeActivePosition = this.activePositionTracker.subscribe((state) => {
            this.rounds = state.rounds;
            if (Date.now() >= this.navigationLockUntil) this.activePosition = state.activePosition;
            this.syncButtons();
        });
        this.refreshState();
        document.addEventListener('keydown', this.onKeyDownCapture, { capture: true });
        this.unsubscribeSurface = this.surface.subscribeFrame(() => {
            this.activePositionTracker.invalidate();
            this.scheduleRefreshState();
        });
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('keydown', this.onKeyDownCapture, { capture: true } as any);
        this.unsubscribeActivePosition?.();
        this.unsubscribeActivePosition = null;
        this.unsubscribeSurface?.();
        this.unsubscribeSurface = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        if (this.refreshAnimationFrame !== null) {
            window.cancelAnimationFrame(this.refreshAnimationFrame);
            this.refreshAnimationFrame = null;
        }
        this.appearanceScope?.dispose();
        this.appearanceScope = null;
        this.host?.remove();
        this.host = null;
        this.bookmarksPanelButton = null;
        this.pageBookmarkButton = null;
        this.detachedReaderButton = null;
        this.promptsButton = null;
        this.messageNavigationButton = null;
        this.previousButton = null;
        this.nextButton = null;
        this.rounds = [];
        this.activePosition = 0;
        this.navigationLockUntil = 0;
        this.navigationRequestId += 1;
        this.pageBookmarkRequestId += 1;
        this.pageBookmarkStatusUrl = null;
        this.pageBookmarkState = 'unknown';
        this.pageBookmarkError = null;
        this.pageBookmarkMutationPending = false;
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
        this.pageBookmarkState = saved ? 'saved' : 'unsaved';
        this.pageBookmarkError = null;
        this.syncPageBookmarkButton();
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.appearanceScope?.apply(snapshot);
    }

    private ensureHost(): void {
        if (this.host?.isConnected) {
            this.appearanceScope?.apply(this.appearance);
            return;
        }
        const existing = document.getElementById(HOST_ID);
        if (existing instanceof HTMLDivElement) existing.remove();
        this.appearanceScope?.dispose();
        this.appearanceScope = null;
        this.ensureStyle();
        const host = document.createElement('div');
        host.id = HOST_ID;
        host.className = 'aimd-chatgpt-message-stepper';
        host.dataset.aimdRole = 'chatgpt-message-stepper';
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        host.dataset.visible = '0';

        const bookmarksPanel = this.createButton('open-bookmarks-panel', this.getLabel('bookmarks', 'Bookmarks'), () => {
            void this.options.onOpenBookmarksPanel?.();
        }, Icons.createBrandIcon());
        const pageBookmark = this.createButton('toggle-page-bookmark', this.getLabel('chatgptPageControlBookmark', 'Bookmark current page'), () => {
            void this.handlePageBookmarkClick();
        }, bookmarkIcon);
        const previous = this.createButton('previous-message', this.getLabel('previousMessage', 'Previous message'), () => this.step(-1));
        const next = this.createButton('next-message', this.getLabel('nextMessage', 'Next message'), () => this.step(1));
        const detachedReader = this.createButton('open-detached-reader', this.getLabel('chatgptPageControlSplitView', 'Open Reader in split view'), () => {
            void this.options.onOpenDetachedReader?.();
        }, splitViewIcon);
        const prompts = this.createButton('open-prompts', this.getLabel('chatgptPageControlPrompts', 'Prompts'), () => {
            if (prompts.hidden || prompts.disabled) return;
            void this.options.onOpenPrompts?.(prompts);
        }, messageSquareTextIcon);
        const refreshMessageNavigation = this.createButton(
            'chatgpt-refresh-message-navigation',
            this.getLabel('chatgptRefreshMessageNavigation', 'Refresh message navigation'),
            () => {
                void this.options.onRefreshMessageNavigation?.();
            },
            refreshCwIcon,
        );
        previous.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon')!.dataset.direction = 'left';
        next.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon')!.dataset.direction = 'right';
        host.append(bookmarksPanel, pageBookmark, detachedReader, prompts, refreshMessageNavigation, previous, next);
        document.body.appendChild(host);
        this.host = host;
        this.appearanceScope = AppearanceScope.forLightDomPortal(host, {
            selector: '.aimd-chatgpt-message-stepper',
            styleId: TOKEN_STYLE_ID,
        });
        this.appearanceScope.apply(this.appearance);
        this.bookmarksPanelButton = bookmarksPanel;
        this.pageBookmarkButton = pageBookmark;
        this.detachedReaderButton = detachedReader;
        this.promptsButton = prompts;
        this.messageNavigationButton = refreshMessageNavigation;
        this.previousButton = previous;
        this.nextButton = next;
        this.syncNavigationVisibility();
        this.syncPageBookmarkButton();
        this.syncAuxiliaryButtonVisibility();
    }

    private getLabel(key: string, fallback: string): string {
        const label = t(key);
        return !label || label === key ? fallback : label;
    }

    private syncControlLabels(): void {
        const labels: ReadonlyArray<[HTMLButtonElement | null, string]> = [
            [this.bookmarksPanelButton, this.getLabel('bookmarks', 'Bookmarks')],
            [this.detachedReaderButton, this.getLabel('chatgptPageControlSplitView', 'Open Reader in split view')],
            [this.promptsButton, this.getLabel('chatgptPageControlPrompts', 'Prompts')],
            [this.messageNavigationButton, this.getLabel('chatgptRefreshMessageNavigation', 'Refresh message navigation')],
            [this.previousButton, this.getLabel('previousMessage', 'Previous message')],
            [this.nextButton, this.getLabel('nextMessage', 'Next message')],
        ];
        for (const [button, label] of labels) {
            if (!button) continue;
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        }
        this.syncPageBookmarkButton();
    }

    private createButton(action: string, label: string, onClick: () => void, icon: string | HTMLElement = chevronRightIcon): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aimd-chatgpt-message-stepper__button';
        button.dataset.action = action;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        const iconWrap = document.createElement('span');
        iconWrap.className = 'aimd-chatgpt-message-stepper__icon';
        if (typeof icon === 'string') {
            iconWrap.innerHTML = icon;
        } else {
            iconWrap.appendChild(icon);
        }
        button.appendChild(iconWrap);
        button.addEventListener('click', () => {
            if (button.disabled || button.hidden) return;
            onClick();
        });
        return button;
    }

    private ensureStyle(): void {
        let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        if (style.textContent) return;
        style.textContent = this.getCss();
    }

    private getCss(): string {
        return `.aimd-chatgpt-message-stepper {
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
.aimd-chatgpt-message-stepper__button[data-running="1"] {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-button-icon-hover);
}
.aimd-chatgpt-message-stepper__button[hidden] {
  display: none;
}
.aimd-chatgpt-message-stepper__icon,
.aimd-chatgpt-message-stepper__icon svg,
.aimd-chatgpt-message-stepper__icon img {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.aimd-chatgpt-message-stepper__icon[data-direction="left"] {
  transform: scaleX(-1);
}
`;
    }

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
        const navigation = this.options.navigation
            ? this.options.navigation.navigate({
                position: target.position,
                messageId: target.messageId,
                roundId: target.roundId,
                userMessageId: target.userMessageId,
                assistantMessageId: target.assistantMessageId,
                source: 'stepper',
            }, { timeoutMs: 15_000, align: 'start' }).then((result) => ({ ok: result.ok }))
            : navigateChatGPTDirectoryTarget(this.adapter, {
                position: target.position,
                messageId: target.messageId,
                roundId: target.roundId,
                userMessageId: target.userMessageId,
                assistantMessageId: target.assistantMessageId,
            }, { surface: this.surface }).then((result) => ({ ok: result.ok }));
        void navigation.then((result) => {
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
        const tracked = this.activePositionTracker.refreshNow();
        this.rounds = tracked.rounds;
        const visible = this.adapter.getPlatformId() === 'chatgpt' && Boolean(this.bookmarksPanelButton);
        if (this.host) {
            this.host.dataset.visible = visible ? '1' : '0';
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
        this.activePosition = tracked.activePosition;
        this.syncButtons();
    }

    private syncButtons(): void {
        this.syncNavigationVisibility();
        this.syncAuxiliaryButtonVisibility();
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
        const visible = this.pageBookmarkVisibleEnabled && this.resolveBoundConversationUrl() !== null;
        this.pageBookmarkButton.hidden = !visible;
        this.pageBookmarkButton.disabled = this.pageBookmarkMutationPending;
        this.pageBookmarkButton.dataset.pending = this.pageBookmarkMutationPending ? '1' : '0';
        this.pageBookmarkButton.dataset.active = this.pageBookmarkState === 'saved'
            ? '1'
            : this.pageBookmarkState === 'unsaved' ? '0' : 'unknown';
        this.pageBookmarkButton.dataset.bookmarkState = this.pageBookmarkError ? 'error' : this.pageBookmarkState;
        if (this.pageBookmarkState === 'unknown') {
            this.pageBookmarkButton.removeAttribute('aria-pressed');
        } else {
            this.pageBookmarkButton.setAttribute('aria-pressed', this.pageBookmarkState === 'saved' ? 'true' : 'false');
        }
        const label = this.pageBookmarkState === 'saved'
            ? this.getLabel('chatgptPageControlRemoveBookmark', 'Remove page bookmark')
            : this.getLabel('chatgptPageControlBookmark', 'Bookmark current page');
        this.pageBookmarkButton.setAttribute('aria-label', label);
        this.pageBookmarkButton.setAttribute('title', this.pageBookmarkError ?? label);
        const iconEl = this.pageBookmarkButton.querySelector<HTMLElement>('.aimd-chatgpt-message-stepper__icon');
        if (iconEl) iconEl.innerHTML = this.pageBookmarkState === 'saved' ? bookmarkCheckIcon : bookmarkIcon;
    }

    private refreshPageBookmarkStatusIfNeeded(): void {
        const url = this.resolveBoundConversationUrl();
        if (!this.pageBookmarkVisibleEnabled || !url) {
            this.pageBookmarkRequestId += 1;
            this.pageBookmarkStatusUrl = null;
            this.pageBookmarkState = 'unknown';
            this.pageBookmarkError = null;
            this.pageBookmarkMutationPending = false;
            this.syncPageBookmarkButton();
            return;
        }
        if (this.pageBookmarkStatusUrl === url) {
            this.syncPageBookmarkButton();
            return;
        }
        this.pageBookmarkStatusUrl = url;
        const requestId = this.pageBookmarkRequestId + 1;
        this.pageBookmarkRequestId = requestId;
        this.pageBookmarkState = 'unknown';
        this.pageBookmarkError = null;
        this.pageBookmarkMutationPending = false;
        this.syncPageBookmarkButton();
        const refresh = this.options.onRefreshPageBookmarkState;
        if (!refresh) return;
        void Promise.resolve(refresh(url)).then((result) => {
            if (requestId !== this.pageBookmarkRequestId || this.pageBookmarkStatusUrl !== url) return;
            if (result.ok) {
                this.setPageBookmarked(result.saved);
                return;
            }
            this.pageBookmarkError = result.message;
            this.syncPageBookmarkButton();
        }).catch((error: unknown) => {
            if (requestId !== this.pageBookmarkRequestId || this.pageBookmarkStatusUrl !== url) return;
            this.pageBookmarkError = error instanceof Error && error.message
                ? error.message
                : this.getLabel('failedToToggleBookmark', 'Failed to refresh bookmark status');
            this.syncPageBookmarkButton();
        });
    }

    private async handlePageBookmarkClick(): Promise<void> {
        if (!this.pageBookmarkButton || this.pageBookmarkButton.hidden || this.pageBookmarkButton.disabled) return;
        const toggle = this.options.onTogglePageBookmark;
        if (!toggle) return;
        const url = this.resolveBoundConversationUrl();
        if (!url) return;
        const requestId = this.pageBookmarkRequestId + 1;
        this.pageBookmarkRequestId = requestId;
        this.pageBookmarkMutationPending = true;
        this.pageBookmarkError = null;
        this.syncPageBookmarkButton();
        try {
            const result = await toggle(url);
            if (
                requestId !== this.pageBookmarkRequestId
                || this.resolveBoundConversationUrl() !== url
            ) return;
            if (result.ok) {
                this.setPageBookmarked(result.saved);
            } else if ('message' in result) {
                this.presentPageBookmarkMutationError(result.message);
            }
        } catch (error: unknown) {
            if (
                requestId !== this.pageBookmarkRequestId
                || this.resolveBoundConversationUrl() !== url
            ) return;
            this.presentPageBookmarkMutationError(error instanceof Error && error.message
                ? error.message
                : this.getLabel('failedToToggleBookmark', 'Failed to toggle bookmark'));
        } finally {
            if (requestId !== this.pageBookmarkRequestId) return;
            this.pageBookmarkMutationPending = false;
            if (this.resolveBoundConversationUrl() !== url) {
                this.refreshPageBookmarkStatusIfNeeded();
            } else {
                this.syncPageBookmarkButton();
            }
        }
    }

    private presentPageBookmarkMutationError(message: string): void {
        this.pageBookmarkError = message;
        if (!this.pageBookmarkButton) return;
        showEphemeralTooltip({ anchor: this.pageBookmarkButton, text: message });
    }

    private resolveBoundConversationUrl(): string | null {
        const frame = this.surface.readFrame();
        if (!frame.document?.conversationId) return null;
        const canonicalUrl = frame.document.canonicalUrl?.trim();
        return canonicalUrl ? canonicalUrl.split('#')[0] || canonicalUrl : null;
    }

    private resolveInitialTheme(): Theme {
        return document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light';
    }

}
