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
import {
    CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX,
    DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    type ChatGPTDirectoryMode,
    type ChatGPTDirectoryPromptLabelMode,
} from '../../../core/settings/types';

const RAIL_ID = 'aimd-chatgpt-directory-rail';
const PREVIEW_ID = 'aimd-chatgpt-directory-preview';
const PREVIEW_STYLE_ID = 'aimd-chatgpt-directory-preview-style';
const PREVIEW_TOKEN_STYLE_ID = 'aimd-chatgpt-directory-preview-tokens';
const HOVER_RADIUS = 3;
const EXPANDED_LABEL_HEAD_LENGTH = 15;
const EXPANDED_LABEL_HEAD_TAIL_MAX_LENGTH = 30;
const USER_INTERACTION_IDLE_MS = 800;

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

export class ChatGPTDirectoryRail {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private railAppearanceScope: AppearanceScope;
    private listEl: HTMLDivElement;
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
    private lastHoverPosition: number | null = null;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private promptLabelMode: ChatGPTDirectoryPromptLabelMode = 'head';
    private rightInsetPx = DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX;
    private viewportScrollbarWidthPx = 0;
    private expanded = false;
    private userInteracting = false;
    private interactionIdleTimer: number | null = null;
    private onSelect: (round: ChatGPTConversationRound) => void;

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
        this.rootEl.dataset.mode = this.displayMode;
        this.rootEl.dataset.expanded = '0';
        this.rootEl.setAttribute('data-aimd-theme', theme);
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
        this.listEl = document.createElement('div');
        this.listEl.className = 'rail__list';
        this.listEl.dataset.mode = this.displayMode;
        this.listEl.dataset.expanded = '0';
        this.listEl.dataset.promptLabelMode = this.promptLabelMode;
        this.listEl.addEventListener('pointerenter', () => {
            this.markUserInteracting();
            this.setExpanded(true);
        });
        this.listEl.addEventListener('pointerover', (event) => {
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.rail__item') : null;
            if (!item) return;
            this.markUserInteracting();
            this.setExpanded(true);
            this.setHoverPosition(Number(item.dataset.position));
        });
        this.listEl.addEventListener('pointerleave', () => {
            this.setHoverPosition(null);
            this.setExpanded(false);
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
            this.setHoverPosition(null);
            this.setExpanded(false);
            this.releaseUserInteractionSoon();
        });
        this.listEl.addEventListener('scroll', () => {
            this.markUserInteracting();
            this.releaseUserInteractionSoon();
        });
        shell.appendChild(this.listEl);
        this.shadowRoot.appendChild(shell);

        this.previewEl = document.createElement('div');
        this.previewEl.id = PREVIEW_ID;
        this.previewEl.className = 'aimd-chatgpt-directory-preview';
        this.previewEl.dataset.open = '0';
        this.previewEl.setAttribute('data-aimd-theme', theme);
        this.previewEl.innerHTML = '<div class="aimd-chatgpt-directory-preview__title"></div><div class="aimd-chatgpt-directory-preview__body"></div>';
        this.previewAppearanceScope = AppearanceScope.forLightDomPortal(this.previewEl, {
            selector: '.aimd-chatgpt-directory-preview',
            styleId: PREVIEW_TOKEN_STYLE_ID,
        });
        this.previewAppearanceScope.apply(this.appearance);
        this.applyRightOffsetVars();
        this.syncViewportScrollbarWidth();
        window.addEventListener('resize', this.handleViewportResize, { passive: true });
        this.ensurePreviewStyle();
        document.body.appendChild(this.previewEl);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        if (this.interactionIdleTimer !== null) {
            window.clearTimeout(this.interactionIdleTimer);
            this.interactionIdleTimer = null;
        }
        window.removeEventListener('resize', this.handleViewportResize as any);
        this.railAppearanceScope.dispose();
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
    }

    setVisible(visible: boolean): void {
        this.rootEl.style.display = visible ? 'block' : 'none';
        if (!visible) {
            this.previewEl.dataset.open = '0';
            this.hoverPosition = null;
            this.setExpanded(false);
            this.renderHoverState();
        }
    }

    setDisplayMode(mode: ChatGPTDirectoryMode): void {
        this.displayMode = mode === 'expanded' ? 'expanded' : 'preview';
        this.listEl.dataset.mode = this.displayMode;
        this.rootEl.dataset.mode = this.displayMode;
        this.previewEl.dataset.open = '0';
        this.setExpanded(false);
        this.renderHoverState();
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

    setRounds(rounds: ChatGPTConversationRound[]): void {
        const signature = this.buildRoundsSignature(rounds);
        if (signature === this.roundsSignature) return;
        this.roundsSignature = signature;
        this.rounds = rounds.slice();
        this.render();
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
            button.setAttribute('aria-label', `#${round.position} ${round.userPrompt}`);
            button.addEventListener('click', () => this.onSelect(round));
            const index = document.createElement('span');
            index.className = 'rail__index';
            index.textContent = `#${round.position}`;
            const label = document.createElement('span');
            label.className = 'rail__label';
            label.textContent = formatExpandedLabel(round.userPrompt || `Message ${round.position}`, this.promptLabelMode);
            button.append(index, label);
            this.itemsByPosition.set(round.position, button);
            this.roundsByPosition.set(round.position, round);
            this.listEl.appendChild(button);
        }

        this.lastHoverPosition = null;
        this.renderHoverState();
        this.renderBookmarkedState();
        this.renderPreview();
    }

    private handleViewportResize = (): void => {
        this.syncViewportScrollbarWidth();
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
        if (item && typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest' });
        }
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
        }, USER_INTERACTION_IDLE_MS);
    }

    private setHoverPosition(position: number | null): void {
        const nextPosition = Number.isFinite(position) ? position : null;
        if (this.hoverPosition === nextPosition) return;
        this.hoverPosition = nextPosition;
        this.renderHoverState();
        this.renderPreview();
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
        if (this.displayMode !== 'preview') {
            this.previewEl.dataset.open = '0';
            return;
        }
        this.ensurePreviewAttached();
        const position = this.hoverPosition;
        const round = position == null ? null : this.roundsByPosition.get(position);
        if (!round) {
            this.previewEl.dataset.open = '0';
            return;
        }
        const title = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__title');
        const body = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__body');
        if (title) title.textContent = `#${round.position}`;
        if (body) body.textContent = this.buildPreviewText(round);
        this.previewEl.dataset.open = '1';
    }

    private ensurePreviewAttached(): void {
        this.previewAppearanceScope.apply(this.appearance);
        this.ensurePreviewStyle();
        if (!this.previewEl.isConnected) document.body.appendChild(this.previewEl);
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
        const seen = new Set<string>();
        const parts = [round.userPrompt, round.preview || round.assistantContent]
            .map((value) => value.replace(/\s+/g, ' ').trim())
            .filter((value) => {
                if (!value) return false;
                const key = value.toLocaleLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        const text = parts.join('\n\n').trim();
        return text.length > 120 ? `${text.slice(0, 119)}…` : text;
    }

    private getPreviewCss(): string {
        return `.aimd-chatgpt-directory-preview {
  --_directory-preview-width: 280px;
  position: fixed;
  right: calc(var(--aimd-space-2) + var(--aimd-space-4) + var(--aimd-space-6) + var(--_directory-scrollbar-width, 0px) + var(--_directory-user-right-inset, ${DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX}px));
  top: 50%;
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
  opacity: 0;
  transform: translateY(-50%);
  z-index: var(--aimd-z-tooltip);
  font-family: var(--aimd-font-family-sans);
  box-sizing: border-box;
  max-height: calc(100vh - (var(--aimd-space-3) * 2));
  overflow: hidden;
}
.aimd-chatgpt-directory-preview[data-open="1"] {
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
}
@media (max-width: 900px) {
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
  transform: translateY(-50%);
  z-index: var(--aimd-z-panel);
  pointer-events: auto;
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
  align-items: center;
  justify-content: flex-end;
}
.rail__list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--aimd-space-1) / 2);
  width: 100%;
  padding: var(--aimd-space-1) 0;
  min-height: calc(var(--aimd-space-3) * 6);
  max-height: min(78vh, 920px);
  overflow: hidden auto;
  scrollbar-width: none;
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
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
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, transparent);
  border-color: color-mix(in srgb, var(--aimd-border-subtle) 72%, transparent);
  box-shadow: var(--aimd-shadow-lg);
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
  background: color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
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
.rail__item[data-active="1"]::before {
  transform: scaleX(0.56) scaleY(1);
  background: var(--aimd-interactive-primary);
}
.rail__item[data-bookmarked="1"]::before {
  background: var(--aimd-bookmark-marker-gradient);
  box-shadow: var(--aimd-shadow-bookmark-marker);
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
  background: color-mix(in srgb, var(--aimd-interactive-primary) 72%, var(--aimd-border-default));
}
.rail__item[data-proximity="2"]::before {
  transform: scaleX(0.64) scaleY(1);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 48%, var(--aimd-border-default));
}
.rail__item[data-proximity="3"]::before {
  transform: scaleX(0.5) scaleY(1);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) 26px;
  height: 30px;
  padding-inline: var(--aimd-space-2);
  border-radius: var(--aimd-radius-md);
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
  background: var(--aimd-interactive-selected);
  color: var(--aimd-text-primary);
}
.rail__list[data-mode="expanded"][data-expanded="1"] .rail__item[data-active="1"] {
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
