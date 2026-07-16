import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import {
    readComposer,
    replaceComposerTextRange,
    type ComposerTextRangeReplacement,
} from '../../../drivers/content/sending/composerPort';
import { getContenteditablePlainTextSelection } from '../../../core/sending/contenteditable';
import type { PromptRecord } from '../../../core/prompts/promptLibrary';
import type { PromptTriggerToken } from '../../../core/prompts/slashTrigger';
import type { PromptLibraryClient } from '../../../drivers/content/prompts/promptLibraryClient';
import { ensureStyle } from '../../../style/shadow';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { markTransientRoot } from '../components/transientUi';
import { getLocale, subscribeLocaleChange, t, type UiLocale } from '../components/i18n';
import {
    getDefaultSurfaceMotionProfile,
    SurfaceSession,
    type ResponsiveProfile,
} from '../components/SurfaceRuntime';
import { getAnchoredMotionCss } from '../components/styles/anchoredMotionCss';
import { PromptWorkflow } from '../prompts/PromptWorkflow';
import {
    PromptGeometryAdapter,
    type PromptGeometryLayout,
} from '../prompts/PromptGeometryAdapter';
import {
    PromptSurfaceRenderer,
    type PromptSurfaceAction,
    type PromptSurfaceView,
} from '../prompts/PromptSurfaceRenderer';
import { getPromptSurfaceCss } from '../prompts/promptSurfaceCss';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

const HOST_ID = 'aimd-chatgpt-prompt-popover-host';
const REBIND_DELAY_MS = 200;
const RESPONSIVE_PROFILE: ResponsiveProfile = {
    viewportGutterPx: 16,
    maxWidthCss: '520px',
    maxHeightCss: '630px',
    collision: 'flip-clamp',
    scrollOwner: 'content',
    narrowFallback: 'compact',
};

function stripCursorMarker(value: string): { text: string; markerIndex: number } {
    const marker = '{{cursor}}';
    const markerIndex = value.indexOf(marker);
    return { text: value.replace(marker, ''), markerIndex };
}

/**
 * Orchestrates the Prompt family against composer and Prompt Library adapters.
 * Workflow state, host geometry, and DOM rendering live in their deep Modules.
 */
export class ChatGPTPromptAutocompleteController {
    private initialized = false;
    private composer: ComposerInput | null = null;
    private composerOverride: ComposerInput | null = null;
    private observer: MutationObserver | null = null;
    private rebindTimer: number | null = null;
    private composing = false;
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private root: HTMLElement | null = null;
    private renderer: PromptSurfaceRenderer | null = null;
    private appearanceScope: AppearanceScope | null = null;
    private surfaceSession: SurfaceSession<AppearanceSnapshot, UiLocale> | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private surfaceLifecycleMode: 'autocomplete' | 'manager' | null = null;
    private surfaceAnchor: HTMLElement | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private enabled = true;
    private formulaAuthoringEnabled = false;
    private readonly workflow: PromptWorkflow;
    private readonly geometry: PromptGeometryAdapter;

    constructor(
        private readonly adapter: SiteAdapter,
        client: PromptLibraryClient,
    ) {
        this.workflow = new PromptWorkflow(client);
        this.geometry = new PromptGeometryAdapter(() => this.getComposerInput());
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureLocaleSubscription();
        this.bindGlobalKeydown();
        if (this.enabled) this.bindComposer();
        this.observeComposerReplacements();
    }

    attachExternalComposer(input: ComposerInput): () => void {
        this.composerOverride = input;
        if (!this.initialized) {
            this.initialized = true;
            this.ensureLocaleSubscription();
            this.bindGlobalKeydown();
            this.observeComposerReplacements();
        }
        if (this.enabled) this.bindComposer();
        return () => {
            if (this.composerOverride !== input) return;
            if (this.workflow.state.mode === 'autocomplete') this.close();
            this.composerOverride = null;
            if (this.enabled) this.bindComposer();
        };
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) return;
        this.enabled = enabled;
        if (!enabled) {
            if (this.workflow.state.mode === 'autocomplete') this.close();
            this.detachComposer();
            return;
        }
        if (this.initialized) this.bindComposer();
    }

    setFormulaAuthoringEnabled(enabled: boolean): void {
        this.formulaAuthoringEnabled = enabled;
        if (enabled && this.workflow.state.mode === 'autocomplete') void this.refreshAutocomplete();
    }

    dispose(): void {
        if (!this.initialized && !this.host && !this.unsubscribeLocale) return;
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
        this.close();
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.surfaceSession?.setAppearance(snapshot);
    }

    async openManager(anchor?: HTMLElement | null): Promise<void> {
        this.ensureLocaleSubscription();
        await this.workflow.openManager();
        this.ensureHost();
        this.surfaceSession?.captureFocus(anchor ?? undefined);
        this.render();
        this.host!.hidden = false;
        this.surfaceAnchor = anchor ?? this.getComposerInput();
        this.openSurfaceLifecycle();
        this.renderer?.focusSearch();
    }

    close(): void {
        this.teardownSurface(true);
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
        if (!this.enabled || !this.isAutocompleteKeyEvent(event) || !this.isEventFromActiveComposer(event)) return;
        this.handleAutocompleteKeydown(event);
    };

    private onComposerInput = (): void => {
        if (this.enabled && !this.composing) void this.refreshAutocomplete();
    };

    private onComposerKeyUp = (): void => {
        if (this.enabled && !this.composing) void this.refreshAutocomplete();
    };

    private onComposerClick = (): void => {
        if (this.enabled && !this.composing) void this.refreshAutocomplete();
    };

    private onCompositionStart = (): void => {
        this.composing = true;
    };

    private onCompositionEnd = (): void => {
        this.composing = false;
        if (this.enabled) void this.refreshAutocomplete();
    };

    private onComposerKeyDownCapture = (event: KeyboardEvent): void => {
        if (!this.enabled || !this.isAutocompleteKeyEvent(event)) return;
        this.handleAutocompleteKeydown(event);
    };

    private isAutocompleteKeyEvent(event: KeyboardEvent): boolean {
        return !event.defaultPrevented
            && !event.isComposing
            && event.keyCode !== 229
            && this.workflow.state.mode === 'autocomplete';
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
        const state = this.workflow.state;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.workflow.dismissAutocomplete();
            this.teardownSurface(false);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (state.suggestions.length < 1) return;
            event.preventDefault();
            event.stopPropagation();
            this.workflow.moveSelection(event.key === 'ArrowDown' ? 1 : -1);
            this.render();
            return;
        }
        if (event.key !== 'Enter' && event.key !== 'Tab') return;
        const current = this.workflow.state;
        const prompt = current.suggestions[current.selectedIndex];
        if (!prompt || !current.activeToken) return;
        event.preventDefault();
        event.stopPropagation();
        void this.insertPrompt(prompt, current.activeToken);
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
        const mode = this.workflow.state.mode;
        if (!this.initialized || mode === 'manager' || mode === 'edit') return;
        const read = readComposer(this.getActiveComposerAdapter());
        const caret = this.getCaretRange();
        if (!read.ok || !caret || caret.start !== caret.end) {
            if (mode === 'autocomplete') this.close();
            return;
        }
        const result = await this.workflow.refreshAutocomplete({
            text: read.text,
            caret: caret.start,
            formulaAuthoringEnabled: this.formulaAuthoringEnabled,
        });
        if (result === 'close') {
            this.teardownSurface(false);
            return;
        }
        if (result !== 'open') return;
        this.ensureLocaleSubscription();
        this.ensureHost();
        this.host!.hidden = false;
        this.render();
        this.surfaceAnchor = this.getComposerInput();
        this.openSurfaceLifecycle();
    }

    private ensureLocaleSubscription(): void {
        if (this.unsubscribeLocale) return;
        this.unsubscribeLocale = subscribeLocaleChange((locale) => this.surfaceSession?.setLocale(locale));
    }

    private ensureHost(): void {
        if (this.host?.isConnected && this.shadow && this.root && this.renderer) return;
        document.getElementById(HOST_ID)?.remove();
        const host = markTransientRoot(document.createElement('div'));
        host.id = HOST_ID;
        host.dataset.aimdRole = 'chatgpt-prompt-popover';
        host.dataset.aimdTheme = this.appearance.theme;
        host.style.position = 'fixed';
        host.style.left = '0px';
        host.style.top = '0px';
        host.style.zIndex = 'var(--aimd-z-tooltip)';
        const shadow = host.attachShadow({ mode: 'open' });
        const root = document.createElement('div');
        root.className = 'prompt-popover';
        root.dataset.aimdSurfaceProfile = 'anchored';
        shadow.append(root);
        document.body.appendChild(host);
        this.host = host;
        this.shadow = shadow;
        this.root = root;
        this.renderer = new PromptSurfaceRenderer(root, { onAction: (action) => this.handleSurfaceAction(action) });
        this.appearanceScope = AppearanceScope.forShadowRoot(shadow, { styleId: 'aimd-prompt-popover-tokens' });
        this.appearanceScope.apply(this.appearance);
        ensureStyle(shadow, `${getAnchoredMotionCss()}\n${getPromptSurfaceCss()}`, {
            id: 'aimd-prompt-popover-style',
            cache: 'shared',
        });
        this.surfaceSession = new SurfaceSession<AppearanceSnapshot, UiLocale>({
            profile: 'anchored',
            responsiveProfile: RESPONSIVE_PROFILE,
            motionProfile: getDefaultSurfaceMotionProfile('anchored'),
            appearance: {
                currentValue: this.appearance,
                equals: areAppearanceSnapshotsEqual,
                apply: (snapshot) => {
                    this.appearance = snapshot;
                    host.dataset.aimdTheme = snapshot.theme;
                    this.appearanceScope?.apply(snapshot);
                    this.renderPreservingFocus();
                },
            },
            locale: {
                currentValue: getLocale(),
                apply: () => this.renderPreservingFocus(),
            },
        });
    }

    private createView(): PromptSurfaceView | null {
        const state = this.workflow.state;
        if (!state.mode) return null;
        return {
            mode: state.mode,
            prompts: state.mode === 'manager' ? this.workflow.managerPrompts : (state.prompts ?? []),
            suggestions: state.suggestions,
            selectedIndex: state.selectedIndex,
            managerQuery: state.managerQuery,
            editPrompt: state.editPrompt,
            statusMessage: state.statusMessage,
        };
    }

    private render(): void {
        const view = this.createView();
        if (!view || !this.renderer || !this.host) return;
        this.host.dataset.aimdTheme = this.appearance.theme;
        this.renderer.render(view);
    }

    private renderPreservingFocus(): void {
        const view = this.createView();
        if (view) this.renderer?.renderPreservingFocus(view);
    }

    private createGeometryLayout(): PromptGeometryLayout | null {
        const state = this.workflow.state;
        if (!state.mode || !this.host || !this.root) return null;
        return {
            mode: state.mode,
            host: this.host,
            root: this.root,
            anchor: this.surfaceAnchor,
            promptCount: state.mode === 'manager' ? this.workflow.managerPrompts.length : state.suggestions.length,
            hasStatus: Boolean(state.statusMessage),
        };
    }

    private openSurfaceLifecycle(): void {
        if (!this.surfaceSession || !this.root || !this.host || !this.workflow.state.mode) return;
        const lifecycleMode = this.workflow.state.mode === 'autocomplete' ? 'autocomplete' : 'manager';
        const shouldOpen = this.surfaceLifecycleMode !== lifecycleMode || !this.root.dataset.motionState;
        this.surfaceLifecycleMode = lifecycleMode;
        this.surfaceSession.syncPositioner(this.geometry.createPositioner(() => this.createGeometryLayout()));
        this.surfaceSession.syncOutsideDismiss({
            eventTarget: document,
            roots: () => [this.host, this.getComposerInput()],
            onDismiss: () => this.close(),
        });
        this.surfaceSession.syncEscapeScope({
            root: this.host,
            onEscape: () => {
                if (this.workflow.state.mode === 'autocomplete') {
                    this.workflow.dismissAutocomplete();
                    this.teardownSurface(false);
                    return;
                }
                this.close();
            },
            maintainFocus: lifecycleMode === 'manager',
            capture: lifecycleMode === 'manager',
            focusFallback: () => this.shadow?.querySelector<HTMLElement>('[data-role="prompt-search"]') ?? null,
        });
        this.surfaceSession.position();
        if (shouldOpen) this.surfaceSession.open({ surface: this.root });
        else this.surfaceSession.syncMotion({ surface: this.root });
    }

    private teardownSurface(resetWorkflow: boolean): void {
        const shouldRestoreFocus = this.workflow.state.mode === 'manager' || this.workflow.state.mode === 'edit';
        this.surfaceSession?.clearOutsideDismiss();
        this.surfaceSession?.clearEscapeScope();
        this.surfaceSession?.clearPositioner();
        this.geometry.destroyTransient();
        if (shouldRestoreFocus) this.surfaceSession?.restoreFocus();
        this.surfaceSession?.destroy();
        this.surfaceSession = null;
        this.renderer?.destroy();
        this.renderer = null;
        this.appearanceScope?.dispose();
        this.appearanceScope = null;
        this.host?.remove();
        this.host = null;
        this.shadow = null;
        this.root = null;
        this.surfaceLifecycleMode = null;
        this.surfaceAnchor = null;
        if (resetWorkflow) this.workflow.closeSurface();
    }

    private handleSurfaceAction(action: PromptSurfaceAction): void {
        if (action.type === 'close') {
            this.close();
        } else if (action.type === 'search') {
            this.workflow.setManagerQuery(action.query);
            this.render();
            this.renderer?.focusSearch();
        } else if (action.type === 'add') {
            this.workflow.beginCreate(t('promptUntitled'));
            this.render();
        } else if (action.type === 'edit') {
            if (this.workflow.beginEdit(action.promptId)) this.render();
        } else if (action.type === 'toggle') {
            void this.workflow.toggleEnabled(action.promptId, action.enabled, t('promptSaveFailed'))
                .then(() => this.render());
        } else if (action.type === 'delete') {
            void this.workflow.delete(action.promptId, t('promptSaveFailed')).then(() => this.render());
        } else if (action.type === 'cancel-edit') {
            this.workflow.cancelEdit();
            this.render();
        } else if (action.type === 'save') {
            void this.workflow.saveEditor(action.draft, {
                required: t('promptContentRequired'),
                failed: t('promptSaveFailed'),
            }).then(() => this.render());
        } else if (action.type === 'select') {
            const prompt = this.workflow.selectIndex(action.index);
            const token = this.workflow.state.activeToken;
            if (prompt && token) void this.insertPrompt(prompt, token);
        } else if (action.type === 'hover') {
            this.workflow.selectIndex(action.index);
            this.renderer?.syncAutocompleteSelection(this.workflow.state.selectedIndex);
        } else if (action.type === 'reorder-start') {
            this.startPromptListDrag(action.event, action.promptId);
        } else if (action.type === 'panel-drag-start') {
            const layout = this.createGeometryLayout();
            if (layout) this.geometry.startPanelDrag(action.event, layout);
        }
    }

    private startPromptListDrag(event: PointerEvent, sourceId: string): void {
        if (this.workflow.state.mode !== 'manager' || !sourceId) return;
        this.renderer?.setPromptDragging(sourceId, true);
        this.geometry.startListDrag(event, {
            sourceId,
            getTargetIdAt: (clientY) => this.renderer?.getManagerRowIdAt(clientY) ?? null,
            onTarget: (targetId) => {
                if (!this.workflow.reorder(sourceId, targetId)) return;
                this.render();
                this.renderer?.setPromptDragging(sourceId, true);
            },
            onEnd: (moved) => {
                this.renderer?.setPromptDragging(sourceId, false);
                if (moved) {
                    void this.workflow.persistOrder(t('promptSaveFailed')).then(() => this.render());
                }
            },
        });
    }

    private async insertPrompt(prompt: PromptRecord, token: PromptTriggerToken | null): Promise<void> {
        const read = readComposer(this.getActiveComposerAdapter());
        if (!read.ok) return;
        const range = this.createReplacementRange(read.text, prompt.content, token);
        const result = await replaceComposerTextRange(this.getActiveComposerAdapter(), range, { focus: true });
        if (!result.ok) return;
        this.workflow.recordUse(prompt.id);
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
}
