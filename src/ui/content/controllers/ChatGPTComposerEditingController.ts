import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { armChatGPTSendPositionRestore } from '../../../drivers/content/chatgpt/sendPositionRestoreEvents';
import {
    activateChatGPTComposerInputEnhancementMount,
    findChatGPTComposerInputEnhancementMount,
} from '../../../drivers/content/chatgpt/composerInputEnhancementMount';
import { applyComposerNativeTextEdit, readComposer } from '../../../drivers/content/sending/composerPort';
import {
    getContenteditableCaretClientRect,
    getContenteditablePlainTextOffsetFromPoint,
    getContenteditablePlainTextSelection,
    setContenteditablePlainTextSelection,
} from '../../../core/sending/contenteditable';
import { logger } from '../../../core/logger';
import { resolveChatGPTInputEnhancement } from '../../../core/settings/inputEnhancement';
import {
    DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
    type ChatGPTInputEnhancementSettings,
} from '../../../core/settings/types';
import {
    compileLatexSnippet,
    searchLatexSnippets,
    type LatexSnippetCatalog,
    type LatexSnippetItem,
} from '../../../core/math/latexSnippets';
import {
    findLatexCommandToken,
    findMarkdownMathAt,
    type LatexCommandToken,
    type MarkdownMathRange,
} from '../../../core/sending/markdownMath';
import {
    detectMarkdownListTypeAt,
    planMarkdownBackspaceEdit,
    planMarkdownBoldEdit,
    planMarkdownEnterEdit,
    planMarkdownOrderedListDeletionEdit,
    type MarkdownTextSelection,
    type MarkdownListCapabilities,
} from '../../../core/sending/markdownAuthoring';
import type {
    FormulaRenderOptions,
    FormulaSvgAsset,
} from '../../../services/math/formulaAssetRenderer';
import { loadLatexSnippetCatalog } from '../../../services/math/latexSnippetCatalog';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { FormulaComposerAssistantPopover } from '../components/FormulaComposerAssistantPopover';
import { InputEnhancementButton } from '../components/InputEnhancementButton';
import {
    createInputEnhancementGuideContent,
    INPUT_ENHANCEMENT_GUIDE_CSS,
} from '../components/InputEnhancementGuide';
import { InputEnhancementPopover } from '../components/InputEnhancementPopover';
import { OverlaySession } from '../overlay/OverlaySession';
import { t } from '../components/i18n';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

const REBIND_DELAY_MS = 200;
const FORMULA_REFRESH_DELAY_MS = 120;
const FORMULA_HOVER_DELAY_MS = 160;
const FORMULA_PREVIEW_MAX_SOURCE_LENGTH = 4000;

export type ChatGPTComposerEditingControllerOptions = {
    onInputEnhancementChange?: (settings: ChatGPTInputEnhancementSettings) => Promise<boolean>;
    loadFormulaSnippets?: () => Promise<LatexSnippetCatalog>;
    renderFormula?: (options: FormulaRenderOptions) => Promise<FormulaSvgAsset>;
    prewarmFormula?: () => void;
};

type FormulaSnippetSession = {
    stops: Array<{ start: number; end: number }>;
    finalCursor: number;
    current: number;
};

export class ChatGPTComposerEditingController {
    private inputEnhancementSettings: ChatGPTInputEnhancementSettings = {
        ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
        lists: { ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS.lists },
    };
    private initialized = false;
    private composer: ComposerInput | null = null;
    private observer: MutationObserver | null = null;
    private rebindTimer: number | null = null;
    private inputEnhancementButton: InputEnhancementButton | null = null;
    private inputEnhancementPopover: InputEnhancementPopover | null = null;
    private inputEnhancementMountCleanup: (() => void) | null = null;
    private inputEnhancementSavePending = false;
    private inputEnhancementGuideSession: OverlaySession | null = null;
    private isInsertingNewline = false;
    private isTriggeringSend = false;
    private composing = false;
    private formulaRefreshTimer: number | null = null;
    private formulaHoverTimer: number | null = null;
    private formulaRequestId = 0;
    private formulaAssistant: FormulaComposerAssistantPopover | null = null;
    private formulaSuggestions: LatexSnippetItem[] = [];
    private formulaSelectedIndex = 0;
    private formulaToken: LatexCommandToken | null = null;
    private formulaSnippetSession: FormulaSnippetSession | null = null;
    private applyingFormulaSnippet = false;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly options: ChatGPTComposerEditingControllerOptions = {},
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.bindComposer();
        this.observeComposerReplacements();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.detachComposer();
        this.observer?.disconnect();
        this.observer = null;
        this.clearFormulaTimers();
        this.formulaAssistant?.dispose();
        this.formulaAssistant = null;
        this.inputEnhancementGuideSession?.unmount();
        this.inputEnhancementGuideSession = null;
        if (this.rebindTimer != null) {
            window.clearTimeout(this.rebindTimer);
            this.rebindTimer = null;
        }
    }

    setInputEnhancementSettings(settings: ChatGPTInputEnhancementSettings): void {
        this.applyInputEnhancementSettings(settings);
        if (this.initialized) this.bindComposer();
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.formulaAssistant?.setAppearance(snapshot);
        this.inputEnhancementPopover?.setAppearance(snapshot);
        this.inputEnhancementGuideSession?.setAppearance(snapshot);
    }

    private bindComposer(): void {
        const next = this.adapter.getComposerInputElement?.() ?? null;
        if (next !== this.composer) {
            this.detachComposer();
            if (!next) return;

            this.composer = next;
            next.addEventListener('keydown', this.onKeyDownCapture as EventListener, { capture: true });
            next.addEventListener('beforeinput', this.onBeforeInputCapture as EventListener, { capture: true });
            next.addEventListener('input', this.onComposerInput as EventListener);
            next.addEventListener('keyup', this.onComposerCaretChange as EventListener);
            next.addEventListener('click', this.onComposerCaretChange as EventListener);
            next.addEventListener('compositionstart', this.onCompositionStart as EventListener);
            next.addEventListener('compositionend', this.onCompositionEnd as EventListener);
            next.addEventListener('mousemove', this.onComposerMouseMove as EventListener);
        }
        if (next) this.ensureInputEnhancementButton(next);
    }

    private detachComposer(): void {
        this.composer?.removeEventListener('keydown', this.onKeyDownCapture as EventListener, { capture: true } as any);
        this.composer?.removeEventListener('beforeinput', this.onBeforeInputCapture as EventListener, { capture: true } as any);
        this.composer?.removeEventListener('input', this.onComposerInput as EventListener);
        this.composer?.removeEventListener('keyup', this.onComposerCaretChange as EventListener);
        this.composer?.removeEventListener('click', this.onComposerCaretChange as EventListener);
        this.composer?.removeEventListener('compositionstart', this.onCompositionStart as EventListener);
        this.composer?.removeEventListener('compositionend', this.onCompositionEnd as EventListener);
        this.composer?.removeEventListener('mousemove', this.onComposerMouseMove as EventListener);
        this.composer = null;
        this.formulaSnippetSession = null;
        this.closeFormulaAssistant();
        this.disposeInputEnhancementButton();
    }

    private ensureInputEnhancementButton(composer: ComposerInput): void {
        if (!this.inputEnhancementSettings.available) {
            this.disposeInputEnhancementButton();
            return;
        }
        const mount = findChatGPTComposerInputEnhancementMount(composer);
        if (!mount) {
            this.disposeInputEnhancementButton();
            return;
        }
        if (this.inputEnhancementButton?.host.parentElement === mount.container) {
            if (mount.anchor.nextElementSibling !== this.inputEnhancementButton.host) {
                mount.container.insertBefore(this.inputEnhancementButton.host, mount.anchor.nextSibling);
            }
            return;
        }

        this.disposeInputEnhancementButton();
        mount.container.querySelectorAll('[data-aimd-role="input-enhancement-button"]')
            .forEach((node) => node.remove());
        this.inputEnhancementButton = new InputEnhancementButton({
            onOpen: () => this.openInputEnhancementPopover(),
        });
        this.syncInputEnhancementUi();
        this.inputEnhancementMountCleanup = activateChatGPTComposerInputEnhancementMount(mount);
        mount.container.insertBefore(this.inputEnhancementButton.host, mount.anchor.nextSibling);
    }

    private disposeInputEnhancementButton(): void {
        this.inputEnhancementPopover?.dispose();
        this.inputEnhancementPopover = null;
        this.inputEnhancementButton?.dispose();
        this.inputEnhancementButton = null;
        this.inputEnhancementMountCleanup?.();
        this.inputEnhancementMountCleanup = null;
    }

    private openInputEnhancementPopover(): void {
        const button = this.inputEnhancementButton;
        if (!button || this.inputEnhancementSavePending) return;
        if (this.inputEnhancementPopover?.isOpen()) {
            this.inputEnhancementPopover.close('programmatic');
            return;
        }
        if (!this.inputEnhancementPopover) {
            this.inputEnhancementPopover = new InputEnhancementPopover({
                onChange: (settings) => void this.persistInputEnhancementSettings(settings),
                onClose: () => {
                    this.inputEnhancementButton?.setExpanded(false);
                },
                onOpenGuide: () => this.openInputEnhancementGuide(),
            });
            this.inputEnhancementPopover.setAppearance(this.appearance);
        }
        button.setExpanded(true);
        this.inputEnhancementPopover.open({
            anchor: button.getAnchorElement(),
            settings: this.inputEnhancementSettings,
            pending: this.inputEnhancementSavePending,
        });
    }

    private async persistInputEnhancementSettings(settings: ChatGPTInputEnhancementSettings): Promise<void> {
        if (this.inputEnhancementSavePending) return;
        const previous = this.cloneInputEnhancementSettings(this.inputEnhancementSettings);
        this.applyInputEnhancementSettings(settings);
        this.inputEnhancementSavePending = true;
        this.syncInputEnhancementUi();
        try {
            const saved = await (
                this.options.onInputEnhancementChange?.(this.cloneInputEnhancementSettings(settings))
                ?? Promise.resolve(true)
            );
            if (!saved) {
                this.applyInputEnhancementSettings(previous);
                logger.warn('[AI-MarkDone][ChatGPTComposerEditing] Input enhancement settings were not saved');
            }
        } catch (error) {
            this.applyInputEnhancementSettings(previous);
            logger.warn('[AI-MarkDone][ChatGPTComposerEditing] Failed to save input enhancement settings', error);
        } finally {
            this.inputEnhancementSavePending = false;
            this.syncInputEnhancementUi();
        }
    }

    private applyInputEnhancementSettings(settings: ChatGPTInputEnhancementSettings): void {
        const previous = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        this.inputEnhancementSettings = this.cloneInputEnhancementSettings(settings);
        const effective = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        if (!effective.formulaSuggestions) {
            this.formulaSnippetSession = null;
            this.formulaSuggestions = [];
            this.formulaToken = null;
        }
        if (!effective.formulaSuggestions && !effective.formulaPreview) {
            this.closeFormulaAssistant();
        } else if (
            previous.formulaSuggestions !== effective.formulaSuggestions
            || previous.formulaPreview !== effective.formulaPreview
        ) {
            this.closeFormulaAssistant();
            this.scheduleFormulaRefresh(0);
        }
        this.syncInputEnhancementUi();
    }

    private syncInputEnhancementUi(): void {
        this.inputEnhancementButton?.setEnabled(
            this.inputEnhancementSettings.available && this.inputEnhancementSettings.enabled,
        );
        this.inputEnhancementButton?.setPending(this.inputEnhancementSavePending);
        this.inputEnhancementPopover?.update(
            this.inputEnhancementSettings,
            this.inputEnhancementSavePending,
        );
    }

    private cloneInputEnhancementSettings(
        settings: ChatGPTInputEnhancementSettings,
    ): ChatGPTInputEnhancementSettings {
        return { ...settings, lists: { ...settings.lists } };
    }

    private openInputEnhancementGuide(): void {
        if (!this.inputEnhancementGuideSession) {
            this.inputEnhancementGuideSession = new OverlaySession({
                id: 'aimd-input-enhancement-guide',
                theme: this.appearance.theme,
                themeOverrides: this.appearance.overrides,
                surfaceCss: '',
                overlayCss: INPUT_ENHANCEMENT_GUIDE_CSS,
                surfaceStyleId: 'aimd-input-enhancement-guide-surface',
                overlayStyleId: 'aimd-input-enhancement-guide-content',
                overlayStyleCache: 'shared',
                zIndex: 'var(--aimd-z-tooltip)',
            });
        }
        const session = this.inputEnhancementGuideSession;
        void session.modalHost.showCustom({
            kind: 'info',
            title: t('chatgptInputEnhancementGuideTitle'),
            body: createInputEnhancementGuideContent(),
            dialogClassName: 'input-enhancement-guide-dialog',
            onClosed: () => {
                if (this.inputEnhancementGuideSession !== session || session.modalHost.isOpen()) return;
                session.unmount();
                this.inputEnhancementGuideSession = null;
            },
        });
    }

    private observeComposerReplacements(): void {
        if (this.observer || typeof MutationObserver !== 'function') return;
        const target = document.body ?? document.documentElement;
        this.observer = new MutationObserver(() => this.scheduleRebind());
        this.observer.observe(target, { childList: true, subtree: true });
    }

    private scheduleRebind(): void {
        if (!this.initialized || this.rebindTimer != null) return;
        this.rebindTimer = window.setTimeout(() => {
            this.rebindTimer = null;
            this.bindComposer();
        }, REBIND_DELAY_MS);
    }

    private onKeyDownCapture = (event: KeyboardEvent): void => {
        const target = event.currentTarget;
        const enhancement = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        if (!enhancement.enabled || this.isInsertingNewline || this.isTriggeringSend || event.defaultPrevented) return;
        if (!(target instanceof HTMLElement)) return;
        if ((enhancement.formulaSuggestions || enhancement.formulaPreview) && this.handleFormulaKeydown(event, target)) return;
        if (enhancement.lists.enabled && this.handleMarkdownDeletion(event, target, enhancement.lists)) return;
        if (enhancement.boldShortcut && this.shouldToggleBold(event)) {
            event.preventDefault();
            event.stopPropagation();
            this.applyMarkdownBold(target);
            return;
        }
        if (this.shouldSend(event)) {
            event.preventDefault();
            event.stopPropagation();
            this.triggerSend(target);
            return;
        }
        if (!this.shouldConvertEnter(event)) return;

        const listContextEnabled = this.isEnabledListContext(target, enhancement.lists);
        if (!enhancement.enterKeyNewline && !listContextEnabled) return;

        event.preventDefault();
        event.stopPropagation();
        if (listContextEnabled && this.applyMarkdownEnter(target, enhancement.lists)) return;
        this.insertNewline(target);
    };

    private onBeforeInputCapture = (event: InputEvent): void => {
        const enhancement = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        if (!enhancement.lists.ordered || event.defaultPrevented || event.isComposing || this.composing) return;
        if (event.inputType !== 'deleteByCut') return;
        const input = event.currentTarget;
        if (!(input instanceof HTMLElement)) return;
        const snapshot = readComposer(this.adapter);
        const selection = this.getSelection(input);
        if (!snapshot.ok || !selection || selection.start === selection.end) return;
        const edit = planMarkdownOrderedListDeletionEdit(snapshot.text, selection);
        if (!edit) return;
        const result = applyComposerNativeTextEdit(this.adapter, edit);
        if (!result.ok && !result.changed) return;
        event.preventDefault();
        event.stopPropagation();
    };

    private onComposerInput = (): void => {
        if (!this.hasFormulaEnhancement() || this.composing || this.applyingFormulaSnippet) return;
        this.formulaSnippetSession = null;
        this.scheduleFormulaRefresh(FORMULA_REFRESH_DELAY_MS);
    };

    private onComposerCaretChange = (): void => {
        if (!this.hasFormulaEnhancement() || this.composing) return;
        this.scheduleFormulaRefresh(FORMULA_REFRESH_DELAY_MS);
    };

    private onCompositionStart = (): void => {
        this.composing = true;
        this.closeFormulaAssistant();
    };

    private onCompositionEnd = (): void => {
        this.composing = false;
        if (this.hasFormulaEnhancement()) this.scheduleFormulaRefresh(FORMULA_REFRESH_DELAY_MS);
    };

    private onComposerMouseMove = (event: MouseEvent): void => {
        if (!this.isFormulaPreviewEnabled() || this.composing || !(event.currentTarget instanceof HTMLElement)) return;
        const input = event.currentTarget;
        if (!this.isContentEditable(input)) return;
        if (this.formulaHoverTimer != null) window.clearTimeout(this.formulaHoverTimer);
        this.formulaHoverTimer = window.setTimeout(() => {
            this.formulaHoverTimer = null;
            void this.refreshFormulaFromPoint(input, event.clientX, event.clientY);
        }, FORMULA_HOVER_DELAY_MS);
    };

    private handleMarkdownDeletion(
        event: KeyboardEvent,
        input: ComposerInput,
        capabilities: MarkdownListCapabilities,
    ): boolean {
        if (
            (event.key !== 'Backspace' && event.key !== 'Delete')
            || event.metaKey
            || event.ctrlKey
            || event.altKey
            || event.isComposing
            || event.keyCode === 229
        ) return false;
        const snapshot = readComposer(this.adapter);
        const selection = this.getSelection(input);
        if (!snapshot.ok || !selection) return false;
        const edit = selection.start === selection.end && event.key === 'Backspace'
            ? planMarkdownBackspaceEdit(snapshot.text, selection, capabilities)
            : capabilities.ordered
                ? planMarkdownOrderedListDeletionEdit(snapshot.text, selection)
                : null;
        if (!edit) return false;
        const result = applyComposerNativeTextEdit(this.adapter, edit);
        if (!result.ok && !result.changed) return false;
        event.preventDefault();
        event.stopPropagation();
        if (result.ok) this.scheduleFormulaRefresh(FORMULA_REFRESH_DELAY_MS);
        return result.ok || result.changed;
    }

    private handleFormulaKeydown(event: KeyboardEvent, input: ComposerInput): boolean {
        if (event.isComposing || event.keyCode === 229 || this.composing) return false;
        if (this.formulaSuggestions.length > 0 && this.formulaToken) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeFormulaAssistant();
                return true;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                this.formulaSelectedIndex = (
                    this.formulaSelectedIndex + delta + this.formulaSuggestions.length
                ) % this.formulaSuggestions.length;
                this.formulaAssistant?.updateSelectedIndex(this.formulaSelectedIndex);
                return true;
            }
            if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey)) {
                event.preventDefault();
                event.stopPropagation();
                this.insertFormulaSuggestion(input, this.formulaSelectedIndex);
                return true;
            }
        }
        if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
            return this.moveFormulaTabStop(event, input);
        }
        return false;
    }

    private shouldConvertEnter(event: KeyboardEvent): boolean {
        return event.key === 'Enter'
            && !event.shiftKey
            && !event.metaKey
            && !event.ctrlKey
            && !event.altKey
            && !event.isComposing
            && event.keyCode !== 229;
    }

    private shouldSend(event: KeyboardEvent): boolean {
        return event.key === 'Enter'
            && (event.metaKey || event.ctrlKey)
            && !event.shiftKey
            && !event.altKey
            && !event.isComposing
            && event.keyCode !== 229;
    }

    private shouldToggleBold(event: KeyboardEvent): boolean {
        return event.key.toLowerCase() === 'b'
            && (event.metaKey || event.ctrlKey)
            && !event.shiftKey
            && !event.altKey
            && !event.isComposing
            && event.keyCode !== 229;
    }

    private scheduleFormulaRefresh(delayMs: number): void {
        if (!this.initialized || !this.hasFormulaEnhancement()) return;
        if (this.formulaRefreshTimer != null) window.clearTimeout(this.formulaRefreshTimer);
        this.formulaRefreshTimer = window.setTimeout(() => {
            this.formulaRefreshTimer = null;
            void this.refreshFormulaAtCaret();
        }, delayMs);
    }

    private async refreshFormulaAtCaret(): Promise<void> {
        const input = this.composer;
        if (!input || !this.hasFormulaEnhancement() || this.composing) return;
        const snapshot = readComposer(this.adapter);
        const selection = this.getSelection(input);
        if (!snapshot.ok || !selection || selection.start !== selection.end) {
            this.closeFormulaAssistant();
            return;
        }
        const math = findMarkdownMathAt(snapshot.text, selection.start, { includeOpen: true });
        if (!math || !math.source.trim()) {
            this.closeFormulaAssistant();
            return;
        }
        const token = findLatexCommandToken(snapshot.text, selection.start);
        await this.showFormulaMath(math, this.getFormulaAnchorRect(input), token);
    }

    private async refreshFormulaFromPoint(input: HTMLElement, x: number, y: number): Promise<void> {
        if (!this.isFormulaPreviewEnabled() || input !== this.composer) return;
        const offset = getContenteditablePlainTextOffsetFromPoint(input, x, y);
        const snapshot = readComposer(this.adapter);
        if (offset == null || !snapshot.ok) return;
        const math = findMarkdownMathAt(snapshot.text, offset);
        if (!math?.closed || !math.source.trim()) return;
        const anchor = typeof DOMRect === 'function'
            ? new DOMRect(x, y, 0, 16)
            : ({ left: x, right: x, top: y, bottom: y + 16, width: 0, height: 16 } as DOMRect);
        await this.showFormulaMath(math, anchor, null);
    }

    private async showFormulaMath(
        math: MarkdownMathRange,
        anchorRect: DOMRect,
        token: LatexCommandToken | null,
    ): Promise<void> {
        const enhancement = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        const suggestionsEnabled = enhancement.formulaSuggestions;
        const previewEnabled = enhancement.formulaPreview;
        if (!suggestionsEnabled && !previewEnabled) {
            this.closeFormulaAssistant();
            return;
        }
        const source = math.source.trim();
        if (!source || source.length > FORMULA_PREVIEW_MAX_SOURCE_LENGTH) {
            this.closeFormulaAssistant();
            return;
        }
        const requestId = ++this.formulaRequestId;
        if (previewEnabled) this.options.prewarmFormula?.();

        let suggestions: LatexSnippetItem[] = [];
        if (suggestionsEnabled && token) {
            try {
                const catalog = await (this.options.loadFormulaSnippets ?? loadLatexSnippetCatalog)();
                if (requestId !== this.formulaRequestId || !this.hasFormulaEnhancement()) return;
                suggestions = searchLatexSnippets(catalog, token.query);
            } catch (error) {
                logger.warn('[AI-MarkDone][ChatGPTComposerEditing] Formula snippets failed to load', error);
            }
        }
        if (requestId !== this.formulaRequestId || !this.hasFormulaEnhancement()) return;
        this.formulaToken = suggestionsEnabled ? token : null;
        this.formulaSuggestions = suggestions;
        this.formulaSelectedIndex = 0;
        const assistant = this.ensureFormulaAssistant();
        assistant.show({
            anchorRect,
            mathKind: math.kind,
            preview: previewEnabled ? { status: 'loading' } : null,
            suggestions,
            selectedIndex: 0,
        });

        if (!previewEnabled) return;

        try {
            if (!this.options.renderFormula) throw new Error('Formula preview renderer is unavailable.');
            const asset = await this.options.renderFormula({
                source,
                displayMode: math.kind === 'display',
            });
            if (requestId !== this.formulaRequestId || !this.isFormulaPreviewEnabled()) return;
            assistant.show({
                anchorRect,
                mathKind: math.kind,
                preview: { status: 'ready', asset },
                suggestions,
                selectedIndex: this.formulaSelectedIndex,
            });
        } catch {
            if (requestId !== this.formulaRequestId || !this.isFormulaPreviewEnabled()) return;
            assistant.show({
                anchorRect,
                mathKind: math.kind,
                preview: { status: 'error' },
                suggestions,
                selectedIndex: this.formulaSelectedIndex,
            });
        }
    }

    private ensureFormulaAssistant(): FormulaComposerAssistantPopover {
        if (this.formulaAssistant) return this.formulaAssistant;
        this.formulaAssistant = new FormulaComposerAssistantPopover({
            onSelect: (index) => {
                if (this.composer) this.insertFormulaSuggestion(this.composer, index);
            },
            onHover: (index) => {
                this.formulaSelectedIndex = index;
                this.formulaAssistant?.updateSelectedIndex(index);
            },
            onDismiss: () => this.closeFormulaAssistant(),
            getDismissRoots: () => [this.composer],
        });
        this.formulaAssistant.setAppearance(this.appearance);
        return this.formulaAssistant;
    }

    private insertFormulaSuggestion(input: ComposerInput, index: number): void {
        const snippet = this.formulaSuggestions[index];
        const token = this.formulaToken;
        if (!snippet || !token) return;
        const compiled = compileLatexSnippet(snippet.insertText);
        const firstStop = compiled.tabStops[0] ?? null;
        const edit = {
            start: token.start,
            end: token.end,
            replacement: compiled.text,
            selectionStart: token.start + (firstStop?.start ?? compiled.finalCursor),
            selectionEnd: token.start + (firstStop?.end ?? compiled.finalCursor),
        };
        this.applyingFormulaSnippet = true;
        const result = applyComposerNativeTextEdit(this.adapter, edit);
        this.applyingFormulaSnippet = false;
        if (!result.ok) return;

        const uniqueStops = new Map<number, { start: number; end: number }>();
        for (const stop of compiled.tabStops) {
            if (!uniqueStops.has(stop.index)) {
                uniqueStops.set(stop.index, {
                    start: token.start + stop.start,
                    end: token.start + stop.end,
                });
            }
        }
        const stops = [...uniqueStops.values()];
        this.formulaSnippetSession = stops.length > 0
            ? {
                stops,
                finalCursor: token.start + compiled.finalCursor,
                current: 0,
            }
            : null;
        this.closeFormulaAssistant();
        this.scheduleFormulaRefresh(FORMULA_REFRESH_DELAY_MS);
        if (document.activeElement !== input) input.focus();
    }

    private moveFormulaTabStop(event: KeyboardEvent, input: ComposerInput): boolean {
        const session = this.formulaSnippetSession;
        if (!session) return false;
        const currentSelection = this.getSelection(input);
        const currentStop = session.stops[session.current];
        if (
            !currentSelection
            || !currentStop
            || currentSelection.start !== currentStop.start
            || currentSelection.end !== currentStop.end
        ) {
            this.formulaSnippetSession = null;
            return false;
        }
        const next = event.shiftKey ? session.current - 1 : session.current + 1;
        if (next < 0) return false;
        event.preventDefault();
        event.stopPropagation();
        if (next >= session.stops.length) {
            this.setComposerSelection(input, session.finalCursor, session.finalCursor);
            this.formulaSnippetSession = null;
            return true;
        }
        session.current = next;
        const stop = session.stops[next]!;
        this.setComposerSelection(input, stop.start, stop.end);
        return true;
    }

    private setComposerSelection(input: ComposerInput, start: number, end: number): boolean {
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            input.setSelectionRange(start, end);
            return true;
        }
        return this.isContentEditable(input) && setContenteditablePlainTextSelection(input, start, end);
    }

    private getFormulaAnchorRect(input: ComposerInput): DOMRect {
        if (this.isContentEditable(input)) {
            const caret = getContenteditableCaretClientRect(input);
            if (caret) return caret;
        }
        const rect = input.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
            return typeof DOMRect === 'function'
                ? new DOMRect(rect.left, rect.bottom, 0, 0)
                : ({ ...rect, left: rect.left, right: rect.left, top: rect.bottom, bottom: rect.bottom, width: 0, height: 0 } as DOMRect);
        }
        return typeof DOMRect === 'function'
            ? new DOMRect(16, 16, 0, 0)
            : ({ left: 16, right: 16, top: 16, bottom: 16, width: 0, height: 0 } as DOMRect);
    }

    private closeFormulaAssistant(): void {
        this.formulaRequestId += 1;
        this.formulaSuggestions = [];
        this.formulaSelectedIndex = 0;
        this.formulaToken = null;
        this.formulaAssistant?.close();
    }

    private hasFormulaEnhancement(): boolean {
        const enhancement = resolveChatGPTInputEnhancement(this.inputEnhancementSettings);
        return enhancement.formulaSuggestions || enhancement.formulaPreview;
    }

    private isFormulaPreviewEnabled(): boolean {
        return resolveChatGPTInputEnhancement(this.inputEnhancementSettings).formulaPreview;
    }

    private clearFormulaTimers(): void {
        if (this.formulaRefreshTimer != null) window.clearTimeout(this.formulaRefreshTimer);
        if (this.formulaHoverTimer != null) window.clearTimeout(this.formulaHoverTimer);
        this.formulaRefreshTimer = null;
        this.formulaHoverTimer = null;
    }

    private insertNewline(input: ComposerInput): void {
        if (this.isContentEditable(input)) {
            this.dispatchNativeShiftEnter(input);
            return;
        }

        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            input.value = `${input.value.slice(0, start)}\n${input.value.slice(end)}`;
            const cursor = start + 1;
            input.selectionStart = cursor;
            input.selectionEnd = cursor;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    private applyMarkdownEnter(input: ComposerInput, capabilities: MarkdownListCapabilities): boolean {
        const snapshot = readComposer(this.adapter);
        if (!snapshot.ok) return false;
        const selection = this.getSelection(input);
        if (!selection) return false;
        const edit = planMarkdownEnterEdit(snapshot.text, selection, capabilities);
        if (!edit) return false;
        const result = applyComposerNativeTextEdit(this.adapter, edit);
        return result.ok || result.changed;
    }

    private isEnabledListContext(
        input: ComposerInput,
        capabilities: MarkdownListCapabilities,
    ): boolean {
        const snapshot = readComposer(this.adapter);
        const selection = this.getSelection(input);
        if (!snapshot.ok || !selection) return false;
        const type = detectMarkdownListTypeAt(snapshot.text, selection.start);
        return type === 'ordered' ? capabilities.ordered : type === 'unordered' && capabilities.unordered;
    }

    private applyMarkdownBold(input: ComposerInput): void {
        const snapshot = readComposer(this.adapter);
        if (!snapshot.ok) return;
        const selection = this.getSelection(input);
        if (!selection) return;
        const edit = planMarkdownBoldEdit(snapshot.text, selection);
        if (!edit) return;
        applyComposerNativeTextEdit(this.adapter, edit);
    }

    private getSelection(input: ComposerInput): MarkdownTextSelection | null {
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            if (start == null || end == null) return null;
            return { start, end };
        }
        if (this.isContentEditable(input)) {
            return getContenteditablePlainTextSelection(input);
        }
        return null;
    }

    private dispatchNativeShiftEnter(input: ComposerInput): void {
        if (document.activeElement !== input) input.focus();
        this.isInsertingNewline = true;
        try {
            for (const type of ['keydown', 'keypress', 'keyup'] as const) {
                input.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                }));
            }
        } finally {
            this.isInsertingNewline = false;
        }
    }

    private triggerSend(input: ComposerInput): void {
        if (document.activeElement !== input) input.focus();
        armChatGPTSendPositionRestore();
        this.isTriggeringSend = true;
        try {
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
            }));
        } finally {
            window.setTimeout(() => {
                this.isTriggeringSend = false;
            }, 50);
        }
    }

    private isContentEditable(input: ComposerInput): boolean {
        return input instanceof HTMLElement && (input.isContentEditable || input.hasAttribute('contenteditable'));
    }
}
