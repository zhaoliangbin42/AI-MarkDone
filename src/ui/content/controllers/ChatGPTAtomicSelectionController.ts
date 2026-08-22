import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import {
    DOMContentSurfaceAdapter,
    type ContentSurfaceAdapter,
} from '../../../drivers/content/adapters/ContentSurfaceAdapter';
import type { ChatGPTAtomicMarkdownCopyShortcut } from '../../../core/settings/types';
import {
    PageMarkdownSelectionResolver,
    isPageMarkdownSelectionSnapshotCurrent,
    type PageMarkdownSelectionSnapshot,
} from '../selectionMarkdownSnapshot';
import {
    ChatGPTPageSelectionCoordinator,
    type ChatGPTPageSelectionFrame,
} from './ChatGPTPageSelectionCoordinator';
import {
    copyCanonicalMarkdownToClipboard,
    formatCanonicalMarkdownForCopy,
} from '../../../services/copy/canonicalMarkdownCopy';
import {
    type RenderedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import { showToast } from '../../../utils/toast';
import { t } from '../components/i18n';

const STYLE_ID = 'aimd-chatgpt-atomic-selection-style';
const STATE_ATTRIBUTE = 'data-aimd-page-atomic-state';

export type ChatGPTAtomicSelectionControllerOptions = Readonly<{
    contentSource?: ConversationContentSourceV1 | null;
    materialization?: ConversationMaterializationPortV1 | null;
    surfaceAdapter?: ContentSurfaceAdapter;
    selectionCoordinator?: ChatGPTPageSelectionCoordinator;
    markdownResolver?: PageMarkdownSelectionResolver;
}>;

export class ChatGPTAtomicSelectionController {
    private readonly selectedElements = new Set<HTMLElement>();
    private initialized = false;
    private lastSelection: PageMarkdownSelectionSnapshot | null = null;
    private markdownCopyShortcut: ChatGPTAtomicMarkdownCopyShortcut = 'mod-shift-c';
    private pendingModCopy = false;

    private readonly contentSource: ConversationContentSourceV1 | null;
    private readonly materialization: ConversationMaterializationPortV1 | null;
    private readonly surfaceAdapter: ContentSurfaceAdapter;
    private readonly selectionCoordinator: ChatGPTPageSelectionCoordinator;
    private readonly markdownResolver: PageMarkdownSelectionResolver;
    private readonly ownsSelectionCoordinator: boolean;
    private unsubscribeSelection: (() => void) | null = null;

    constructor(
        adapter: SiteAdapter,
        options: ChatGPTAtomicSelectionControllerOptions = {},
    ) {
        this.contentSource = options.contentSource ?? null;
        this.materialization = options.materialization ?? null;
        this.surfaceAdapter = options.surfaceAdapter
            ?? new DOMContentSurfaceAdapter(adapter, this.materialization);
        this.ownsSelectionCoordinator = !options.selectionCoordinator;
        this.selectionCoordinator = options.selectionCoordinator
            ?? new ChatGPTPageSelectionCoordinator({
                surfaceAdapter: this.surfaceAdapter,
                materialization: this.materialization,
            });
        this.markdownResolver = options.markdownResolver
            ?? new PageMarkdownSelectionResolver({
                adapter,
                contentSource: this.contentSource,
                materialization: this.materialization,
                surfaceAdapter: this.surfaceAdapter,
            });
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureStyle();
        if (this.ownsSelectionCoordinator) this.selectionCoordinator.init();
        this.unsubscribeSelection = this.selectionCoordinator.subscribe(this.handleSelectionFrame);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        // ChatGPT may rewrite formula clipboard data from a document-level React handler.
        window.addEventListener('copy', this.handleCopy);
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.unsubscribeSelection?.();
        this.unsubscribeSelection = null;
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('copy', this.handleCopy);
        if (this.ownsSelectionCoordinator) this.selectionCoordinator.dispose();
        this.applySelectedElements([]);
        this.clearSelectionSnapshot();
        document.getElementById(STYLE_ID)?.remove();
    }

    setMarkdownCopyShortcut(shortcut: ChatGPTAtomicMarkdownCopyShortcut): void {
        const next = isChatGPTAtomicMarkdownCopyShortcut(shortcut) ? shortcut : 'none';
        if (this.markdownCopyShortcut === next) return;
        this.markdownCopyShortcut = next;
        this.pendingModCopy = false;
    }

    private readonly handleSelectionFrame = (frame: ChatGPTPageSelectionFrame | null): void => {
        this.syncSelection(frame);
    };

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || !isPrimaryCopyKey(event) || isEditableTarget(event.target)) return;
        const snapshot = this.resolveCurrentSelectionSnapshot();
        if (!snapshot) {
            if (this.markdownCopyShortcut === 'mod-c' && !event.shiftKey) {
                if (this.hasCanonicalSurfaceEvidence()) this.pendingModCopy = true;
                return;
            }
            if (this.markdownCopyShortcut === 'mod-shift-c' && event.shiftKey) {
                event.preventDefault();
                if (this.hasCanonicalSurfaceEvidence()) this.showCopyFailure();
            }
            return;
        }

        if (this.markdownCopyShortcut === 'mod-c' && !event.shiftKey) {
            this.pendingModCopy = true;
            return;
        }
        if (this.markdownCopyShortcut !== 'mod-shift-c' || !event.shiftKey) return;

        event.preventDefault();
        void this.handleMarkdownShortcut(snapshot);
    };

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() === 'c') this.pendingModCopy = false;
    };

    private readonly handleCopy = (event: ClipboardEvent): void => {
        if (this.markdownCopyShortcut !== 'mod-c' || !this.pendingModCopy) return;
        this.pendingModCopy = false;
        if (!event.clipboardData) return;
        const snapshot = this.resolveCurrentSelectionSnapshot();
        if (!snapshot) {
            if (this.hasCanonicalSurfaceEvidence()) {
                event.preventDefault();
                this.showCopyFailure();
            }
            return;
        }
        const markdown = formatCanonicalMarkdownForCopy(snapshot.canonicalMarkdown);
        if (!markdown) return;
        try {
            event.clipboardData.clearData?.();
            event.clipboardData.setData('text/plain', markdown);
            event.preventDefault();
        } catch {
            // Clipboard failures must leave the host page's native copy path available.
        }
    };

    private syncSelection(frame: ChatGPTPageSelectionFrame | null): void {
        const selectedUnits = frame?.renderedAtomicUnits ?? [];
        // Atomic recognition is an independent visual contract. Canonical
        // projection controls Markdown copy eligibility only; a stale or
        // unresolved source must not erase a complete rendered atom.
        this.applySelectedElements(selectedUnits);
        // Build the Markdown snapshot lazily on the copy path instead of
        // compiling canonical Markdown on every selection frame (drag
        // selection would otherwise recompile the whole turn per frame).
        this.lastSelection = null;
    }

    private async handleMarkdownShortcut(snapshot: PageMarkdownSelectionSnapshot): Promise<void> {
        if (!this.isSnapshotCurrent(snapshot)) return;
        const copied = await copyCanonicalMarkdownToClipboard(snapshot.canonicalMarkdown);
        if (!copied && this.lastSelection === snapshot) this.showCopyFailure();
    }

    private showCopyFailure(): void {
        showToast({
            text: resolveLocalizedLabel(
                t('atomicCopyMarkdownFailed'),
                'atomicCopyMarkdownFailed',
                'The Markdown selection could not be copied.',
            ),
            tone: 'error',
        });
    }

    private resolveCurrentSelectionSnapshot(): PageMarkdownSelectionSnapshot | null {
        const frame = this.selectionCoordinator.refreshNow();
        if (!frame) return null;
        const snapshot = this.lastSelection;
        if (snapshot && this.isSameFrame(frame, snapshot) && this.isSnapshotCurrent(snapshot)) {
            this.applySelectedElements(snapshot.units);
            return snapshot;
        }
        const next = this.markdownResolver.resolve(frame);
        this.applySelectedElements(frame.renderedAtomicUnits);
        this.lastSelection = next;
        return next;
    }

    private hasCanonicalSurfaceEvidence(): boolean {
        const frame = this.selectionCoordinator.refreshNow();
        if (!frame) return false;
        return this.markdownResolver.hasEvidence(frame);
    }

    private clearSelectionSnapshot(): void {
        this.lastSelection = null;
        this.pendingModCopy = false;
    }

    private isSameFrame(
        frame: ChatGPTPageSelectionFrame,
        snapshot: PageMarkdownSelectionSnapshot,
    ): boolean {
        const left = snapshot.range;
        const right = frame.location.range;
        return snapshot.root === frame.location.root
            && left.startContainer === right.startContainer
            && left.startOffset === right.startOffset
            && left.endContainer === right.endContainer
            && left.endOffset === right.endOffset;
    }

    private isSnapshotCurrent(snapshot: PageMarkdownSelectionSnapshot): boolean {
        return isPageMarkdownSelectionSnapshotCurrent(snapshot);
    }

    private applySelectedElements(units: RenderedAtomicUnit[]): void {
        const next = new Set(units.map((unit) => unit.element));
        for (const element of this.selectedElements) {
            if (next.has(element)) continue;
            element.removeAttribute(STATE_ATTRIBUTE);
        }
        for (const element of next) {
            if (this.selectedElements.has(element)) continue;
            element.setAttribute(STATE_ATTRIBUTE, 'selected');
        }
        this.selectedElements.clear();
        next.forEach((element) => this.selectedElements.add(element));
    }

    private ensureStyle(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
[data-message-author-role="assistant"][data-message-id] .markdown.prose [${STATE_ATTRIBUTE}="selected"] {
  --_reader-atomic-selected-bg: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  --_reader-atomic-selected-bg-strong: color-mix(in srgb, var(--aimd-interactive-selected) 96%, var(--aimd-bg-primary));
  --_reader-atomic-selected-border: color-mix(in srgb, var(--aimd-interactive-primary) 28%, transparent);
  --_reader-atomic-selected-border-strong: color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  --_reader-atomic-selection-effect: inset 0 0 0 1px var(--_reader-atomic-selected-border);
  --_reader-atomic-selection-strong-effect: inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
  --_reader-atomic-formula-effect: inset 0 -0.22em 0 var(--_reader-atomic-selected-bg-strong), inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg);
  box-shadow: var(--_reader-atomic-selection-effect);
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(.katex, .katex-display)[${STATE_ATTRIBUTE}="selected"] {
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: var(--_reader-atomic-formula-effect);
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(code, pre, table, img)[${STATE_ATTRIBUTE}="selected"] {
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: var(--_reader-atomic-selection-strong-effect);
}
`;
        (document.head || document.documentElement).appendChild(style);
    }
}

function isChatGPTAtomicMarkdownCopyShortcut(value: unknown): value is ChatGPTAtomicMarkdownCopyShortcut {
    return value === 'none' || value === 'mod-c' || value === 'mod-shift-c';
}

function isPrimaryCopyKey(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'c'
        && (event.metaKey || event.ctrlKey)
        && !event.altKey;
}

function isEditableTarget(target: EventTarget | null): boolean {
    const element = target instanceof HTMLElement ? target : document.activeElement;
    if (!(element instanceof HTMLElement)) return false;
    return element instanceof HTMLInputElement
        || element instanceof HTMLTextAreaElement
        || element.isContentEditable
        || Boolean(element.closest('input, textarea, [contenteditable]:not([contenteditable="false"])'));
}

function resolveLocalizedLabel(translated: string, key: string, fallback: string): string {
    return !translated || translated === key ? fallback : translated;
}
