import type { Theme } from '../../../core/types/theme';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import type { UserThemeOverrides } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';
import type { DiscoveryHistoryStatusV1 } from '../../../contracts/conversationDiscoveryDiagnostics';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';
import {
    CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX,
    DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
    DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    type ChatGPTDirectoryMode,
    type ChatGPTDirectoryPromptLabelMode,
} from '../../../core/settings/types';
import { normalizeChatGPTDirectoryPreviewMaxChars } from '../../../core/settings/migrations';
import { MessageToolbar, type MessageToolbarAction } from '../MessageToolbar';
import { TooltipDelegate } from '../../../utils/tooltip';

const RAIL_ID = 'aimd-chatgpt-directory-rail';
const PREVIEW_ID = 'aimd-chatgpt-directory-preview';
const PREVIEW_STYLE_ID = 'aimd-chatgpt-directory-preview-style';
const PREVIEW_TOKEN_STYLE_ID = 'aimd-chatgpt-directory-preview-tokens';
const HOVER_RADIUS = 3;
const EXPANDED_LABEL_HEAD_LENGTH = 15;
const EXPANDED_LABEL_HEAD_TAIL_MAX_LENGTH = 30;
const USER_INTERACTION_IDLE_MS = 800;
const PREVIEW_CLOSE_DELAY_MS = 400;
const PREVIEW_MIN_WIDTH_PX = 360;
const PREVIEW_MAX_WIDTH_PX = 800;
const PREVIEW_WIDTH_BASE_CHARS = 40;
const PREVIEW_WIDTH_STEP_CHARS = 120;
const PREVIEW_WIDTH_STEP_PX = 100;

export type ChatGPTDirectoryPreviewActionsFactory = (
    round: ChatGPTConversationRound,
) => MessageToolbarAction[];

function formatExpandedLabel(value: string, mode: ChatGPTDirectoryPromptLabelMode): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    const chars = Array.from(normalized);
    if (mode === 'headTail') {
        if (chars.length <= EXPANDED_LABEL_HEAD_TAIL_MAX_LENGTH) return normalized;
        return `${chars.slice(0, EXPANDED_LABEL_HEAD_LENGTH).join('')}…${chars.slice(-EXPANDED_LABEL_HEAD_LENGTH).join('')}`;
    }
    if (chars.length <= EXPANDED_LABEL_HEAD_LENGTH) return normalized;
    return `${chars.slice(0, EXPANDED_LABEL_HEAD_LENGTH).join('')}…`;
}

function normalizeRightInsetPx(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX;
    const clamped = Math.min(MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX, Math.max(MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX, numeric));
    return Math.round(clamped / CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX) * CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX;
}

function resolveDirectoryEntryText(round: ChatGPTConversationRound): string {
    return [round.userPrompt, round.preview, round.assistantContent]
        .map((value) => value.replace(/\s+/g, ' ').trim())
        .find((value) => value.length > 0) ?? '';
}

function resolvePreviewWidth(text: string): number {
    const charCount = Array.from(text).length;
    const extraSteps = charCount <= PREVIEW_WIDTH_BASE_CHARS
        ? 0
        : Math.ceil((charCount - PREVIEW_WIDTH_BASE_CHARS) / PREVIEW_WIDTH_STEP_CHARS);
    return Math.min(PREVIEW_MAX_WIDTH_PX, PREVIEW_MIN_WIDTH_PX + extraSteps * PREVIEW_WIDTH_STEP_PX);
}

function getDirectoryPortalHost(): HTMLElement | null {
    // Match the already-proven lower-right ChatGPT controls: a page-level
    // fixed host under body, with documentElement only as the early-start
    // fallback before body has been created.
    return document.body ?? document.documentElement ?? null;
}

export class ChatGPTDirectoryRail {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private railAppearanceScope: AppearanceScope;
    private listEl: HTMLDivElement;
    private navigationControlsEl: HTMLDivElement;
    private navigationControls: HTMLButtonElement[] = [];
    private tooltipDelegate: TooltipDelegate;
    private previewEl: HTMLDivElement;
    private previewAppearanceScope: AppearanceScope;
    private appearance: AppearanceSnapshot;
    private rounds: ChatGPTConversationRound[] = [];
    private roundsSignature = '';
    private itemsByPosition = new Map<number, HTMLElement>();
    private roundsByPosition = new Map<number, ChatGPTConversationRound>();
    private bookmarkedPositions = new Set<number>();
    private activePosition = 0;
    private hoverPosition: number | null = null;
    private previewPosition: number | null = null;
    private lastHoverPosition: number | null = null;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private promptLabelMode: ChatGPTDirectoryPromptLabelMode = 'head';
    private rightInsetPx = DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX;
    private historyStatus: DiscoveryHistoryStatusV1 = 'unknown';
    private viewportScrollbarWidthPx = 0;
    private expanded = false;
    private userInteracting = false;
    private programmaticScrollTop: number | null = null;
    private interactionIdleTimer: number | null = null;
    private onSelect: (round: ChatGPTConversationRound) => void;
    private previewMaxChars = DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS;
    private previewActionsFactory: ChatGPTDirectoryPreviewActionsFactory | null = null;
    private previewToolbar: MessageToolbar | null = null;
    private previewToolbarPosition: number | null = null;
    private previewCloseTimer: number | null = null;
    private previewFitFrame: number | null = null;
    private previewPointerInside = false;
    private railPointerInside = false;
    private previewDocumentPointerDown: ((event: Event) => void) | null = null;
    private previewKeyDown: ((event: KeyboardEvent) => void) | null = null;

    constructor(theme: Theme, onSelect: (round: ChatGPTConversationRound) => void, themeOverrides: UserThemeOverrides = {}) {
        this.onSelect = onSelect;
        this.appearance = createAppearanceSnapshot(theme, themeOverrides);

        const existing = document.getElementById(RAIL_ID);
        if (existing instanceof HTMLElement) existing.remove();
        const existingPreview = document.getElementById(PREVIEW_ID);
        if (existingPreview instanceof HTMLElement) existingPreview.remove();

        this.rootEl = document.createElement('div');
        this.rootEl.id = RAIL_ID;
        this.rootEl.className = 'aimd-chatgpt-directory-rail';
        this.rootEl.dataset.aimdRole = 'chatgpt-directory-rail';
        this.rootEl.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        this.rootEl.dataset.mode = this.displayMode;
        this.rootEl.dataset.expanded = '0';
        this.rootEl.dataset.historyStatus = this.historyStatus;
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.rootEl.style.display = 'none';
        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });
        this.applyRightOffsetVars();

        this.railAppearanceScope = AppearanceScope.forShadowRoot(this.shadowRoot, {
            styleId: 'aimd-chatgpt-directory-rail-tokens',
        });
        this.railAppearanceScope.apply(this.appearance);
        ensureStyle(this.shadowRoot, this.getCss(), {
            id: 'aimd-chatgpt-directory-rail-base',
            cache: 'shared',
        });

        const shell = document.createElement('div');
        shell.className = 'rail';
        this.navigationControlsEl = document.createElement('div');
        this.navigationControlsEl.className = 'rail__navigation-controls';
        this.tooltipDelegate = new TooltipDelegate(this.shadowRoot, { upgradeTitles: false });
        this.listEl = document.createElement('div');
        this.listEl.className = 'rail__list';
        this.listEl.dataset.mode = this.displayMode;
        this.listEl.dataset.expanded = '0';
        this.listEl.dataset.promptLabelMode = this.promptLabelMode;
        this.listEl.addEventListener('pointerenter', () => {
            this.railPointerInside = true;
            this.clearPreviewCloseTimer();
            this.markUserInteracting();
            this.setExpanded(true);
        });
        this.listEl.addEventListener('pointerover', (event) => {
            this.railPointerInside = true;
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.rail__item') : null;
            if (!item) return;
            this.markUserInteracting();
            this.setExpanded(true);
            this.setHoverPosition(Number(item.dataset.position));
        });
        this.listEl.addEventListener('pointerleave', () => {
            this.railPointerInside = false;
            this.schedulePreviewClose();
            this.releaseUserInteractionSoon();
        });
        this.listEl.addEventListener('focusin', (event) => {
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.rail__item') : null;
            this.markUserInteracting();
            this.setExpanded(true);
            if (!item) return;
            this.setHoverPosition(Number(item.dataset.position));
        });
        this.listEl.addEventListener('focusout', () => {
            this.schedulePreviewClose();
            this.releaseUserInteractionSoon();
        });
        this.listEl.addEventListener('scroll', () => {
            if (this.programmaticScrollTop === null || Math.abs(this.programmaticScrollTop - this.listEl.scrollTop) >= 1) {
                this.markUserInteracting();
                this.releaseUserInteractionSoon();
            }
            this.programmaticScrollTop = null;
            this.positionPreview();
        });
        for (const eventName of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            this.listEl.addEventListener(eventName, () => {
                this.markUserInteracting();
                this.releaseUserInteractionSoon();
            }, { passive: true });
        }
        shell.appendChild(this.listEl);
        this.shadowRoot.appendChild(shell);

        this.previewEl = document.createElement('div');
        this.previewEl.id = PREVIEW_ID;
        this.previewEl.className = 'aimd-chatgpt-directory-preview';
        this.previewEl.dataset.aimdRole = 'chatgpt-directory-preview';
        this.previewEl.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        this.previewEl.dataset.open = '0';
        this.previewEl.setAttribute('data-aimd-theme', theme);
        this.previewEl.innerHTML = '<div class="aimd-chatgpt-directory-preview__title"></div><div class="aimd-chatgpt-directory-preview__body"></div><div class="aimd-chatgpt-directory-preview__actions" hidden></div>';
        this.previewEl.addEventListener('pointerenter', () => {
            this.previewPointerInside = true;
            this.clearPreviewCloseTimer();
            this.renderPreview();
        });
        this.previewEl.addEventListener('pointerleave', () => {
            this.previewPointerInside = false;
            this.schedulePreviewClose();
        });
        this.previewEl.addEventListener('focusin', () => this.clearPreviewCloseTimer());
        this.previewEl.addEventListener('focusout', () => this.schedulePreviewClose());
        this.previewAppearanceScope = AppearanceScope.forLightDomPortal(this.previewEl, {
            selector: '.aimd-chatgpt-directory-preview',
            styleId: PREVIEW_TOKEN_STYLE_ID,
        });
        this.previewAppearanceScope.apply(this.appearance);
        this.applyRightOffsetVars();
        this.syncViewportScrollbarWidth();
        window.addEventListener('resize', this.handleViewportResize, { passive: true });
        this.ensurePreviewStyle();
        getDirectoryPortalHost()?.appendChild(this.previewEl);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setNavigationControls(previous: HTMLButtonElement, next: HTMLButtonElement): void {
        this.navigationControls.filter(control => control !== previous && control !== next).forEach(control => control.remove());
        this.navigationControls = [previous, next];
        previous.classList.add('rail__navigation');
        next.classList.add('rail__navigation');
        this.navigationControlsEl.replaceChildren(previous, next);
        this.shadowRoot.append(this.navigationControlsEl);
    }

    ensureAttached(): void {
        const portalHost = getDirectoryPortalHost();
        if (portalHost && this.rootEl.parentElement !== portalHost) portalHost.appendChild(this.rootEl);
        this.ensurePreviewAttached();
    }

    dispose(): void {
        if (this.interactionIdleTimer !== null) {
            window.clearTimeout(this.interactionIdleTimer);
            this.interactionIdleTimer = null;
        }
        this.clearPreviewCloseTimer();
        this.removePreviewGlobalHandlers();
        if (this.previewFitFrame !== null) {
            window.cancelAnimationFrame(this.previewFitFrame);
            this.previewFitFrame = null;
        }
        this.disposePreviewToolbar();
        window.removeEventListener('resize', this.handleViewportResize as any);
        this.railAppearanceScope.dispose();
        this.tooltipDelegate.disconnect();
        this.previewAppearanceScope.dispose();
        this.rootEl.remove();
        this.previewEl.remove();
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.rootEl.setAttribute('data-aimd-theme', snapshot.theme);
        this.railAppearanceScope.apply(snapshot);
        this.previewAppearanceScope.apply(snapshot);
        this.previewToolbar?.setAppearance(snapshot);
    }

    setDisplayMode(mode: ChatGPTDirectoryMode): void {
        this.displayMode = mode === 'expanded' ? 'expanded' : 'preview';
        this.listEl.dataset.mode = this.displayMode;
        this.rootEl.dataset.mode = this.displayMode;
        this.previewEl.dataset.open = '0';
        this.previewPosition = null;
        this.removePreviewGlobalHandlers();
        this.disposePreviewToolbar();
        this.setExpanded(false);
        this.renderHoverState();
        this.renderPreview();
    }

    setPromptLabelMode(mode: ChatGPTDirectoryPromptLabelMode): void {
        this.promptLabelMode = mode === 'headTail' ? 'headTail' : 'head';
        this.listEl.dataset.promptLabelMode = this.promptLabelMode;
        this.render();
    }

    setRightInsetPx(value: number): void {
        this.rightInsetPx = normalizeRightInsetPx(value);
        this.applyRightOffsetVars();
    }

    setPreviewMaxChars(value: number): void {
        const next = normalizeChatGPTDirectoryPreviewMaxChars(value);
        if (this.previewMaxChars === next) return;
        this.previewMaxChars = next;
        this.renderPreview();
    }

    setPreviewActionsFactory(factory: ChatGPTDirectoryPreviewActionsFactory | null): void {
        this.previewActionsFactory = factory;
        this.disposePreviewToolbar();
        this.renderPreview();
    }

    setHistoryStatus(status: DiscoveryHistoryStatusV1): void {
        if (this.historyStatus === status) return;
        this.historyStatus = status;
        this.rootEl.dataset.historyStatus = status;
    }

    setRounds(rounds: ChatGPTConversationRound[], contentToken?: string | null): void {
        const orderChanged = rounds.length !== this.rounds.length || rounds.some((round, index) => {
            const previous = this.rounds[index];
            return round.position !== previous?.position
                || (round.assistantMessageId ?? round.messageId ?? round.id) !== (previous?.assistantMessageId ?? previous?.messageId ?? previous?.id);
        });
        const signature = contentToken ?? this.buildRoundsSignature(rounds);
        if (signature !== this.roundsSignature || orderChanged) {
            // The same ordinal can now refer to another branch or updated content.
            this.disposePreviewToolbar();
            this.roundsSignature = signature;
            this.rounds = rounds.slice();
            this.render();
        }
        this.syncVisibilityFromRounds();
        // A passive history upgrade can add the active row after the tracker
        // already published its position. Follow after the new rows are visible.
        if (orderChanged) this.followActiveItem();
    }

    private syncVisibilityFromRounds(): void {
        const visible = this.rounds.length > 0;
        this.rootEl.style.display = visible ? 'block' : 'none';
        if (visible) return;
        this.previewEl.dataset.open = '0';
        this.hoverPosition = null;
        this.previewPosition = null;
        this.disposePreviewToolbar();
        this.setExpanded(false);
        this.renderHoverState();
    }

    setBookmarkedPositions(positions: Iterable<number>): void {
        const next = new Set(
            Array.from(positions)
                .map((position) => Number(position))
                .filter((position) => Number.isInteger(position) && position > 0),
        );
        if (this.arePositionSetsEqual(this.bookmarkedPositions, next)) return;
        this.bookmarkedPositions = next;
        this.renderBookmarkedState();
    }

    setActivePosition(position: number, options?: { follow?: boolean }): void {
        if (this.activePosition === position) {
            if (options?.follow !== false) this.followActiveItem();
            return;
        }
        this.activePosition = position;
        this.renderActiveState();
        if (options?.follow !== false) this.followActiveItem();
    }

    private buildRoundsSignature(rounds: ChatGPTConversationRound[]): string {
        return rounds
            .map((round) => [
                round.position,
                round.id ?? '',
                round.messageId ?? '',
                round.userPrompt ?? '',
                round.preview ?? '',
                round.assistantContent ?? '',
            ].join(':'))
            .join('|');
    }

    private arePositionSetsEqual(left: Set<number>, right: Set<number>): boolean {
        if (left.size !== right.size) return false;
        for (const value of left) {
            if (!right.has(value)) return false;
        }
        return true;
    }

    private render(): void {
        const scrollTop = this.listEl.scrollTop;
        const focusedPosition = this.shadowRoot.activeElement instanceof HTMLElement
            ? Number(this.shadowRoot.activeElement.dataset.position)
            : null;
        this.listEl.replaceChildren();
        this.itemsByPosition.clear();
        this.roundsByPosition.clear();

        for (const round of this.rounds) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rail__item';
            button.dataset.position = String(round.position);
            button.dataset.active = round.position === this.activePosition ? '1' : '0';
            button.dataset.bookmarked = this.bookmarkedPositions.has(round.position) ? '1' : '0';
            const entryText = resolveDirectoryEntryText(round);
            button.setAttribute('aria-label', `#${round.position} ${entryText}`);
            button.addEventListener('click', () => this.onSelect(round));
            const index = document.createElement('span');
            index.className = 'rail__index';
            index.textContent = `#${round.position}`;
            const label = document.createElement('span');
            label.className = 'rail__label';
            label.textContent = formatExpandedLabel(entryText, this.promptLabelMode);
            button.append(index, label);
            this.itemsByPosition.set(round.position, button);
            this.roundsByPosition.set(round.position, round);
            this.listEl.appendChild(button);
        }

        this.lastHoverPosition = null;
        this.renderHoverState();
        this.renderBookmarkedState();
        this.renderPreview();
        this.listEl.scrollTop = scrollTop;
        this.programmaticScrollTop = this.listEl.scrollTop;
        if (focusedPosition !== null && Number.isFinite(focusedPosition)) {
            this.itemsByPosition.get(focusedPosition)?.focus({ preventScroll: true });
        }
    }

    private handleViewportResize = (): void => {
        this.syncViewportScrollbarWidth();
        this.positionPreview();
        this.schedulePreviewFit();
    };

    private syncViewportScrollbarWidth(): void {
        const innerWidth = window.innerWidth || 0;
        const clientWidth = document.documentElement?.clientWidth || innerWidth;
        const next = Math.max(0, Math.round(innerWidth - clientWidth));
        if (next === this.viewportScrollbarWidthPx) return;
        this.viewportScrollbarWidthPx = next;
        this.applyRightOffsetVars();
    }

    private applyRightOffsetVars(): void {
        const inset = `${this.rightInsetPx}px`;
        const scrollbar = `${this.viewportScrollbarWidthPx}px`;
        this.rootEl.style.setProperty('--_directory-user-right-inset', inset);
        this.rootEl.style.setProperty('--_directory-scrollbar-width', scrollbar);
        this.previewEl?.style.setProperty('--_directory-user-right-inset', inset);
        this.previewEl?.style.setProperty('--_directory-scrollbar-width', scrollbar);
    }

    private renderBookmarkedState(): void {
        for (const item of Array.from(this.listEl.querySelectorAll<HTMLElement>('.rail__item'))) {
            item.dataset.bookmarked = this.bookmarkedPositions.has(Number(item.dataset.position)) ? '1' : '0';
        }
    }

    private renderActiveState(): void {
        for (const item of Array.from(this.listEl.querySelectorAll<HTMLElement>('.rail__item'))) {
            item.dataset.active = Number(item.dataset.position) === this.activePosition ? '1' : '0';
        }
    }

    private followActiveItem(): void {
        if (this.userInteracting || !this.activePosition) return;
        const item = this.itemsByPosition.get(this.activePosition);
        if (!item) return;
        const desired = item.offsetTop + item.offsetHeight / 2 - this.listEl.clientHeight / 2;
        const max = Math.max(0, this.listEl.scrollHeight - this.listEl.clientHeight);
        const next = Math.max(0, Math.min(max, desired));
        if (Math.abs(this.listEl.scrollTop - next) < 1) return;
        this.listEl.scrollTop = next;
        this.programmaticScrollTop = this.listEl.scrollTop;
        this.positionPreview();
    }

    private markUserInteracting(): void {
        this.userInteracting = true;
        if (this.interactionIdleTimer !== null) {
            window.clearTimeout(this.interactionIdleTimer);
            this.interactionIdleTimer = null;
        }
    }

    private releaseUserInteractionSoon(): void {
        if (this.interactionIdleTimer !== null) window.clearTimeout(this.interactionIdleTimer);
        this.interactionIdleTimer = window.setTimeout(() => {
            this.userInteracting = false;
            this.interactionIdleTimer = null;
            this.followActiveItem();
        }, USER_INTERACTION_IDLE_MS);
    }

    private setHoverPosition(position: number | null): void {
        const nextPosition = Number.isFinite(position) ? position : null;
        if (nextPosition === null) {
            this.clearRailHover();
            return;
        }
        if (this.hoverPosition === nextPosition && this.previewPosition === nextPosition) return;
        this.clearPreviewCloseTimer();
        this.hoverPosition = nextPosition;
        this.previewPosition = nextPosition;
        this.renderHoverState();
        this.renderPreview();
    }

    private clearRailHover(): void {
        if (this.hoverPosition !== null) {
            this.hoverPosition = null;
            this.renderHoverState();
        }
        this.schedulePreviewClose();
    }

    private setExpanded(expanded: boolean): void {
        const nextExpanded = this.displayMode === 'expanded' && expanded;
        if (this.expanded === nextExpanded) return;
        this.expanded = nextExpanded;
        this.rootEl.dataset.expanded = this.expanded ? '1' : '0';
        this.listEl.dataset.expanded = this.expanded ? '1' : '0';
    }

    private renderHoverState(): void {
        this.listEl.dataset.mode = this.displayMode;
        this.listEl.dataset.expanded = this.expanded ? '1' : '0';
        this.listEl.dataset.hasHover = this.hoverPosition === null ? '0' : '1';
        if (this.lastHoverPosition === this.hoverPosition) return;
        this.clearAccordionRange(this.lastHoverPosition);
        this.applyAccordionRange(this.hoverPosition);
        this.lastHoverPosition = this.hoverPosition;
    }

    private clearAccordionRange(position: number | null): void {
        if (position === null) return;
        for (let next = position - HOVER_RADIUS; next <= position + HOVER_RADIUS; next += 1) {
            const item = this.itemsByPosition.get(next);
            if (!item) continue;
            delete item.dataset.proximity;
            delete item.dataset.hovered;
        }
    }

    private applyAccordionRange(position: number | null): void {
        if (position === null) return;
        for (let next = position - HOVER_RADIUS; next <= position + HOVER_RADIUS; next += 1) {
            const item = this.itemsByPosition.get(next);
            if (!item) continue;
            const distance = Math.abs(next - position);
            item.dataset.proximity = String(distance);
            if (distance === 0) item.dataset.hovered = '1';
        }
    }

    private renderPreview(): void {
        this.ensurePreviewAttached();
        const position = this.previewPosition;
        const round = position == null ? null : this.roundsByPosition.get(position);
        if (!round) {
            this.previewEl.dataset.open = '0';
            this.previewPosition = null;
            this.removePreviewGlobalHandlers();
            this.disposePreviewToolbar();
            return;
        }
        const title = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__title');
        const body = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__body');
        const previewText = this.buildPreviewText(round);
        if (title) title.textContent = `#${round.position}`;
        if (body) body.textContent = previewText;
        this.previewEl.style.setProperty('--_directory-preview-width', `${resolvePreviewWidth(previewText)}px`);
        this.renderPreviewActions(round);
        this.previewEl.dataset.open = '1';
        this.installPreviewGlobalHandlers();
        this.positionPreview();
        this.fitPreviewBody(body);
        this.schedulePreviewFit();
    }

    private ensurePreviewAttached(): void {
        this.previewAppearanceScope.apply(this.appearance);
        this.ensurePreviewStyle();
        const portalHost = getDirectoryPortalHost();
        if (portalHost && this.previewEl.parentElement !== portalHost) portalHost.appendChild(this.previewEl);
    }

    private ensurePreviewStyle(options: { force?: boolean } = {}): void {
        let style = document.getElementById(PREVIEW_STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = PREVIEW_STYLE_ID;
            document.head.appendChild(style);
        }
        if (!options.force && style.textContent) return;
        style.textContent = this.getPreviewCss();
    }

    private buildPreviewText(round: ChatGPTConversationRound): string {
        const text = resolveDirectoryEntryText(round);
        const chars = Array.from(text);
        if (chars.length <= this.previewMaxChars) return text;
        return `${chars.slice(0, Math.max(1, this.previewMaxChars - 1)).join('')}…`;
    }

    private renderPreviewActions(round: ChatGPTConversationRound): void {
        const actionsRoot = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__actions');
        if (!actionsRoot) return;
        if (this.previewToolbar && this.previewToolbarPosition === round.position) return;
        const actions = this.previewActionsFactory?.(round) ?? [];
        this.disposePreviewToolbar();
        actionsRoot.replaceChildren();
        actionsRoot.hidden = actions.length === 0;
        if (actions.length === 0) return;
        const toolbar = new MessageToolbar(this.appearance.theme, actions, {
            showStats: false,
            themeOverrides: this.appearance.overrides,
            variant: 'bare',
        });
        toolbar.setPlacement('actionbar');
        const host = toolbar.getElement();
        host.dataset.aimdRole = 'directory-preview-toolbar';
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        actionsRoot.appendChild(host);
        this.previewToolbar = toolbar;
        this.previewToolbarPosition = round.position;
    }

    private disposePreviewToolbar(): void {
        const host = this.previewToolbar?.getElement();
        this.previewToolbar?.dispose();
        this.previewToolbar = null;
        this.previewToolbarPosition = null;
        host?.remove();
    }

    private fitPreviewBody(body: HTMLElement | null): void {
        if (!body || body.clientHeight <= 0 || body.scrollHeight <= body.clientHeight) return;
        const chars = Array.from((body.textContent ?? '').replace(/…$/, ''));
        let low = 1;
        let high = chars.length;
        let best = '';
        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const candidate = `${chars.slice(0, middle).join('')}…`;
            body.textContent = candidate;
            if (body.scrollHeight <= body.clientHeight + 1) {
                best = candidate;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }
        if (best) body.textContent = best;
    }

    private schedulePreviewFit(): void {
        if (this.previewFitFrame !== null || this.previewEl.dataset.open !== '1') return;
        this.previewFitFrame = window.requestAnimationFrame(() => {
            this.previewFitFrame = null;
            this.fitPreviewBody(this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__body'));
            this.positionPreview();
        });
    }

    private installPreviewGlobalHandlers(): void {
        if (this.previewDocumentPointerDown) return;
        this.previewDocumentPointerDown = (event: Event) => {
            const target = event.target;
            if (target instanceof Node && (this.previewEl.contains(target) || this.rootEl.contains(target))) return;
            this.previewPosition = null;
            this.hoverPosition = null;
            this.setExpanded(false);
            this.renderHoverState();
            this.previewEl.dataset.open = '0';
            this.disposePreviewToolbar();
        };
        this.previewKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            this.previewPosition = null;
            this.hoverPosition = null;
            this.setExpanded(false);
            this.renderHoverState();
            this.previewEl.dataset.open = '0';
            this.disposePreviewToolbar();
        };
        document.addEventListener('pointerdown', this.previewDocumentPointerDown, true);
        window.addEventListener('keydown', this.previewKeyDown, true);
    }

    private removePreviewGlobalHandlers(): void {
        if (this.previewDocumentPointerDown) {
            document.removeEventListener('pointerdown', this.previewDocumentPointerDown, true);
            this.previewDocumentPointerDown = null;
        }
        if (this.previewKeyDown) {
            window.removeEventListener('keydown', this.previewKeyDown, true);
            this.previewKeyDown = null;
        }
    }

    private clearPreviewCloseTimer(): void {
        if (this.previewCloseTimer === null) return;
        window.clearTimeout(this.previewCloseTimer);
        this.previewCloseTimer = null;
    }

    private schedulePreviewClose(): void {
        this.clearPreviewCloseTimer();
        this.previewCloseTimer = window.setTimeout(() => {
            this.previewCloseTimer = null;
            if (this.previewPointerInside || this.railPointerInside
                || this.listEl.contains(this.shadowRoot.activeElement)
                || this.previewEl.contains(document.activeElement)) return;
            this.hoverPosition = null;
            this.setExpanded(false);
            this.renderHoverState();
            this.previewPosition = null;
            this.previewEl.dataset.open = '0';
            this.removePreviewGlobalHandlers();
            this.disposePreviewToolbar();
        }, PREVIEW_CLOSE_DELAY_MS);
    }

    private positionPreview(): void {
        if (this.previewEl.dataset.open !== '1') return;
        const railRect = this.rootEl.getBoundingClientRect();
        const previewRect = this.previewEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
        const computed = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(this.previewEl) : null;
        const gap = Number.parseFloat(computed?.getPropertyValue('--_directory-preview-gap') ?? '') || 12;
        const gutter = Number.parseFloat(computed?.getPropertyValue('--_directory-preview-gutter') ?? '') || 12;
        const width = previewRect.width || 280;
        const leftOfRail = railRect.left - gap - width;
        const rightOfRail = railRect.right + gap;
        const preferredLeft = leftOfRail >= gutter ? leftOfRail : rightOfRail;
        const left = Math.min(Math.max(gutter, preferredLeft), Math.max(gutter, viewportWidth - width - gutter));
        this.previewEl.style.left = `${Math.round(left)}px`;
        this.previewEl.style.right = 'auto';
        const height = previewRect.height || 64;
        const top = Math.min(
            Math.max(gutter, (viewportHeight - height) / 2),
            Math.max(gutter, viewportHeight - height - gutter),
        );
        this.previewEl.style.top = `${Math.round(top)}px`;
        this.previewEl.style.transform = 'none';
    }

    private getPreviewCss(): string {
        return `.aimd-chatgpt-directory-preview {
  --_directory-preview-width: 360px;
  --_directory-preview-gap: var(--aimd-space-3);
  --_directory-preview-gutter: var(--aimd-space-3);
  position: fixed;
  right: calc(var(--aimd-space-2) + var(--aimd-space-4) + var(--aimd-space-6) + var(--_directory-scrollbar-width, 0px) + var(--_directory-user-right-inset, ${DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX}px));
  left: 0;
  right: auto;
  top: 0;
  width: var(--_directory-preview-width);
  max-width: min(var(--_directory-preview-width), calc(100vw - (var(--aimd-space-3) * 2)));
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  background: color-mix(in srgb, var(--aimd-bg-surface) 92%, transparent);
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 72%, transparent);
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: none;
  z-index: var(--aimd-z-tooltip);
  font-family: var(--aimd-font-family-sans);
  box-sizing: border-box;
  max-height: calc(100vh - (var(--aimd-space-3) * 2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.aimd-chatgpt-directory-preview[data-open="1"] {
  pointer-events: auto;
  visibility: visible;
  opacity: 1;
}
.aimd-chatgpt-directory-preview__title {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: 1;
  margin-bottom: var(--aimd-space-2);
}
.aimd-chatgpt-directory-preview__body {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-sm);
  line-height: 1.45;
  white-space: normal;
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100vh - (var(--aimd-space-3) * 7));
  overflow: hidden;
}
.aimd-chatgpt-directory-preview__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--aimd-space-3);
  pointer-events: auto;
}
@media (max-width: 560px) {
  .aimd-chatgpt-directory-preview {
    display: none;
  }
}

`;
    }

    private getCss(): string {
        return `
:host {
  position: fixed;
  top: 50%;
  right: calc(var(--aimd-space-2) + var(--_directory-scrollbar-width, 0px) + var(--_directory-user-right-inset, ${DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX}px));
  --_directory-dock-bottom: calc(var(--aimd-size-control-icon-toolbar) + var(--aimd-space-4) + var(--aimd-space-3) / 2);
  --_directory-dock-height: calc(var(--aimd-size-control-icon-toolbar) * 2 + var(--aimd-space-1) / 2);
  --_directory-list-max-height: min(78vh, 920px);
  z-index: var(--aimd-z-panel);
  pointer-events: none;
  display: block;
  font-family: var(--aimd-font-family-sans);
  width: calc(var(--aimd-space-4) + var(--aimd-space-6));
}
:host([data-mode="expanded"][data-expanded="1"]) {
  width: fit-content;
  max-width: calc(100vw - 32px - var(--_directory-scrollbar-width, 0px) - var(--_directory-user-right-inset, ${DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX}px));
}
.rail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--aimd-space-1);
  transform: translateY(-50%);
  pointer-events: auto;
}
.rail__navigation {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  cursor: pointer;
}
.rail__navigation-controls {
  position: fixed;
  right: calc(var(--aimd-space-2) + var(--_directory-scrollbar-width, 0px) + var(--_directory-user-right-inset, ${DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX}px));
  bottom: var(--_directory-dock-bottom);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  align-self: flex-end;
  gap: calc(var(--aimd-space-1) / 2);
}
.rail__navigation-controls:not(:has(.rail__navigation:not([hidden]))) { display: none; }
.rail__navigation:hover:not(:disabled), .rail__navigation:focus-visible {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-text-primary);
}
.rail__navigation:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
.rail__navigation:disabled { opacity: 0.4; cursor: default; }
.rail__navigation[hidden] { display: none; }
.rail__navigation .aimd-chatgpt-message-stepper__icon { display: inline-flex; }
.rail__navigation svg { width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); }
.rail__navigation[data-action="previous-message"] svg { transform: rotate(-90deg); }
.rail__navigation[data-action="next-message"] svg { transform: rotate(90deg); }
.rail__navigation .aimd-chatgpt-message-stepper__settings { display: none; }
.rail__list {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--aimd-space-1) / 2);
  width: 100%;
  padding: var(--aimd-space-1) 0;
  min-height: min(calc(var(--aimd-space-3) * 6), var(--_directory-list-max-height));
  max-height: var(--_directory-list-max-height);
  overflow: hidden auto;
  scrollbar-width: none;
}
.rail:has(+ .rail__navigation-controls .rail__navigation:not([hidden])) {
  --_directory-list-max-height: min(78vh, 920px, max(0px, calc(100vh - (var(--_directory-dock-bottom) + var(--_directory-dock-height) + var(--aimd-space-3)) * 2)));
}
.rail__list::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.rail__list[data-mode="expanded"][data-expanded="1"] {
  width: max-content;
  max-width: 100%;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2);
  background: var(--aimd-bg-surface);
}
.rail__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 10px;
  border-radius: var(--aimd-radius-full);
  padding-inline: 0;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-secondary);
}
.rail__item::before {
  content: "";
  order: 3;
  flex: 0 0 auto;
  display: block;
  width: 36px;
  height: 3px;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-text-tertiary) 28%, transparent);
  transform: scaleX(0.39) scaleY(1);
  transform-origin: right center;
  transition: transform calc(var(--aimd-duration-fast) * 0.8) var(--aimd-ease-out),
              background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.rail__index,
.rail__label {
  display: block;
  min-width: 0;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--aimd-font-size-sm);
  line-height: 1.25;
}
.rail__index {
  order: 1;
  flex: 0 0 auto;
  color: var(--aimd-text-tertiary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--aimd-font-medium);
}
.rail__label {
  order: 2;
}
.rail__item[data-proximity="0"]::before {
  transform: scaleX(1) scaleY(1.33);
  background: var(--aimd-interactive-primary);
  box-shadow: var(--aimd-shadow-interactive-halo);
}
.rail__item[data-bookmarked="1"][data-proximity="0"]::before {
  background: var(--aimd-bookmark-marker-gradient);
  box-shadow: var(--aimd-shadow-bookmark-marker-strong);
}
.rail__item[data-proximity="1"]::before {
  transform: scaleX(0.83) scaleY(1.33);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 48%, var(--aimd-border-subtle));
}
.rail__item[data-proximity="2"]::before {
  transform: scaleX(0.64) scaleY(1);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 30%, var(--aimd-border-subtle));
}
.rail__item[data-proximity="3"]::before {
  transform: scaleX(0.5) scaleY(1);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 18%, var(--aimd-border-subtle));
}
.rail__item[data-active="1"]::before {
  transform: scaleX(0.72) scaleY(1.33);
  background: var(--aimd-interactive-primary);
  box-shadow: var(--aimd-shadow-interactive-halo);
}
.rail__item[data-active="1"][data-proximity="0"]::before {
  transform: scaleX(1) scaleY(1.33);
}
.rail__item[data-bookmarked="1"]::before {
  background: var(--aimd-bookmark-marker-gradient);
  box-shadow: var(--aimd-shadow-bookmark-marker);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) 26px;
  height: 30px;
  padding-inline: var(--aimd-space-2);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-tertiary);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item::before {
  grid-column: 3;
  justify-self: end;
  width: 26px;
  transform: scaleX(0.5) scaleY(1);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-active="1"]::before,
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-hovered="1"]::before,
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item:focus-visible::before {
  transform: scaleX(1) scaleY(1.33);
  background: var(--aimd-interactive-primary);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-bookmarked="1"]::before,
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-bookmarked="1"][data-active="1"]::before,
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-bookmarked="1"][data-hovered="1"]::before,
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-bookmarked="1"]:focus-visible::before {
  background: var(--aimd-bookmark-marker-gradient);
  box-shadow: var(--aimd-shadow-bookmark-marker);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__label {
  grid-column: 2;
  inline-size: 15em;
  max-inline-size: 15em;
  max-width: none;
  opacity: 1;
}
.rail__list[data-mode="expanded"][data-expanded="1"][data-prompt-label-mode="headTail"] .rail__label {
  inline-size: 30em;
  max-inline-size: 30em;
  max-width: none;
  opacity: 1;
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__index {
  grid-column: 1;
  max-width: none;
  opacity: 1;
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-hovered="1"],
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item:focus-visible {
  background: var(--aimd-interactive-hover);
  color: var(--aimd-text-primary);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-active="1"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}
.rail__item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}
@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .rail__item::before {
    background: var(--aimd-border-default);
  }
  .rail__item[data-active="1"]::before,
  .rail__item[data-proximity="0"]::before,
  .rail__item:focus-visible::before {
    background: var(--aimd-interactive-primary);
  }
  .rail__item[data-bookmarked="1"]::before,
  .rail__item[data-bookmarked="1"][data-proximity="0"]::before,
  .rail__item[data-bookmarked="1"]:focus-visible::before {
    background: var(--aimd-interactive-primary);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rail__list,
  .rail__item::before {
    transition: none;
  }
}
@media (max-width: 720px) {
  :host([data-mode="expanded"][data-expanded="1"]) {
    max-width: calc(100vw - (var(--aimd-space-3) * 2));
  }
  .rail__list[data-mode="expanded"][data-expanded="1"] .rail__label,
  .rail__list[data-mode="expanded"][data-expanded="1"][data-prompt-label-mode="headTail"] .rail__label {
    inline-size: 12em;
    max-inline-size: 12em;
  }
}
@media (max-width: 560px) {
  :host { display: none; }
}
`;
    }
}
