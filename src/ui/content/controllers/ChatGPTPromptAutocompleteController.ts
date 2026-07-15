import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import {
    readComposer,
    replaceComposerTextRange,
    type ComposerTextRangeReplacement,
} from '../../../drivers/content/sending/composerPort';
import {
    getContenteditableCaretClientRect,
    getContenteditablePlainTextSelection,
} from '../../../core/sending/contenteditable';
import {
    filterPromptRecords,
    type PromptRecord,
} from '../../../core/prompts/promptLibrary';
import { findPromptTriggerToken, type PromptTriggerToken } from '../../../core/prompts/slashTrigger';
import { findMarkdownMathAt } from '../../../core/sending/markdownMath';
import type { PromptLibraryClient } from '../../../drivers/content/prompts/promptLibraryClient';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { checkIcon, gripHorizontalIcon, messageSquareTextIcon, pencilIcon, plusIcon, trashIcon, xIcon } from '../../../assets/icons';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { installTransientOutsideDismissBoundary, markTransientRoot, type TransientOutsideDismissBoundaryHandle } from '../components/transientUi';
import { t } from '../components/i18n';
import {
    COMPOSER_SUGGESTION_LIST_CSS,
    renderComposerSuggestionList,
} from '../components/ComposerSuggestionList';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;
type Mode = 'autocomplete' | 'manager' | 'edit';
type ManagerPlacement = { left: number; top: number };
type ViewportFrame = { left: number; top: number; width: number; height: number; right: number; bottom: number };

const HOST_ID = 'aimd-chatgpt-prompt-popover-host';
const REBIND_DELAY_MS = 200;
const POPOVER_MARGIN_PX = 16;
const POPOVER_GAP_PX = 8;
const POPOVER_MIN_WIDTH_PX = 300;
const AUTOCOMPLETE_WIDTH_PX = 420;
const MANAGER_WIDTH_PX = 520;
const AUTOCOMPLETE_FALLBACK_HEIGHT_PX = 220;
const MANAGER_FIXED_HEIGHT_PX = 112;
const MANAGER_ROW_HEIGHT_PX = 64;
const MANAGER_STATUS_HEIGHT_PX = 36;
const MANAGER_MAX_HEIGHT_PX = 630;
const EDITOR_FALLBACK_HEIGHT_PX = 560;
const POPOVER_MIN_MAX_HEIGHT_PX = 180;
const TEXTAREA_CARET_MARKER = '\u200b';

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] ?? char));
}

function stripCursorMarker(value: string): { text: string; markerIndex: number } {
    const marker = '{{cursor}}';
    const markerIndex = value.indexOf(marker);
    return {
        text: value.replace(marker, ''),
        markerIndex,
    };
}

function matchesManagerQuery(prompt: PromptRecord, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [
        prompt.triggerText,
        prompt.title,
        prompt.content,
    ].some((value) => value.toLowerCase().includes(normalized));
}

function createPromptId(): string {
    return `prompt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTokenKey(token: PromptTriggerToken): string {
    return `${token.start}:${token.end}:${token.token}`;
}

export class ChatGPTPromptAutocompleteController {
    private initialized = false;
    private composer: ComposerInput | null = null;
    private composerOverride: ComposerInput | null = null;
    private observer: MutationObserver | null = null;
    private rebindTimer: number | null = null;
    private composing = false;
    private mode: Mode | null = null;
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private root: HTMLElement | null = null;
    private outsideDismiss: TransientOutsideDismissBoundaryHandle | null = null;
    private promptsCache: PromptRecord[] | null = null;
    private suggestions: PromptRecord[] = [];
    private activeToken: PromptTriggerToken | null = null;
    private dismissedTokenKey: string | null = null;
    private selectedIndex = 0;
    private requestId = 0;
    private managerQuery = '';
    private editPrompt: PromptRecord | null = null;
    private statusMessage = '';
    private themeOverrides: UserThemeOverrides = {};
    private promptDragId: string | null = null;
    private promptDragDirty = false;
    private promptDragCleanup: (() => void) | null = null;
    private managerPlacement: ManagerPlacement | null = null;
    private managerPanelDragCleanup: (() => void) | null = null;
    private managerViewportClampCleanup: (() => void) | null = null;
    private enabled = true;
    private formulaAuthoringEnabled = false;

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly client: PromptLibraryClient,
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.bindGlobalKeydown();
        if (this.enabled) this.bindComposer();
        this.observeComposerReplacements();
    }

    attachExternalComposer(input: ComposerInput): () => void {
        this.composerOverride = input;
        if (!this.initialized) {
            this.initialized = true;
            this.bindGlobalKeydown();
            this.observeComposerReplacements();
        }
        if (this.enabled) this.bindComposer();
        return () => {
            if (this.composerOverride !== input) return;
            if (this.mode === 'autocomplete') this.close();
            this.composerOverride = null;
            if (this.enabled) this.bindComposer();
        };
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) return;
        this.enabled = enabled;
        if (!enabled) {
            if (this.mode === 'autocomplete') this.close();
            this.detachComposer();
            return;
        }
        if (this.initialized) this.bindComposer();
    }

    setFormulaAuthoringEnabled(enabled: boolean): void {
        this.formulaAuthoringEnabled = enabled;
        if (enabled && this.mode === 'autocomplete') void this.refreshAutocomplete();
    }

    dispose(): void {
        if (!this.initialized && !this.host) return;
        this.initialized = false;
        this.composerOverride = null;
        this.detachGlobalKeydown();
        this.detachComposer();
        this.observer?.disconnect();
        this.observer = null;
        if (this.rebindTimer != null) {
            window.clearTimeout(this.rebindTimer);
            this.rebindTimer = null;
        }
        this.managerPlacement = null;
        this.close();
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        if (!this.host?.isConnected || !this.shadow || !this.root) return;
        this.render();
    }

    async openManager(anchor?: HTMLElement | null): Promise<void> {
        this.mode = 'manager';
        this.activeToken = null;
        this.dismissedTokenKey = null;
        this.suggestions = [];
        this.managerQuery = '';
        this.statusMessage = '';
        this.editPrompt = null;
        await this.loadPrompts({ force: true, context: 'all', includeDisabled: true });
        this.ensureHost();
        this.render();
        if (this.managerPlacement) {
            this.managerPlacement = this.applyManagerPlacement(this.managerPlacement);
        } else {
            this.positionNear(anchor ?? this.getComposerInput(), 'above');
        }
        this.installManagerViewportClamp();
        this.installOutsideDismiss();
        this.shadow?.querySelector<HTMLInputElement>('[data-role="prompt-search"]')?.focus();
    }

    close(): void {
        this.outsideDismiss?.detach();
        this.outsideDismiss = null;
        this.managerViewportClampCleanup?.();
        this.managerViewportClampCleanup = null;
        this.managerPanelDragCleanup?.();
        this.managerPanelDragCleanup = null;
        this.promptDragCleanup?.();
        this.promptDragCleanup = null;
        this.promptDragId = null;
        this.promptDragDirty = false;
        this.host?.remove();
        this.host = null;
        this.shadow = null;
        this.root = null;
        this.mode = null;
        this.suggestions = [];
        this.activeToken = null;
        this.selectedIndex = 0;
        this.editPrompt = null;
        this.statusMessage = '';
    }

    private bindComposer(): void {
        const next = this.getComposerInput();
        if (next === this.composer) return;
        this.detachComposer();
        if (!next) return;

        this.composer = next;
        next.addEventListener('input', this.onComposerInput);
        next.addEventListener('keyup', this.onComposerKeyUp);
        next.addEventListener('click', this.onComposerClick);
        next.addEventListener('keydown', this.onComposerKeyDownCapture as EventListener, { capture: true });
        next.addEventListener('compositionstart', this.onCompositionStart);
        next.addEventListener('compositionend', this.onCompositionEnd);
    }

    private detachComposer(): void {
        if (!this.composer) return;
        this.composer.removeEventListener('input', this.onComposerInput);
        this.composer.removeEventListener('keyup', this.onComposerKeyUp);
        this.composer.removeEventListener('click', this.onComposerClick);
        this.composer.removeEventListener('keydown', this.onComposerKeyDownCapture as EventListener, { capture: true } as any);
        this.composer.removeEventListener('compositionstart', this.onCompositionStart);
        this.composer.removeEventListener('compositionend', this.onCompositionEnd);
        this.composer = null;
    }

    private observeComposerReplacements(): void {
        if (this.observer || typeof MutationObserver !== 'function') return;
        this.observer = new MutationObserver(() => this.scheduleRebind());
        this.observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    private bindGlobalKeydown(): void {
        window.addEventListener('keydown', this.onGlobalKeyDownCapture, true);
    }

    private detachGlobalKeydown(): void {
        window.removeEventListener('keydown', this.onGlobalKeyDownCapture, true);
    }

    private scheduleRebind(): void {
        if (!this.initialized || !this.enabled || this.rebindTimer != null) return;
        this.rebindTimer = window.setTimeout(() => {
            this.rebindTimer = null;
            this.bindComposer();
        }, REBIND_DELAY_MS);
    }

    private getComposerInput(): ComposerInput | null {
        if (this.composerOverride) {
            if (this.composerOverride.isConnected) return this.composerOverride;
            this.composerOverride = null;
        }
        try {
            return this.adapter.getComposerInputElement?.() ?? null;
        } catch {
            return null;
        }
    }

    private getActiveComposerAdapter(): SiteAdapter {
        if (!this.composerOverride) return this.adapter;
        return {
            getComposerInputElement: () => this.getComposerInput(),
            getComposerKind: () => {
                const input = this.getComposerInput();
                if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return 'textarea';
                if (input instanceof HTMLElement && (input.isContentEditable || input.getAttribute('contenteditable') === 'true')) {
                    return 'contenteditable';
                }
                return 'unknown';
            },
        } as SiteAdapter;
    }

    private onGlobalKeyDownCapture = (event: KeyboardEvent): void => {
        if (!this.enabled) return;
        if (!this.isAutocompleteKeyEvent(event)) return;
        if (!this.isEventFromActiveComposer(event)) return;
        this.handleAutocompleteKeydown(event);
    };

    private onComposerInput = (): void => {
        if (!this.enabled) return;
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onComposerKeyUp = (): void => {
        if (!this.enabled) return;
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onComposerClick = (): void => {
        if (!this.enabled) return;
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onCompositionStart = (): void => {
        this.composing = true;
    };

    private onCompositionEnd = (): void => {
        this.composing = false;
        if (!this.enabled) return;
        void this.refreshAutocomplete();
    };

    private onComposerKeyDownCapture = (event: KeyboardEvent): void => {
        if (!this.enabled) return;
        if (!this.isAutocompleteKeyEvent(event)) return;
        this.handleAutocompleteKeydown(event);
    };

    private isAutocompleteKeyEvent(event: KeyboardEvent): boolean {
        return !event.defaultPrevented
            && !event.isComposing
            && event.keyCode !== 229
            && this.mode === 'autocomplete';
    }

    private isEventFromActiveComposer(event: KeyboardEvent): boolean {
        const input = this.getComposerInput();
        if (!input) return false;
        const path = event.composedPath?.() ?? [];
        if (path.includes(input)) return true;
        const target = event.target;
        return target instanceof Node && (target === input || input.contains(target));
    }

    private handleAutocompleteKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (this.activeToken) this.dismissedTokenKey = getTokenKey(this.activeToken);
            this.close();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (this.suggestions.length < 1) return;
            event.preventDefault();
            event.stopPropagation();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            this.selectedIndex = (this.selectedIndex + delta + this.suggestions.length) % this.suggestions.length;
            this.render();
            return;
        }
        if (event.key !== 'Enter' && event.key !== 'Tab') return;
        const prompt = this.suggestions[this.selectedIndex];
        if (!prompt || !this.activeToken) return;
        event.preventDefault();
        event.stopPropagation();
        void this.insertPrompt(prompt, this.activeToken);
    }

    private getCaretRange(): { start: number; end: number } | null {
        const input = this.getComposerInput();
        if (!input) return null;
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            return { start, end };
        }
        if (input instanceof HTMLElement && (input.isContentEditable || input.getAttribute('contenteditable') === 'true')) {
            return getContenteditablePlainTextSelection(input);
        }
        const text = input.textContent || '';
        return { start: text.length, end: text.length };
    }

    private async refreshAutocomplete(): Promise<void> {
        if (!this.initialized || this.mode === 'manager' || this.mode === 'edit') return;
        const read = readComposer(this.getActiveComposerAdapter());
        if (!read.ok) {
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        const caret = this.getCaretRange();
        if (!caret || caret.start !== caret.end) {
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        if (this.formulaAuthoringEnabled && findMarkdownMathAt(read.text, caret.start, { includeOpen: true })) {
            this.dismissedTokenKey = null;
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        const token = findPromptTriggerToken(read.text, caret.start);
        if (!token) {
            this.dismissedTokenKey = null;
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        const tokenKey = getTokenKey(token);
        if (this.dismissedTokenKey === tokenKey) {
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        if (this.dismissedTokenKey && this.dismissedTokenKey !== tokenKey) {
            this.dismissedTokenKey = null;
        }

        const currentRequest = ++this.requestId;
        const prompts = await this.loadPrompts().catch(() => []);
        if (currentRequest !== this.requestId) return;
        const suggestions = filterPromptRecords(
            prompts.filter((prompt) => prompt.triggerText.trim()),
            { query: token.query, match: 'trigger' },
        );
        if (suggestions.length < 1) {
            if (this.mode === 'autocomplete') this.close();
            return;
        }

        this.mode = 'autocomplete';
        this.activeToken = token;
        this.suggestions = suggestions;
        this.selectedIndex = Math.min(this.selectedIndex, suggestions.length - 1);
        this.ensureHost();
        this.render();
        this.positionAutocompleteNearCaret();
        this.installOutsideDismiss();
    }

    private async loadPrompts(options: { force?: boolean; context?: 'composer' | 'all'; includeDisabled?: boolean } = {}): Promise<PromptRecord[]> {
        if (!options.force && this.promptsCache) return this.promptsCache;
        const prompts = await this.client.listPrompts({
            context: options.context ?? 'all',
            includeDisabled: options.includeDisabled,
        });
        this.promptsCache = prompts;
        return prompts;
    }

    private invalidatePromptCache(): void {
        this.promptsCache = null;
    }

    private ensureHost(): void {
        if (this.host?.isConnected && this.shadow && this.root) return;
        document.getElementById(HOST_ID)?.remove();
        const host = markTransientRoot(document.createElement('div'));
        host.id = HOST_ID;
        host.dataset.aimdRole = 'chatgpt-prompt-popover';
        host.setAttribute('data-aimd-theme', this.resolveTheme());
        host.style.position = 'fixed';
        host.style.left = '0px';
        host.style.top = '0px';
        host.style.zIndex = 'var(--aimd-z-tooltip)';
        const shadow = host.attachShadow({ mode: 'open' });
        const root = document.createElement('div');
        root.className = 'prompt-popover';
        shadow.append(root);
        document.body.appendChild(host);
        this.host = host;
        this.shadow = shadow;
        this.root = root;
    }

    private render(): void {
        if (!this.shadow || !this.root || !this.host) return;
        if (!this.mode) return;
        this.host.setAttribute('data-aimd-theme', this.resolveTheme());
        this.shadow.querySelector('style')?.remove();
        const style = document.createElement('style');
        style.textContent = `${getTokenCss(this.resolveTheme(), this.themeOverrides)}\n${this.getCss()}`;
        this.shadow.prepend(style);

        if (this.mode === 'autocomplete') {
            this.renderAutocomplete();
            return;
        }
        if (this.mode === 'edit') {
            this.renderEditor();
            return;
        }
        this.renderManager();
    }

    private renderAutocomplete(): void {
        if (!this.root) return;
        this.root.className = 'prompt-popover prompt-popover--autocomplete';
        this.root.replaceChildren();
        const list = renderComposerSuggestionList({
            root: this.root,
            items: this.suggestions.map((prompt) => ({
                title: prompt.title,
                content: prompt.content.replace('{{cursor}}', '').trim(),
                trailing: prompt.triggerText,
            })),
            selectedIndex: this.selectedIndex,
            role: 'prompt-suggestion',
            rowClassName: 'prompt-row',
            mainClassName: 'prompt-row__main',
            titleClassName: 'prompt-row__title',
            contentClassName: 'prompt-row__content',
            trailingClassName: 'prompt-row__trigger',
            onHover: (index) => {
                this.selectedIndex = index;
                this.root?.querySelectorAll<HTMLButtonElement>('[data-role="prompt-suggestion"]').forEach((row) => {
                    const active = Number(row.dataset.index) === index;
                    row.classList.toggle('is-active', active);
                    row.setAttribute('aria-selected', active ? 'true' : 'false');
                });
            },
            onSelect: (index) => {
                const prompt = this.suggestions[index];
                if (prompt && this.activeToken) void this.insertPrompt(prompt, this.activeToken);
            },
        });
        list.classList.add('prompt-list');
    }

    private renderManager(): void {
        if (!this.root) return;
        const prompts = (this.promptsCache ?? []).filter((prompt) => matchesManagerQuery(prompt, this.managerQuery));
        const rows = prompts.map((prompt) => {
            const body = `<button class="manager-row__main" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}">
                <span class="manager-row__title">${escapeHtml(prompt.title)}</span>
                <span class="manager-row__meta">${escapeHtml(prompt.triggerText)}</span>
                <span class="manager-row__content">${escapeHtml(prompt.content.replace('{{cursor}}', '').trim())}</span>
              </button>`;
            return `
            <div class="manager-row" data-prompt-id="${escapeHtml(prompt.id)}">
              <button class="icon-btn prompt-drag-handle" type="button" data-action="reorder-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('readerStickyDrag'))}" title="${escapeHtml(t('readerStickyDrag'))}">${gripHorizontalIcon}</button>
              ${body}
              <label class="prompt-enabled-toggle">
                <span>${escapeHtml(t('promptEnabledLabel'))}</span>
                <input type="checkbox" data-action="toggle-prompt-enabled" data-prompt-id="${escapeHtml(prompt.id)}" ${prompt.enabled ? 'checked' : ''} />
              </label>
              <button class="icon-btn" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptEdit'))}">${pencilIcon}</button>
              <button class="icon-btn icon-btn--danger" type="button" data-action="delete-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptDelete'))}">${trashIcon}</button>
            </div>
        `;
        }).join('');
        this.root.className = 'prompt-popover prompt-popover--manager';
        this.root.innerHTML = `
          <div class="prompt-header">
            <div class="prompt-header__title">${messageSquareTextIcon}<span>${escapeHtml(t('promptManagerTitle'))}</span></div>
            <button class="icon-btn" type="button" data-action="close-prompts" aria-label="${escapeHtml(t('btnClose'))}">${xIcon}</button>
          </div>
          <div class="prompt-toolbar">
            <input class="prompt-search" data-role="prompt-search" type="search" placeholder="${escapeHtml(t('promptSearchPlaceholder'))}" value="${escapeHtml(this.managerQuery)}" />
            <button class="primary-btn" type="button" data-action="add-prompt">${plusIcon}<span>${escapeHtml(t('promptAdd'))}</span></button>
          </div>
          ${this.statusMessage ? `<div class="prompt-status">${escapeHtml(this.statusMessage)}</div>` : ''}
          <div class="manager-list">${rows || `<div class="prompt-empty">${escapeHtml(t('promptNoPrompts'))}</div>`}</div>
        `;
        const search = this.root.querySelector<HTMLInputElement>('[data-role="prompt-search"]');
        if (search) {
            installInputEventBoundary(search);
            search.addEventListener('input', () => {
                this.managerQuery = search.value;
                this.render();
                this.shadow?.querySelector<HTMLInputElement>('[data-role="prompt-search"]')?.focus();
            });
        }
        this.root.querySelector<HTMLButtonElement>('[data-action="close-prompts"]')?.addEventListener('click', () => this.close());
        this.installManagerPanelDrag();
        this.root.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')?.addEventListener('click', () => {
            this.editPrompt = {
                id: createPromptId(),
                title: t('promptUntitled'),
                content: '',
                triggerText: '',
                contexts: ['composer', 'readerComment'],
                favorite: false,
                enabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastUsedAt: null,
            };
            this.mode = 'edit';
            this.render();
        });
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="edit-prompt"]').forEach((button) => {
            button.addEventListener('click', () => {
                const prompt = this.findPrompt(button.dataset.promptId);
                if (!prompt) return;
                this.editPrompt = { ...prompt, contexts: [...prompt.contexts] };
                this.mode = 'edit';
                this.render();
            });
        });
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="reorder-prompt"]').forEach((button) => {
            button.addEventListener('pointerdown', (event) => {
                this.startPromptPointerDrag(event, button.dataset.promptId ?? '');
            });
        });
        this.root.querySelectorAll<HTMLInputElement>('[data-action="toggle-prompt-enabled"]').forEach((input) => {
            installInputEventBoundary(input);
            input.addEventListener('change', async () => {
                const prompt = this.findPrompt(input.dataset.promptId);
                if (!prompt) return;
                try {
                    await this.client.savePrompt({ ...prompt, enabled: input.checked });
                    this.invalidatePromptCache();
                    await this.loadPrompts({ force: true, context: 'all', includeDisabled: true });
                    this.render();
                } catch (error) {
                    this.statusMessage = error instanceof Error ? error.message : t('promptSaveFailed');
                    this.render();
                }
            });
        });
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="delete-prompt"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const prompt = this.findPrompt(button.dataset.promptId);
                if (!prompt) return;
                await this.client.deletePrompt(prompt.id);
                this.invalidatePromptCache();
                await this.loadPrompts({ force: true, context: 'all', includeDisabled: true });
                this.render();
            });
        });
    }

    private startPromptPointerDrag(event: PointerEvent, sourceId: string): void {
        if (!sourceId || this.mode !== 'manager') return;
        event.preventDefault();
        event.stopPropagation();

        this.promptDragCleanup?.();
        this.promptDragId = sourceId;
        this.promptDragDirty = false;
        this.setPromptDragState(sourceId, true);

        const onMove = (moveEvent: PointerEvent) => {
            if (!this.promptDragId) return;
            moveEvent.preventDefault();
            const target = this.findManagerRowAtPointer(moveEvent.clientY);
            const targetId = target?.dataset.promptId ?? '';
            if (!targetId || targetId === this.promptDragId) return;
            this.reorderPromptCache(this.promptDragId, targetId);
            this.promptDragDirty = true;
            this.render();
            this.setPromptDragState(this.promptDragId, true);
        };
        const onEnd = () => {
            const draggedId = this.promptDragId;
            const shouldPersist = this.promptDragDirty;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);
            this.promptDragCleanup = null;
            this.promptDragId = null;
            this.promptDragDirty = false;
            if (draggedId) this.setPromptDragState(draggedId, false);
            if (shouldPersist) void this.persistPromptOrder();
        };

        this.promptDragCleanup = onEnd;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd, { once: true });
        document.addEventListener('pointercancel', onEnd, { once: true });
    }

    private findManagerRowAtPointer(clientY: number): HTMLElement | null {
        const rows = Array.from(this.root?.querySelectorAll<HTMLElement>('.manager-row') ?? []);
        return rows.find((row) => {
            const rect = row.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        }) ?? null;
    }

    private setPromptDragState(id: string, dragging: boolean): void {
        const row = Array.from(this.root?.querySelectorAll<HTMLElement>('.manager-row') ?? [])
            .find((candidate) => candidate.dataset.promptId === id);
        if (!row) return;
        if (dragging) {
            row.dataset.dragging = '1';
            return;
        }
        delete row.dataset.dragging;
    }

    private reorderPromptCache(sourceId: string, targetId: string): void {
        const prompts = this.promptsCache ?? [];
        const sourceIndex = prompts.findIndex((prompt) => prompt.id === sourceId);
        const targetIndex = prompts.findIndex((prompt) => prompt.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
        const next = [...prompts];
        const [prompt] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, prompt!);
        this.promptsCache = next;
    }

    private async persistPromptOrder(): Promise<void> {
        if (!this.promptsCache || !this.client.reorderPrompts) return;
        try {
            this.promptsCache = await this.client.reorderPrompts(this.promptsCache.map((prompt) => prompt.id));
            this.statusMessage = '';
            this.render();
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : t('promptSaveFailed');
            this.render();
        }
    }

    private renderEditor(): void {
        if (!this.root || !this.editPrompt) return;
        const prompt = this.editPrompt;
        this.root.className = 'prompt-popover prompt-popover--editor';
        this.root.innerHTML = `
          <div class="prompt-header">
            <div class="prompt-header__title">${messageSquareTextIcon}<span>${escapeHtml(prompt.content ? t('promptEdit') : t('promptAdd'))}</span></div>
            <button class="icon-btn" type="button" data-action="cancel-edit" aria-label="${escapeHtml(t('btnBack'))}">${xIcon}</button>
          </div>
          <div class="prompt-editor-body">
            <label class="field"><span>${escapeHtml(t('promptTitleLabel'))}</span><input data-role="prompt-title" type="text" value="${escapeHtml(prompt.title)}" /></label>
            <label class="field"><span>${escapeHtml(t('promptTriggerLabel'))}</span><input data-role="prompt-trigger" type="text" value="${escapeHtml(prompt.triggerText)}" placeholder="translate" /></label>
            <label class="field"><span>${escapeHtml(t('promptContentLabel'))}</span><textarea data-role="prompt-content" rows="7">${escapeHtml(prompt.content)}</textarea></label>
            <div class="placeholder-row">
              <button class="secondary-btn" type="button" data-action="insert-cursor-placeholder">${escapeHtml(t('promptInsertCursorPlaceholder'))}</button>
            </div>
            ${this.statusMessage ? `<div class="prompt-status">${escapeHtml(this.statusMessage)}</div>` : ''}
          </div>
          <div class="prompt-footer">
            <button class="secondary-btn" type="button" data-action="cancel-edit">${escapeHtml(t('btnCancel'))}</button>
            <button class="primary-btn" type="button" data-action="save-prompt">${checkIcon}<span>${escapeHtml(t('btnSave'))}</span></button>
          </div>
        `;
        this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((input) => installInputEventBoundary(input));
        this.syncCursorPlaceholderButtonState();
        this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')?.addEventListener('input', () => {
            this.syncCursorPlaceholderButtonState();
        });
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="cancel-edit"]').forEach((button) => {
            button.addEventListener('click', () => {
                this.mode = 'manager';
                this.editPrompt = null;
                this.statusMessage = '';
                this.render();
            });
        });
        this.root.querySelector<HTMLButtonElement>('[data-action="save-prompt"]')?.addEventListener('click', () => {
            void this.saveEditor();
        });
        this.root.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]')?.addEventListener('click', () => {
            this.insertCursorPlaceholder();
        });
        this.installManagerPanelDrag();
    }

    private async saveEditor(): Promise<void> {
        if (!this.root || !this.editPrompt) return;
        const title = this.root.querySelector<HTMLInputElement>('[data-role="prompt-title"]')?.value ?? '';
        const triggerText = this.root.querySelector<HTMLInputElement>('[data-role="prompt-trigger"]')?.value ?? '';
        const content = this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')?.value ?? '';
        if (!content.trim()) {
            this.statusMessage = t('promptContentRequired');
            this.render();
            return;
        }
        try {
            await this.client.savePrompt({
                ...this.editPrompt,
                title,
                triggerText,
                content,
                contexts: ['composer', 'readerComment'],
                enabled: this.editPrompt.enabled,
                favorite: this.editPrompt.favorite,
            });
            this.invalidatePromptCache();
            await this.loadPrompts({ force: true, context: 'all', includeDisabled: true });
            this.mode = 'manager';
            this.editPrompt = null;
            this.statusMessage = '';
            this.render();
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : t('promptSaveFailed');
            this.render();
        }
    }

    private insertCursorPlaceholder(): void {
        const textarea = this.root?.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]');
        if (!textarea) return;
        const marker = '{{cursor}}';
        if (textarea.value.includes(marker)) {
            this.syncCursorPlaceholderButtonState();
            return;
        }
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        textarea.value = `${textarea.value.slice(0, start)}${marker}${textarea.value.slice(end)}`;
        const nextCursor = start + marker.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        textarea.focus();
        this.syncCursorPlaceholderButtonState();
    }

    private syncCursorPlaceholderButtonState(): void {
        const textarea = this.root?.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]');
        const button = this.root?.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]');
        if (!textarea || !button) return;
        button.disabled = textarea.value.includes('{{cursor}}');
    }

    private findPrompt(id: string | undefined): PromptRecord | null {
        if (!id) return null;
        return (this.promptsCache ?? []).find((prompt) => prompt.id === id) ?? null;
    }

    private async insertPrompt(prompt: PromptRecord, token: PromptTriggerToken | null): Promise<void> {
        const read = readComposer(this.getActiveComposerAdapter());
        if (!read.ok) return;
        const range = this.createReplacementRange(read.text, prompt.content, token);
        const result = await replaceComposerTextRange(this.getActiveComposerAdapter(), range, { focus: true });
        if (!result.ok) return;
        void this.client.recordUse(prompt.id).catch(() => undefined);
        this.dismissedTokenKey = null;
        this.close();
    }

    private createReplacementRange(
        currentText: string,
        promptContent: string,
        token: PromptTriggerToken | null,
    ): ComposerTextRangeReplacement {
        const prepared = stripCursorMarker(promptContent);
        if (token) {
            return {
                start: token.start,
                end: token.end,
                replacement: prepared.text,
                cursorIndex: token.start + (prepared.markerIndex >= 0 ? prepared.markerIndex : prepared.text.length),
            };
        }

        const caret = this.getCaretRange();
        const start = caret ? caret.start : currentText.length;
        const end = caret ? caret.end : currentText.length;
        return {
            start,
            end,
            replacement: prepared.text,
            cursorIndex: start + (prepared.markerIndex >= 0 ? prepared.markerIndex : prepared.text.length),
        };
    }

    private installOutsideDismiss(): void {
        this.outsideDismiss?.detach();
        this.outsideDismiss = installTransientOutsideDismissBoundary({
            eventTarget: document,
            roots: () => [this.host, this.getComposerInput()],
            onDismiss: () => this.close(),
        });
    }

    private positionNear(anchor: HTMLElement | null, preferred: 'above' | 'below'): void {
        if (!this.host || !this.root) return;
        const { width, height } = this.applyPopoverGeometry();
        const viewport = this.getViewportFrame();
        const rect = anchor?.getBoundingClientRect?.();
        const fallbackLeft = Math.max(viewport.left + POPOVER_MARGIN_PX, viewport.right - width - POPOVER_MARGIN_PX);
        const fallbackTop = Math.max(viewport.top + POPOVER_MARGIN_PX, viewport.bottom - height - (POPOVER_MARGIN_PX * 4));
        if (!rect) {
            this.host.style.left = `${fallbackLeft}px`;
            this.host.style.top = `${fallbackTop}px`;
            return;
        }
        const rawLeft = this.mode === 'autocomplete' ? rect.left : rect.right - width;
        const maxLeft = Math.max(viewport.left + POPOVER_MARGIN_PX, viewport.right - width - POPOVER_MARGIN_PX);
        const left = Math.max(viewport.left + POPOVER_MARGIN_PX, Math.min(rawLeft, maxLeft));
        const aboveTop = rect.top - height - POPOVER_GAP_PX;
        const belowTop = rect.bottom + POPOVER_GAP_PX;
        const spaceAbove = rect.top - viewport.top - POPOVER_MARGIN_PX;
        const spaceBelow = viewport.bottom - rect.bottom - POPOVER_MARGIN_PX;
        const preferredTop = preferred === 'above'
            ? (aboveTop >= viewport.top + POPOVER_MARGIN_PX || spaceAbove >= spaceBelow ? aboveTop : belowTop)
            : (belowTop + height <= viewport.bottom - POPOVER_MARGIN_PX || spaceBelow >= spaceAbove ? belowTop : aboveTop);
        const placement = this.clampManagerPlacement({ left, top: preferredTop }, width, height);
        this.host.style.left = `${placement.left}px`;
        this.host.style.top = `${placement.top}px`;
    }

    private resolvePopoverGeometry(): { width: number; height: number; maxHeight: number } {
        const viewport = this.getViewportFrame();
        const viewportWidth = Math.max(0, viewport.width);
        const viewportHeight = Math.max(0, viewport.height);
        const preferredWidth = this.mode === 'autocomplete' ? AUTOCOMPLETE_WIDTH_PX : MANAGER_WIDTH_PX;
        const width = Math.min(preferredWidth, Math.max(POPOVER_MIN_WIDTH_PX, viewportWidth - (POPOVER_MARGIN_PX * 2)));
        const viewportMaxHeight = Math.max(POPOVER_MIN_MAX_HEIGHT_PX, viewportHeight - (POPOVER_MARGIN_PX * 2));
        const maxHeight = this.mode === 'autocomplete' ? viewportMaxHeight : Math.min(MANAGER_MAX_HEIGHT_PX, viewportMaxHeight);
        const measuredHeight = this.root?.getBoundingClientRect().height ?? 0;
        const fallbackHeight = this.estimatePopoverHeight(maxHeight);
        const height = Math.min(maxHeight, Math.max(measuredHeight, fallbackHeight));
        return { width, height, maxHeight };
    }

    private applyPopoverGeometry(): { width: number; height: number; maxHeight: number } {
        const geometry = this.resolvePopoverGeometry();
        if (!this.host) return geometry;
        this.host.style.width = `${geometry.width}px`;
        this.host.style.setProperty('--aimd-prompt-popover-max-height', `${geometry.maxHeight}px`);
        return geometry;
    }

    private getViewportFrame(): ViewportFrame {
        const visual = window.visualViewport;
        const left = Number.isFinite(visual?.offsetLeft) ? visual!.offsetLeft : 0;
        const top = Number.isFinite(visual?.offsetTop) ? visual!.offsetTop : 0;
        const width = Math.max(0, Number.isFinite(visual?.width) ? visual!.width : (window.innerWidth || document.documentElement.clientWidth || 0));
        const height = Math.max(0, Number.isFinite(visual?.height) ? visual!.height : (window.innerHeight || document.documentElement.clientHeight || 0));
        return {
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
        };
    }

    private clampManagerPlacement(placement: ManagerPlacement, width: number, height: number): ManagerPlacement {
        const viewport = this.getViewportFrame();
        const minLeft = viewport.left + POPOVER_MARGIN_PX;
        const minTop = viewport.top + POPOVER_MARGIN_PX;
        const maxLeft = Math.max(minLeft, viewport.right - width - POPOVER_MARGIN_PX);
        const maxTop = Math.max(minTop, viewport.bottom - height - POPOVER_MARGIN_PX);
        return {
            left: Math.round(Math.max(minLeft, Math.min(placement.left, maxLeft))),
            top: Math.round(Math.max(minTop, Math.min(placement.top, maxTop))),
        };
    }

    private applyManagerPlacement(placement: ManagerPlacement): ManagerPlacement {
        if (!this.host) return placement;
        const { width, height } = this.applyPopoverGeometry();
        const clamped = this.clampManagerPlacement(placement, width, height);
        this.host.style.left = `${clamped.left}px`;
        this.host.style.top = `${clamped.top}px`;
        return clamped;
    }

    private readCurrentManagerPlacement(): ManagerPlacement {
        const rect = this.host?.getBoundingClientRect();
        const left = Number.parseFloat(this.host?.style.left ?? '');
        const top = Number.parseFloat(this.host?.style.top ?? '');
        return {
            left: Number.isFinite(left) ? left : (rect?.left ?? POPOVER_MARGIN_PX),
            top: Number.isFinite(top) ? top : (rect?.top ?? POPOVER_MARGIN_PX),
        };
    }

    private clampOpenManagerPlacement(): void {
        if (!this.host || !this.root || (this.mode !== 'manager' && this.mode !== 'edit')) return;
        const current = this.managerPlacement ?? this.readCurrentManagerPlacement();
        const clamped = this.applyManagerPlacement(current);
        if (this.managerPlacement) this.managerPlacement = clamped;
    }

    private installManagerViewportClamp(): void {
        this.managerViewportClampCleanup?.();
        const onViewportChange = () => this.clampOpenManagerPlacement();
        const visualViewport = window.visualViewport;
        window.addEventListener('resize', onViewportChange);
        visualViewport?.addEventListener('resize', onViewportChange);
        visualViewport?.addEventListener('scroll', onViewportChange);
        this.managerViewportClampCleanup = () => {
            window.removeEventListener('resize', onViewportChange);
            visualViewport?.removeEventListener('resize', onViewportChange);
            visualViewport?.removeEventListener('scroll', onViewportChange);
        };
    }

    private installManagerPanelDrag(): void {
        const header = this.root?.querySelector<HTMLElement>('.prompt-header');
        header?.addEventListener('pointerdown', (event) => this.startManagerPanelDrag(event));
    }

    private startManagerPanelDrag(event: PointerEvent): void {
        if (!this.host || (this.mode !== 'manager' && this.mode !== 'edit')) return;
        if (event.button !== 0 || this.isManagerPanelDragExcludedTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();

        this.managerPanelDragCleanup?.();
        const start = this.readCurrentManagerPlacement();
        const priorPlacement = this.managerPlacement;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;

        const onMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            moved = true;
            this.managerPlacement = this.applyManagerPlacement({
                left: start.left + (moveEvent.clientX - startX),
                top: start.top + (moveEvent.clientY - startY),
            });
        };
        const onEnd = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);
            this.managerPanelDragCleanup = null;
            if (!moved) this.managerPlacement = priorPlacement;
        };

        this.managerPanelDragCleanup = onEnd;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd, { once: true });
        document.addEventListener('pointercancel', onEnd, { once: true });
    }

    private isManagerPanelDragExcludedTarget(target: EventTarget | null): boolean {
        if (!(target instanceof Element)) return true;
        return !!target.closest('button, input, textarea, select, [contenteditable="true"], [data-action="reorder-prompt"], .prompt-drag-handle');
    }

    private estimatePopoverHeight(maxHeight: number): number {
        if (this.mode === 'autocomplete') return Math.min(maxHeight, AUTOCOMPLETE_FALLBACK_HEIGHT_PX);
        if (this.mode === 'edit') return Math.min(maxHeight, EDITOR_FALLBACK_HEIGHT_PX);
        const promptCount = (this.promptsCache ?? []).filter((prompt) => matchesManagerQuery(prompt, this.managerQuery)).length;
        const rowCount = Math.max(1, promptCount);
        const statusHeight = this.statusMessage ? MANAGER_STATUS_HEIGHT_PX : 0;
        return Math.min(maxHeight, MANAGER_FIXED_HEIGHT_PX + statusHeight + (rowCount * MANAGER_ROW_HEIGHT_PX));
    }

    private getCaretClientRect(): DOMRect | null {
        const input = this.getComposerInput();
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            return this.getTextInputCaretClientRect(input);
        }
        if (input instanceof HTMLElement && (input.isContentEditable || input.getAttribute('contenteditable') === 'true')) {
            return getContenteditableCaretClientRect(input);
        }
        return null;
    }

    private getTextInputCaretClientRect(input: HTMLTextAreaElement | HTMLInputElement): DOMRect | null {
        const position = input.selectionStart ?? input.value.length;
        const rect = input.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const style = window.getComputedStyle(input);
        const mirror = document.createElement('div');
        const marker = document.createElement('span');
        const copyProperties = [
            'boxSizing',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'fontFamily',
            'fontSize',
            'fontWeight',
            'fontStyle',
            'letterSpacing',
            'lineHeight',
            'textTransform',
            'textIndent',
            'textAlign',
            'tabSize',
            'wordBreak',
        ] as const;

        mirror.style.position = 'fixed';
        mirror.style.left = '0';
        mirror.style.top = '0';
        mirror.style.width = `${rect.width}px`;
        mirror.style.height = 'auto';
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.whiteSpace = input instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.overflow = 'hidden';
        copyProperties.forEach((property) => {
            mirror.style[property] = style[property];
        });
        mirror.textContent = input.value.slice(0, position);
        marker.dataset.aimdTextareaCaret = '1';
        marker.textContent = TEXTAREA_CARET_MARKER;
        mirror.appendChild(marker);
        document.body.appendChild(mirror);

        const markerLeft = marker.offsetLeft;
        const markerTop = marker.offsetTop;
        mirror.remove();

        const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 16;
        const left = rect.left + markerLeft - input.scrollLeft;
        const top = rect.top + markerTop - input.scrollTop;
        return {
            x: left,
            y: top,
            left,
            top,
            width: 0,
            height: lineHeight,
            right: left,
            bottom: top + lineHeight,
            toJSON: () => ({}),
        } as DOMRect;
    }

    private positionAutocompleteNearCaret(): void {
        if (!this.host || !this.root) return;
        const { width } = this.resolvePopoverGeometry();
        this.host.style.width = `${width}px`;
        const caretRect = this.getCaretClientRect();
        if (!caretRect) {
            this.positionNear(this.getComposerInput(), 'above');
            return;
        }

        const margin = POPOVER_MARGIN_PX;
        const gap = POPOVER_GAP_PX;
        const measuredHeight = this.root.getBoundingClientRect().height;
        const height = measuredHeight > 0 ? measuredHeight : AUTOCOMPLETE_FALLBACK_HEIGHT_PX;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const left = Math.max(margin, Math.min(caretRect.left, maxLeft));
        const aboveTop = caretRect.top - height - gap;
        const belowTop = caretRect.bottom + gap;
        const preferredTop = aboveTop >= margin ? aboveTop : belowTop;
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        const top = Math.max(margin, Math.min(preferredTop, maxTop));

        this.host.style.left = `${left}px`;
        this.host.style.top = `${top}px`;
    }

    private resolveTheme(): 'light' | 'dark' {
        const attr = document.documentElement.getAttribute('data-aimd-theme') || document.documentElement.getAttribute('data-theme');
        return attr === 'dark' || document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }

    private getCss(): string {
        return `
:host {
  box-sizing: border-box;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
* {
  box-sizing: border-box;
}
${COMPOSER_SUGGESTION_LIST_CSS}
.prompt-popover {
  width: 100%;
  max-height: var(--aimd-prompt-popover-max-height, min(520px, calc(100vh - var(--aimd-space-8))));
  min-height: 0;
  display: grid;
  overflow: hidden;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-panel);
}
.prompt-popover--autocomplete {
  max-height: min(240px, calc(100vh - var(--aimd-space-8)));
}
.prompt-popover--manager {
  grid-template-rows: auto auto auto minmax(0, 1fr);
}
.prompt-popover--editor {
  grid-template-rows: auto minmax(0, 1fr) auto;
}
.prompt-list {
  display: grid;
  gap: var(--aimd-space-1);
  max-height: min(360px, calc(100vh - var(--aimd-space-12)));
  overflow: auto;
  padding: var(--aimd-space-2);
}
.manager-list {
  display: grid;
  gap: var(--aimd-space-1);
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--aimd-space-2);
}
.prompt-editor-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: var(--aimd-space-3);
}
.prompt-row,
.manager-row__main {
  all: unset;
  min-width: 0;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
}
.prompt-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
.prompt-row:hover,
.prompt-row.is-active,
.manager-row__main:hover {
  background: var(--aimd-button-icon-hover);
}
.prompt-row__main,
.manager-row__main {
  min-width: 0;
}
.prompt-row__title,
.manager-row__title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
}
.prompt-row__content,
.manager-row__content,
.manager-row__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.prompt-row__trigger {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  font-family: var(--aimd-font-family-mono);
}
.prompt-enabled-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  white-space: nowrap;
}
.prompt-enabled-toggle input {
  accent-color: var(--aimd-interactive-primary);
}
.prompt-header,
.prompt-toolbar,
.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
}
.prompt-header {
  border-bottom: 1px solid var(--aimd-border-subtle);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.prompt-header:active {
  cursor: grabbing;
}
.prompt-header button {
  touch-action: auto;
  user-select: auto;
}
.prompt-header__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-width: 0;
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
}
.prompt-header__title svg,
.icon-btn svg,
.primary-btn svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.prompt-search,
.field input,
.field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-md);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font: inherit;
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.prompt-search {
  flex: 1;
}
.manager-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--aimd-space-1);
}
.prompt-drag-handle {
  cursor: grab;
}
.prompt-drag-handle:active {
  cursor: grabbing;
}
.manager-row[data-dragging="1"] {
  opacity: 0.72;
}
.manager-row[data-dragging="1"] .prompt-drag-handle {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-selected);
}
.icon-btn,
.primary-btn,
.secondary-btn {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-1);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-xs);
}
.icon-btn {
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-size-control-icon-panel-nav);
  color: var(--aimd-text-secondary);
}
.icon-btn:hover,
.icon-btn:focus-visible,
.secondary-btn:hover,
.secondary-btn:focus-visible {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-interactive-primary);
}
.icon-btn--danger:hover,
.icon-btn--danger:focus-visible {
  color: var(--aimd-interactive-danger);
}
.primary-btn,
.secondary-btn {
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.primary-btn {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}
.prompt-footer {
  border-top: 1px solid var(--aimd-border-subtle);
}
.secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.secondary-btn:disabled:hover,
.secondary-btn:disabled:focus-visible {
  background: transparent;
  color: var(--aimd-text-primary);
}
.field {
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-3) var(--aimd-space-3) 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.field textarea {
  resize: vertical;
  min-height: 132px;
  max-height: min(320px, calc(var(--aimd-prompt-popover-max-height, 630px) - 220px));
  overflow-y: auto;
}
.placeholder-row {
  display: grid;
  justify-content: start;
  padding: var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.prompt-status,
.prompt-empty {
  padding: var(--aimd-space-2) var(--aimd-space-3);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
`;
    }
}
