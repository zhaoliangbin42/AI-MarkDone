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
import type { PromptLibraryClient } from '../../../drivers/content/prompts/promptLibraryClient';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { checkIcon, messageSquareTextIcon, pencilIcon, plusIcon, trashIcon, xIcon } from '../../../assets/icons';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { installTransientOutsideDismissBoundary, markTransientRoot, type TransientOutsideDismissBoundaryHandle } from '../components/transientUi';
import { t } from '../components/i18n';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;
type Mode = 'autocomplete' | 'manager' | 'edit';

const HOST_ID = 'aimd-chatgpt-prompt-popover-host';
const REBIND_DELAY_MS = 200;

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

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly client: PromptLibraryClient,
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.bindComposer();
        this.observeComposerReplacements();
    }

    dispose(): void {
        if (!this.initialized && !this.host) return;
        this.initialized = false;
        this.detachComposer();
        this.observer?.disconnect();
        this.observer = null;
        if (this.rebindTimer != null) {
            window.clearTimeout(this.rebindTimer);
            this.rebindTimer = null;
        }
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
        this.positionNear(anchor ?? this.getComposerInput(), 'above');
        this.installOutsideDismiss();
        this.shadow?.querySelector<HTMLInputElement>('[data-role="prompt-search"]')?.focus();
    }

    close(): void {
        this.outsideDismiss?.detach();
        this.outsideDismiss = null;
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

    private scheduleRebind(): void {
        if (!this.initialized || this.rebindTimer != null) return;
        this.rebindTimer = window.setTimeout(() => {
            this.rebindTimer = null;
            this.bindComposer();
        }, REBIND_DELAY_MS);
    }

    private getComposerInput(): ComposerInput | null {
        try {
            return this.adapter.getComposerInputElement?.() ?? null;
        } catch {
            return null;
        }
    }

    private onComposerInput = (): void => {
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onComposerKeyUp = (): void => {
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onComposerClick = (): void => {
        if (this.composing) return;
        void this.refreshAutocomplete();
    };

    private onCompositionStart = (): void => {
        this.composing = true;
    };

    private onCompositionEnd = (): void => {
        this.composing = false;
        void this.refreshAutocomplete();
    };

    private onComposerKeyDownCapture = (event: KeyboardEvent): void => {
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
        if (this.mode !== 'autocomplete') return;

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
    };

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
        const read = readComposer(this.adapter);
        if (!read.ok) {
            if (this.mode === 'autocomplete') this.close();
            return;
        }
        const caret = this.getCaretRange();
        if (!caret || caret.start !== caret.end) {
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
            { query: token.query },
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
        host.style.zIndex = 'var(--aimd-z-panel)';
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
        const rows = this.suggestions.map((prompt, index) => `
            <button class="prompt-row ${index === this.selectedIndex ? 'is-active' : ''}" type="button" data-role="prompt-suggestion" data-index="${index}">
              <span class="prompt-row__main">
                <span class="prompt-row__title">${escapeHtml(prompt.title)}</span>
                <span class="prompt-row__content">${escapeHtml(prompt.content.replace('{{cursor}}', '').trim())}</span>
              </span>
              ${prompt.triggerText ? `<span class="prompt-row__trigger">${escapeHtml(prompt.triggerText)}</span>` : ''}
            </button>
        `).join('');
        this.root.className = 'prompt-popover prompt-popover--autocomplete';
        this.root.innerHTML = `<div class="prompt-list">${rows}</div>`;
        this.root.querySelectorAll<HTMLButtonElement>('[data-role="prompt-suggestion"]').forEach((button) => {
            button.addEventListener('mouseenter', () => {
                this.selectedIndex = Number(button.dataset.index ?? 0);
                this.render();
            });
            button.addEventListener('click', () => {
                const prompt = this.suggestions[Number(button.dataset.index ?? 0)];
                if (prompt && this.activeToken) void this.insertPrompt(prompt, this.activeToken);
            });
        });
    }

    private renderManager(): void {
        if (!this.root) return;
        const prompts = (this.promptsCache ?? []).filter((prompt) => matchesManagerQuery(prompt, this.managerQuery));
        const rows = prompts.map((prompt) => `
            <div class="manager-row" data-prompt-id="${escapeHtml(prompt.id)}">
              <button class="manager-row__main" type="button" data-action="insert-prompt" data-prompt-id="${escapeHtml(prompt.id)}">
                <span class="manager-row__title">${escapeHtml(prompt.title)}</span>
                <span class="manager-row__meta">${escapeHtml(prompt.triggerText)}</span>
                <span class="manager-row__content">${escapeHtml(prompt.content.replace('{{cursor}}', '').trim())}</span>
              </button>
              <button class="icon-btn" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptEdit'))}">${pencilIcon}</button>
              <button class="icon-btn icon-btn--danger" type="button" data-action="delete-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptDelete'))}">${trashIcon}</button>
            </div>
        `).join('');
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
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="insert-prompt"]').forEach((button) => {
            button.addEventListener('click', () => {
                const prompt = this.findPrompt(button.dataset.promptId);
                if (prompt) void this.insertPrompt(prompt, null);
            });
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

    private renderEditor(): void {
        if (!this.root || !this.editPrompt) return;
        const prompt = this.editPrompt;
        this.root.className = 'prompt-popover prompt-popover--editor';
        this.root.innerHTML = `
          <div class="prompt-header">
            <div class="prompt-header__title">${messageSquareTextIcon}<span>${escapeHtml(prompt.content ? t('promptEdit') : t('promptAdd'))}</span></div>
            <button class="icon-btn" type="button" data-action="cancel-edit" aria-label="${escapeHtml(t('btnBack'))}">${xIcon}</button>
          </div>
          <label class="field"><span>${escapeHtml(t('promptTitleLabel'))}</span><input data-role="prompt-title" type="text" value="${escapeHtml(prompt.title)}" /></label>
          <label class="field"><span>${escapeHtml(t('promptTriggerLabel'))}</span><input data-role="prompt-trigger" type="text" value="${escapeHtml(prompt.triggerText)}" placeholder="\\sum" /></label>
          <label class="field"><span>${escapeHtml(t('promptContentLabel'))}</span><textarea data-role="prompt-content" rows="7">${escapeHtml(prompt.content)}</textarea></label>
          <div class="placeholder-row">
            <button class="secondary-btn" type="button" data-action="insert-cursor-placeholder">${escapeHtml(t('promptInsertCursorPlaceholder'))}</button>
          </div>
          ${this.statusMessage ? `<div class="prompt-status">${escapeHtml(this.statusMessage)}</div>` : ''}
          <div class="prompt-footer">
            <button class="secondary-btn" type="button" data-action="cancel-edit">${escapeHtml(t('btnCancel'))}</button>
            <button class="primary-btn" type="button" data-action="save-prompt">${checkIcon}<span>${escapeHtml(t('btnSave'))}</span></button>
          </div>
        `;
        this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((input) => installInputEventBoundary(input));
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
                enabled: true,
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
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        textarea.value = `${textarea.value.slice(0, start)}${marker}${textarea.value.slice(end)}`;
        const nextCursor = start + marker.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        textarea.focus();
    }

    private findPrompt(id: string | undefined): PromptRecord | null {
        if (!id) return null;
        return (this.promptsCache ?? []).find((prompt) => prompt.id === id) ?? null;
    }

    private async insertPrompt(prompt: PromptRecord, token: PromptTriggerToken | null): Promise<void> {
        const read = readComposer(this.adapter);
        if (!read.ok) return;
        const range = this.createReplacementRange(read.text, prompt.content, token);
        const result = await replaceComposerTextRange(this.adapter, range, { focus: true });
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
        if (!this.host) return;
        const width = Math.min(420, Math.max(300, window.innerWidth - 32));
        const height = this.mode === 'autocomplete' ? 220 : 520;
        const rect = anchor?.getBoundingClientRect?.();
        const fallbackLeft = Math.max(16, window.innerWidth - width - 16);
        const fallbackTop = Math.max(16, window.innerHeight - height - 64);
        if (!rect) {
            this.host.style.left = `${fallbackLeft}px`;
            this.host.style.top = `${fallbackTop}px`;
            this.host.style.width = `${width}px`;
            return;
        }
        const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
        const aboveTop = rect.top - height - 8;
        const belowTop = rect.bottom + 8;
        const canFitAbove = aboveTop >= 16;
        const preferredTop = preferred === 'above' && canFitAbove ? aboveTop : belowTop;
        const top = Math.max(16, Math.min(preferredTop, window.innerHeight - height - 16));
        this.host.style.left = `${left}px`;
        this.host.style.top = `${top}px`;
        this.host.style.width = `${width}px`;
    }

    private getCaretClientRect(): DOMRect | null {
        const input = this.getComposerInput();
        if (input instanceof HTMLElement && (input.isContentEditable || input.getAttribute('contenteditable') === 'true')) {
            return getContenteditableCaretClientRect(input);
        }
        return null;
    }

    private positionAutocompleteNearCaret(): void {
        if (!this.host || !this.root) return;
        const width = Math.min(420, Math.max(300, window.innerWidth - 32));
        this.host.style.width = `${width}px`;
        const caretRect = this.getCaretClientRect();
        if (!caretRect) {
            this.positionNear(this.getComposerInput(), 'above');
            return;
        }

        const margin = 16;
        const gap = 8;
        const measuredHeight = this.root.getBoundingClientRect().height;
        const height = measuredHeight > 0 ? measuredHeight : 220;
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
.prompt-popover {
  width: 100%;
  max-height: min(520px, calc(100vh - var(--aimd-space-8)));
  overflow: hidden;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-panel);
}
.prompt-popover--autocomplete {
  max-height: min(240px, calc(100vh - var(--aimd-space-8)));
}
.prompt-list,
.manager-list {
  display: grid;
  gap: var(--aimd-space-1);
  max-height: min(360px, calc(100vh - var(--aimd-space-12)));
  overflow: auto;
  padding: var(--aimd-space-2);
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
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--aimd-space-1);
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
